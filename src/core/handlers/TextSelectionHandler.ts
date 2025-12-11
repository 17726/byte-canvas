/**
 * src/core/handlers/TextSelectionHandler.ts（有状态交互处理器）
   处理文本选区相关的交互细节，维护编辑状态和选区状态，响应连续 DOM 事件流。
 */

import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';
import {
  NodeType,
  type InlineStyleProps,
  type TextDecorationValue,
  type TextState,
} from '@/types/state';
import { nextTick } from 'vue';
import type { TransformHandler } from './TransformHandler';
import type { ViewportHandler } from './ViewportHandler';
//import { TextService } from '../services/TextService';
type CanvasStore = ReturnType<typeof useCanvasStore>;
type TextGlobalStyleProps = Partial<
  Pick<
    TextState['props'],
    | 'fontFamily'
    | 'fontSize'
    | 'fontWeight'
    | 'fontStyle'
    | 'color'
    | 'lineHeight'
    | 'textDecoration'
  >
>;

// 有状态处理器：维护交互过程中的中间状态
export class TextSelectionHandler {
  // 私有属性：存储构造函数传入的依赖（供内部方法使用）
  private store: CanvasStore;
  private selectionStore: ReturnType<typeof useSelectionStore>;
  private transformHandler: TransformHandler; // 用于互斥判断（拖拽/缩放状态）
  private viewportHandler: ViewportHandler; // 用于互斥判断（平移状态）

  // 公开状态：供 ToolManager/组件访问
  public isEditing = false;
  public currentSelection: { start: number; end: number } | null = null;

  // 私有状态：内部使用
  private isClickingToolbar = false;
  // 新增：维护所有editor的ref映射，key=节点ID，value=DOM元素
  private editors: Record<string, HTMLElement | null> = {};
  // 全局监听器引用计数（避免重复添加/移除）
  private globalListenerRefCount = 0;

  /**
   * 构造函数（适配 ToolManager 实例化参数）
   * @param store - CanvasStore 实例（用于获取节点数据、更新全局状态）
   * @param transformHandler - TransformHandler 实例（用于互斥判断：拖拽/缩放状态）
   * @param viewportHandler - ViewportHandler 实例（用于互斥判断：平移状态）
   */
  constructor(
    store: CanvasStore,
    transformHandler: TransformHandler,
    viewportHandler: ViewportHandler,
    selectionStore?: ReturnType<typeof useSelectionStore>
  ) {
    // 赋值依赖到私有属性（供内部方法使用）
    this.store = store;
    this.selectionStore = selectionStore || useSelectionStore();
    this.transformHandler = transformHandler;
    this.viewportHandler = viewportHandler;

    // 关键：绑定事件方法的 this 指向（避免事件触发时丢失实例上下文）
    this.handleGlobalMousedown = this.handleGlobalMousedown.bind(this);
  }

  // 接收nodeId和对应的editor，存入映射
  init(nodeId: string, editor: HTMLElement | null) {
    this.editors[nodeId] = editor; // 按节点ID存储editor

    // 只在第一次调用时添加全局监听器
    if (this.globalListenerRefCount === 0) {
      document.addEventListener('mousedown', this.handleGlobalMousedown, true);
    }
    this.globalListenerRefCount++;
  }

  // 公共方法，更新全局选区
  updateGlobalSelection(selection: { start: number; end: number } | null) {
    //console.log('updateGlobalSelection:', selection);
    this.store.updateGlobalTextSelection(selection);
  }

  /**
   * 进入文本编辑态（接收 id 参数）
   * @param e 鼠标事件
   * @param id 文本节点 ID
   */
  public enterEditing(event: MouseEvent, id: string) {
    if (this.transformHandler.isTransforming || this.viewportHandler.isPanning) {
      return;
    }
    // console.log('刚进入编辑态 currentSelection:', JSON.stringify(this.currentSelection));
    // 通过 id 获取节点
    const node = this.store.nodes[id] as TextState;
    if (!node || node.type !== NodeType.TEXT) return;

    event.stopPropagation();
    const isSelected = this.selectionStore.activeElementIds.has(id);
    if (!isSelected) this.selectionStore.setActive([id]);

    this.isEditing = true;

    const editor = this.editors[id];
    nextTick(() => {
      if (editor) {
        // 1. DOM 层面全选文本（原有逻辑不变）
        editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        //console.log('editor节点：', editor);
        range.selectNodeContents(editor); // 选中编辑器内所有内容
        selection?.removeAllRanges();
        selection?.addRange(range);
        // console.log('双击全选');

        // 2. 更新 currentSelection 为「全部文本范围」
        const content = node.props.content || ''; // 获取文本内容
        const contentLength = content.length; // 文本总长度（全选的 end 索引）
        // console.log('文本内容长度 contentLength:', contentLength);
        // 调用方法更新 currentSelection
        this.setCurrentSelection({
          start: 0, // 全选从索引 0 开始
          end: contentLength, // 全选到文本长度结束（符合你的 inlineStyles 规则：end 排除）
        });
        // 3. 关键同步：更新 Pinia 全局的 globalTextSelection（响应式状态）
        this.store.updateGlobalTextSelection({
          start: 0, // 全选从索引 0 开始
          end: contentLength, // 全选到文本长度结束（符合你的 inlineStyles 规则：end 排除）
        });
        // console.log('进入编辑态更新后 currentSelection:', JSON.stringify(this.currentSelection));
      }
    });
  }

  exitEditing() {
    this.isEditing = false;
    this.setCurrentSelection(null);
    this.updateGlobalSelection(null);
  }

  /**
   * 处理鼠标按下事件
   * @param e 鼠标事件
   */
  handleMouseDown(e: MouseEvent) {
    if (!this.isEditing) {
      // 非编辑态阻止文本框单击聚焦（避免单击时光标出现，不进入编辑态）
      e.preventDefault();
    }
  }

  /**
   * 处理鼠标移动事件
   * @param e 鼠标事件
   */
  handleMouseMove(e: MouseEvent) {
    if (this.isEditing) {
      e.stopPropagation();
    }
    //console.log('处理文本节点的handleMouseMove');
  }

  /**
   * 处理鼠标抬起并计算选区
   * @param e 鼠标事件
   */
  handleMouseUpAndSelection(e: MouseEvent, id: string) {
    if (this.isEditing) {
      e.stopPropagation();
      // 延迟处理选区变化，让浏览器先处理完点击事件（清除全选等）
      nextTick(() => {
        this.handleSelectionChange(id);
      });
    }
    //console.log('处理文本节点的handleMouseUpAndSelection');
  }

  /**
   * 处理文本选区变化（接收 id 参数）
   * @param id 文本节点 ID
   */
  public handleSelectionChange(id: string) {
    const editor = this.editors[id];
    if (!this.isEditing || !editor) {
      this.currentSelection = null;
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.currentSelection = null;
      return;
    }
    /**
     * 选区范围校验：确保选中的内容「在当前编辑器内」
     * 避免用户选中编辑器外的内容（比如页面其他文字）时误触发
     */
    const range = selection.getRangeAt(0); // 获取第一个（也是唯一）选区的范围
    if (!editor.contains(range.commonAncestorContainer)) {
      /**
       * commonAncestorContainer：选区内所有节点的共同父节点，判断是否在编辑器内
       */
      this.currentSelection = null;
      return;
    }

    // 1. 先修正getTextOffset的传参（直接传节点，而非content+parent，保证精准）
    const startTargetNode = range.startContainer;
    const endTargetNode = range.endContainer;

    // 调用修复后的getTextOffset（传目标节点+编辑器根节点，递归计算baseOffset）
    const startBaseOffset = this.getTextOffset(startTargetNode, editor);
    const endBaseOffset = this.getTextOffset(endTargetNode, editor);

    // 2. 统一单位：将range的offset转为字符数（区分文本/元素节点）
    let startLocalOffset = 0; // 节点内的字符数偏移
    let endLocalOffset = 0;

    // 处理startOffset
    if (startTargetNode.nodeType === Node.TEXT_NODE) {
      // 文本节点：offset本身就是字符数，直接用
      startLocalOffset = range.startOffset;
    } else if (startTargetNode.nodeType === Node.ELEMENT_NODE) {
      // 元素节点：递归计算插入索引对应的字符数
      startLocalOffset = this.calculateInsertOffsetToChars(startTargetNode, range.startOffset);
    }

    // 处理endOffset（逻辑和start完全一致）
    if (endTargetNode.nodeType === Node.TEXT_NODE) {
      endLocalOffset = range.endOffset;
    } else if (endTargetNode.nodeType === Node.ELEMENT_NODE) {
      endLocalOffset = this.calculateInsertOffsetToChars(endTargetNode, range.endOffset);
    }

    // 3. 统一单位后相加，得到最终的全局字符索引
    const startTextOffset = startBaseOffset + startLocalOffset;
    const endTextOffset = endBaseOffset + endLocalOffset;

    // 统一选区方向：确保 start ≤ end（用户可能从后往前选，比如从第8个字符选到第2个）
    const start = Math.min(startTextOffset, endTextOffset); // 取较小值为真正的起始
    const end = Math.max(startTextOffset, endTextOffset); // 取较大值为真正的结束
    // console.log('计算得到的选区：', { start, end });

    // 保存有效选区：只有「真正选中文字」（start < end）才保存
    if (start < end) {
      this.setCurrentSelection({ start, end }); // 比如 { start:2, end:8 } 表示选中第2-8个字符
    } else {
      this.currentSelection = null; // 无有效选中（比如选中长度为0）
    }

    // 同步选区到全局状态：让其他功能（比如设置字体样式）能获取当前选区
    const isActive = this.selectionStore.activeElements[0]?.id === id || this.isEditing;
    if (isActive && this.currentSelection) {
      //console.log('handler中updateGlobalSelection：', this.currentSelection);
      this.updateGlobalSelection(this.currentSelection);
    } else {
      this.updateGlobalSelection(null);
    }
  }

  /**
   * 处理文本框点击事件
   * @param e 鼠标事件
   * @param node 文本节点数据
   */
  handleTextBoxClick(e: MouseEvent, id: string) {
    const editor = this.editors[id];
    if (!this.isEditing) {
      //console.log('没有在编辑状态');
      // 阻止文本框聚焦（避免单击时光标出现，不进入编辑态）
      //e.preventDefault();

      // 执行选中逻辑（单击的核心需求）
      const isSelected = this.selectionStore.activeElementIds.has(id);
      if (!isSelected) this.selectionStore.setActive([id]);
      // 强制让文本框失焦（兜底，避免意外聚焦）
      editor?.blur();
    } else {
      if (this.currentSelection && this.currentSelection.end - this.currentSelection.start > 0) {
        e.preventDefault();
        e.stopPropagation();
        //console.log('拦截了选中文本导致的错误click');
        return;
      }
      // 编辑状态下，正常响应点击（选中文本、输入等）
      //console.log('处于编辑态 正常响应点击');
      e.stopPropagation();

      // 修复：点击时如果当前是全选状态，清除全选并将光标设置到点击位置
      // 使用 nextTick 确保在浏览器处理完点击事件后再处理
      nextTick(() => {
        if (editor) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // 检查是否是全选状态（选区覆盖整个编辑器内容）
            const editorText = editor.textContent || '';
            const selectedText = range.toString();

            // 如果选中的文本长度等于编辑器文本长度，说明是全选
            if (selectedText.length === editorText.length && editorText.length > 0) {
              // 尝试获取点击位置的文本节点和偏移量
              let targetNode: Node | null = null;
              let offset = 0;

              // 使用 document.caretPositionFromPoint (Firefox) 或 document.caretRangeFromPoint (Chrome)
              if (document.caretPositionFromPoint) {
                const caretPos = document.caretPositionFromPoint(e.clientX, e.clientY);
                if (caretPos) {
                  targetNode = caretPos.offsetNode;
                  offset = caretPos.offset;
                }
              } else {
                // TypeScript 类型定义中可能没有 caretRangeFromPoint，使用类型断言
                const doc = document as Document & {
                  caretRangeFromPoint?: (x: number, y: number) => Range | null;
                };
                if (doc.caretRangeFromPoint) {
                  const clickRange = doc.caretRangeFromPoint(e.clientX, e.clientY);
                  if (clickRange) {
                    targetNode = clickRange.startContainer;
                    offset = clickRange.startOffset;
                  }
                }
              }

              // 如果成功获取到点击位置，设置光标到该位置
              if (targetNode && editor.contains(targetNode)) {
                const newRange = document.createRange();
                newRange.setStart(targetNode, offset);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                // 更新选区状态（清除全选）
                this.handleSelectionChange(id);
              } else {
                // 降级方案：将光标设置到文本末尾
                const lastTextNode = this.getLastTextNode(editor);
                if (lastTextNode) {
                  const textLength = lastTextNode.textContent?.length || 0;
                  const newRange = document.createRange();
                  newRange.setStart(lastTextNode, textLength);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                  // 更新选区状态（清除全选）
                  this.handleSelectionChange(id);
                }
              }
            }
          }
        }
      });
    }
  }

  /**
   * 判断当前文本节点是否可以直接进入编辑态
   * - 顶层文本节点（没有 parentId）始终允许
   * - 组合子节点只有在父组合已经处于编辑模式时才允许
   */
  canEnterEditingDirectly = (id: string) => {
    const node = this.store.nodes[id];
    if (!node) return;

    const parentId = node.parentId;
    if (!parentId) return true;

    return this.selectionStore.editingGroupId === parentId;
  };

  /**
   * 递归计算元素节点内「插入索引」对应的字符数（统一单位为字符数）
   * @param elementNode 元素节点（如根DIV/SPAN）
   * @param insertIndex 元素节点内的插入索引（range.startOffset/range.endOffset）
   * @returns 插入索引前的累计字符数（\n计1）
   */
  private calculateInsertOffsetToChars = (elementNode: Node, insertIndex: number): number => {
    let totalChars = 0;
    const childNodes = Array.from(elementNode.childNodes);

    // 遍历到插入索引前的所有子节点（递归计算字符数）
    for (let i = 0; i < insertIndex; i++) {
      const child = childNodes[i];
      if (!child) continue;
      // 1. 文本节点：直接累加字符数（排除空文本）
      if (child.nodeType === Node.TEXT_NODE) {
        const textLength = child.textContent?.trim() === '' ? 0 : child.textContent?.length || 0;
        totalChars += textLength;
      }
      // 2. BR节点：对应\n，累加1个字符
      else if (child.nodeName === 'BR') {
        totalChars += 1;
      }
      // 3. 其他元素节点（如嵌套SPAN/DIV）：递归遍历其子节点
      else if (child.nodeType === Node.ELEMENT_NODE) {
        // 元素节点本身无字符数，但要递归计算其内部所有子节点的字符数
        totalChars += this.calculateInsertOffsetToChars(child, child.childNodes.length);
      }
    }
    return totalChars;
  };

  /**
   * 新增：保存完整的选区 Range（支持选中一段文本 + 光标）
   * 区别于仅保存光标，此方法保存完整的选区范围，恢复后能保留文本选中的视觉效果
   */
  /**
   * 重写：保存选区的静态序列化信息（避免 Range 活引用失效）
   * @param id 文本节点ID
   * @returns 静态序列化数据（无活引用，不会被浏览器修改）
   */
  saveFullSelection(id: string): {
    isCollapsed: boolean; // 是否是光标（折叠选区）
    startOffset: number; // 选区起始的「文本逻辑索引」（整个文本的第n个字符）
    endOffset: number; // 选区结束的「文本逻辑索引」
    nodeText: string; // 光标/选区所在文本节点的内容（用于匹配新DOM）
  } | null {
    const editor = this.editors[id];
    const node = this.store.nodes[id] as TextState | undefined;
    if (!editor || !node || !this.isEditing) return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);

    // console.log('===== Range 关键信息 =====');
    // console.log(
    //   'startContainer节点类型：',
    //   range.startContainer.nodeType === 3 ? '文本节点' : '元素节点'
    // );
    // console.log('startContainer节点名称：', range.startContainer.nodeName);
    // console.log('startOffset：', range.startOffset);
    // console.log('是否是光标（collapsed）：', range.collapsed);

    // 1. 先修正getTextOffset的传参（直接传节点，而非content+parent，保证精准）
    const startTargetNode = range.startContainer;
    const endTargetNode = range.endContainer;

    // 调用修复后的getTextOffset（传目标节点+编辑器根节点，递归计算baseOffset）
    const startBaseOffset = this.getTextOffset(startTargetNode, editor);
    const endBaseOffset = this.getTextOffset(endTargetNode, editor);

    // 2. 统一单位：将range的offset转为字符数（区分文本/元素节点）
    let startLocalOffset = 0; // 节点内的字符数偏移
    let endLocalOffset = 0;

    // 处理startOffset
    if (startTargetNode.nodeType === Node.TEXT_NODE) {
      // 文本节点：offset本身就是字符数，直接用
      startLocalOffset = range.startOffset;
    } else if (startTargetNode.nodeType === Node.ELEMENT_NODE) {
      // 元素节点：递归计算插入索引对应的字符数
      startLocalOffset = this.calculateInsertOffsetToChars(startTargetNode, range.startOffset);
    }

    // 处理endOffset（逻辑和start完全一致）
    if (endTargetNode.nodeType === Node.TEXT_NODE) {
      endLocalOffset = range.endOffset;
    } else if (endTargetNode.nodeType === Node.ELEMENT_NODE) {
      endLocalOffset = this.calculateInsertOffsetToChars(endTargetNode, range.endOffset);
    }

    // 3. 统一单位后相加，得到最终的全局字符索引
    const startTextOffset = startBaseOffset + startLocalOffset;
    const endTextOffset = endBaseOffset + endLocalOffset;

    // 4. 调试日志（保留并优化）
    // console.log('===== 偏移计算详情 =====');
    // console.log('startBaseOffset（目标节点前累计字符数）=', startBaseOffset);
    // console.log('startLocalOffset（节点内字符数偏移）=', startLocalOffset);
    // console.log('range.startOffset（原始offset）=', range.startOffset);
    // console.log('endBaseOffset（目标节点前累计字符数）=', endBaseOffset);
    // console.log('endLocalOffset（节点内字符数偏移）=', endLocalOffset);
    // console.log('range.endOffset（原始offset）=', range.endOffset);
    // console.log('最终保存的光标位置：', Math.max(0, startTextOffset), Math.max(0, endTextOffset));
    return {
      isCollapsed: range.collapsed, // 是否是光标（折叠）
      startOffset: Math.max(0, startTextOffset),
      endOffset: Math.max(0, endTextOffset),
      nodeText: range.startContainer.textContent || '', // 保存节点文本（兜底匹配）
    };
  }

  /**
   * 重写：基于静态序列化信息恢复选区/光标（彻底解决 Range 失效问题）
   * @param savedData 保存的静态序列化信息
   * @param id 文本节点ID
   */
  restoreFullSelection(savedData: ReturnType<typeof this.saveFullSelection>, id: string) {
    if (!savedData || !this.isEditing) return;

    const editor = this.editors[id];
    const node = this.store.nodes[id] as TextState | undefined;
    if (!editor || !node) return;

    const selection = window.getSelection();
    if (!selection) return;

    // 关键：nextTick 等待 DOM 重渲染完成
    nextTick(() => {
      try {
        // 核心：根据「文本逻辑索引」在新 DOM 中创建全新 Range
        const newRange = this.createRangeFromTextOffsets(
          editor,
          savedData.startOffset,
          savedData.endOffset
        );
        // console.log('到这里了newRange:', newRange);
        if (newRange) {
          // 恢复选区/光标（折叠则是光标，非折叠则是选中）
          if (savedData.isCollapsed) {
            newRange.collapse(true);
          }
          selection.removeAllRanges();
          selection.addRange(newRange);
          // console.log('选区恢复成功:', newRange);
        } else {
          // 降级：定位到文本末尾
          this.fallbackToTextEnd(editor, selection);
        }
      } catch (e) {
        console.log('恢复选区失败，降级到文本末尾', e);
        this.fallbackToTextEnd(editor, selection);
      }
    });
  }

  /**
   * 修正版：计算目标节点在整个文本中的绝对偏移量（包含 \n 计1个字符）
   * @param targetNode 目标节点（直接传Range的startContainer/endContainer，不再传文本内容+父元素）
   * @param root 编辑器根节点
   * @returns 目标节点在整个文本中的起始偏移（\n 计1个字符）
   */
  private getTextOffset = (
    targetNode: Node, // 核心修改：传目标节点实例，而非文本内容+父元素
    root: HTMLElement
  ): number => {
    let totalOffset = 0; // 累计偏移量
    let foundTarget = false; // 是否找到目标节点

    // 递归遍历所有节点（文本+元素），计算偏移量
    const traverseNodes = (node: Node): boolean => {
      if (foundTarget) return true; // 已找到目标节点，终止遍历

      // 1. 匹配到目标节点：标记并终止遍历（核心修改：节点实例匹配，而非内容+父元素）
      if (node === targetNode) {
        foundTarget = true;
        return true;
      }

      // 2. 文本节点：累加字符数（保留原有规则，排除空文本更严谨）
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        totalOffset += textLength;
        return false;
      }

      // 2. 元素节点：处理换行相关标签
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        // <br> 对应 \n，偏移量+1
        if (el.nodeName === 'BR') {
          totalOffset += 1;
          return false;
        }
        // <div> 对应换行，偏移量+1（块级换行） 仅对「根节点的子节点中的DIV」计数，跳过根节点本身
        if (el.nodeName === 'DIV' && el !== root) {
          totalOffset += 1;
        }

        // 递归遍历子节点
        for (const child of el.childNodes) {
          const found = traverseNodes(child);
          if (found) {
            foundTarget = true; // 标记全局找到，避免其他分支继续遍历
            return true;
          }
        }
      }

      return false;
    };

    // 从根节点开始遍历
    traverseNodes(root);
    return totalOffset;
  };

  /**
   * 核心修改：根据文本偏移量创建Range（包含 \n 计1个字符）
   * @param editor 编辑器根节点
   * @param startOffset 起始偏移（\n 计1个字符）
   * @param endOffset 结束偏移（\n 计1个字符）
   * @returns 匹配的Range对象
   */
  private createRangeFromTextOffsets(
    editor: HTMLElement,
    startOffset: number,
    endOffset: number
  ): Range | null {
    // console.log('传入createRangeFromTextOffsets的光标位置：', startOffset, endOffset);
    const range = document.createRange();
    let currentOffset = 0; // 当前累计偏移量
    let lastTextNode: Node | null = null; // 记录最后一个文本节点（兜底用）
    let lastElementNode: Node | null = null; // 记录最后一个元素节点（兜底用）

    // 存储找到的起始/结束位置
    interface Position {
      node: Node;
      offset: number;
    }
    let startPos: Position | null = null;
    let endPos: Position | null = null;

    // 递归遍历所有节点，找到对应偏移量的位置
    const traverseForOffset = (node: Node) => {
      // 已找到起始+结束位置，终止遍历
      if (startPos && endPos) return;

      // 记录最后一个节点（兜底用）
      if (node.nodeType === Node.TEXT_NODE) {
        lastTextNode = node;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        lastElementNode = node;
      }

      // 1. 处理字符偏移
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const textLength = text.length;

        // 找起始位置
        if (!startPos && currentOffset + textLength >= startOffset) {
          startPos = {
            node,
            offset: startOffset - currentOffset, // 节点内相对偏移
          };
        }

        // 找结束位置
        if (!endPos && currentOffset + textLength >= endOffset) {
          endPos = {
            node,
            offset: endOffset - currentOffset,
          };
        }

        // 累加偏移量
        currentOffset += textLength;
        // console.log('文本节点：', JSON.stringify(text), '累计偏移：', currentOffset);
        return;
      }

      // 2. 元素节点：处理换行标签
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;

        // <br> 对应 \n，计1个字符
        if (el.nodeName === 'BR') {
          // 起始位置落在当前 <br>
          if (!startPos && currentOffset + 1 >= startOffset) {
            // 不定位到BR本身，而是定位到BR的父节点 + BR的索引+1
            const brParent = el.parentElement;
            if (!brParent) return;
            const brIndex = Array.from(brParent.childNodes).indexOf(el);
            startPos = {
              node: brParent, // 父节点（根DIV）
              offset: brIndex + 1, // BR索引+1 → BR后面的位置
            };
          }
          // 结束位置落在当前 <br>
          if (!endPos && currentOffset + 1 >= endOffset) {
            const brParent = el.parentElement;
            if (!brParent) return;
            const brIndex = Array.from(brParent.childNodes).indexOf(el);
            endPos = {
              node: brParent,
              offset: brIndex + 1,
            };
          }
          currentOffset += 1; // 偏移量+1
          // console.log('BR节点：累计偏移：', currentOffset); // 调试日志
          return;
        }

        // <div> 对应换行，计1个字符（修复匹配逻辑 + 排除根节点）
        if (el.nodeName === 'DIV' && el !== editor) {
          // 修复：匹配条件改为 currentOffset +1 >= startOffset
          if (!startPos && currentOffset + 1 >= startOffset) {
            startPos = { node, offset: 0 };
          }
          if (!endPos && currentOffset + 1 >= endOffset) {
            endPos = { node, offset: 0 };
          }
          currentOffset += 1; // 累加偏移量
          // console.log('DIV节点：累计偏移：', currentOffset); // 调试日志
        }

        // 递归遍历子节点
        for (const child of el.childNodes) {
          traverseForOffset(child);
        }
      }
    };

    // 从编辑器根节点开始遍历
    traverseForOffset(editor);
    // console.log(
    //   '遍历结束后累计偏移：',
    //   currentOffset,
    //   '遍历结束后定位的光标位置：',
    //   startPos,
    //   endPos
    // );
    // 核心兜底：未找到位置时，定位到最后一个节点的末尾
    if (!startPos) {
      // 优先用最后一个文本节点
      if (lastTextNode) {
        const textLength = ((lastTextNode as Node).textContent || '').length;
        startPos = { node: lastTextNode, offset: textLength };
        endPos = startPos;
      } else if (lastElementNode) {
        // 没有文本节点，用最后一个元素节点
        startPos = { node: lastElementNode, offset: 0 };
        endPos = startPos;
      } else {
        // 编辑器为空，定位到根节点
        startPos = { node: editor, offset: 0 };
        endPos = startPos;
      }
      // console.log('兜底后的光标位置：', startPos, endPos);
    }
    // 设置Range的起始/结束位置
    range.setStart((startPos as Position).node, (startPos as Position).offset);
    range.setEnd((endPos as Position).node, (endPos as Position).offset);

    return range;
  }

  /**
   * 新增：辅助方法 - 兜底到文本末尾
   */
  private fallbackToTextEnd(editor: HTMLElement, selection: Selection) {
    const lastTextNode = this.getLastTextNode(editor);
    if (lastTextNode) {
      const fallbackRange = document.createRange();
      fallbackRange.setStart(lastTextNode, lastTextNode.textContent?.length || 0);
      fallbackRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(fallbackRange);
    }
  }

  /**
   * 辅助方法：在编辑器DOM下，找到「文本内容完全匹配」的文本节点（核心修复）
   * @param root 编辑器根节点（this.editor）
   * @param targetText 保存时的节点文本内容
   */
  private findTextNodeByContent(root: HTMLElement, targetText: string): Node | null {
    // 遍历编辑器下所有文本节点（递归）
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentNode: Node | null;

    while ((currentNode = walker.nextNode())) {
      // 找到文本内容完全匹配的节点（不使用.trim()，避免有空格节点和没空格节点会识别成同一个）
      if (currentNode.textContent === targetText) {
        return currentNode;
      }
    }

    // 找不到时，返回编辑器下第一个文本节点（兜底，避免光标丢了）
    return this.getFirstTextNode(root);
  }

  /**
   * 辅助方法：获取编辑器下第一个文本节点（兜底用）
   */
  private getFirstTextNode(root: HTMLElement): Node | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    return walker.nextNode();
  }

  /**
   * 辅助方法：获取编辑器下最后一个文本节点
   */
  private getLastTextNode(root: HTMLElement): Node | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let lastNode: Node | null = null;
    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      lastNode = currentNode;
    }
    return lastNode;
  }

  /**
   * 处理全局鼠标按下事件（判断是否点击工具栏）
   * @param e 鼠标事件
   */
  handleGlobalMousedown(e: MouseEvent) {
    if (!this.isEditing) return;
    const target = e.target as HTMLElement;
    console.log('全局mousedown事件触发，目标元素：', target.className);
    // 查找工具栏
    const toolbar = document.querySelector('.context-toolbar');
    // 如果工具栏不存在，直接判定为未点击工具栏
    if (!toolbar) {
      this.isClickingToolbar = false;
      console.log('工具栏不存在 isClickingToolbar:', this.isClickingToolbar);
      return;
    }
    // 2. 检查目标是否在工具栏内（最主要的判断）
    if (toolbar.contains(target)) {
      this.isClickingToolbar = true;
      console.log('目标在工具栏内 isClickingToolbar:', this.isClickingToolbar);
      return;
    }
    // 3. 检查是否点击了工具栏相关的弹出层/下拉组件（ArcoDesign组件）
    const relatedSelectors = [
      // 颜色选择器相关
      '.text-color-picker',
      '.arco-color-picker-popup',
      '.arco-color-picker-palette',
      '.arco-color-picker-control-bar',
      '.arco-color-picker-control-bar-alpha',
      '.arco-color-picker-handler',
      '.arco-color-picker-preview',
      '.arco-color-picker-panel-control',
      '.arco-color-picker-control-wrapper',
      // 字体选择器相关
      '.font-family-selector',
      '.arco-select-popup',
      '.arco-select-option',
      '.arco-select-option-active',
      '.arco-select-option-content',
      '.font-family-dropdown',
      '.arco-scrollbar-thumb-bar',
      '.arco-scrollbar-track-direction-vertical',
      '.arco-scrollbar-track',
      // ArcoDesign下拉箭头
      '.arco-select-view-arrow-icon',
      // Tooltip/Popover弹出层
      '.arco-tooltip-popup',
      '.arco-popover-popup',
      // 数字输入框按钮
      '.arco-input-number-handler',
      // 滑块组件
      '.arco-slider-rail',
      '.arco-slider-track',
      '.arco-slider-handle',
    ];
    // 4. 检查目标是否是工具栏相关组件
    // 关键修改：遍历所有选择器 + 所有匹配元素，检查是否包含目标
    let isRelatedToToolbar = false;
    for (const selector of relatedSelectors) {
      const elements = document.querySelectorAll(selector);
      // 遍历当前选择器下的所有元素，只要有一个包含target就判定为相关
      const match = Array.from(elements).some((el) => el.contains(target));
      if (match) {
        isRelatedToToolbar = true;
        console.log(`✅ 匹配到相关组件：${selector}`);
        break; // 找到匹配项后提前退出循环
      }
    }
    console.log('isRelatedToToolbar:', isRelatedToToolbar);

    // 5. 额外检查目标元素本身是否有相关类名
    const hasRelatedClass = target.closest(
      '.context-toolbar, .text-color-picker, .font-family-selector, .font-family-dropdown, ' +
        '.arco-color-picker-popup, .arco-select-popup, .arco-select-option, ' + // 补充arco-select-option
        '.arco-tooltip-popup, .arco-popover-popup'
    );
    console.log('是否匹配到相关类 → hasRelatedClass:', !!hasRelatedClass);

    this.isClickingToolbar = isRelatedToToolbar || !!hasRelatedClass;
    console.log('isClickingToolbar:', this.isClickingToolbar);
  }

  /**
   * 处理文本节点失焦（接收 id 参数）
   * @param id 文本节点 ID
   */
  public handleBlur(id: string) {
    const node = this.store.nodes[id];
    const editor = this.editors[id];
    if (!node || !editor) return;

    if (this.isClickingToolbar) {
      editor.focus();
    } else {
      this.isEditing = false;
      if (!this.selectionStore.activeElementIds.has(id)) {
        this.updateGlobalSelection(null);
      }
    }
  }

  /**
   * 检查是否为激活节点
   * @param node 文本节点数据
   * @returns 是否为激活节点
   */
  isActiveNode(id: string): boolean {
    const node = this.store.nodes[id];
    const activeNode = this.selectionStore.activeElements[0];
    const baseActive = activeNode?.id === node!.id;
    // 编辑态时，强制返回true（锁定激活状态）
    return this.isEditing ? true : baseActive;
  }

  /**
   * 移除单个编辑器引用（组件卸载时调用）
   * @param nodeId - 要移除的节点ID
   */
  removeEditor(nodeId: string) {
    delete this.editors[nodeId];
    this.globalListenerRefCount--;

    // 当所有编辑器都被移除时，移除全局监听器
    if (this.globalListenerRefCount <= 0) {
      document.removeEventListener('mousedown', this.handleGlobalMousedown, true);
      this.globalListenerRefCount = 0; // 防止负数
    }
  }

  /**
   * 清理所有状态（全局销毁时调用）
   */
  destroy() {
    this.isEditing = false;
    this.currentSelection = null;
    this.isClickingToolbar = false;
    this.editors = {};

    // 确保移除全局监听器
    if (this.globalListenerRefCount > 0) {
      document.removeEventListener('mousedown', this.handleGlobalMousedown, true);
      this.globalListenerRefCount = 0;
    }
  }

  // 新增：设置选中范围（供外部调用，比如双击全选时）
  setCurrentSelection(selection: { start: number; end: number } | null): void {
    // 可选：添加范围有效性校验（符合你的 inlineStyles 规则）
    if (selection !== null && selection.start >= 0 && selection.end > selection.start) {
      // console.log('设置currentSelection为：', JSON.stringify(selection));
      this.currentSelection = selection;
    } else {
      this.currentSelection = null; // 无效范围则置空
    }
  }

  /**
   * 辅助函数：拆分重叠的样式范围（核心解决部分重叠问题）
   * @param originalStyle 原有样式对象（如 {start:0, end:6, styles:{fontWeight:'bold'}}）
   * @param targetStart 要修改的起始位置（如 3）
   * @param targetEnd 要修改的结束位置（如 6）
   * @param styleKey 要移除的样式属性（如 'fontWeight'）
   * @returns 拆分后的样式对象数组
   */
  private splitOverlappingStyle(
    originalStyle: { start: number; end: number; styles: InlineStyleProps },
    targetStart: number,
    targetEnd: number,
    styleKey: keyof InlineStyleProps,
    styleValue: InlineStyleProps[keyof InlineStyleProps] // 新增：接收styleValue
  ): Array<{ start: number; end: number; styles: InlineStyleProps }> {
    const { start: origStart, end: origEnd, styles: origStyles } = originalStyle;
    const newStyles = [];

    // 情况1：原有范围左侧有不重叠部分（如 origStart=0, targetStart=3 → 0-3 保留原样式）
    if (origStart < targetStart) {
      console.log('添加左侧不重叠部分:', origStart, targetStart);
      newStyles.push({
        start: origStart,
        end: targetStart,
        styles: { ...origStyles }, // 保留原样式
      });
    }

    // 情况2：重叠部分（如 3-6）→ 移除目标样式属性
    if (targetStart <= origEnd && targetEnd >= origStart) {
      const overlapStart = Math.max(origStart, targetStart);
      const overlapEnd = Math.min(origEnd, targetEnd);
      // 移除目标属性，保留其他样式
      const remainingStyles = { ...origStyles };

      //console.log('remaining:', remainingStyles);

      // 处理textDecoration多值移除
      if (styleKey === 'textDecoration' && styleValue) {
        const targetValue = styleValue.toString().trim();
        const origValues = remainingStyles.textDecoration?.toString().split(/\s+/) || [];
        const hasTargetDecoration = origValues.includes(targetValue);
        //console.log('targetValue:', targetValue);
        //console.log('origValues:', origValues);
        //console.log('hasTargetDecoration:', hasTargetDecoration);
        if (hasTargetDecoration) {
          // 已有，过滤掉目标值，保留其他值（如移除underline，保留line-through）
          const newValues = origValues.filter((v) => v !== targetValue);
          if (newValues.length > 0) {
            remainingStyles.textDecoration = newValues.join(' ') as TextDecorationValue;
          } else {
            // 无剩余值则删除整个属性
            delete remainingStyles.textDecoration;
          }
        }
      } else {
        // 非textDecoration：删除整个属性（原有逻辑）
        delete remainingStyles[styleKey];
        //console.log('已删除原有属性');
        //console.log('删除后的remaining:', remainingStyles);
        //console.log('删除后的remaining长度:', Object.keys(remainingStyles).length);
      }

      if (Object.keys(remainingStyles).length > 0 && overlapStart < overlapEnd) {
        newStyles.push({
          start: overlapStart,
          end: overlapEnd,
          styles: remainingStyles,
        });
        console.log(
          '添加重叠部分剩余样式:',
          overlapStart,
          overlapEnd,
          JSON.stringify(remainingStyles)
        );
      }
      // 若剩余样式为空，则不添加该范围（相当于移除重叠部分的样式）
    }

    // 情况3：原有范围右侧有不重叠部分（如 origEnd=6, targetEnd=6 → 无右侧部分；若 origEnd=8, targetEnd=6 → 6-8 保留原样式）
    if (origEnd > targetEnd) {
      newStyles.push({
        start: targetEnd,
        end: origEnd,
        styles: { ...origStyles }, // 保留原样式
      });
    }
    console.log('newStyles:', JSON.stringify(newStyles));
    return newStyles;
  }

  updatePartialInlineStyle(
    id: string,
    store: CanvasStore,
    styleKey: keyof InlineStyleProps,
    styleValue: InlineStyleProps[keyof InlineStyleProps],
    toggle = true
  ) {
    //console.log('开始处理部分属性');
    // ========== 新增：第一步：修改前保存完整选区 ==========
    const savedData = this.saveFullSelection(id);
    //console.log('保存后savedRange:', savedData);
    // 1. 安全校验：获取有效文本节点（原有逻辑）
    const node = store.nodes[id] as TextState | undefined;
    if (!node || node.type !== NodeType.TEXT) return;

    const { content, inlineStyles = [] } = node.props;
    const contentLength = content.length;

    // 2. 获取并处理选中范围（越界修正 + 空范围过滤）（原有逻辑）
    const selection = this.currentSelection;
    if (!selection || selection.start >= selection.end) return;

    let { start: selectionStart, end: selectionEnd } = selection;
    selectionStart = Math.max(0, selectionStart);
    selectionEnd = Math.min(contentLength, selectionEnd);
    if (selectionStart >= selectionEnd) return;

    // ===================== 修复核心：全局样式联动逻辑 =====================
    // 2.1 提取全局样式当前值
    const globalStyleValue = (node.props as TextGlobalStyleProps)[styleKey];
    //console.log('全局样式值：', globalStyleValue);
    // 标记是否需要取消全局样式
    let needClearGlobalStyle = false;
    // 存储从全局拆分出的内联样式（未选中区域+选中区域）
    let globalSplitStyles: Array<{ start: number; end: number; styles: InlineStyleProps }> = [];

    // 仅当全局存在该样式属性时，执行拆分逻辑
    if (globalStyleValue !== undefined) {
      needClearGlobalStyle = true; // 标记需要取消全局样式

      // ========== 步骤1：未选中区域始终保留原全局样式值 ==========
      const unselectedRanges = [
        { start: 0, end: selectionStart, value: globalStyleValue },
        { start: selectionEnd, end: contentLength, value: globalStyleValue },
      ];
      // 为未选中区域创建内联样式（过滤空范围）
      const unselectedStyles = unselectedRanges
        .filter((range) => range.start < range.end)
        .map((range) => ({
          start: range.start,
          end: range.end,
          styles: { [styleKey]: range.value } as InlineStyleProps,
        }));

      // ========== 步骤2：根据 toggle + 全局值与目标值的关系处理选中区域 ==========
      // toggle==true 原封不动把全局属性传进去 toggle==false 不加入
      let selectedStyles: Array<{ start: number; end: number; styles: InlineStyleProps }> = [];
      if (toggle)
        selectedStyles = [
          {
            start: selectionStart,
            end: selectionEnd,
            styles: { [styleKey]: globalStyleValue } as InlineStyleProps,
          },
        ];
      // ========== 合并：未选中区域样式 + 选中区域样式 ==========
      globalSplitStyles = [...unselectedStyles, ...selectedStyles]; //从全局属性中拆出来的三部分 要加入到内联样式数组中
    }
    //console.log('globalSplitStyles:', JSON.stringify(globalSplitStyles));
    // ===================== 预处理现有样式（无修改） =====================
    const validInlineStyles = [
      ...inlineStyles.filter((style) => style.start < style.end),
      ...globalSplitStyles,
    ]; //原有内联样式数组+全局拆分处理得到的内联样式数组（就是对全局样式做简单拆分）
    //console.log('validInlineStyles:', JSON.stringify(validInlineStyles));

    // 4. 处理范围重叠
    const updatedStyles: Array<{ start: number; end: number; styles: InlineStyleProps }> = [];
    //console.log('初始updatedstyles:', JSON.stringify(updatedStyles));

    for (const style of validInlineStyles) {
      if (style.end <= selectionStart || style.start >= selectionEnd) {
        //完全不在选中范围内（无重叠） 直接保留
        updatedStyles.push(style);
        //console.log('style:', JSON.stringify(style));
        //console.log('updatedstyles:', JSON.stringify(updatedStyles));
        continue;
      }

      //有范围重叠 得到所有范围要【保留】的原样式属性
      const splitStyles = this.splitOverlappingStyle(
        style,
        selectionStart,
        selectionEnd,
        styleKey,
        styleValue
      );
      updatedStyles.push(...splitStyles);
      console.log('splitStyles:', JSON.stringify(splitStyles));
      console.log('处理重叠范围后的updatedstyles:', JSON.stringify(updatedStyles));
    }

    //5. 处理样式的【添加】
    // 步骤1：判断选中区域是否已存在目标样式值（兼容textDecoration多值）
    let hasTargetStyle = false;
    // 遍历现有样式，检查选中范围内是否包含目标值 valid没有进行分隔 如果仅检查下面这个范围，部分重叠的不会被检查到
    for (const style of validInlineStyles) {
      // 仅检查与选中区域重叠的样式
      if (style.start < selectionEnd && style.end > selectionStart) {
        if (styleKey === 'textDecoration' && styleValue) {
          // textDecoration特判：判断是否包含目标值（而非全等）
          const targetValue = styleValue.toString().trim();
          console.log('targetValue:', targetValue);
          const currentTextDeco = style.styles.textDecoration;
          console.log('currentTextDeco:', currentTextDeco);
          if (currentTextDeco) {
            const currentValues = currentTextDeco.toString().split(/\s+/).filter(Boolean);
            if (currentValues.includes(targetValue)) {
              hasTargetStyle = true;
              break; // 找到目标值，终止遍历
            }
          }
        } else {
          // 普通属性：判断是否存在该属性且值完全匹配
          if (style.styles[styleKey] === styleValue) {
            hasTargetStyle = true;
            break;
          }
        }
      }
    }
    console.log('hasTargetStyle:', hasTargetStyle);

    if (toggle) {
      if (!hasTargetStyle) {
        //特殊处理textDecoration多值添加 只要有重叠就要拆【新样式】 逻辑和前面拆全局是一样的
        if (styleKey === 'textDecoration' && styleValue) {
          let isOverlapping = false; // 标记是否有重叠
          let shouldAddLastStyle = true; // 标记是否需要添加最后一段样式

          // 遍历updatedStyles，拆分新属性的重叠部分并添加
          const finalNewStyles: Array<{ start: number; end: number; styles: InlineStyleProps }> =
            [];
          let newDecorationStyle = {
            start: selectionStart,
            end: selectionEnd,
            styles: { [styleKey]: styleValue } as InlineStyleProps,
          };
          for (const style of updatedStyles) {
            if (
              style.end <= selectionStart ||
              style.start >= selectionEnd ||
              style.styles.textDecoration === undefined
            ) {
              //旧decoratio完全不在选中范围内（无重叠） 直接添加新decoration即可
              continue;
            }
            //有范围重叠 拆分要【添加】的【新样式】
            isOverlapping = true;
            const splitNewStyles = this.splitOverlappingStyle(
              newDecorationStyle,
              style.start,
              style.end,
              'textDecoration',
              style.styles.textDecoration as TextDecorationValue // 传入旧的textDecoration值
            );
            console.log('拆分后的新值 splitNewStyles:', JSON.stringify(splitNewStyles));
            if (style.end === selectionEnd) {
              shouldAddLastStyle = false;
              finalNewStyles.push(...splitNewStyles);
            } else {
              for (let i = 0; i < splitNewStyles.length - 1; i++) {
                const ns = splitNewStyles[i];
                if (!ns) continue;
                finalNewStyles.push(ns);
              }
              newDecorationStyle = splitNewStyles[splitNewStyles.length - 1]!;
            }
            //finalNewStyles.push(...splitNewStyles);
            //这里有问题 只要遍历到有重叠的就会拆一次，存进finalNewStyles，最后会有很多重复的范围, 改成上面这样
          }
          if (newDecorationStyle && shouldAddLastStyle && isOverlapping)
            finalNewStyles.push(newDecorationStyle); // 添加最后剩余的部分
          console.log('finalNewStyles before check:', JSON.stringify(finalNewStyles));
          console.log('isOverlapping:', isOverlapping);
          // 若没有重叠，直接在选中范围内添加新的textDecoration值
          if (!isOverlapping) {
            finalNewStyles.push({
              start: selectionStart,
              end: selectionEnd,
              styles: { [styleKey]: styleValue } as InlineStyleProps,
            });
          }
          console.log('最终要添加的newStyles:', JSON.stringify(finalNewStyles));
          // finalNewStyles加入updatedStyles中
          updatedStyles.push(...finalNewStyles);
        } else {
          updatedStyles.push({
            start: selectionStart,
            end: selectionEnd,
            styles: { [styleKey]: styleValue } as InlineStyleProps,
          });
        }
      }
      // 若hasTargetStyle=true，说明已有该样式，toggle逻辑下不添加（相当于移除）
    } else {
      updatedStyles.push({
        start: selectionStart,
        end: selectionEnd,
        styles: { [styleKey]: styleValue } as InlineStyleProps,
      });
    }

    // 6. 排序（原有逻辑）
    const finalStyles = updatedStyles
      .filter((style) => style.start < style.end)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    // 7. 更新节点（原有逻辑 + 取消全局样式）
    const updateData: Partial<TextState> = {
      props: {
        ...node.props,
        inlineStyles: finalStyles,
      },
    };

    if (needClearGlobalStyle) {
      (updateData.props as TextGlobalStyleProps)[styleKey] = undefined;
    }

    store.updateNode(id, updateData);
    // ========== 新增：第二步：更新后恢复完整选区 ==========
    //console.log('恢复前savedRange:', savedData);
    this.restoreFullSelection(savedData, id);
  }
  /**
   * 更新文本节点的全局样式属性（同步处理内联样式）
   * 核心规则：
   * 1. 有有效文本选中范围时，不执行任何操作；
   * 2. toggle=false：强制覆盖全局样式，清理所有内联样式中的该属性；
   * 3. toggle=true：
   *    - 若内联样式含该属性但未覆盖全部文本 → 全局应用该样式，清理内联；
   *    - 若内联样式该属性覆盖全部文本 / 全局已应用该属性 → 取消全局+所有内联的该属性；
   * @param id 文本节点ID
   * @param store CanvasStore实例
   * @param styleKey 要修改的样式属性名（对齐内联样式的key）
   * @param styleValue 要修改的样式值（对齐内联样式的value类型）
   * @param toggle 是否智能切换（true=切换，false=强制覆盖）
   */
  updateGlobalStyles(
    id: string,
    store: CanvasStore,
    styleKey: keyof InlineStyleProps,
    styleValue: InlineStyleProps[keyof InlineStyleProps],
    toggle = true
  ) {
    // ========== 新增：第一步：修改前保存完整选区 ==========
    const savedData = this.saveFullSelection(id);
    // ===================== 1. 基础安全校验 =====================
    const node = store.nodes[id] as TextState | undefined;
    if (!node || node.type !== NodeType.TEXT) {
      console.log(`updateGlobalStyles: 节点${id}不存在或非文本节点，跳过更新`);
      return;
    }

    const { props: nodeProps } = node;
    const content = nodeProps.content || '';
    const contentLength = content.length;
    // 无文本内容时直接返回（无需设置样式）
    if (contentLength === 0) {
      console.log(`updateGlobalStyles: 节点${id}无文本内容，跳过更新`);
      return;
    }

    // ===================== 2. 选中范围校验 =====================
    const selection = this.currentSelection;
    console.log(`updateGlobalStyles: 节点${id}当前选中范围:`, JSON.stringify(selection));
    let hasValidSelection = false;
    if (selection) {
      const correctedStart = Math.max(0, selection.start);
      const correctedEnd = Math.min(contentLength, selection.end);
      hasValidSelection = correctedStart < correctedEnd;
    }
    // 有有效选中范围时，不修改全局样式
    if (hasValidSelection) {
      console.log(
        `updateGlobalStyles: 节点${id}存在有效选中范围，跳过更新，selection:`,
        JSON.stringify(selection)
      );
      return;
    }

    // ===================== 3. 分析当前样式状态 =====================
    // 3.1 提取全局样式当前值（显式类型断言，避免类型窄化）
    const currentGlobalValue = (nodeProps as TextGlobalStyleProps)[styleKey] as
      | string
      | number
      | undefined;
    // 3.2 分析内联样式中该属性的覆盖情况
    const inlineStyles = nodeProps.inlineStyles || [];
    // 存储内联样式中该属性的所有有效范围
    const styleRanges: Array<{ start: number; end: number; value: string | number | undefined }> =
      [];

    inlineStyles.forEach((style) => {
      // 过滤出包含目标styleKey的有效内联样式（范围非空）
      if (style.start < style.end && style.styles[styleKey] !== undefined) {
        styleRanges.push({
          start: style.start,
          end: style.end,
          value: style.styles[styleKey],
        });
      }
    });

    // 3.3 判断内联样式是否用该值覆盖了全部文本
    let isInlineCoversAll = false;
    if (styleRanges.length > 0) {
      // 检查所有内联范围是否无缝覆盖 [0, contentLength]
      const filteredRanges = styleRanges.filter((r) => r.value === styleValue);
      if (filteredRanges.length > 0) {
        filteredRanges.sort((a, b) => a.start - b.start);
        let covered = 0;
        for (const range of filteredRanges) {
          if (range.start > covered) {
            // 存在未覆盖的间隙
            break;
          }
          covered = Math.max(covered, range.end);
        }
        isInlineCoversAll = covered >= contentLength;
      }
    }

    // 3.4 判断全局是否已应用该样式（值完全匹配）
    let isGlobalApplied: boolean;
    if (styleKey === 'textDecoration') {
      const globalValues = currentGlobalValue?.toString().split(/\s+/) || [];
      const targetValue = styleValue?.toString() || '';
      isGlobalApplied = globalValues.includes(targetValue);
    } else {
      isGlobalApplied = currentGlobalValue === styleValue;
    }
    // ===================== 4. 根据toggle处理样式 =====================
    // 修复点1：初始化时显式定义类型，避免TS类型窄化
    const finalGlobalStyles: Partial<
      Record<keyof TextGlobalStyleProps, string | number | undefined>
    > = {};
    // 最终要保留的内联样式（过滤掉目标styleKey）
    let finalInlineStyles = [...inlineStyles];

    if (!toggle) {
      // -------------------- 场景1：toggle=false 强制覆盖 --------------------
      // console.log(`updateGlobalStyles: 节点${id}强制设置全局样式 ${styleKey}=${styleValue}`);
      // 修复点2：显式类型断言，兼容TextGlobalStyleProps的属性类型
      finalGlobalStyles[styleKey] = styleValue as string | number | undefined;
      // 清理所有内联样式中的该属性
      finalInlineStyles = inlineStyles
        .map((style) => {
          const newStyles = { ...style.styles };
          delete newStyles[styleKey]; // 删除目标属性
          return { ...style, styles: newStyles };
        })
        .filter((style) => Object.keys(style.styles).length > 0); // 过滤空样式
    } else {
      // -------------------- 场景2：toggle=true 智能切换 --------------------
      // 子场景A：内联有该样式但未覆盖全部文本 → 全局应用（合并值），清理内联
      if (styleRanges.length > 0 && !isInlineCoversAll) {
        // console.log(
        // `updateGlobalStyles: 节点${id}内联样式未全覆盖，全局应用 ${styleKey}=${styleValue}`
        //);
        // 核心修改：textDecoration合并值，非textDecoration直接赋值
        if (styleKey === 'textDecoration' && styleValue) {
          const targetValue = styleValue.toString().trim();
          // 读取原有全局textDecoration值
          const currentGlobalTextDeco = (nodeProps as TextGlobalStyleProps).textDecoration;
          // 拆分原有值（无则为空数组）
          const currentValues = currentGlobalTextDeco
            ? currentGlobalTextDeco.toString().split(/\s+/).filter(Boolean)
            : [];
          // 合并目标值并去重（避免重复值，如多次添加underline）
          const newValues = Array.from(new Set([...currentValues, targetValue]));
          // 赋值合并后的值
          finalGlobalStyles[styleKey] = newValues.join(' ') as TextDecorationValue;
        } else {
          // 非textDecoration属性：直接赋值（原有逻辑）
          finalGlobalStyles[styleKey] = styleValue as string | number | undefined;
        }

        // 清理内联样式（精准移除目标值，保留其他值）
        finalInlineStyles = inlineStyles
          .map((style) => {
            const newStyles = { ...style.styles };
            if (styleKey === 'textDecoration' && styleValue) {
              const targetValue = styleValue.toString().trim();
              const currentTextDeco = newStyles.textDecoration;

              if (currentTextDeco) {
                const currentValues = currentTextDeco.toString().split(/\s+/).filter(Boolean);
                const remainingValues = currentValues.filter((v) => v !== targetValue);

                if (remainingValues.length > 0) {
                  newStyles.textDecoration = remainingValues.join(' ') as TextDecorationValue;
                } else {
                  delete newStyles.textDecoration;
                }
              }
            } else {
              delete newStyles[styleKey];
            }
            return { ...style, styles: newStyles };
          })
          .filter((style) => Object.keys(style.styles).length > 0);
      }
      // 子场景B：内联全覆盖 或 全局已应用 → 取消全局（精准移除）+ 清理内联
      else if (isInlineCoversAll || isGlobalApplied) {
        console.debug(`updateGlobalStyles: 节点${id}样式全覆盖/全局已应用，取消 ${styleKey}`);
        // 取消全局样式（精准移除textDecoration目标值）
        if (styleKey === 'textDecoration' && styleValue) {
          const currentGlobalTextDeco = (nodeProps as TextGlobalStyleProps).textDecoration;
          const targetValue = styleValue.toString().trim();

          if (currentGlobalTextDeco) {
            const currentValues = currentGlobalTextDeco.toString().split(/\s+/).filter(Boolean);
            const remainingValues = currentValues.filter((v) => v !== targetValue);

            if (remainingValues.length > 0) {
              finalGlobalStyles[styleKey] = remainingValues.join(' ') as TextDecorationValue;
            } else {
              finalGlobalStyles[styleKey] = undefined;
            }
          } else {
            finalGlobalStyles[styleKey] = undefined;
          }
        } else {
          finalGlobalStyles[styleKey] = undefined;
        }

        // 清理内联样式（精准移除目标值）
        finalInlineStyles = inlineStyles
          .map((style) => {
            const newStyles = { ...style.styles };
            if (styleKey === 'textDecoration' && styleValue) {
              const targetValue = styleValue.toString().trim();
              const currentTextDeco = newStyles.textDecoration;

              if (currentTextDeco) {
                const currentValues = currentTextDeco.toString().split(/\s+/).filter(Boolean);
                const remainingValues = currentValues.filter((v) => v !== targetValue);

                if (remainingValues.length > 0) {
                  newStyles.textDecoration = remainingValues.join(' ') as TextDecorationValue;
                } else {
                  delete newStyles.textDecoration;
                }
              }
            } else {
              delete newStyles[styleKey];
            }
            return { ...style, styles: newStyles };
          })
          .filter((style) => Object.keys(style.styles).length > 0);
      }
      // 子场景C：无内联样式且全局未应用 → 全局应用（合并值）
      else {
        console.debug(
          `updateGlobalStyles: 节点${id}无相关样式，全局应用 ${styleKey}=${styleValue}`
        );
        // 核心修改：textDecoration合并值，非textDecoration直接赋值
        if (styleKey === 'textDecoration' && styleValue) {
          const targetValue = styleValue.toString().trim();
          const currentGlobalTextDeco = (nodeProps as TextGlobalStyleProps).textDecoration;
          const currentValues = currentGlobalTextDeco
            ? currentGlobalTextDeco.toString().split(/\s+/).filter(Boolean)
            : [];
          // 合并目标值并去重
          const newValues = Array.from(new Set([...currentValues, targetValue]));
          finalGlobalStyles[styleKey] = newValues.join(' ') as TextDecorationValue;
        } else {
          finalGlobalStyles[styleKey] = styleValue as string | number | undefined;
        }
      }
    }

    // ===================== 5. 安全更新节点 =====================
    store.updateNode(id, {
      props: {
        ...nodeProps, // 保留原有属性
        // 修复点3：类型断言，确保和TextState的props兼容
        ...(finalGlobalStyles as Partial<TextGlobalStyleProps>),
        inlineStyles: finalInlineStyles, // 更新内联样式
        // 显式保留核心属性，避免意外覆盖
        content: nodeProps.content,
      },
    } as Partial<TextState>);

    console.debug(`updateGlobalStyles: 节点${id}样式更新完成`, {
      globalStyles: finalGlobalStyles,
      inlineStylesCount: finalInlineStyles.length,
    });

    // ========== 新增：第二步：更新后恢复完整选区 ==========
    this.restoreFullSelection(savedData, id);
  }

  /**
   * 处理 Enter 换行（连续换行时修复多余 <br>）
   * @param editor 编辑器根节点
   * @param e 键盘事件对象
   */
  handleEnterKey = (id: string, e: KeyboardEvent) => {
    console.log('handleEnterKey触发 进入handler');
    const editor = this.editors[id];
    if (e.key !== 'Enter' || !editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let range = selection.getRangeAt(0);

    // 判断光标是否在根节点内
    if (!editor.contains(range.startContainer)) {
      console.error('光标不在文本组件根节点内');
      return;
    }

    // 获取光标前的节点（根节点的子节点）
    let previousNode: Node | null = null;
    if (range.startContainer === editor) {
      // 如果光标直接位于根节点，使用 startOffset 获取子节点
      previousNode = editor.childNodes[range.startOffset - 1] || null;
    } else {
      // 如果光标位于子节点内部，找到其父节点在根节点中的位置
      const parent = range.startContainer.parentNode;
      if (parent === editor) {
        previousNode = range.startContainer.previousSibling;
      } else {
        // 遍历找到光标所在节点在根节点中的前一个节点
        let currentNode = range.startContainer;
        while (
          currentNode &&
          currentNode.parentNode !== editor &&
          currentNode.parentNode !== null
        ) {
          currentNode = currentNode.parentNode;
        }
        previousNode = currentNode?.previousSibling || null;
      }
    }

    console.log('previousNode:', previousNode);
    const isPreviousBr = previousNode?.nodeName === 'BR';
    console.log('isPreviousBr:', isPreviousBr);
    if (isPreviousBr) {
      e.preventDefault();

      const editor = this.editors[id];
      if (!editor) return;

      // 步骤1：将range移到span外部
      const spanNode = range.startContainer.parentElement;
      if (spanNode && spanNode.nodeName === 'SPAN') {
        const outerRange = document.createRange();
        outerRange.setStartAfter(spanNode);
        outerRange.collapse(true);
        range = outerRange;
      }

      // 步骤2：插入BR（仅保留BR，删除空文本节点相关）
      const br = document.createElement('br');
      range.insertNode(br);

      // 步骤3：将光标定位到BR后面（无需空文本节点）
      const newRange = document.createRange();
      newRange.setStartAfter(br); // 直接定位到BR后
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // 后续逻辑不变
      setTimeout(() => {
        this.handleContentChange(
          e,
          id,
          this.store,
          () => this.saveFullSelection(id),
          (pos) => this.restoreFullSelection(pos, id)
        );
        // this.cleanExtraBrAtEnd(id);
      }, 0);

      // 验证日志（此时只有SPAN+BR，共2个节点）
      console.log('===== 编辑器根节点所有子节点 =====');
      Array.from(editor.childNodes).forEach((node, index) => {
        console.log(`第${index}个节点：`);
        console.log('  节点类型：', node.nodeType === 3 ? '文本节点' : '元素节点');
        console.log('  节点名称：', node.nodeName);
        console.log('  节点内容：', node.textContent ? `"${node.textContent}"` : '空');
      });
    }
    console.log('保留默认行为');
    // 非末尾换行：保留浏览器默认行为（只插一个 <br>，无需处理）
  };

  handleHeightAdaptation(id: string) {
    // 延迟调整文本框高度，确保 TextService 的光标恢复已完成
    nextTick(() => {
      nextTick(() => {
        const editorEl = this.editors[id];
        if (!editorEl) return;

        const node = this.store.nodes[id] as TextState | undefined;
        if (!node) return;

        const fontSize = node.props.fontSize || 16;
        const lineHeight = node.props.lineHeight || 1.6;
        const minHeight = fontSize * lineHeight;
        const currentHeight = node.transform.height;

        // 临时设置高度为 auto，获取准确的内容高度
        const originalHeight = editorEl.style.height;
        const originalOverflow = editorEl.style.overflow;
        editorEl.style.height = 'auto';
        editorEl.style.overflow = 'hidden';

        // 获取实际内容高度
        const scrollHeight = editorEl.scrollHeight;

        // 恢复原始样式
        editorEl.style.height = originalHeight;
        editorEl.style.overflow = originalOverflow;

        const newHeight = Math.max(scrollHeight, minHeight);

        // 只有当新高度大于当前高度时才更新（避免高度缩小）
        // 允许1px的误差，避免因为计算精度问题导致的频繁更新
        if (newHeight > currentHeight + 1) {
          this.store.updateNode(id, {
            transform: { ...node.transform, height: newHeight },
          });
        }
      });
    });
  }
  /**
   * 处理文本内容变化（入参改为 id）
   * @param e 事件对象
   * @param id 文本节点 ID
   * @param store Pinia 实例（由调用方传递）
   * @param saveCursorPosition 回调函数——保存当前光标位置（防止DOM更新后光标丢失）
   * @param restoreCursorPosition 回调函数——恢复光标位置（DOM更新后让光标回到原来的地方）
   */
  public handleContentChange(
    e: Event,
    id: string,
    store: CanvasStore,
    saveCursorPosition: (id: string) => {
      isCollapsed: boolean; // 是否是光标（折叠选区）
      startOffset: number; // 选区起始的「文本逻辑索引」（整个文本的第n个字符）
      endOffset: number; // 选区结束的「文本逻辑索引」
      nodeText: string; // 光标/选区所在文本节点的内容（用于匹配新DOM）
    } | null,
    restoreCursorPosition: (
      savedData: {
        isCollapsed: boolean; // 是否是光标（折叠选区）
        startOffset: number; // 选区起始的「文本逻辑索引」（整个文本的第n个字符）
        endOffset: number; // 选区结束的「文本逻辑索引」
        nodeText: string; // 光标/选区所在文本节点的内容（用于匹配新DOM）
      } | null
    ) => void
  ) {
    //通过 ID 获取节点，加非空+类型校验
    const node = store.nodes[id] as TextState | undefined;
    if (!node || node.type !== NodeType.TEXT) return; // 仅处理文本节点

    const target = e.target as HTMLElement;
    // 保存当前光标位置
    const savedCursorPos = saveCursorPosition(id);
    // 递归处理所有层级的节点
    const getContentWithNewlines = (target: Node) => {
      // 核心：只遍历 target 的直接子节点，不处理 target 本身
      const processChildNode = (node: Node): string => {
        // 1. 处理 <br> 节点（包括嵌套的）
        if (node.nodeName === 'BR') {
          return '\n';
        }
        // 2. 处理 <div> 节点（包括嵌套的）：div 本身加换行，再递归处理其内部
        if (node.nodeName === 'DIV') {
          return '\n' + Array.from(node.childNodes).map(processChildNode).join('');
        }
        // 3. 文本节点：直接返回内容
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent || '';
        }
        // 4. 其他元素（如 <span>）：递归遍历其内部子节点（处理嵌套的 <br>/<div>）
        return Array.from(node.childNodes).map(processChildNode).join('');
      };

      // 只处理 target 的直接子节点，不处理 target 本身
      return Array.from(target.childNodes).map(processChildNode).join('');
    };

    // 使用时：传入target元素
    const newContent = getContentWithNewlines(target);
    if (newContent === '\n' && this.isEditing) this.clearPartialInlineStyle(id);
    if (newContent === '\n' && !this.isEditing) store.deleteNode(id);

    const oldContent = node.props.content || '';
    console.log('旧内容:', JSON.stringify(oldContent));
    console.log('新内容:', JSON.stringify(newContent));
    // 通过 ID 更新节点内容
    store.updateNode(id, {
      props: { ...node.props, content: newContent },
    });

    // DOM 重新渲染后，恢复光标位置
    restoreCursorPosition(savedCursorPos);
    // console.log('恢复光标位置:', savedCursorPos);
    // console.log('新存储的内容:', JSON.stringify(node.props.content));
    // 同步调整内联样式（传递 id 给内部方法）
    if (oldContent && newContent) {
      this.updateInlineStylesOnContentChange(oldContent, newContent, id, store);
    }
  }

  /**
   * 文本变化时，同步调整 inlineStyles 的 start/end 索引，更新内联样式（富文本样式）的范围
   * @param oldContent 旧内容（比如 "你好"）
   * @param newContent 新内容（比如 "你好世界"）
   * @param id 文本节点 ID（定位要修改的节点）
   * @param store Pinia 实例（由调用方传递）（用来获取和更新节点数据）
   */
  private updateInlineStylesOnContentChange(
    oldContent: string,
    newContent: string,
    id: string, // 精准定位文本节点
    store: CanvasStore
  ) {
    // 1. 安全校验：通过ID从store获取文本节点，只处理「有效文本节点」
    const node = store.nodes[id] as TextState | undefined;
    if (!node || node.type !== NodeType.TEXT) return; // 非文本节点/节点不存在，直接退出

    // 2. 计算文本长度变化（核心依据）
    const oldLength = oldContent.length; // 旧长度（比如 "你好" → 2）
    const newLength = newContent.length; // 新长度（比如 "你好世界" → 4）
    let lengthDiff = newLength - oldLength; // 长度差（+2 表示插入，-1 表示删除）

    if (newContent === '\n') {
      lengthDiff = lengthDiff > 0 ? lengthDiff + 1 : lengthDiff - 1;
    }

    // 3. 无长度变化（比如只修改文字但长度不变："你好"→"哈喽"），无需调整样式
    if (lengthDiff === 0) return;

    // 4. 准备数据：获取旧的富文本样式，以及当前光标/选区位置
    const oldInlineStyles = node.props.inlineStyles || []; // 旧样式（比如 [{start:1, end:2, fontWeight:'bold'}] → "好"加粗）
    const selection = window.getSelection(); // 浏览器选区（获取光标位置）
    if (!selection || !selection.rangeCount) return; // 无光标/选区，无法判断调整位置

    // 5. 关键：获取「内容修改时的光标结束位置」（样式调整的基准）
    const editor = this.editors[id];
    if (!editor) return;

    const range = selection.getRangeAt(0);
    const cursorTargetNode = range.startContainer;
    const cursorBaseOffset = this.getTextOffset(cursorTargetNode, editor);
    let cursorLocalOffset = 0;

    // 处理startOffset
    if (cursorTargetNode.nodeType === Node.TEXT_NODE) {
      // 文本节点：offset本身就是字符数，直接用
      cursorLocalOffset = range.startOffset;
    } else if (cursorTargetNode.nodeType === Node.ELEMENT_NODE) {
      // 元素节点：递归计算插入索引对应的字符数
      cursorLocalOffset = this.calculateInsertOffsetToChars(cursorTargetNode, range.startOffset);
    }

    const cursorPos = cursorBaseOffset + cursorLocalOffset - 1; // 光标的全局字符索引位置

    // 6. 核心逻辑：根据长度变化，调整每个样式的范围索引
    const newInlineStyles = oldInlineStyles
      .map((style) => {
        let { start, end } = style; // 每个样式的原范围（比如 start:1, end:2 → 对应旧文本第1-2个字符）
        console.log('调整前样式范围：', { start, end });
        console.log('光标位置：', cursorPos);
        console.log('长度变化：', lengthDiff);
        // 场景1：文本「插入」（长度增加，lengthDiff>0）—— 光标后的样式范围向后偏移
        if (lengthDiff > 0 && end > cursorPos - lengthDiff) {
          // 比如：旧文本 "你好"（长度2），在光标Pos=2插入"世界"（长度+2）
          // 原样式 start:1, end:2 → 光标后，所以 start 不变（1），end +2 → 4
          // 新样式范围 start:1, end:4 → 依然对应 "好"（新文本第1-2个字符，插入后"世界"在后面，不影响）
          if (cursorPos - lengthDiff < start) {
            start += lengthDiff;
          }
          end += lengthDiff;
          // 如果换行符位于样式范围内，确保不扩展样式范围
          console.log('newContent: ', newContent);
          console.log('光标位置：', cursorPos);
          console.log('插入字符：', JSON.stringify(newContent[cursorPos]));
          console.log('调整后样式范围：', { start, end });
        }

        // 场景2：文本「删除」（长度减少，lengthDiff<0）—— 光标后的样式范围向前偏移
        if (lengthDiff < 0 && end > start) {
          // 先确保样式范围本身有效
          const offset = Math.abs(lengthDiff); // 删除的字符数
          const deleteStart = cursorPos + 1; // 删除起始位置
          const deleteEnd = deleteStart + offset; // 删除结束位置（左闭右开）
          console.log('长度变化：', lengthDiff);
          console.log('删除区间：', { deleteStart, deleteEnd }, '原始样式范围：', { start, end });

          // 分6种场景处理样式范围与删除区间的关系
          if (end <= deleteStart) {
            // 场景1：样式完全在删除区间之前 → 不调整
            console.log('样式完全在删除区间前，不调整：', { start, end });
          } else if (start >= deleteEnd) {
            // 场景2：样式完全在删除区间之后 → 整体向前偏移offset
            start = Math.max(0, start - offset);
            end = Math.max(start, end - offset); // 避免end < start
            console.log('样式完全在删除区间后，偏移后：', { start, end });
          } else if (start < deleteStart && end > deleteEnd) {
            // 场景3：样式跨删除区间（前半在删除前，后半在删除后）→ 截断为删除前的部分
            end = Math.max(start, end - offset);
            console.log('样式跨删除区间，截断后：', { start, end });
          } else if (start >= deleteStart && end <= deleteEnd) {
            // 场景4：样式完全在删除区间内 或 部分重叠 → 置为无效范围（start >= end）
            start = end; // 标记为无效，后续过滤掉该样式
            console.log('样式在删除区间内，置为无效：', { start, end });
          } else if (start < deleteStart && end <= deleteEnd) {
            //边界重叠
            end = Math.max(start, deleteStart);
            console.log('样式与删除区间边界左重叠，调整后：', { start, end });
          } else {
            //边界重叠
            start = Math.max(0, deleteStart);
            end = Math.max(start, end - offset);
            console.log('样式与删除区间边界右重叠，调整后：', { start, end });
          }
        }

        return { ...style, start, end }; // 返回调整后的样式
      })
      .filter((style) => style.start < style.end); // 过滤无效样式（start≥end的空范围）

    // 7. 最终：更新节点的内联样式（同步到store，视图自动刷新）
    store.updateNode(id, {
      props: { ...node.props, inlineStyles: newInlineStyles },
    });
  }
  public clearPartialInlineStyle(id: string) {
    const node = this.store.nodes[id] as TextState | undefined;
    if (!node || node.type !== NodeType.TEXT) return;
    this.store.updateNode(id, {
      props: { ...node.props, inlineStyles: undefined },
    });
  }
}

/**
 * src/core/handlers/TextSelectionHandler.ts（有状态交互处理器）
   处理文本选区相关的交互细节，维护编辑状态和选区状态，响应连续 DOM 事件流。
 */

import { NodeType, type InlineStyleProps, type TextState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';
import { nextTick } from 'vue';
import type { TransformHandler } from './TransformHandler';
import type { ViewportHandler } from './ViewportHandler';
type CanvasStore = ReturnType<typeof useCanvasStore>;

// 有状态处理器：维护交互过程中的中间状态
export class TextSelectionHandler {
  // 私有属性：存储构造函数传入的依赖（供内部方法使用）
  private store: CanvasStore;
  private transformHandler: TransformHandler; // 用于互斥判断（拖拽/缩放状态）
  private viewportHandler: ViewportHandler; // 用于互斥判断（平移状态）

  // 公开状态：供 ToolManager/组件访问
  public isEditing = false;
  public currentSelection: { start: number; end: number } | null = null;

  // 私有状态：内部使用
  private isClickingToolbar = false;
  private editor: HTMLElement | null = null;

  /**
   * 构造函数（适配 ToolManager 实例化参数）
   * @param store - CanvasStore 实例（用于获取节点数据、更新全局状态）
   * @param transformHandler - TransformHandler 实例（用于互斥判断：拖拽/缩放状态）
   * @param viewportHandler - ViewportHandler 实例（用于互斥判断：平移状态）
   */
  constructor(
    store: CanvasStore,
    transformHandler: TransformHandler,
    viewportHandler: ViewportHandler
  ) {
    // 赋值依赖到私有属性（供内部方法使用）
    this.store = store;
    this.transformHandler = transformHandler;
    this.viewportHandler = viewportHandler;

    // 关键：绑定事件方法的 this 指向（避免事件触发时丢失实例上下文）
    this.handleGlobalMousedown = this.handleGlobalMousedown.bind(this);
  }

  init(editor: HTMLElement | null) {
    this.editor = editor;
  }

  // 公共方法，更新全局选区
  updateGlobalSelection(selection: { start: number; end: number } | null) {
    this.store.updateGlobalTextSelection(selection);
    console.log('是这里');
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

    // 通过 id 获取节点
    const node = this.store.nodes[id] as TextState;
    if (!node || node.type !== NodeType.TEXT) return;

    event.stopPropagation();
    const isSelected = this.store.activeElementIds.has(id);
    if (!isSelected) this.store.setActive([id]);

    this.isEditing = true;
    nextTick(() => {
      if (this.editor) {
        // 1. DOM 层面全选文本（原有逻辑不变）
        this.editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(this.editor); // 选中编辑器内所有内容
        selection?.removeAllRanges();
        selection?.addRange(range);
        console.log('双击全选');

        // 2. 更新 currentSelection 为「全部文本范围」
        const content = node.props.content || ''; // 获取文本内容
        const contentLength = content.length; // 文本总长度（全选的 end 索引）

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
        console.log(this.currentSelection);
      }
    });
  }

  exitEditing() {
    this.isEditing = false;
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
    }else
    console.log("处理文本节点的handleMouseDown")
  }

  /**
   * 处理鼠标移动事件
   * @param e 鼠标事件
   */
  handleMouseMove(e: MouseEvent) {
    if (this.isEditing) {
      e.stopPropagation();
    }
    console.log("处理文本节点的handleMouseMove")
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
    console.log("处理文本节点的handleMouseUpAndSelection")
  }

  /**
   * 处理文本选区变化（接收 id 参数）
   * @param id 文本节点 ID
   */
  public handleSelectionChange(id: string) {
    const node = this.store.nodes[id] as TextState;
    if (!this.isEditing || !this.editor) {
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
    if (!this.editor.contains(range.commonAncestorContainer)) {
      /**
       * commonAncestorContainer：选区内所有节点的共同父节点，判断是否在编辑器内
       */
      this.currentSelection = null;
      return;
    }

    /**
     * 精准计算选中文本的 start 和 end
     * 核心工具函数：计算「目标文本节点」在「整个编辑器文本」中的「绝对偏移量」
     * 为什么需要？因为编辑器内的文本可能被多个标签包裹（比如 <span>文字1</span>文字2）
     * 浏览器原生的 offset 是「相对当前节点」的，需要转换成「相对整个编辑器文本」的绝对索引
     */
    const getTextOffset = (node: Node, root: HTMLElement): number => {
      let offset = 0; // 累计偏移量（目标节点前面有多少个字符）
      // TreeWalker：浏览器提供的DOM遍历工具，这里只遍历「文本节点」（SHOW_TEXT）
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let currentNode: Node | null;

      // 遍历编辑器内所有文本节点，累加前面节点的文本长度
      while ((currentNode = walker.nextNode())) {
        if (currentNode === node) break;
        offset += currentNode.textContent?.length || 0;
      }
      return offset;
    };

    // 计算选区的「绝对起始索引」（totalStart）
    const startNode = range.startContainer; // 选区开始的节点（比如某个文本节点）
    const startOffset = range.startOffset; // 相对startNode的偏移量（比如在startNode第2个字符后）
    const baseOffset = getTextOffset(startNode, this.editor);
    const totalStart = baseOffset + startOffset;

    const endNode = range.endContainer;
    const endOffset = range.endOffset;
    const endBaseOffset = getTextOffset(endNode, this.editor); // endNode的绝对偏移
    const totalEnd = endBaseOffset + endOffset; // 最终：选区在整个文本中的绝对结束索引

    // 统一选区方向：确保 start ≤ end（用户可能从后往前选，比如从第8个字符选到第2个）
    const start = Math.min(totalStart, totalEnd); // 取较小值为真正的起始
    const end = Math.max(totalStart, totalEnd); // 取较大值为真正的结束

    // 保存有效选区：只有「真正选中文字」（start < end）才保存
    if (start < end) {
      this.currentSelection = { start, end }; // 比如 { start:2, end:8 } 表示选中第2-8个字符
    } else {
      this.currentSelection = null; // 无有效选中（比如选中长度为0）
    }

    // 同步选区到全局状态：让其他功能（比如设置字体样式）能获取当前选区
    const isActive = this.store.activeElements[0]?.id === node.id || this.isEditing;
    if (isActive && this.currentSelection) {
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
    if (!this.isEditing) {
      console.log("没有在编辑状态");
      // 阻止文本框聚焦（避免单击时光标出现，不进入编辑态）
      //e.preventDefault();

      // 执行选中逻辑（单击的核心需求）
      const isSelected = this.store.activeElementIds.has(id);
      if (!isSelected) this.store.setActive([id]);
      // 强制让文本框失焦（兜底，避免意外聚焦）
      this.editor?.blur();
    } else {
      // 编辑状态下，正常响应点击（选中文本、输入等）
      console.log("处于编辑态 正常响应点击")
      e.stopPropagation();

      // 修复：点击时如果当前是全选状态，清除全选并将光标设置到点击位置
      // 使用 nextTick 确保在浏览器处理完点击事件后再处理
      nextTick(() => {
        if (this.editor) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // 检查是否是全选状态（选区覆盖整个编辑器内容）
            const editorText = this.editor.textContent || '';
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
              if (targetNode && this.editor.contains(targetNode)) {
                const newRange = document.createRange();
                newRange.setStart(targetNode, offset);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                // 更新选区状态（清除全选）
                this.handleSelectionChange(id);
              } else {
                // 降级方案：将光标设置到文本末尾
                const lastTextNode = this.getLastTextNode(this.editor);
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

    return this.store.editingGroupId === parentId;
  };

  /**
   * 保存当前光标位置（修复：保存真实光标节点和结束偏移）
   * @returns 保存的位置信息（文本节点+偏移量）
   */
  saveCursorPosition(): {
    parent: Node | null;
    offset: number;
    textContent: string; // 新增：保存节点文本内容，用于恢复时匹配
  } {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { parent: null, offset: 0, textContent: '' };
    }

    const range = selection.getRangeAt(0);
    // ✅ 关键1：保存光标所在的「最小文本节点」（startContainer）
    // ✅ 关键2：保存 endOffset（输入后光标在末尾，更符合预期）
    // ✅ 关键3：保存节点文本内容，用于恢复时精准匹配
    return {
      parent: range.startContainer,
      offset: range.endOffset,
      textContent: range.startContainer.textContent || '',
    };
  }

  /**
   * 恢复光标位置（修复：精准匹配新DOM节点+边界校验）
   * @param savedPos 保存的位置信息
   */
  restoreCursorPosition(savedPos: { parent: Node | null; offset: number; textContent: string }) {
    if (!this.editor || !savedPos.parent || !this.isEditing || !savedPos.textContent) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) return;

    // 确保DOM完全更新（用nextTick确保渲染完成，避免早了找不到节点）
    nextTick(() => {
      // 在新DOM树中找到「和保存时文本内容一致」的文本节点
      const targetNode = this.findTextNodeByContent(this.editor!, savedPos.textContent);
      if (!targetNode) return;

      //偏移量边界校验（避免超出文本长度）
      const textLength = targetNode.textContent?.length || 0;
      const safeOffset = Math.min(savedPos.offset, textLength); // 最大不超过文本长度
      const finalOffset = Math.max(0, safeOffset); // 最小不小于0

      //恢复光标
      const range = document.createRange();
      range.setStart(targetNode, finalOffset); // 新DOM节点 + 安全偏移
      range.collapse(true); // 光标折叠（只显示光标，不选中文字）

      selection.removeAllRanges();
      selection.addRange(range);
    });
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
      // 找到文本内容完全匹配的节点（忽略空格差异，可选）
      if (currentNode.textContent?.trim() === targetText.trim()) {
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
    const target = e.target as HTMLElement;
    // 查找工具栏
    const toolbar = document.querySelector('.context-toolbar');
    this.isClickingToolbar = toolbar ? toolbar.contains(target) : false;
  }

  /**
   * 处理文本节点失焦（接收 id 参数）
   * @param id 文本节点 ID
   */
  public handleBlur(id: string) {
    const node = this.store.nodes[id];
    if (!node) return;

    if (this.isClickingToolbar) {
      this.editor?.focus();
    } else {
      this.isEditing = false;
      if (!this.store.activeElementIds.has(id)) {
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
    const activeNode = this.store.activeElements[0];
    const baseActive = activeNode?.id === node!.id;
    // 编辑态时，强制返回true（锁定激活状态）
    return this.isEditing ? true : baseActive;
  }

  /**
   * 清理状态（组件卸载时调用）
   */
  destroy() {
    this.isEditing = false;
    this.currentSelection = null;
    this.isClickingToolbar = false;
    this.editor = null;
  }

  // 新增：设置选中范围（供外部调用，比如双击全选时）
  setCurrentSelection(selection: { start: number; end: number }): void {
    // 可选：添加范围有效性校验（符合你的 inlineStyles 规则）
    if (selection.start >= 0 && selection.end > selection.start) {
      this.currentSelection = selection;
    } else {
      this.currentSelection = null; // 无效范围则置空
    }
  }

  /**
   * 通用方法：修改部分文本的内联样式（完全适配你的 TextState 定义）
   * @param id 文本节点ID
   * @param store Pinia存储（用于获取/更新节点）
   * @param styleKey 要修改的样式属性（必须是 InlineStyleProps 中的属性，如 'color'、'fontWeight'）
   * @param styleValue 样式值（如 'red'、'bold'、16、'underline'）
   * @param toggle 是否切换样式（true：有则移除，无则添加；false：强制设置样式）
   */
  updatePartialInlineStyle(
    id: string,
    store: CanvasStore,
    styleKey: keyof InlineStyleProps,
    styleValue: InlineStyleProps[keyof InlineStyleProps],
    toggle = true
  ) {
    // 1. 安全校验：获取有效文本节点
    const node = store.nodes[id] as TextState | undefined;
    if (!node || node.type !== NodeType.TEXT) return;

    const { content, inlineStyles = [] } = node.props;
    const contentLength = content.length;

    // 2. 获取并处理选中范围（遵循你的规则：越界修正 + 空范围过滤）
    const selection = this.currentSelection;

    console.log(selection); //???(6,7)

    if (!selection || selection.start >= selection.end) return;

    // 越界处理：start < 0 按 0 算，end > 文本长度按文本长度算
    let { start: selectionStart, end: selectionEnd } = selection;
    selectionStart = Math.max(0, selectionStart);
    selectionEnd = Math.min(contentLength, selectionEnd);

    if (selectionStart >= selectionEnd) return; // 修正后仍为空范围，直接退出
    console.log('开始设置');
    // 3. 预处理现有样式：过滤空范围（start >= end），保留有效样式
    const validInlineStyles = inlineStyles.filter((style) => style.start < style.end);

    // 4. 核心逻辑：找到目标样式对象（同一范围+包含目标属性），处理添加/移除
    // 目标：只修改当前样式属性，不影响其他属性（如已有fontWeight，只改color）
    const updatedStyles = [...validInlineStyles];
    const targetStyleIndex = updatedStyles.findIndex(
      (style) =>
        // 范围完全匹配（同一文本片段）
        style.start === selectionStart &&
        style.end === selectionEnd &&
        // 包含要修改的样式属性（用于切换）
        style.styles.hasOwnProperty(styleKey)
    );

    if (toggle) {
      // 场景1：切换样式（有则移除，无则添加）
      if (targetStyleIndex > -1) {
        // 存在目标样式：移除该属性（不删除整个样式对象，保留其他属性）
        const targetStyle = updatedStyles[targetStyleIndex] as {
          start: number;
          end: number;
          styles: InlineStyleProps;
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [styleKey]: _, ...remainingStyles } = targetStyle!.styles;

        if (Object.keys(remainingStyles).length > 0) {
          // 还有其他样式属性：更新样式对象
          updatedStyles[targetStyleIndex] = {
            ...targetStyle,
            styles: remainingStyles,
          };
        } else {
          // 无其他样式属性：删除整个样式对象
          updatedStyles.splice(targetStyleIndex, 1);
        }
      } else {
        // 不存在目标样式：添加新的样式对象（遵循优先级规则：后添加的在数组后面，优先级更高）
        updatedStyles.push({
          start: selectionStart,
          end: selectionEnd,
          styles: { [styleKey]: styleValue } as InlineStyleProps,
        });
      }
    } else {
      // 场景2：强制设置样式（不管是否存在，直接覆盖/添加）
      if (targetStyleIndex > -1) {
        const targetStyle = updatedStyles[targetStyleIndex] as {
          start: number;
          end: number;
          styles: InlineStyleProps;
        };
        // 存在目标样式：更新该属性（保留其他属性）
        updatedStyles[targetStyleIndex] = {
          start: targetStyle.start,
          end: targetStyle.end,
          styles: {
            ...targetStyle.styles,
            [styleKey]: styleValue,
          },
        };
      } else {
        // 不存在目标样式：添加新样式对象
        updatedStyles.push({
          start: selectionStart,
          end: selectionEnd,
          styles: { [styleKey]: styleValue } as InlineStyleProps,
        });
      }
    }

    // 5. 最终更新节点（同步到 store，视图自动刷新）
    store.updateNode(id, {
      props: {
        ...node.props,
        inlineStyles: updatedStyles, // 覆盖原有 inlineStyles
      },
    });
  }
}

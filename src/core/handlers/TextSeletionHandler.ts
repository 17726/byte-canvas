/**
 * src/core/handlers/TextSelectionHandler.ts（有状态交互处理器）
   处理文本选区相关的交互细节，维护编辑状态和选区状态，响应连续 DOM 事件流。
 */

import { NodeType, type TextState } from '@/types/state';
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
    if (!isSelected) return;

    this.isEditing = true;
    nextTick(() => {
      if (this.editor) {
        this.editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(this.editor);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    });
  }

  exitEditing(){
    this.isEditing = false;
    this.updateGlobalSelection(null);
  }

  /**
   * 处理鼠标按下事件
   * @param e 鼠标事件
   */
  handleMouseDown(e: MouseEvent) {
    if (this.isEditing) {
      e.stopPropagation(); // 阻止事件冒泡到上层节点
    } else {
      // 阻止文本框聚焦（避免单击时光标出现，不进入编辑态）
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
  }

  /**
   * 处理鼠标抬起并计算选区
   * @param e 鼠标事件
   */
  handleMouseUpAndSelection(e: MouseEvent, id:string) {
    if (this.isEditing) {
      e.stopPropagation();
      this.handleSelectionChange(id); // 传入 node 参数
    }
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

    const range = selection.getRangeAt(0);
    if (!this.editor.contains(range.commonAncestorContainer)) {
      this.currentSelection = null;
      return;
    }

    // 精准计算选中文本的 start 和 end
    const getTextOffset = (node: Node, root: HTMLElement): number => {
      let offset = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let currentNode: Node | null;
      while ((currentNode = walker.nextNode())) {
        if (currentNode === node) break;
        offset += currentNode.textContent?.length || 0;
      }
      return offset;
    };

    const startNode = range.startContainer;
    const startOffset = range.startOffset;
    const baseOffset = getTextOffset(startNode, this.editor);
    const totalStart = baseOffset + startOffset;

    const endNode = range.endContainer;
    const endOffset = range.endOffset;
    const endBaseOffset = getTextOffset(endNode, this.editor);
    const totalEnd = endBaseOffset + endOffset;

    const start = Math.min(totalStart, totalEnd);
    const end = Math.max(totalStart, totalEnd);

    if (start < end) {
      this.currentSelection = { start, end };
    } else {
      this.currentSelection = null;
    }

    // 同步到全局状态
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
    const node = this.store.nodes[id] as TextState;
    if (!this.isEditing) {
      // 阻止文本框聚焦（避免单击时光标出现，不进入编辑态）
      e.preventDefault();

      // 执行选中逻辑（单击的核心需求）
      const isSelected = this.store.activeElementIds.has(node.id);
      if (!isSelected) {
        this.store.setActive([node.id]);
      }

      // 强制让文本框失焦（兜底，避免意外聚焦）
      this.editor?.blur();
    } else {
      // 编辑状态下，正常响应点击（选中文本、输入等）
      e.stopPropagation();
    }
  }

  /**
   * 保存当前光标位置
   * @returns 保存的位置信息
   */
  saveCursorPosition(): {
    parent: Node | null;
    offset: number;
  } {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { parent: null, offset: 0 };
    }
    const range = selection.getRangeAt(0);
    // 记录光标所在的父节点和偏移量
    return {
      parent: range.commonAncestorContainer,
      offset: range.startOffset,
    };
  }

  /**
   * 恢复光标位置
   * @param savedPos 保存的位置信息
   */
  restoreCursorPosition(savedPos: { parent: Node | null; offset: number }) {
    if (!this.editor || !savedPos.parent || !this.isEditing) return;

    const selection = window.getSelection();
    if (!selection) return;

    // 等待 DOM 完全渲染
    nextTick(() => {
      // 找到保存的父节点
      const parentNode = this.findMatchingNode(this.editor!, savedPos.parent!);
      if (!parentNode) return;

      // 创建新的选区，恢复光标位置
      const range = document.createRange();
      range.setStart(parentNode, savedPos.offset);
      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);
    });
  }

  /**
   * 递归查找 DOM 重新渲染后对应的父节点
   * @param root 根节点
   * @param targetNode 目标节点
   * @returns 匹配的节点或null
   */
  private findMatchingNode(root: HTMLElement, targetNode: Node): Node | null {
    // 如果根节点就是目标节点，直接返回
    if (root === targetNode) return root;

    // 递归查找子节点（匹配文本内容和节点类型）
    const childNodes = Array.from(root.childNodes);
    for (const node of childNodes) {
      if (node.nodeType === targetNode.nodeType && node.textContent === targetNode.textContent) {
        return node;
      }
      const found = this.findMatchingNode(node as HTMLElement, targetNode);
      if (found) return found;
    }
    return null;
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
}

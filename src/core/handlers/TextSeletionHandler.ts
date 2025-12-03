/**
 * src/core/handlers/TextSelectionHandler.ts（有状态交互处理器）
   处理文本选区相关的交互细节，维护编辑状态和选区状态，响应连续 DOM 事件流。
 */

import type { TextState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';
import { nextTick } from 'vue';

type CanvasStore = ReturnType<typeof useCanvasStore>;

// 有状态处理器：维护交互过程中的中间状态
export class TextSelectionHandler {
  private store = useCanvasStore();
  // 编辑状态（有状态）
  isEditing = false;
  // 选中状态（有状态）
  currentSelection: { start: number; end: number } | null = null;
  // 标记是否正在点击工具栏（有状态）
  isClickingToolbar = false;
  // 编辑器DOM引用
  private editor: HTMLElement | null = null;

  /**
   * 初始化编辑器引用
   * @param editor 文本编辑器DOM元素
   */
  // 构造函数接收 store 参数，默认值为 useCanvasStore()（保持兼容性）
  constructor(store: CanvasStore = useCanvasStore()) {
    this.store = store; // 注入 store 实例
  }

  init(editor: HTMLElement | null) {
    this.editor = editor;
  }

  // 公共方法，更新全局选区
  updateGlobalSelection(selection: { start: number; end: number } | null) {
    this.store.updateGlobalTextSelection(selection);
  }

  /**
   * 双击进入编辑状态
   * @param event 鼠标事件
   * @param node 文本节点数据
   */
  enterEditing(event: MouseEvent, node: TextState) {
    event.stopPropagation();
    const isSelected = this.store.activeElementIds.has(node.id);
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
  handleMouseUpAndSelection(e: MouseEvent, node: TextState) {
    if (this.isEditing) {
      e.stopPropagation();
      this.handleSelectionChange(node); // 传入 node 参数
    }
  }

  /**
   * 处理文本选区变化
   * @param node 文本节点数据
   */
  handleSelectionChange(node: TextState) {
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
  handleTextBoxClick(e: MouseEvent, node: TextState) {
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
   * 处理失焦事件
   * @param node 文本节点数据
   */
  handleBlur(node: TextState) {
    if (this.isClickingToolbar) {
      // 点击工具栏 → 保留编辑态+重新聚焦
      this.editor?.focus();
    } else {
      // 点击其他区域 → 正常退出
      this.isEditing = false;
      if (!this.store.activeElementIds.has(node.id)) {
        this.store.updateGlobalTextSelection(null);
      }
    }
  }

  /**
   * 检查是否为激活节点
   * @param node 文本节点数据
   * @returns 是否为激活节点
   */
  isActiveNode(node: TextState): boolean {
    const activeNode = this.store.activeElements[0];
    const baseActive = activeNode?.id === node.id;
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

// 单例导出（确保全局唯一实例）
export const textSelectionHandler = new TextSelectionHandler();
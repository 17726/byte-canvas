import type { TextState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';

/**
 * 文本业务服务（无状态）
 * 处理文本相关的原子业务指令，无状态，纯函数操作。
 */
export class TextService {
  private static store = useCanvasStore();

  /**
   * 处理文本内容变化
   * @param e 事件对象
   * @param node 文本节点数据
   * @param saveCursorPosition 保存光标位置的函数
   * @param restoreCursorPosition 恢复光标位置的函数
   */
  static handleContentChange(
    e: Event,
    node: TextState,
    saveCursorPosition: () => { parent: Node | null; offset: number },
    restoreCursorPosition: (savedPos: { parent: Node | null; offset: number }) => void
  ) {
    const target = e.target as HTMLElement;
    // 保存当前光标位置
    const savedCursorPos = saveCursorPosition();

    const newContent = target.textContent;
    // 更新 store 中的 content
    this.store.updateNode(node.id, {
      props: { ...node.props, content: newContent }
    });

    // DOM 重新渲染后，恢复光标位置
    restoreCursorPosition(savedCursorPos);

    // 同步调整内联样式
    this.updateInlineStylesOnContentChange(node.props.content, newContent!, node);
  }

  /**
   * 文本变化时，同步调整 inlineStyles 的 start/end 索引
   * @param oldContent 旧内容
   * @param newContent 新内容
   * @param node 文本节点数据
   */
  static updateInlineStylesOnContentChange(
    oldContent: string,
    newContent: string,
    node: TextState
  ) {
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    const lengthDiff = newLength - oldLength;

    // 无长度变化，无需调整
    if (lengthDiff === 0) return;

    const oldInlineStyles = node.props.inlineStyles || [];
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    // 获取光标/选区的结束位置
    const range = selection.getRangeAt(0);
    const cursorPos = range.endOffset;

    // 调整所有样式范围的索引
    const newInlineStyles = oldInlineStyles.map(style => {
      let { start, end } = style;

      // 场景1：文本插入（长度增加）—— 光标后的样式范围向后偏移
      if (lengthDiff > 0 && end > cursorPos) {
        start = start > cursorPos ? start + lengthDiff : start;
        end += lengthDiff;
      }

      // 场景2：文本删除（长度减少）—— 光标后的样式范围向前偏移
      if (lengthDiff < 0 && end > cursorPos) {
        const offset = Math.abs(lengthDiff);
        start = start > cursorPos ? Math.max(0, start - offset) : start;
        end = Math.max(start, end - offset); // 避免 end < start（空范围）
      }

      return { ...style, start, end };
    }).filter(style => style.start < style.end); // 过滤空范围

    // 更新调整后的 inlineStyles
    this.store.updateNode(node.id, {
      props: { ...node.props, inlineStyles: newInlineStyles }
    });
  }
}
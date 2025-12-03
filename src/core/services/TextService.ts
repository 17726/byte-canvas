import type { TextState } from '@/types/state';
import type { useCanvasStore } from '@/store/canvasStore';
import { NodeType } from '@/types/state'; // 导入节点类型枚举（用于校验节点类型）

type CanvasStore = ReturnType<typeof useCanvasStore>;

/**
 * 文本业务服务（无状态）
 * 处理文本相关的原子业务指令，无状态，纯函数操作。
 * 所有节点相关传参统一为 id，内部通过 store 获取节点。
 */
export class TextService {
  /**
   * 处理文本内容变化（入参改为 id）
   * @param e 事件对象
   * @param id 文本节点 ID
   * @param store Pinia 实例（由调用方传递）
   * @param saveCursorPosition 保存光标位置的函数
   * @param restoreCursorPosition 恢复光标位置的函数
   */
  static handleContentChange(
    e: Event,
    id: string, // 🔥 改为接收节点 ID
    store: CanvasStore,
    saveCursorPosition: () => { parent: Node | null; offset: number },
    restoreCursorPosition: (savedPos: { parent: Node | null; offset: number }) => void
  ) {
    // 🔥 通过 ID 获取节点，加非空+类型校验
    const node = store.nodes[id] as TextState | undefined;
    if (!node || node.type !== NodeType.TEXT) return; // 仅处理文本节点

    const target = e.target as HTMLElement;
    // 保存当前光标位置
    const savedCursorPos = saveCursorPosition();

    const newContent = target.textContent || ''; // 兜底空字符串，避免 null
    // 通过 ID 更新节点内容
    store.updateNode(id, { // 直接使用传入的 id，无需 node.id
      props: { ...node.props, content: newContent }
    });

    // DOM 重新渲染后，恢复光标位置
    restoreCursorPosition(savedCursorPos);

    // 同步调整内联样式（传递 id 给内部方法）
    const oldContent = node.props.content || '';
    if (oldContent && newContent) {
      this.updateInlineStylesOnContentChange(
        oldContent,
        newContent,
        id, // 🔥 传递 ID 而非 node
        store
      );
    }
  }

  /**
   * 文本变化时，同步调整 inlineStyles 的 start/end 索引（入参改为 id）
   * @param oldContent 旧内容
   * @param newContent 新内容
   * @param id 文本节点 ID
   * @param store Pinia 实例（由调用方传递）
   */
  static updateInlineStylesOnContentChange(
    oldContent: string,
    newContent: string,
    id: string, // 🔥 改为接收节点 ID
    store: CanvasStore
  ) {
    // 🔥 通过 ID 获取节点，加非空+类型校验
    const node = store.nodes[id] as TextState | undefined;
    if (!node || node.type !== NodeType.TEXT) return; // 仅处理文本节点

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

    // 通过 ID 更新内联样式
    store.updateNode(id, { // 直接使用传入的 id
      props: { ...node.props, inlineStyles: newInlineStyles }
    });
  }
}
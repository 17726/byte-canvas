import type { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type TextState } from '@/types/state'; // 导入节点类型枚举（用于校验节点类型）

type CanvasStore = ReturnType<typeof useCanvasStore>;

/**
 * 文本业务服务（静态工具类，纯函数操作）
 * 处理文本相关的原子业务指令，所有方法均为静态纯函数，无实例状态。
 * 所有节点相关传参统一为 id，内部通过 store 获取节点。
 */
export class TextService {
  /**
   * 处理文本内容变化（入参改为 id）
   * @param e 事件对象
   * @param id 文本节点 ID
   * @param store Pinia 实例（由调用方传递）
   * @param saveCursorPosition 回调函数——保存当前光标位置（防止DOM更新后光标丢失）
   * @param restoreCursorPosition 回调函数——恢复光标位置（DOM更新后让光标回到原来的地方）
   */
  static handleContentChange(
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
    // 步骤1：临时保存旧光标位置（仅用于参考）
    const oldSavedCursorPos = saveCursorPosition(id);
    // 保存当前光标位置
    const savedCursorPos = saveCursorPosition(id);
    // 递归处理所有层级的节点
    const getContentWithNewlines = (target) => {
      // 核心：只遍历 target 的直接子节点，不处理 target 本身
      const processChildNode = (node) => {
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
    console.log('新内容:', JSON.stringify(newContent));
    const oldContent = node.props.content || '';
    console.log('旧内容:', JSON.stringify(oldContent));
    // 通过 ID 更新节点内容
    store.updateNode(id, {
      props: { ...node.props, content: newContent },
    });

    // 步骤4：基于新content，重新保存光标位置（核心修复）
    const newSavedCursorPos = saveCursorPosition(id);
    console.log('旧光标位置（更新前）:', oldSavedCursorPos);
    console.log('新光标位置（更新后）:', newSavedCursorPos); // 此时应是7,7

    // DOM 重新渲染后，恢复光标位置
    restoreCursorPosition(savedCursorPos);
    console.log('恢复光标位置:', savedCursorPos);
    console.log('新存储的内容:', JSON.stringify(node.props.content));
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
  static updateInlineStylesOnContentChange(
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
    const lengthDiff = newLength - oldLength; // 长度差（+2 表示插入，-1 表示删除）

    // 3. 无长度变化（比如只修改文字但长度不变："你好"→"哈喽"），无需调整样式
    if (lengthDiff === 0) return;

    // 4. 准备数据：获取旧的富文本样式，以及当前光标/选区位置
    const oldInlineStyles = node.props.inlineStyles || []; // 旧样式（比如 [{start:1, end:2, fontWeight:'bold'}] → "好"加粗）
    const selection = window.getSelection(); // 浏览器选区（获取光标位置）
    if (!selection || !selection.rangeCount) return; // 无光标/选区，无法判断调整位置

    // 5. 关键：获取「内容修改时的光标结束位置」（样式调整的基准）
    const range = selection.getRangeAt(0);
    const cursorPos = range.endOffset; // 比如在 "你好" 后面插入 "世界"，光标Pos是 2

    // 6. 核心逻辑：根据长度变化，调整每个样式的范围索引
    const newInlineStyles = oldInlineStyles
      .map((style) => {
        let { start, end } = style; // 每个样式的原范围（比如 start:1, end:2 → 对应旧文本第1-2个字符）

        // 场景1：文本「插入」（长度增加，lengthDiff>0）—— 光标后的样式范围向后偏移
        if (lengthDiff > 0 && end > cursorPos) {
          // 比如：旧文本 "你好"（长度2），在光标Pos=2插入"世界"（长度+2）
          // 原样式 start:1, end:2 → 光标后，所以 start 不变（1），end +2 → 4
          // 新样式范围 start:1, end:4 → 依然对应 "好"（新文本第1-2个字符，插入后"世界"在后面，不影响）
          start = start > cursorPos ? start + lengthDiff : start;
          end += lengthDiff;
        }

        // 场景2：文本「删除」（长度减少，lengthDiff<0）—— 光标后的样式范围向前偏移
        if (lengthDiff < 0 && end > cursorPos) {
          const offset = Math.abs(lengthDiff); // 删除的字符数（比如删除1个字符，offset=1）
          // 比如：旧文本 "你好世界"（长度4），光标Pos=2，删除"世界"（长度-2）
          // 原样式 start:2, end:4 → 光标后，所以 start= max(0, 2-2)=0，end= max(0,4-2)=2
          // 新样式范围 start:0, end:2 → 对应删除后的"你好"，样式不丢失
          start = start > cursorPos ? Math.max(0, start - offset) : start;
          end = Math.max(start, end - offset); // 避免 end < start（无效样式范围）
        }

        return { ...style, start, end }; // 返回调整后的样式
      })
      .filter((style) => style.start < style.end); // 过滤无效样式（start≥end的空范围）

    // 7. 最终：更新节点的内联样式（同步到store，视图自动刷新）
    store.updateNode(id, {
      props: { ...node.props, inlineStyles: newInlineStyles },
    });
  }
}

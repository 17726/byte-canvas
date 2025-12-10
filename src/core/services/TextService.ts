import type { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type TextState } from '@/types/state'; // 导入节点类型枚举（用于校验节点类型）

type CanvasStore = ReturnType<typeof useCanvasStore>;

/**
 * 文本业务服务（静态工具类，纯函数操作）
 * 处理文本相关的原子业务指令，所有方法均为静态纯函数，无实例状态。
 * 所有节点相关传参统一为 id，内部通过 store 获取节点。
 */
export class TextService {
  static getTextOffset = (
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

  static calculateInsertOffsetToChars = (elementNode: Node, insertIndex: number): number => {
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
}

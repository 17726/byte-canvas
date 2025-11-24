import type { CSSProperties } from 'vue';
import type { BaseNodeState } from '@/types/state';
import { NodeType } from '@/types/state';
import { DomRectRenderer } from './DomRectRenderer';

// 缓存渲染器实例 (单例模式)
const rectRenderer = new DomRectRenderer();

/**
 * DOM 样式生成工厂
 * 根据节点类型分发到具体的渲染器
 */
export function getDomStyle(node: BaseNodeState): CSSProperties {
  switch (node.type) {
    case NodeType.RECT:
    case NodeType.CIRCLE: // MVP 阶段 Circle 暂时复用 Rect 渲染器 (或后续添加 DomCircleRenderer)
      return rectRenderer.render(node);
    // case NodeType.TEXT: return textRenderer.render(node);
    default:
      // 默认回退到矩形渲染，或者返回空样式
      return rectRenderer.render(node);
  }
}

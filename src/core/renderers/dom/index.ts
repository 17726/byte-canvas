import type { CSSProperties } from 'vue';
import type { BaseNodeState } from '@/types/state';
import { NodeType } from '@/types/state';
import { DomRectRenderer } from './DomRectRenderer';
import { DomCircleRenderer } from './DomCircleRenderer';

// 【单例模式】
// 实例化渲染器缓存起来，避免每次渲染都 new 一个新对象，提升性能
const rectRenderer = new DomRectRenderer();
const cirRenderer = new DomCircleRenderer();

/**
 * 【工厂模式 - 分发中心】
 * 样式生成工厂函数
 * * 职责：根据节点类型 (NodeType)，自动分发给对应的渲染器去处理。
 * 视图层 (Vue) 只需要调用这个函数，不需要知道具体用了哪个 Renderer 类。
 * @param node 节点数据
 * @returns 计算好的 CSS 样式对象
 */
export function getDomStyle(node: BaseNodeState): CSSProperties {
  switch (node.type) {
    case NodeType.RECT:
      return rectRenderer.render(node);
    case NodeType.CIRCLE:
      return cirRenderer.render(node);
    // 未来扩展点：
    // case NodeType.TEXT: return textRenderer.render(node);
    // case NodeType.IMAGE: return imageRenderer.render(node);
    default:
      // 【Fail Fast 机制】
      // 如果出现了未知的节点类型，直接抛错，防止渲染出奇怪的东西难以排查
      console.warn(`[Renderer] Unsupported node type: ${node.type}`);
      return { display: 'none' }; // 安全回退：隐藏该节点
  }
}

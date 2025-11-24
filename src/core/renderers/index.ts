import type { BaseNodeState } from '@/types/state';

/**
 * 节点渲染器接口 (策略模式)
 * T: 渲染结果类型 (DOM 模式下为 CSSProperties, Canvas 模式下可能为 void 或 RenderObject)
 */
export interface INodeRenderer<T> {
  render(node: BaseNodeState): T;
}

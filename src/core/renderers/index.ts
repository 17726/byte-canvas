import type { BaseNodeState } from '@/types/state';

/**
 * 【策略模式 - 抽象接口】
 * 渲染器接口：规定了所有渲染器（无论矩形、圆形，还是未来 Canvas 版）必须遵守的契约。
 * * @template T 渲染产物的类型。
 * - DOM 模式下，T 是 CSSProperties (Vue 样式对象)。
 * - Canvas 模式下，T 是 void (直接调用 ctx 绘图，不返回样式)。
 */
export interface INodeRenderer<T> {
  /**
   * 渲染核心方法
   * @param node 传入的数据节点 (Store 中的 State)
   * @returns 返回渲染产物 (样式或空)
   */
  render(node: BaseNodeState): T;
}

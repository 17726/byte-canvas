import type { NodeState } from '@/types/state';

/**
 * 【策略模式 - 抽象接口】
 * 渲染器接口：规定了所有渲染器（无论矩形、圆形，还是未来 Canvas 版）必须遵守的契约。
 * @template T 渲染产物的类型。
 * - DOM 模式下，T 是 CSSProperties (Vue 样式对象)。
 * - Canvas 模式下，T 应为 void，render 方法不应有返回值（即不写 return 或 return;），仅执行绘图操作。
 *   如果 Canvas 渲染器需要返回状态对象，请定义单独的接口以避免混淆。
 */
export interface INodeRenderer<T> {
  /**
   * 渲染核心方法
   * @param node 传入的数据节点 (Store 中的 State)
   * @returns 返回渲染产物 (样式或空)
   */
  render(node: NodeState): T;
}

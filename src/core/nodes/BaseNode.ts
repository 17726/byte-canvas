import type { NodeState } from '@/types/state';

export abstract class CanvasNode {
  constructor(public state: NodeState) {}

  /**
   * 业务逻辑：移动
   */
  move(dx: number, dy: number) {
    if (this.state.isLocked) return; // 锁定节点不允许移动
    this.state.transform.x += dx;
    this.state.transform.y += dy;
  }
  /*
  "注：Store 将 State 包装为 Reactive 对象传递给 Node 实例，
  因此 Node 可以直接修改属性触发更新，简化了 API 调用链路。"
  */
  /**
   * 业务逻辑：调整大小
   */
  resize(width: number, height: number) {
    if (this.state.isLocked) return; // 锁定节点不允许调整大小
    this.state.transform.width = width;
    this.state.transform.height = height;
  }

  /**
   * 业务逻辑：调整大小并更新位置（用于从左侧或顶部拖拽时）
   */
  resizeWithPosition(x: number, y: number, width: number, height: number) {
    if (this.state.isLocked) return; // 锁定节点不允许调整大小
    this.state.transform.x = x;
    this.state.transform.y = y;
    this.state.transform.width = width;
    this.state.transform.height = height;
  }
}

import type { CSSProperties } from 'vue';
import type { BaseNodeState } from '@/types/state';

export abstract class CanvasNode {
  constructor(public state: BaseNodeState) {}

  /**
   * 核心方法：生成 Vue 组件所需的样式对象
   * 对应 DOM 的 style 属性
   */
  getStyle(): CSSProperties {
    const { transform, style } = this.state;
    return {
      position: 'absolute',
      left: `${transform.x}px`,
      top: `${transform.y}px`,
      width: `${transform.width}px`,
      height: `${transform.height}px`,
      transform: `rotate(${transform.rotation}deg)`,
      backgroundColor: style.backgroundColor,
      borderWidth: `${style.borderWidth}px`,
      borderStyle: style.borderStyle,
      borderColor: style.borderColor,
      opacity: style.opacity,
      zIndex: style.zIndex,
      display: this.state.isVisible ? 'block' : 'none',
    };
  }

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
}

import { CanvasNode } from './BaseNode';
import type { ShapeState } from '@/types/state';

/**
 * 矩形节点逻辑类
 * 职责：处理矩形特有的几何计算、样式生成
 * 对应文档：L2 逻辑层
 */
export class RectNode extends CanvasNode {
  constructor(public state: ShapeState) {
    super(state);
  }

  // 未来可以在这里扩展矩形特有的逻辑，比如圆角处理、特殊碰撞检测等
}

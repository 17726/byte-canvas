import { type TransformState } from './state.ts';
export interface InternalDragState {
  isDragging: boolean; //是否正在拖拽
  type: 'move' | null; //拖拽类型：移动/缩放/旋转
  nodeId: string; //被拖节点的唯一标识
  startMouseX: number; //拖拽起始时鼠标坐标
  startMouseY: number;
  startTransform: TransformState; // 拖拽起始的变换数据
}

/** 缩放控制点类型 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * 缩放状态
 */
export interface InternalResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  nodeId: string | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startNodeX: number;
  startNodeY: number;
}

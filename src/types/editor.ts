// NOTE: 本地模块引用不应带后缀 .ts，否则会在某些构建配置下导致模块解析失败
import { type TransformState } from './state';
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
  // 组合缩放时存储子节点初始状态
  childStartStates?: Record<string, { x: number; y: number; width: number; height: number }>;
}

// 多节点缩放状态
export interface InternalMultiResizeState {
  isMultiResizing: boolean;
  handle: ResizeHandle | null;
  nodeIds: string[];
  startBounds: { x: number; y: number; width: number; height: number };
  startMouseX: number;
  startMouseY: number;
  nodeStartStates: Record<string, NodeStartState>;
}

// 定义多选缩放的节点初始状态类型（替代any）
export type NodeStartState = {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
};

/** 画布工具类型 */
export type CanvasToolType = 'select' | 'rect' | 'circle' | 'text' | 'image';

/** 创建工具选项 */
export interface CreationToolOptions {
  imageUrl?: string; // 图片URL（用于 image 工具）
}

/** 节点类型枚举 */
export enum NodeType {
  RECT = 'rect',
  CIRCLE = 'circle',
  TEXT = 'text',
  IMAGE = 'image',
  GROUP = 'group',
}

/** 几何变换状态 (CSS Transform) */
export interface TransformState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // 角度 deg
}

/** 样式定义 (对应 CSS Style) */
export interface StyleState {
  backgroundColor: string; // 填充色
  borderWidth: number; // 边框宽
  borderStyle: string; // solid/dashed
  borderColor: string; // 边框色
  opacity: number; // 透明度
  zIndex: number; // 层级
  color?: string;// 文本颜色
}

/** 节点数据基类（核心） */
export interface BaseNodeState {
  readonly id: string;
  readonly type: NodeType;
  name: string;
  transform: TransformState;
  style: StyleState;
  parentId: string | null;
  isLocked: boolean;
  isVisible: boolean;
  props: Record<string, unknown>;
}
/** 画布（视口）状态：控制画布的平移、缩放、尺寸等全局操作 */
export interface ViewportState {
  // 画布容器的物理尺寸（对应 DOM 容器的宽高）
  canvasWidth: number;
  canvasHeight: number;

  // 视口变换核心：平移（pan）+ 缩放（zoom）
  zoom: number; // 缩放比例（1=100%，0.5=50%，2=200%）
  offsetX: number; // 水平平移偏移（画布向左/右移动的距离）
  offsetY: number; // 垂直平移偏移（画布向上/下移动的距离）

  // 画布辅助配置（可选）
  rotation: number; // 画布整体旋转角度（deg，较少用，多数场景节点单独旋转）
  backgroundColor: string; // 画布背景色
  isGridVisible: boolean; // 是否显示网格
  gridSize: number; // 网格大小（px）
  isSnapToGrid: boolean; // 是否开启吸附到网格
}

/** 缩放控制点类型 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * 缩放状态
 */
export interface ResizeState {
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

// 具体节点 State 类型
/** 1. 形状节点 State (包含矩形/圆形/三角形) */
export interface ShapeState extends BaseNodeState {
  type: NodeType.RECT | NodeType.CIRCLE; // 简化 MVP 仅支持 rect/circle
  shapeType: 'rect' | 'circle';
  props: {
    cornerRadius?: number; // 矩形特有
  };
}

/** 2. 文本节点 State */
export interface TextState extends BaseNodeState {
  type: NodeType.TEXT;
  props: {
    content: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number; // B (加粗)
    fontStyle: 'normal' | 'italic'; // I (斜体)
    color: string;
    lineHeight: number;
    underline:boolean;
    strikethrough:boolean;
  };
}

/** 3. 图片节点 State */
export interface ImageState extends BaseNodeState {
  type: NodeType.IMAGE;
  props: {
    imageUrl: string; // 资源 URL (不存 HTMLImageElement)
    filters: {  //NOTE: 滤镜需要通过以下细分属性来设置
      grayscale?: number;      // 0-100
      blur?: number;           // 像素值
      brightness?: number;     // 百分比
      contrast?: number;       // 百分比
      saturate?: number;       // 百分比
      hueRotate?: number;      // 角度值
      filterOpacity?: number;  // 百分比 (滤镜透明度, 对应 CSS filter: opacity(); 与 style.opacity 区分)
      invert?: number;         // 百分比
      sepia?: number;          // 百分比
    };
  };
}

/** 4. 组合节点 State */
export interface GroupState extends BaseNodeState {
  type: NodeType.GROUP;
  // children 数组是其核心结构，它引用了子节点的 ID
  children: string[];
}

/** 5. 所有 State 类型的联合 */
export type NodeState = ShapeState | TextState | ImageState | GroupState;

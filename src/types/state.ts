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
}

/** 节点数据基类 */
export interface BaseNodeState {
  readonly id: string;
  readonly type: NodeType;
  name: string;

  transform: TransformState;
  style: StyleState;

  parentId: string | null;
  isLocked: boolean;
  isVisible: boolean;
}

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
    fontWeight: string | number; // B (加粗)
    fontStyle: 'normal' | 'italic'; // I (斜体)
    color: string;
  };
}

/** 3. 图片节点 State */
export interface ImageState extends BaseNodeState {
  type: NodeType.IMAGE;
  props: {
    src: string; // 资源 URL (不存 HTMLImageElement)
    filters: {
      blur: number;
      brightness: number;
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

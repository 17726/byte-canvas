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
  // props: Record<string, unknown>; // 已移除：由具体子接口定义更精确的 props 类型
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
  // Grid rendering options
  gridStyle?: 'dot' | 'line' | 'none';
  gridDotColor?: string;
  gridDotSize?: number;
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
export type TextDecorationValue = 'none' | 'underline' | 'line-through' | 'underline line-through'; //允许同时使用

// 1. 定义行内样式专属类型（仅允许文本片段独立设置的属性）
export type InlineStyleProps = {
  color?: string; // 文本颜色（支持行内独立设置）
  fontWeight?: 'normal' | 'bold' | number; // 字体粗细
  fontStyle?: 'normal' | 'italic'; // 字体斜体
  textDecoration?: TextDecorationValue; // 文本装饰（下划线/删除线）
  fontSize?: number; // 字体大小（支持行内局部调整）
  letterSpacing?: number | string; // 字间距（仅行内有效）
};

export interface TextState extends BaseNodeState {
  type: NodeType.TEXT;
  props: {
    content: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | number; // B (加粗)
    fontStyle: 'normal' | 'italic'; // I (斜体)
    color: string;
    lineHeight: number;
    textDecoration?: TextDecorationValue;
    // 添加部分文本样式支持
    /**
     * 部分文本的行内样式（支持同一文本片段应用多个样式，或不同片段应用不同样式）
     *
     * 数组中每个对象代表一个文本范围及对应的样式，遵循以下规则：
     *
     * 1. 字段说明：
     *    - start: 样式起始索引（零基于，包含），对应文本字符串的字符位置（如 "abc" 中 "a" 是索引 0）
     *    - end: 样式结束索引（零基于，排除），示例：{start: 0, end: 3} 应用于索引 0、1、2 的字符
     *    - styles: 该范围的行内样式（支持 CSS 文本相关属性，如 color、fontWeight 等）
     *
     * 2. 核心规则（避免实现不一致）：
     *    - 允许重叠：多个范围可重叠（如 [0,3] 和 [2,5]），重叠部分样式会合并
     *    - 优先级：数组顺序决定优先级，后出现的样式覆盖先出现的（同一属性冲突时）
     *    - 越界处理：start < 0 按 0 算，end > 文本长度按文本长度算；仅保留有效部分
     *    - 空范围：start >= end 时视为无效，不应用任何样式，建议过滤此类数据
     *    - 索引基准：基于 UTF-16 代码单元（与 JavaScript 字符串索引一致，支持中文/特殊字符）
     *
     * 3. 样式限制：
     *    - 仅支持文本相关 CSS 属性（如 color、fontWeight、fontStyle、textDecoration 等）
     *    - 不支持布局类属性（如 width、height、margin 等），避免破坏文本容器结构
     */
    inlineStyles?: Array<{
      start: number; // 起始索引（包含）
      end: number; // 结束索引（排除）
      styles: InlineStyleProps; // 替换为自定义类型
    }>;
  };
}

/** 3. 图片节点 State */
export interface ImageState extends BaseNodeState {
  type: NodeType.IMAGE;
  props: {
    imageUrl: string; // 资源 URL (不存 HTMLImageElement)
    filters: {
      //NOTE: 滤镜需要通过以下细分属性来设置
      grayscale?: number; // 0-100
      blur?: number; // 像素值
      brightness?: number; // 百分比
      contrast?: number; // 百分比
      saturate?: number; // 百分比
      hueRotate?: number; // 角度值
      filterOpacity?: number; // 百分比 (滤镜透明度, 对应 CSS filter: opacity(); 与 style.opacity 区分)
      invert?: number; // 百分比
      sepia?: number; // 百分比
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

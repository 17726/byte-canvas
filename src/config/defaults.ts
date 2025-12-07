// import { NodeType } from '@/types/state'; // Not used, remove to satisfy lint

// 视口默认配置（Viewport Defaults）
// 说明：定义画布初始的缩放/偏移/背景和网格相关的默认值
export const DEFAULT_VIEWPORT = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  backgroundColor: 'rgba(245,245,245,1)',
  isGridVisible: true,
  gridSize: 20,
  isSnapToGrid: true,
  gridStyle: 'dot' as const, // 'dot' | 'line' | 'none'
  gridDotColor: 'rgba(196,196,196, 0.7)',
  gridDotSize: 1,
};

// Common Node Defaults
export const DEFAULT_NODE_SIZE = 100;
export const MIN_NODE_SIZE = 20;

// Rect Defaults
export const DEFAULT_RECT_STYLE = {
  backgroundColor: '#ffccc7',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#ff4d4f',
  opacity: 1,
  zIndex: 1,
};
export const DEFAULT_RECT_PROPS = {
  cornerRadius: 0,
};

// Circle Defaults
export const DEFAULT_CIRCLE_STYLE = {
  backgroundColor: '#ADD8E6',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#87CEEB',
  opacity: 1,
  zIndex: 1,
};
export const DEFAULT_CIRCLE_PROPS = {
  cornerRadius: 0,
};

// Text Defaults
export const DEFAULT_TEXT_STYLE = {
  backgroundColor: '#fff0',
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: '#fff0',
  opacity: 1,
  zIndex: 1,
};
export const DEFAULT_TEXT_PROPS = {
  content: '双击编辑文本',
  fontFamily: 'Segoe UI',
  fontSize: 16,
  fontWeight: 400,
  fontStyle: 'normal' as const,
  color: '#000',
  lineHeight: 1.6,
  underline: false,
  strikethrough: false,
  inlineStyles: [],
};

export const DEFAULT_TEXT_SIZE = {
  width: 160,
  height: 40,
};

// Image Defaults
export const DEFAULT_IMAGE_STYLE = {
  backgroundColor: '#fff0',
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: '#fff0',
  opacity: 1,
  zIndex: 1,
};
// 使用 import.meta.env.BASE_URL 确保在子路径部署时也能正确访问
export const DEFAULT_IMAGE_URL = import.meta.env.BASE_URL + '/uploads/images/ori/animals_1.jpg';
export const DEFAULT_IMAGE_FILTERS = {
  grayscale: 0,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotate: 0,
  filterOpacity: 100,
  invert: 0,
  sepia: 0,
};

// 预设画布主题（用于快速应用背景/网格配色）
export const DEFAULT_CANVAS_THEMES = [
  { name: 'Soft', background: '#fbfcfe', gridColor: 'rgba(0,0,0,0.1)', gridSize: 20 },
  { name: 'Warm', background: '#fff8f0', gridColor: 'rgba(0,0,0,0.1)', gridSize: 20 },
  { name: 'Dark', background: '#0f1724', gridColor: 'rgba(255, 255, 255, 0.15)', gridSize: 20 },
];

// Canvas Background / Grid Defaults
export const DEFAULT_CANVAS_BG = '#fbfcfe'; // 更柔和的背景色（更靠近白色但带一点冷色调）
export const DEFAULT_GRID_DOT_COLOR = 'rgba(0,0,0,0.04)'; // 更轻的点网格颜色
export const DEFAULT_GRID_DOT_SIZE = 1; // 点大小（像素）

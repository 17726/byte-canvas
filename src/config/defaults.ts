// import { NodeType } from '@/types/state'; // Not used, remove to satisfy lint

// Viewport Defaults
export const DEFAULT_VIEWPORT = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  backgroundColor: '#ffffff',
  isGridVisible: true,
  gridSize: 20,
  isSnapToGrid: true,
  gridStyle: 'dot' as const, // 'dot' | 'line' | 'none'
  gridDotColor: 'rgba(0,0,0,0.04)',
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
  content: '这里采用了vue绑定，修改这里，内容会响应式改变。但编辑功能暂时没实现，mvp版本中先写死。',
  fontFamily: 'Segoe UI',
  fontSize: 16,
  fontWeight: 400,
  fontStyle: 'normal' as const,
  color: '#000',
  lineHeight: 1.6,
  underline: false,
  strikethrough: false,
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
export const DEFAULT_IMAGE_URL = '/uploads/images/img-test_2.png';
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

export const DEFAULT_CANVAS_THEMES = [
  { name: 'Soft', background: '#fbfcfe', gridColor: 'rgba(0,0,0,0.04)', gridSize: 20 },
  { name: 'Warm', background: '#fff8f0', gridColor: 'rgba(0,0,0,0.03)', gridSize: 20 },
  { name: 'Dark', background: '#0f1724', gridColor: 'rgba(255,255,255,0.04)', gridSize: 20 },
];

// Canvas Background / Grid Defaults
export const DEFAULT_CANVAS_BG = '#fbfcfe'; // 更柔和的背景色（更靠近白色但带一点冷色调）
export const DEFAULT_GRID_DOT_COLOR = 'rgba(0,0,0,0.04)'; // 更轻的点网格颜色
export const DEFAULT_GRID_DOT_SIZE = 1; // 点大小（像素）

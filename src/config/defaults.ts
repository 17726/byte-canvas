import { NodeType } from '@/types/state';

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

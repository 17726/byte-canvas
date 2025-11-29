/**
 * 画布状态持久化模块
 * 说明：负责将画布状态保存到 localStorage 并在页面加载时恢复
 */
import type { NodeState, ViewportState } from '@/types/state';

// localStorage key
const STORAGE_KEY = 'byte-canvas-state';
const STORAGE_VERSION = 1; // 用于未来数据格式升级

/**
 * 持久化数据结构
 */
export interface PersistedState {
  version: number;
  timestamp: number;
  data: {
    nodes: Record<string, NodeState>;
    nodeOrder: string[];
    viewport: Partial<ViewportState>;
  };
}

/**
 * 将状态保存到 localStorage
 */
export function saveToLocalStorage(
  nodes: Record<string, NodeState>,
  nodeOrder: string[],
  viewport: ViewportState
): void {
  try {
    const state: PersistedState = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      data: {
        nodes,
        nodeOrder,
        // 只保存需要持久化的视口属性（排除动态计算的 canvasWidth/canvasHeight）
        viewport: {
          zoom: viewport.zoom,
          offsetX: viewport.offsetX,
          offsetY: viewport.offsetY,
          rotation: viewport.rotation,
          backgroundColor: viewport.backgroundColor,
          isGridVisible: viewport.isGridVisible,
          gridSize: viewport.gridSize,
          isSnapToGrid: viewport.isSnapToGrid,
          gridStyle: viewport.gridStyle,
          gridDotColor: viewport.gridDotColor,
          gridDotSize: viewport.gridDotSize,
        },
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[Persistence] 状态已保存到 localStorage');
  } catch (error) {
    console.error('[Persistence] 保存状态失败:', error);
  }
}

/**
 * 从 localStorage 加载状态
 */
export function loadFromLocalStorage(): PersistedState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('[Persistence] localStorage 中无保存的状态');
      return null;
    }

    const state = JSON.parse(stored) as PersistedState;

    // 版本校验（未来可用于数据迁移）
    if (state.version !== STORAGE_VERSION) {
      console.warn('[Persistence] 状态版本不匹配，可能需要迁移');
      // 这里可以添加迁移逻辑
    }

    console.log('[Persistence] 从 localStorage 加载状态成功');
    return state;
  } catch (error) {
    console.error('[Persistence] 加载状态失败:', error);
    return null;
  }
}

/**
 * 清除 localStorage 中的状态
 */
export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Persistence] localStorage 状态已清除');
  } catch (error) {
    console.error('[Persistence] 清除状态失败:', error);
  }
}

/**
 * 创建防抖保存函数
 * @param delay 防抖延迟时间（毫秒）
 */
export function createDebouncedSave(delay = 500) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (nodes: Record<string, NodeState>, nodeOrder: string[], viewport: ViewportState) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      saveToLocalStorage(nodes, nodeOrder, viewport);
      timeoutId = null;
    }, delay);
  };
}

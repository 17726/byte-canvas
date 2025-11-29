/**
 * 画布状态持久化模块
 * 说明：负责将画布状态保存到 localStorage 并在页面加载时恢复
 */
import type { NodeState, ViewportState } from '@/types/state';

// localStorage key
const STORAGE_KEY = 'byte-canvas-state';
const CLIPBOARD_KEY = 'byte-canvas-clipboard';
const STORAGE_VERSION = 1; // 用于未来数据格式升级

// 过期时间配置（24小时，单位：毫秒）
const STATE_EXPIRY_MS = 24 * 60 * 60 * 1000;

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
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('[Persistence] localStorage 空间不足，无法保存状态');
    } else if (error instanceof DOMException && error.name === 'SecurityError') {
      console.error('[Persistence] 无法访问 localStorage（可能是隐私模式）');
    } else {
      console.error('[Persistence] 保存状态失败:', error);
    }
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
      console.warn('[Persistence] 状态版本不匹配，已拒绝加载旧版本数据');
      clearLocalStorage();
      return null;
    }

    // 过期时间校验（24小时后自动清除）
    const age = Date.now() - state.timestamp;
    if (age > STATE_EXPIRY_MS) {
      console.warn(
        `[Persistence] 状态已过期（${Math.floor(age / 3600000)}小时前保存），已自动清除`
      );
      clearLocalStorage();
      return null;
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
  let lastArgs: [Record<string, NodeState>, string[], ViewportState] | null = null;

  function save(nodes: Record<string, NodeState>, nodeOrder: string[], viewport: ViewportState) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    lastArgs = [nodes, nodeOrder, viewport];
    timeoutId = setTimeout(() => {
      if (lastArgs) {
        saveToLocalStorage(...lastArgs);
        lastArgs = null;
      }
      timeoutId = null;
    }, delay);
  }

  function cancel() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  }

  /**
   * 立即保存待处理的状态（跳过防抖延迟）
   * 使用场景：页面卸载前强制保存，确保数据不丢失
   */
  function flush() {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      saveToLocalStorage(...lastArgs);
      timeoutId = null;
      lastArgs = null;
    }
  }

  return {
    save,
    cancel,
    flush,
  };
}

// ==================== 剪贴板持久化 ====================

/**
 * 剪贴板数据结构
 */
export interface ClipboardData {
  type: 'copy' | 'cut';
  nodes: NodeState[];
  timestamp: number;
}

/**
 * 保存剪贴板数据到 localStorage
 */
export function saveClipboard(data: ClipboardData): void {
  try {
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(data));
    console.log(
      `[Clipboard] ${data.type === 'copy' ? '复制' : '剪切'} ${data.nodes.length} 个元素`
    );
  } catch (error) {
    console.error('[Clipboard] 保存剪贴板失败:', error);
  }
}

/**
 * 从 localStorage 加载剪贴板数据
 */
export function loadClipboard(): ClipboardData | null {
  try {
    const stored = localStorage.getItem(CLIPBOARD_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    // Validate structure
    if (
      !data ||
      !['copy', 'cut'].includes(data.type) ||
      !Array.isArray(data.nodes) ||
      typeof data.timestamp !== 'number'
    ) {
      console.warn('[Clipboard] Invalid clipboard structure');
      return null;
    }
    return data as ClipboardData;
  } catch (error) {
    console.error('[Clipboard] 加载剪贴板失败:', error);
    return null;
  }
}

/**
 * 清除剪贴板
 */
export function clearClipboard(): void {
  try {
    localStorage.removeItem(CLIPBOARD_KEY);
  } catch (error) {
    console.error('[Clipboard] 清除剪贴板失败:', error);
  }
}

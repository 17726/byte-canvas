/**
 * @file historyStore.ts
 * @description History store：管理画布的快照、撤销/重做与历史锁
 *
 * 职责：
 * - 维护撤销/重做栈，提供快照的创建与恢复
 * - 提供历史锁以聚合批量操作（避免重复快照）
 * - 与 canvas/selection store 协同保存节点、视口与选中态
 *
 * State:
 * - historyStack: 撤销栈（最新状态在栈顶）
 * - redoStack: 重做栈
 * - isRestoring: 是否处于快照恢复中（防止循环记录）
 * - isLocked: 是否锁定快照记录（批量更新时使用）
 *
 * Actions:
 * - pushSnapshot/undo/redo: 快照的记录与恢复
 * - lockHistory/lockHistoryWithoutSnapshot: 锁定历史，避免批量操作产生多次快照
 * - clearHistory: 清空历史栈并解锁
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { cloneDeep } from 'lodash-es';
import type { NodeState, ViewportState } from '@/types/state';
import { useCanvasStore } from './canvasStore';
import { useSelectionStore } from './selectionStore';

export type CanvasSnapshot = {
  nodes: Record<string, NodeState>;
  nodeOrder: string[];
  viewport: ViewportState;
  activeElementIds: string[];
  editingGroupId: string | null;
};

export const useHistoryStore = defineStore('history', () => {
  const historyStack = ref<CanvasSnapshot[]>([]);
  const redoStack = ref<CanvasSnapshot[]>([]);
  const isRestoring = ref(false);
  const isLocked = ref(false);
  const MAX_HISTORY = 50;

  const canUndo = computed(() => historyStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  const createSnapshot = (): CanvasSnapshot => {
    const canvasStore = useCanvasStore();
    const selectionStore = useSelectionStore();

    return {
      nodes: cloneDeep(canvasStore.nodes),
      nodeOrder: [...canvasStore.nodeOrder],
      viewport: { ...(canvasStore.viewport as ViewportState) },
      activeElementIds: Array.from(selectionStore.activeElementIds),
      editingGroupId: selectionStore.editingGroupId,
    };
  };

  const captureSnapshot = (): CanvasSnapshot => createSnapshot();

  const pushSnapshotData = (snapshot: CanvasSnapshot) => {
    if (isRestoring.value || isLocked.value) return;
    // 深拷贝防止外部引用被修改
    historyStack.value.push(snapshot);
    if (historyStack.value.length > MAX_HISTORY) {
      historyStack.value.shift();
    }
    redoStack.value = [];
  };

  const pushSnapshot = () => {
    if (isRestoring.value || isLocked.value) return;
    historyStack.value.push(createSnapshot());
    if (historyStack.value.length > MAX_HISTORY) {
      historyStack.value.shift();
    }
    redoStack.value = [];
  };

  const restoreSnapshot = (snapshot: CanvasSnapshot) => {
    const canvasStore = useCanvasStore();
    const selectionStore = useSelectionStore();
    isRestoring.value = true;

    canvasStore.nodes = cloneDeep(snapshot.nodes);
    canvasStore.nodeOrder = [...snapshot.nodeOrder];
    Object.assign(canvasStore.viewport, snapshot.viewport);
    selectionStore.setActive(snapshot.activeElementIds);
    selectionStore.setEditingGroup(snapshot.editingGroupId);

    canvasStore.version++;
    queueMicrotask(() => {
      isRestoring.value = false;
    });
  };

  const undo = () => {
    if (!historyStack.value.length) return false;
    const current = createSnapshot();
    const previous = historyStack.value.pop()!;
    redoStack.value.push(current);
    restoreSnapshot(previous);
    return true;
  };

  const redo = () => {
    if (!redoStack.value.length) return false;
    const current = createSnapshot();
    const next = redoStack.value.pop()!;
    historyStack.value.push(current);
    restoreSnapshot(next);
    return true;
  };

  const lockHistory = () => {
    const wasLocked = isLocked.value;
    if (!wasLocked) {
      pushSnapshot();
      isLocked.value = true;
    }
    return () => {
      if (!wasLocked) {
        isLocked.value = false;
      }
    };
  };

  const lockHistoryWithoutSnapshot = () => {
    const wasLocked = isLocked.value;
    if (!wasLocked) {
      isLocked.value = true;
    }
    return () => {
      if (!wasLocked) {
        isLocked.value = false;
      }
    };
  };

  const clearHistory = () => {
    historyStack.value = [];
    redoStack.value = [];
    isLocked.value = false;
    isRestoring.value = false;
  };

  return {
    historyStack,
    redoStack,
    isRestoring,
    isLocked,
    canUndo,
    canRedo,
    captureSnapshot,
    pushSnapshotData,
    pushSnapshot,
    undo,
    redo,
    restoreSnapshot,
    lockHistory,
    lockHistoryWithoutSnapshot,
    clearHistory,
  };
});

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
    pushSnapshot,
    undo,
    redo,
    restoreSnapshot,
    lockHistory,
    lockHistoryWithoutSnapshot,
    clearHistory,
  };
});

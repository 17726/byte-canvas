import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { NodeState } from '@/types/state';
import { useCanvasStore } from './canvasStore';

export const useSelectionStore = defineStore('selection', () => {
  const activeElementIds = ref<Set<string>>(new Set());
  const editingGroupId = ref<string | null>(null);

  const canvasStore = useCanvasStore();

  const activeElements = computed(() => {
    return Array.from(activeElementIds.value)
      .map((id) => canvasStore.nodes[id])
      .filter(Boolean) as NodeState[];
  });

  const isSingleSelection = computed(() => activeElementIds.value.size === 1);

  const activeNode = computed<NodeState | null>(() => {
    if (activeElementIds.value.size !== 1) return null;
    const [id] = Array.from(activeElementIds.value);
    return canvasStore.nodes[id] || null;
  });

  const setActive = (ids: string[]) => {
    const validIds = [...new Set(ids)].filter((id) => canvasStore.nodes[id]);
    activeElementIds.value = new Set(validIds);
  };

  const toggleSelection = (id: string) => {
    if (!canvasStore.nodes[id]) return;
    const next = new Set(activeElementIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    activeElementIds.value = next;
  };

  const clearSelection = () => {
    activeElementIds.value = new Set();
  };

  const setEditingGroup = (id: string | null) => {
    editingGroupId.value = id;
  };

  return {
    activeElementIds,
    editingGroupId,
    activeElements,
    isSingleSelection,
    activeNode,
    setActive,
    toggleSelection,
    clearSelection,
    setEditingGroup,
  };
});

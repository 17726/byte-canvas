/**
 * @file selectionStore.ts
 * @description Selection store：管理画布的选中状态与组合编辑状态
 *
 * 职责：
 * - 维护当前选中的元素集合以及正在编辑的组合 ID
 * - 提供计算属性以获取选中元素详情与单选状态
 * - 提供选中、切换、清空与组合编辑状态的更新方法
 *
 * State:
 * - activeElementIds: 当前选中元素 ID 的集合（Set）
 * - editingGroupId: 正在编辑的组合 ID（或 null）
 *
 * Actions:
 * - setActive(ids): 设置当前选中元素
 * - toggleSelection(id): 切换单个元素的选中状态
 * - clearSelection(): 清空选中
 * - setEditingGroup(id|null): 进入/退出组合编辑模式
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { NodeState } from '@/types/state';
import { useCanvasStore } from './canvasStore';

export const useSelectionStore = defineStore('selection', () => {
  const activeElementIds = ref<Set<string>>(new Set());
  const editingGroupId = ref<string | null>(null);

  const activeElements = computed(() => {
    const canvasStore = useCanvasStore();
    return Array.from(activeElementIds.value)
      .map((id) => canvasStore.nodes[id])
      .filter(Boolean) as NodeState[];
  });

  const isSingleSelection = computed(() => activeElementIds.value.size === 1);

  const activeNode = computed<NodeState | null>(() => {
    const canvasStore = useCanvasStore();
    if (activeElementIds.value.size !== 1) return null;
    const [id] = Array.from(activeElementIds.value);
    if (!id) return null; // 如果没选中则直接返回 null
    return canvasStore.nodes[id] || null;
  });

  const setActive = (ids: string[]) => {
    const canvasStore = useCanvasStore();
    const validIds = [...new Set(ids)].filter((id) => canvasStore.nodes[id]);
    activeElementIds.value = new Set(validIds);
  };

  const toggleSelection = (id: string) => {
    const canvasStore = useCanvasStore();
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

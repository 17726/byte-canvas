<template>
  <div v-if="isVisible" class="group-toolbar" :style="positionStyle" @mousedown.stop>
    <!-- 组合按钮 -->
    <a-button
      v-if="showGroupButton"
      size="mini"
      type="primary"
      @click="handleGroup"
      title="组合 (Ctrl+G)"
    >
      <template #icon>
        <icon-group />
      </template>
      组合
    </a-button>

    <!-- 解组合按钮 -->
    <a-button
      v-if="canUngroup"
      size="mini"
      type="outline"
      @click="handleUngroup"
      title="解组合 (Ctrl+Shift+G)"
    >
      <template #icon>
        <icon-ungroup />
      </template>
      解组合
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { worldToClient } from '@/core/utils/geometry';
import { Group as IconGroup, Ungroup as IconUngroup } from '@icon-park/vue-next';
import { useNodeActions } from '@/composables/useNodeActions';

const store = useCanvasStore();
const { canGroup, canUngroup, groupSelected, ungroupSelected } = useNodeActions();

// 显示条件：选中多个元素时显示组合按钮，选中组合时显示解组合按钮
const hasChildSelection = computed(() => {
  const ids = Array.from(store.activeElementIds);
  return ids.some((id) => {
    const node = store.nodes[id];
    return node && node.parentId !== null;
  });
});

const showGroupButton = computed(() => canGroup.value && !hasChildSelection.value);

const isVisible = computed(() => {
  return (showGroupButton.value || canUngroup.value) && !store.isInteracting;
});

// 计算工具栏位置：在选中区域的上方中央
const positionStyle = computed(() => {
  const ids = Array.from(store.activeElementIds);
  if (ids.length === 0) return {};

  // 计算所有选中节点的边界框
  const bounds = store.getSelectionBounds(ids);

  // 计算边界框顶部中心点的屏幕坐标
  const worldPos = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y,
  };

  const clientPos = worldToClient(store.viewport, worldPos.x, worldPos.y);

  return {
    top: `${clientPos.y - 12}px`,
    left: `${clientPos.x}px`,
    transform: 'translate(-50%, -100%)',
  };
});

// 组合操作
const handleGroup = () => {
  groupSelected();
};

// 解组合操作
const handleUngroup = () => {
  ungroupSelected();
};
</script>

<style scoped>
.group-toolbar {
  position: absolute;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background-color: var(--color-bg-2);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--color-border-2);
  pointer-events: auto;
}

.group-toolbar :deep(.arco-btn) {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>

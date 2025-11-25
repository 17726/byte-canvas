<template>
  <div class="canvas-toolbar">
    <!-- 使用 Arco Design 按钮 -->
    <a-space>
      <a-button type="primary" @click="addRect">
        <template #icon><icon-plus /></template>
        矩形
      </a-button>
      <a-button>文本</a-button>
      <a-button>图片</a-button>

      <a-divider direction="vertical" />

      <a-button status="danger" @click="deleteSelected" :disabled="!hasSelection">
        <template #icon><icon-delete /></template>
        删除
      </a-button>
    </a-space>
  </div>
  <div class="property-panel">
    <PropertyPanel></PropertyPanel>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { IconPlus, IconDelete } from '@arco-design/web-vue/es/icon';
import { ToolManager } from '@/core/tools/ToolManager';
import PropertyPanel from '@/components/layout/PropertyPanel.vue';
const store = useCanvasStore();
const toolManager = new ToolManager();

const hasSelection = computed(() => store.activeElementIds.size > 0);

// 添加矩形
const addRect = () => {
  toolManager.createRect();
};

// 删除选中
const deleteSelected = () => {
  toolManager.deleteSelected();
};
</script>

<style scoped>
.canvas-toolbar {
  display: flex;
  padding: 4px;
  /* 移除阴影和背景，使其融入 Header */
  background: transparent;
  border-radius: 4px;
}
.property-panel {
  padding: 4px;
}
</style>

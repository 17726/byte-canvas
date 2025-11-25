<template>
  <div class="canvas-toolbar">
    <!-- 使用 Arco Design 按钮 -->
    <a-space>
      <a-button type="primary" shape="square" @click="addRect">
        <template #icon><icon-plus /></template>
        矩形
      </a-button>
      <a-button type="primary" shape="square" @click="addCircle">
        <template #icon><icon-plus /></template>
        圆形
      </a-button>
      <a-button type="primary" shape="square" @click="addText">
        <template #icon><icon-plus /></template>
        文本
      </a-button>
      <a-button>图片</a-button>

      <a-divider direction="vertical" />

      <a-button status="danger" @click="deleteSelected" :disabled="!hasSelection">
        <template #icon><icon-delete /></template>
        删除
      </a-button>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { ToolManager } from '@/core/tools/ToolManager';
import { useCanvasStore } from '@/store/canvasStore';
import { IconDelete, IconPlus } from '@arco-design/web-vue/es/icon';
import { computed } from 'vue';

const store = useCanvasStore();
const toolManager = new ToolManager();

const hasSelection = computed(() => store.activeElementIds.size > 0);

// 添加矩形
const addRect = () => {
  console.log('矩形被点击');
  toolManager.createRect();
};
//添加文本
const addText = () => {
  toolManager.createText();
};

// 添加圆形
const addCircle = () => {
  console.log('圆被点击');
  toolManager.createCircle();
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
</style>

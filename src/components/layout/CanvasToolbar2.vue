<template>
  <!-- 使用 Arco Design 菜单 -->
  <div class="ToolMenu">
    <a-menu mode="pop" showCollapseButton :default-collapsed="true" @menu-item-click="onMenuItemClick">
      <!-- 元素创建列表 -->
      <a-sub-menu key="addGraphics">
        <template #icon><icon-plus/></template>
        <template #title>图形</template>
        <!-- 创建矩形 -->
        <a-menu-item key="addRect">
          <template #icon><square/></template>
          矩形
        </a-menu-item>
        <!-- 创建圆形 -->
        <a-menu-item key="addCircle">
          <template #icon><round/></template>
          圆形
        </a-menu-item>
      </a-sub-menu>
      <!-- 文本创建按钮 -->
      <a-menu-item key="addText">
        <template #icon><icon-edit/></template>
        文本
      </a-menu-item>
      <!-- 照片创建按钮 -->
      <a-menu-item key="addImage">
        <template #icon><icon-image/></template>
        图片
      </a-menu-item>
      <!-- 元素删除按钮 -->
      <a-menu-item key="deleteSelected" :disabled="!hasSelection">
        <template #icon><icon-delete /></template>
        删除
      </a-menu-item>
    </a-menu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IconPlus, IconEdit, IconImage, IconDelete } from '@arco-design/web-vue/es/icon';
import { Square , Round } from '@icon-park/vue-next';
import { useCanvasStore } from '@/store/canvasStore'
import { ToolManager } from '@/core/tools/ToolManager'

enum MenuKey {
  AddRect   = 'addRect',
  AddCircle = 'addCircle',
  AddText   = 'addText',
  AddImage  = 'addImage',
  Delete    = 'deleteSelected',
}

const store = useCanvasStore();
const hasSelection = computed(() => store.activeElementIds.size > 0);

const toolManager = new ToolManager();

function onMenuItemClick(key: string) {
  switch (key) {
    case MenuKey.AddRect:
      console.log("矩形被点击");
      toolManager.createRect();
      break;
    case MenuKey.AddCircle:
      console.log("圆被点击");
      toolManager.createCircle();
      break;
    case MenuKey.AddText:
      console.log("文本被点击");
      // toolManager.createText();   // 需 core 层实现
      break;
    case MenuKey.AddImage:
      console.log("照片被点击");
      // toolManager.createImage();  // 需 core 层实现
      break;
    case MenuKey.Delete:
      toolManager.deleteSelected();
      break;
  }
}

</script>

<style scoped>
.ToolMenu {
  width: 100%;
  height: 600px;
  padding: 40px;
  position: fixed;
  pointer-events: none;
  z-index:9999;
}

.ToolMenu .arco-menu {
  width: 150px;
  height: 100%;
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  border-radius: 22px 22px 0 22px;
}

.ToolMenu .arco-menu :deep(.arco-menu-collapse-button) {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.ToolMenu .arco-menu:not(.arco-menu-collapsed) :deep(.arco-menu-collapse-button) {
  right: 0;
  bottom: 8px;
  transform: translateX(50%);
}

.ToolMenu .arco-menu:not(.arco-menu-collapsed)::before {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 48px;
  height: 48px;
  background-color: inherit;
  border-radius: 50%;
  box-shadow: -4px 0 2px var(--color-bg-2), 0 0 1px rgba(0, 0, 0, 0.3);
  transform: translateX(50%);
}

.ToolMenu .arco-menu.arco-menu-collapsed {
  width: 48px;
  height: auto;
  padding-top: 24px;
  padding-bottom: 138px;
  border-radius: 22px;
}

.ToolMenu .arco-menu.arco-menu-collapsed :deep(.arco-menu-collapse-button) {
  right: 8px;
  bottom: 8px;
}
</style>

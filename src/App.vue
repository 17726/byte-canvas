<script setup lang="ts">
import CanvasStage from '@/components/editor/CanvasStage.vue';
import CanvasHeader from '@/components/layout/CanvasHeader.vue';
import CanvasToolbar from '@/components/layout/CanvasToolbar.vue';
import PropertyPanel from '@/components/layout/PropertyPanel.vue';
</script>

<template>
  <a-layout class="app-container">
    <!-- 页头 -->
    <CanvasHeader />

    <a-layout class="main-layout">
      <!-- 左侧工具栏 (固定宽度) -->
      <a-layout-sider :width="0" class="left-sider">
        <CanvasToolbar />
      </a-layout-sider>

      <!-- 中间画布 -->
      <a-layout-content class="canvas-content">
        <CanvasStage />
      </a-layout-content>

      <!-- 右侧属性面板 (固定宽度) -->
      <a-layout-sider :width="280" class="right-sider">
        <PropertyPanel />
      </a-layout-sider>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-layout {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: row;
}

.left-sider {
  /* background: var(--color-bg-2); */
  border-right: 1px solid var(--color-border);
  z-index: 10;
}

.canvas-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--color-fill-2);
}

.right-sider {
  background: var(--color-bg-2);
  border-left: 1px solid var(--color-border);
  z-index: 10;
}
</style>

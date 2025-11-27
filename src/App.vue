<script setup lang="ts">
import CanvasStage from '@/components/editor/CanvasStage.vue';
import CanvasHeader from '@/components/layout/CanvasHeader.vue';
import CanvasToolbar2 from '@/components/layout/CanvasToolbar2.vue';
import PropertyPanel from '@/components/layout/PropertyPanel.vue';
</script>

<template>
  <a-layout class="app-container">
    <!-- 页头 -->
    <CanvasHeader />

    <a-layout>
      <!-- 页面内容 -->
      <a-layout-content class="main-content">
        <!-- 工具栏 -->
        <CanvasToolbar2 />
        <!-- 画板组件 -->
        <CanvasStage />
      </a-layout-content>

      <!-- 右侧属性面板 -->
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
  overflow: hidden;
}

.main-content {
  position: relative;
  overflow: hidden;
  background: var(--color-fill-2);
  display: flex;
  flex-direction: column;
}

.right-sider {
  background: var(--color-bg-2);
  border-left: 1px solid var(--color-border);
  z-index: 10;
}
</style>

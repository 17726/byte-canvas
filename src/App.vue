<script setup lang="ts">
import CanvasStage from '@/components/editor/CanvasStage.vue';
import CanvasToolbar from '@/components/layout/CanvasToolbar.vue';
</script>

<template>
  <a-layout class="app-container">
    <a-layout-header class="header">
      <div class="logo">Byte Canvas</div>
      <!-- 工具栏居中显示 -->
      <div class="toolbar-container">
        <CanvasToolbar />
      </div>
      <!-- 右侧占位，保持 Logo 左对齐 -->
      <div class="header-right"></div>
    </a-layout-header>
    <a-layout-content class="main-content">
      <CanvasStage />
    </a-layout-content>

  </a-layout>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.header {
  height: 56px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between; /* 两端对齐 */
  padding: 0 20px;
  background: var(--color-bg-2);
  z-index: 10;
}

.logo {
  font-weight: bold;
  font-size: 18px;
  color: var(--color-text-1);
  width: 200px; /* 固定宽度 */
}

.toolbar-container {
  flex: 1;
  display: flex;
  justify-content: center; /* 居中 */
}

.header-right {
  width: 200px; /* 与 Logo 同宽，确保中间居中 */
}

.main-content {
  position: relative;
  overflow: hidden;
  background: var(--color-fill-2);
}
</style>

<script setup lang="ts">
import CanvasStage from '@/components/editor/CanvasStage.vue';
import CanvasHeader from '@/components/layout/CanvasHeader.vue';
import CanvasToolbar2 from '@/components/layout/CanvasToolbar2.vue';
</script>

<template>
  <a-layout class="app-container">

    <!-- 页头 -->
    <CanvasHeader />

    <!-- 页面内容 -->
    <a-layout-content class="main-content">
      <!-- 工具栏 -->
      <CanvasToolbar2/>
      <!-- 画板组件 -->
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

.main-content {
  position: relative;
  overflow: hidden;
  background: var(--color-fill-2);
}
</style>

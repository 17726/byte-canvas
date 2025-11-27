<template>
  <div class="canvas-header" :style="{ background: 'var(--color-fill-2)' }">
    <a-page-header
      :style="{ background: 'var(--color-bg-2)', paddingLeft: '15px' }"
      title="Byte Canvas"
      subtitle="无限画布"
      :show-back="false"
    >
      <template #extra>
        <a-button size="medium" type="text" class="canvas-settings-btn" @click="openSettings">
          <template #icon><icon-settings /></template>
        </a-button>
      </template>
    </a-page-header>
  </div>
</template>

<script setup lang="ts">
import { useCanvasStore } from '@/store/canvasStore';
import { IconSettings } from '@arco-design/web-vue/es/icon';

const store = useCanvasStore();
// Settings are handled via the right-hand `PropertyPanel` (canvas mode), no popover here

function openSettings() {
  store.setActivePanel('canvas');
  store.setPanelExpanded(true);
}
</script>

<style scoped>
.canvas-settings-btn {
  border-radius: 8px;
}

.canvas-header {
  /* subtle drop shadow to visually separate header from white canvas */
  box-shadow: 0 2px 8px rgba(16, 24, 40, 0.06);
  border-bottom: 1px solid rgba(16, 24, 40, 0.04);
}
</style>

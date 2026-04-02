<template>
  <div class="canvas-header" :style="{ background: 'var(--color-fill-2)' }">
    <a-page-header
      :style="{ background: 'var(--color-bg-2)', paddingLeft: '15px' }"
      title="Byte Canvas"
      subtitle="无限画布"
      :show-back="false"
    >
      <template #extra>
        <a-tooltip content="画布设置" :mini="true" position="br">
          <a-button size="medium" type="text" class="canvas-settings-btn" @click="openSettings">
            <template #icon><icon-settings /></template>
          </a-button>
        </a-tooltip>
      </template>
    </a-page-header>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '@/store/uiStore';
import { IconSettings } from '@arco-design/web-vue/es/icon';

const ui = useUIStore();

function openSettings() {
  ui.setActivePanel('canvas');
  ui.setPanelExpanded(true);
}
</script>

<style scoped>
.canvas-settings-btn {
  border-radius: 8px;
}

.canvas-header {
  box-shadow: 0 2px 8px rgba(16, 24, 40, 0.06);
  border-bottom: 1px solid rgba(16, 24, 40, 0.04);
}
</style>

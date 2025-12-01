<script setup lang="ts">
import { watch, computed,onMounted } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { Left as IconLeft, Right as IconRight } from '@icon-park/vue-next';
import CanvasStage from '@/components/editor/CanvasStage.vue';
import CanvasHeader from '@/components/layout/CanvasHeader.vue';
import CanvasToolbar from '@/components/layout/CanvasToolbar.vue';
import PropertyPanel from '@/components/layout/PropertyPanel.vue';

const store = useCanvasStore();
const ui = useUIStore();

// 应用启动时从 localStorage 恢复画布状态
onMounted(() => {
  store.initFromStorage();
});

// 监听选中状态，自动展开/折叠
watch(
  () => store.activeElementIds.size,
  (newSize) => {
    if (newSize > 0) {
      ui.setPanelExpanded(true);
      ui.setActivePanel('node');
    } else {
      ui.setPanelExpanded(false);
    }
  },
  { immediate: true }
);

const togglePanel = () => {
  ui.setPanelExpanded(!ui.isPanelExpanded);
};

const showPopover = computed(() => !ui.isPanelExpanded);
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

        <!-- 展开/折叠按钮 -->
        <template v-if="showPopover">
          <a-tooltip content="属性" position="left">
            <div class="panel-toggle-btn" @click="togglePanel">
              <component :is="ui.isPanelExpanded ? IconRight : IconLeft" size="16" fill="#333" />
            </div>
          </a-tooltip>
        </template>

        <div v-else class="panel-toggle-btn" @click="togglePanel">
          <component :is="ui.isPanelExpanded ? IconRight : IconLeft" size="16" fill="#333" />
        </div>
      </a-layout-content>

      <!-- 右侧属性面板 (固定宽度) -->
      <a-layout-sider
        :width="280"
        class="right-sider"
        :collapsed="!ui.isPanelExpanded"
        :collapsed-width="0"
        :trigger="null"
        breakpoint="xl"
      >
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
  transition: all 0.3s cubic-bezier(0.34, 0.69, 0.1, 1); /* 优化动画曲线 */
}

.panel-toggle-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 48px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.05);
  transition: background-color 0.2s;
}

.panel-toggle-btn:hover {
  background-color: var(--color-fill-3);
}
</style>

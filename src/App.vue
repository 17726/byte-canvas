<script setup lang="ts">
import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';
import { useUIStore } from '@/store/uiStore';
import { Left as IconLeft, Right as IconRight } from '@icon-park/vue-next';
import { computed, defineAsyncComponent, onMounted, watch } from 'vue';

// =====================================
// 优化 1：核心画布【优先加载】
// 必须首屏渲染的只有这个
// =====================================
import CanvasStage from '@/components/canvas/CanvasStage.vue';

// =====================================
// 优化 2：非首屏组件【延迟加载】
// 这些全部不阻塞首屏
// =====================================
const CanvasHeader = defineAsyncComponent(() => import('@/components/ui/panels/AppHeader.vue'));
const CanvasToolbar = defineAsyncComponent(() => import('@/components/ui/panels/ToolPanel.vue'));
const PropertyPanel = defineAsyncComponent(
  () => import('@/components/ui/panels/InspectorPanel.vue')
);
const ContextMenu = defineAsyncComponent(() => import('@/components/ui/floating/ContextMenu.vue'));

const store = useCanvasStore();
const selectionStore = useSelectionStore();
const ui = useUIStore();

// =====================================
// 优化 3：首屏仅做关键初始化
// =====================================
onMounted(() => {
  // 恢复画布（必须）
  store.initFromStorage();
});

// 监听选中状态，自动展开/折叠
watch(
  () => selectionStore.activeElementIds.size,
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

// 计算是否应该隐藏面板
const shouldHidePanel = computed(() => {
  if (ui.activePanel === 'canvas') {
    return !ui.isPanelExpanded;
  }

  const isMultiSelect = selectionStore.activeElements.length > 1;
  if (isMultiSelect) {
    return true;
  }

  return !ui.isPanelExpanded;
});
</script>

<template>
  <a-layout class="app-container">
    <!-- 页头占位：固定高度避免延迟加载导致 CLS -->
    <div class="app-header-slot">
      <Suspense>
        <CanvasHeader />
        <template #fallback>
          <div class="app-header-skeleton" aria-hidden="true" />
        </template>
      </Suspense>
    </div>

    <a-layout class="main-layout">
      <!-- 左侧工具栏 → 延迟渲染 -->
      <a-layout-sider :width="0" class="left-sider">
        <CanvasToolbar />
      </a-layout-sider>

      <!-- 中间画布 → 首屏必须渲染 -->
      <a-layout-content class="canvas-content">
        <CanvasStage />

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

        <!-- 右键菜单 → 延迟渲染 -->
        <ContextMenu />
      </a-layout-content>

      <!-- 右侧属性面板 → 延迟渲染 -->
      <a-layout-sider
        :width="280"
        class="right-sider"
        :collapsed="shouldHidePanel"
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

.app-header-slot {
  height: 64px;
  min-height: 64px;
  flex-shrink: 0;
  overflow: hidden;
}

.app-header-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-fill-2) 0%,
    var(--color-fill-3) 50%,
    var(--color-fill-2) 100%
  );
  background-size: 200% 100%;
  border-bottom: 1px solid rgba(16, 24, 40, 0.04);
  box-shadow: 0 2px 8px rgba(16, 24, 40, 0.06);
  animation: header-shimmer 1.4s ease-in-out infinite;
}

@keyframes header-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.main-layout {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: row;
}

.left-sider {
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
  transition: all 0.3s cubic-bezier(0.34, 0.69, 0.1, 1);
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

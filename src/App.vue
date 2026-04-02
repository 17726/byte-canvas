<script setup lang="ts">
import { watch, computed, onMounted, ref, getCurrentInstance } from 'vue';
import { Layout, LayoutSider, LayoutContent, Tooltip } from '@arco-design/web-vue';
import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';
import { useUIStore } from '@/store/uiStore';
import { Left as IconLeft, Right as IconRight } from '@icon-park/vue-next';

// ====== 局部注册 Arco 布局 + Tooltip 组件 ======
const app = getCurrentInstance()?.appContext.app;
if (app) {
  app.component('a-layout', Layout);
  app.component('a-layout-sider', LayoutSider);
  app.component('a-layout-content', LayoutContent);
  app.component('a-tooltip', Tooltip);
}
// =====================================
// 优化 1：核心画布【优先加载】
// 必须首屏渲染的只有这个
// =====================================
import CanvasStage from '@/components/canvas/CanvasStage.vue';

// =====================================
// 优化 2：非首屏组件【延迟加载】
// 这些全部不阻塞首屏
// =====================================
import type { Component } from 'vue';

const CanvasHeader = ref<Component | null>(null);
const CanvasToolbar = ref<Component | null>(null);
const PropertyPanel = ref<Component | null>(null);
const ContextMenu = ref<Component | null>(null);

const store = useCanvasStore();
const selectionStore = useSelectionStore();
const ui = useUIStore();

// =====================================
// 优化 3：延迟加载非首屏组件 + 延迟初始化
// 等 Vue 首屏渲染完了再加载
// =====================================
onMounted(() => {
  // 1. 先恢复画布（必须）
  store.initFromStorage();

  // 2. 延迟加载所有非首屏 UI（关键优化）
  setTimeout(() => {
    import('@/components/ui/panels/AppHeader.vue').then((mod) => {
      CanvasHeader.value = mod.default;
    });
    import('@/components/ui/panels/ToolPanel.vue').then((mod) => {
      CanvasToolbar.value = mod.default;
    });
    import('@/components/ui/panels/InspectorPanel.vue').then((mod) => {
      PropertyPanel.value = mod.default;
    });
    import('@/components/ui/floating/ContextMenu.vue').then((mod) => {
      ContextMenu.value = mod.default;
    });
  }, 200); // 200ms 足够首屏渲染完成
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
    <!-- 页头 → 延迟渲染 -->
    <CanvasHeader v-if="CanvasHeader" />

    <a-layout class="main-layout">
      <!-- 左侧工具栏 → 延迟渲染 -->
      <a-layout-sider :width="0" class="left-sider">
        <CanvasToolbar v-if="CanvasToolbar" />
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
        <ContextMenu v-if="ContextMenu" />
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
        <PropertyPanel v-if="PropertyPanel" />
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

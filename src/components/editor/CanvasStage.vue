<template>
  <div
    class="canvas-stage"
    ref="stageRef"
    @mousedown="handleMouseDown"
    @wheel="handleWheel"
    :style="stageStyle"
  >
    <!--
      视口层 (Viewport Layer)
      职责：应用全局的平移(Translate)和缩放(Scale)
      对应文档：L4 渲染层 - 画布容器
    -->
    <div class="canvas-viewport" :style="viewportStyle">
      <!--
        图元渲染层 (Node Rendering Layer)
        职责：遍历 Store 中的节点列表进行渲染
        对应文档：L4 渲染层 - 响应式渲染
      -->
      <component
        v-for="node in store.renderList"
        :key="node!.id"
        :is="getComponentType(node!.type)"
        :node="node"
        @mousedown="handleNodeDown($event, node!.id)"
      />

      <!-- 选中覆盖层 (处理拖拽缩放) -->
      <SelectionOverlay />
    </div>

    <!-- 悬浮属性栏 (Context Toolbar) - 放在视口外，但跟随节点坐标 -->
    <ContextToolbar />

    <!-- 辅助信息：显示当前视口状态 -->
    <div class="debug-info" @click="resetViewport" title="点击恢复默认视图">
      Zoom: {{ (store.viewport.zoom * 100).toFixed(0) }}% <br />
      X: {{ store.viewport.offsetX.toFixed(0) }} <br />
      Y: {{ store.viewport.offsetY.toFixed(0) }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide, type CSSProperties } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType } from '@/types/state';
import RectLayer from './layers/RectLayer.vue';
import TextLayer from './layers/TextLayer.vue';
import CircleLayer from './layers/CircleLayer.vue';
import ImageLayer from './layers/ImageLayer.vue';
import SelectionOverlay from './SelectionOverlay.vue';
import ContextToolbar from '../layout/ContextToolbar.vue'; // Import ContextToolbar
import { ToolManager } from '@/core/tools/ToolManager';
import {
  DEFAULT_VIEWPORT,
  DEFAULT_CANVAS_BG,
  DEFAULT_GRID_DOT_COLOR,
  DEFAULT_GRID_DOT_SIZE,
} from '@/config/defaults';

const store = useCanvasStore();
const stageRef = ref<HTMLElement | null>(null);
const toolManager = new ToolManager();

// 将 toolManager 提供给子组件
provide('toolManager', toolManager);

// 1. 视口样式计算
const viewportStyle = computed(() => ({
  transform: `translate(${store.viewport.offsetX}px, ${store.viewport.offsetY}px) scale(${store.viewport.zoom})`,
  transformOrigin: '0 0', // 从左上角开始变换
}));

// 背景样式计算 (点阵效果)
const stageStyle = computed(() => {
  const bg = store.viewport.backgroundColor || DEFAULT_CANVAS_BG; // use store setting

  if (!store.viewport.isGridVisible) {
    return { backgroundColor: bg };
  }

  const gridSize = Math.max(8, store.viewport.gridSize) * store.viewport.zoom; // 防止 zoom=0 或 gridSize 太小影响显示
  const offsetX = store.viewport.offsetX;
  const offsetY = store.viewport.offsetY;
  const dotColor = store.viewport.gridDotColor || DEFAULT_GRID_DOT_COLOR;
  const dotSize = store.viewport.gridDotSize || DEFAULT_GRID_DOT_SIZE; // px
  const gridStyle = store.viewport.gridStyle || 'dot';

  const style: CSSProperties = { backgroundColor: bg };
  if (gridStyle === 'dot') {
    style.backgroundImage = `radial-gradient(${dotColor} ${dotSize}px, transparent ${dotSize}px)`;
    style.backgroundSize = `${gridSize}px ${gridSize}px`;
    style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  } else if (gridStyle === 'line') {
    // Use two repeating-linear-gradients to draw grid lines
    const lineColor = dotColor;
    style.backgroundImage = `linear-gradient(0deg, ${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`;
    style.backgroundSize = `${gridSize}px ${gridSize}px`;
    style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  }

  return style;
});

// 重置视口
const resetViewport = () => {
  store.viewport.zoom = DEFAULT_VIEWPORT.zoom;
  store.viewport.offsetX = DEFAULT_VIEWPORT.offsetX;
  store.viewport.offsetY = DEFAULT_VIEWPORT.offsetY;
};

// 2. 组件映射工厂
const getComponentType = (type: NodeType) => {
  // Removed excessive debug log
  switch (type) {
    case NodeType.RECT:
      return RectLayer;
    case NodeType.CIRCLE:
      return CircleLayer;
    case NodeType.TEXT:
      return TextLayer;
    case NodeType.IMAGE:
      return ImageLayer;
    default:
      return 'div';
  }
};

// 3. 事件转发 -> 逻辑层 (ToolManager)
// 滚轮缩放
const handleWheel = (e: WheelEvent) => {
  toolManager.handleWheel(e);
};
// 鼠标按下
const handleMouseDown = (e: MouseEvent) => {
  toolManager.handleMouseDown(e);
};
// 鼠标移动
const handleMouseMove = (e: MouseEvent) => {
  toolManager.handleMouseMove(e);
};
// 鼠标抬起
const handleMouseUp = () => {
  toolManager.handleMouseUp();
};

// 节点交互转发
const handleNodeDown = (e: MouseEvent, id: string) => {
  // 注意：这里传入 e，以便 ToolManager 处理 stopPropagation 或其他逻辑
  toolManager.handleNodeDown(e, id);
};

// 全局事件监听
onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
});
</script>

<style scoped>
.canvas-stage {
  width: 100%;
  height: 100%;
  overflow: hidden; /* 隐藏超出视口的内容 */
  /* background color moved to inline stageStyle */
  position: relative;
  /* cursor: grab; */ /* 暂时禁用拖拽手势 */
}

/* .canvas-stage:active {
  cursor: grabbing;
} */

.canvas-viewport {
  width: 100%;
  height: 100%;
  /* 硬件加速 */
  will-change: transform;
}

.debug-info {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.debug-info:hover {
  background: rgba(0, 0, 0, 0.7);
}
</style>

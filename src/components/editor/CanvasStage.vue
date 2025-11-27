<template>
  <div class="canvas-stage" ref="stageRef" @mousedown="handleMouseDown" @wheel="handleWheel">
    <!-- 框选视觉层 -->
    <div
      v-if="isBoxSelecting"
      class="box-select-overlay"
      :style="boxSelectStyle"
    ></div>

    <!-- 视口层 -->
    <div class="canvas-viewport" :style="viewportStyle">
      <!-- 图元渲染层 -->
      <component
        v-for="node in store.renderList"
        :key="node!.id"
        :is="getComponentType(node!.type)"
        :node="node"
        @mousedown="handleNodeDown($event, node!.id)"
      />
    </div>

    <!-- 辅助信息 -->
    <div class="debug-info">
      Zoom: {{ (store.viewport.zoom * 100).toFixed(0) }}% <br />
      X: {{ store.viewport.offsetX.toFixed(0) }} <br />
      Y: {{ store.viewport.offsetY.toFixed(0) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType } from '@/types/state';
import RectLayer from './layers/RectLayer.vue';
import TextLayer from './layers/TextLayer.vue';
import CircleLayer from './layers/CircleLayer.vue';
import { ToolManager } from '@/core/tools/ToolManager';

const store = useCanvasStore();
const stageRef = ref<HTMLElement | null>(null);
let toolManager: ToolManager; // 改为let，延迟初始化

// 将 toolManager 提供给子组件
provide('toolManager', toolManager);

// 1. 视口样式计算
const viewportStyle = computed(() => ({
  transform: `translate(${store.viewport.offsetX}px, ${store.viewport.offsetY}px) scale(${store.viewport.zoom})`,
  transformOrigin: '0 0',
}));

// 2. 组件映射工厂
const getComponentType = (type: NodeType) => {
  switch (type) {
    case NodeType.RECT:
      return RectLayer;
    case NodeType.CIRCLE:
      return CircleLayer;
    case NodeType.TEXT:
      return TextLayer;
    default:
      return 'div';
  }
};

// 框选状态响应式数据
const isBoxSelecting = ref(false);
const boxSelectStart = ref({ x: 0, y: 0 });
const boxSelectEnd = ref({ x: 0, y: 0 });

// 框选样式计算
const boxSelectStyle = computed(() => {
  const stageEl = stageRef.value;
  const stageRect = stageEl ? stageEl.getBoundingClientRect() : { left: 0, top: 0 };
  const start = boxSelectStart.value;
  const end = boxSelectEnd.value;

  // 转换为相对于画布的坐标
  const startX = start.x - stageRect.left;
  const startY = start.y - stageRect.top;
  const endX = end.x - stageRect.left;
  const endY = end.y - stageRect.top;

  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  return {
    left: `${Math.max(0, left)}px`,
    top: `${Math.max(0, top)}px`,
    width: `${Math.max(0, width)}px`,
    height: `${Math.max(0, height)}px`,
  };
});

// 3. 事件转发 -> 逻辑层
const handleWheel = (e: WheelEvent) => {
  toolManager.handleWheel(e); // 使用初始化后的实例
};
const handleMouseDown = (e: MouseEvent) => {
  toolManager.handleMouseDown(e);
};
const handleMouseMove = (e: MouseEvent) => {
  toolManager.handleMouseMove(e);
  // 同步框选状态到Vue组件
  const boxState = toolManager.getBoxSelectState();
  isBoxSelecting.value = boxState.isBoxSelecting;
  boxSelectStart.value = boxState.boxSelectStart;
  boxSelectEnd.value = boxState.boxSelectEnd;
};
const handleMouseUp = () => {
  toolManager.handleMouseUp();
  isBoxSelecting.value = false;
};

// 节点交互转发
const handleNodeDown = (e: MouseEvent, id: string) => {
  toolManager.handleNodeDown(e, id);
};

// 全局事件监听
onMounted(() => {
  // 方案一核心：传入stage元素初始化ToolManager
  toolManager = new ToolManager(stageRef.value);
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
  overflow: hidden;
  background-color: #f5f5f5;
  position: relative;
}

.canvas-viewport {
  width: 100%;
  height: 100%;
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
  pointer-events: none;
}

/* 框选样式 */
.box-select-overlay {
  position: absolute;
  background: rgba(66, 133, 244, 0.2);
  border: 1px solid rgba(66, 133, 244, 0.8);
  pointer-events: none;
  z-index: 100;
}
</style>
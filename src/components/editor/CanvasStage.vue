<template>
  <div class="canvas-stage" ref="stageRef" @mousedown="handleMouseDown" @wheel="handleWheel">
    <!--
      视口层 (Viewport Layer)
      职责：应用全局的平移(Translate)和缩放(Scale)
      对应文档：L4 渲染层 - 画布容器
    -->
    <!-- 框选视觉层 -->
    <div
      v-if="isBoxSelecting"
      class="box-select-overlay"
      :style="boxSelectStyle"
    ></div>

    <!-- 视口层 -->
    <div class="canvas-viewport" :style="viewportStyle">
      <!--
        图元渲染层 (Node Rendering Layer)
        职责：遍历 Store 中的节点列表进行渲染
        对应文档：L4 渲染层 - 响应式渲染
      -->
      <!-- 图元渲染层 -->
      <component
        v-for="node in store.renderList"
        :key="node!.id"
        :is="getComponentType(node!.type)"
        :node="node"
        @mousedown="handleNodeDown($event, node!.id)"
      />
    </div>

    <!-- 辅助信息：显示当前视口状态 -->
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
let toolManager: ToolManager; // 延迟初始化

// 1. 视口样式计算
const viewportStyle = computed(() => ({
  transform: `translate(${store.viewport.offsetX}px, ${store.viewport.offsetY}px) scale(${store.viewport.zoom})`,
  transformOrigin: '0 0', // 从左上角开始变换
}));

// 2. 组件映射工厂
const getComponentType = (type: NodeType) => {
  switch (type) {
    case NodeType.RECT:
      return RectLayer;
    case NodeType.CIRCLE:
      return CircleLayer; // 暂时用 Rect 代替
    case NodeType.TEXT:
      return TextLayer;
    default:
      return 'div';
  }
};
// 3. 事件转发 -> 逻辑层 (ToolManager)
// 滚轮缩放
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
  if (!toolManager) return; // 防御性判断
  toolManager.handleWheel(e);
};
// 鼠标按下
const handleMouseDown = (e: MouseEvent) => {
  if (!toolManager) return;
  toolManager.handleMouseDown(e);
};
// 鼠标移动
const handleMouseMove = (e: MouseEvent) => {
  if (!toolManager) return;
  toolManager.handleMouseMove(e);
  // 同步框选状态到Vue组件
  const boxState = toolManager.getBoxSelectState();
  isBoxSelecting.value = boxState.isBoxSelecting;
  boxSelectStart.value = boxState.boxSelectStart;
  boxSelectEnd.value = boxState.boxSelectEnd;
};
// 鼠标抬起
const handleMouseUp = () => {
  if (!toolManager) return;
  toolManager.handleMouseUp();
  isBoxSelecting.value = false;
};

// 节点交互转发
const handleNodeDown = (e: MouseEvent, id: string) => {
    // 注意：这里传入 e，以便 ToolManager 处理 stopPropagation 或其他逻辑
  if (!toolManager) return;
  toolManager.handleNodeDown(e, id);
};

// 暴露创建节点的方法（供父组件/子组件调用）
const createRect = () => toolManager?.createRect();
const createCircle = () => toolManager?.createCircle();
const createText = () => toolManager?.createText();
const deleteSelected = () => toolManager?.deleteSelected();

// 全局事件监听
onMounted(() => {
  // 1. 先初始化toolManager（核心修复：顺序调整）
  toolManager = new ToolManager(stageRef.value);
  // 2. 再provide给子组件（确保注入的是有效实例）
  provide('toolManager', toolManager);
  // 3. 暴露方法给父组件（可选，若需要外部调用）
  provide('createRect', createRect);
  provide('createCircle', createCircle);
  provide('createText', createText);
  provide('deleteSelected', deleteSelected);

  // 绑定事件
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
  background-color: #f5f5f5;/* 画布背景色 */
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
<template>
  <div class="canvas-stage" ref="stageRef" @mousedown="handleMouseDown" @wheel="handleWheel">
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType } from '@/types/state';
import RectLayer from './layers/RectLayer.vue';
import TextLayer from './layers/TextLayer.vue';
import CircleLayer from './layers/CircleLayer.vue';
// import TextLayer from './layers/TextLayer.vue';
import { ToolManager } from '@/core/tools/ToolManager';

const store = useCanvasStore();
const stageRef = ref<HTMLElement | null>(null);
const toolManager = new ToolManager();

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
      return RectLayer; // 暂时用 Rect 代替
    case NodeType.TEXT:
      return TextLayer;
      return CircleLayer;
    // case NodeType.TEXT: return TextLayer;
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

// 4. 节点交互转发
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
  background-color: #f5f5f5; /* 画布背景色 */
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
</style>

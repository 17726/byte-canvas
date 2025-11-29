<template>
  <!-- 多选大框覆盖层：单个大框替代原有多个节点的小框 -->
  <div
    v-if="hasSelectedNodes && !allNodesLocked"
    class="selection-overlay"
    :style="overlayStyle"
  >
    <!-- 多选大框边框 -->
    <div class="selection-border"></div>

    <!-- 8个控制点（绑定到大框上） -->
    <div
      v-for="handle in handles"
      :key="handle"
      class="resize-handle"
      :class="`handle-${handle}`"
      :style="getHandleStyle(handle)"
      @mousedown.stop.prevent="onHandleDown($event, handle)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, type Ref } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import type { ToolManager } from '@/core/tools/ToolManager';
import type { ResizeHandle } from '@/types/editor';
import type { BaseNodeState } from '@/types/state';

const store = useCanvasStore();
const toolManagerRef = inject<Ref<ToolManager | null>>('toolManager');

if (!toolManagerRef) {
  console.error('❌ SelectionOverlay: toolManager not provided!');
}

const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// 1. 多选判断：选中节点数 ≥ 1 且未全部锁定
const hasSelectedNodes = computed(() => store.activeElements.length > 0);
const allNodesLocked = computed(() =>
  store.activeElements.every(node => (node as BaseNodeState).isLocked)
);

// 2. 计算多选大框的包围盒（核心：包裹所有选中节点的最小矩形）
const selectionBounds = computed(() => {
  const nodes = store.activeElements as BaseNodeState[];
  if (nodes.length === 0) return null;
   // 新增：检查 startState 是否存在，不存在则跳过当前节点
  if(!nodes[0]) return null;

  // 初始化包围盒为第一个节点的范围
  let minX = nodes[0].transform.x;
  let maxX = nodes[0].transform.x + nodes[0].transform.width;
  let minY = nodes[0].transform.y;
  let maxY = nodes[0].transform.y + nodes[0].transform.height;

  // 遍历所有选中节点，扩展包围盒
  nodes.forEach(node => {
    const nodeX = node.transform.x;
    const nodeY = node.transform.y;
    const nodeW = node.transform.width;
    const nodeH = node.transform.height;

    minX = Math.min(minX, nodeX);
    maxX = Math.max(maxX, nodeX + nodeW);
    minY = Math.min(minY, nodeY);
    maxY = Math.max(maxY, nodeY + nodeH);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
});

// 3. 大框的样式
const overlayStyle = computed(() => {
  const bounds = selectionBounds.value;
  if (!bounds) return {};

  return {
    transform: `translate(${bounds.x}px, ${bounds.y}px)`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  };
});

// 4. 控制点样式（适配大框）
const getHandleStyle = (handle: ResizeHandle) => {
  const scale = 1 / store.viewport.zoom;
  let baseTransform = '';

  switch (handle) {
    case 'n':
    case 's':
      baseTransform = 'translateX(-50%)';
      break;
    case 'e':
    case 'w':
      baseTransform = 'translateY(-50%)';
      break;
    default:
      baseTransform = '';
  }

  return {
    transform: `${baseTransform} scale(${scale})`,
  };
};

// 5. 触发多选缩放
const onHandleDown = (e: MouseEvent, handle: ResizeHandle) => {
  const bounds = selectionBounds.value;
  if (!bounds || !toolManagerRef?.value || store.activeElements.length === 0) return;

  // 获取选中节点ID列表
  const nodeIds = store.activeElements.map(node => (node as BaseNodeState).id);

  // 调用多选缩放初始化方法
  toolManagerRef.value.handleMultiResizeDown(
    e,
    handle,
    bounds,
    nodeIds
  );
};
</script>

<style scoped>
.selection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none; /* 让鼠标事件穿透到下方的节点（除了控制点） */
  z-index: 999; /* 确保在最上层 */
}

.selection-border {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 1px solid #1890ff;
  pointer-events: none;
  box-sizing: border-box; /* 关键：让边框包含在 width/height 内，紧贴元素 */
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: #fff;
  border: 1px solid #1890ff;
  border-radius: 50%; /* 圆形控制点 */
  pointer-events: auto; /* 恢复鼠标事件响应 */
  z-index: 1000;
}

/* 控制点位置 */
.handle-nw {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}
.handle-n {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}
.handle-ne {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}
.handle-e {
  top: 50%;
  right: -4px;
  transform: translateY(-50%);
  cursor: e-resize;
}
.handle-se {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}
.handle-s {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}
.handle-sw {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}
.handle-w {
  top: 50%;
  left: -4px;
  transform: translateY(-50%);
  cursor: w-resize;
}
</style>

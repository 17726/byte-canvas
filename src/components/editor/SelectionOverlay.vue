<template>
  <div v-if="hasSelectedNodes && !allNodesLocked" class="selection-container">
    <!-- 多选时：显示每个元素的单独选中框 -->
    <div
      v-for="node in selectedNodes"
      :key="node.id"
      class="individual-selection"
      :style="getIndividualStyle(node)"
      v-if="selectedNodes.length > 1"
    ></div>

    <!-- 主选中框（单选/多选大框） -->
    <div class="selection-overlay" :style="overlayStyle">
      <!-- 选中框边框 -->
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
  store.activeElements.every((node) => (node as BaseNodeState).isLocked)
);

// 选中的节点列表
const selectedNodes = computed(() => store.activeElements as BaseNodeState[]);

// 单个元素选中框样式
const getIndividualStyle = (node: BaseNodeState) => {
  const { x, y, width, height, rotation } = node.transform;
  return {
    transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
    transformOrigin: `${width / 2}px ${height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
};

/**
 * 计算旋转后的节点边界框（AABB）
 * 将节点四个角点按旋转角度变换后，求最小外接矩形
 */
const getRotatedBounds = (node: BaseNodeState) => {
  const { x, y, width, height, rotation } = node.transform;

  // 如果没有旋转，直接返回原始边界
  if (rotation === 0) {
    return { minX: x, maxX: x + width, minY: y, maxY: y + height };
  }

  // 计算旋转中心（节点中心点）
  const cx = x + width / 2;
  const cy = y + height / 2;

  // 节点四个角点（相对于左上角）
  const corners = [
    { x: x, y: y }, // 左上
    { x: x + width, y: y }, // 右上
    { x: x + width, y: y + height }, // 右下
    { x: x, y: y + height }, // 左下
  ];

  // 旋转角度转弧度
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // 旋转所有角点，找出边界
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  corners.forEach((corner) => {
    // 相对于中心点的坐标
    const dx = corner.x - cx;
    const dy = corner.y - cy;
    // 旋转变换
    const rx = cx + dx * cos - dy * sin;
    const ry = cy + dx * sin + dy * cos;
    // 更新边界
    minX = Math.min(minX, rx);
    maxX = Math.max(maxX, rx);
    minY = Math.min(minY, ry);
    maxY = Math.max(maxY, ry);
  });

  return { minX, maxX, minY, maxY };
};

// 2. 计算多选大框的包围盒（核心：包裹所有选中节点的最小矩形，考虑旋转）
const selectionBounds = computed(() => {
  const nodes = store.activeElements as BaseNodeState[];
  if (nodes.length === 0) return null;
  if (!nodes[0]) return null;

  // 单选时：返回节点原始边界（选中框会跟着旋转）
  if (nodes.length === 1) {
    const node = nodes[0];
    return {
      x: node.transform.x,
      y: node.transform.y,
      width: node.transform.width,
      height: node.transform.height,
    };
  }

  // 多选时：计算所有节点旋转后的 AABB 并合并
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  nodes.forEach((node) => {
    const bounds = getRotatedBounds(node);
    minX = Math.min(minX, bounds.minX);
    maxX = Math.max(maxX, bounds.maxX);
    minY = Math.min(minY, bounds.minY);
    maxY = Math.max(maxY, bounds.maxY);
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

  const nodes = store.activeElements as BaseNodeState[];
  // 单选时，选中框跟随节点旋转
  const rotation = nodes.length === 1 && nodes[0] ? nodes[0].transform.rotation : 0;

  return {
    transform: `translate(${bounds.x}px, ${bounds.y}px) rotate(${rotation}deg)`,
    transformOrigin: `${bounds.width / 2}px ${bounds.height / 2}px`,
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
  const nodeIds = store.activeElements.map((node) => (node as BaseNodeState).id);

  // 调用多选缩放初始化方法
  if (nodeIds.length === 1) {
    if (!nodeIds[0]) return;
    // 单选时，调用单节点缩放初始化方法
    toolManagerRef.value.handleResizeHandleDown(e, nodeIds[0], handle);
  } else {
    // 多选时，调用多选缩放初始化方法
    toolManagerRef.value.handleMultiResizeDown(e, handle, bounds, nodeIds);
  }
</script>

<style scoped>
.selection-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.individual-selection {
  position: absolute;
  top: 0;
  left: 0;
  border: 1px dashed #1890ff;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 998;
}

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

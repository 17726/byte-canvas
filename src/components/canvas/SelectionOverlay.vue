<template>
  <div v-if="hasSelectedNodes && !allNodesLocked" class="selection-container">
    <template v-if="isEditingGroup && selectedNodes.length > 0">
      <div
        v-for="node in selectedNodes"
        :key="node.id"
        class="individual-selection"
        :style="getIndividualStyle(node)"
      ></div>
    </template>

    <div class="selection-overlay" :style="overlayStyle">
      <div class="selection-border"></div>

      <div
        v-for="handle in handles"
        :key="handle"
        class="resize-handle"
        :class="`handle-${handle}`"
        :style="getHandleStyle(handle)"
        @mousedown.stop.prevent="onHandleDown($event, handle)"
      ></div>

      <div
        class="rotate-handle"
        :style="rotateHandleStyle"
        @mousedown.stop.prevent="onRotateHandleDown"
        title="拖拽旋转（绕自身中心）"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1890ff"
          stroke-width="2"
        >
          <path
            d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, type Ref } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import type { ToolManager } from '@/core/ToolManager';
import type { ResizeHandle } from '@/types/editor';
import { NodeType, type BaseNodeState, type NodeState } from '@/types/state';

const store = useCanvasStore();
const toolManagerRef = inject<Ref<ToolManager | null>>('toolManager');

if (!toolManagerRef) {
  console.error('❌ SelectionOverlay: toolManager not provided!');
}

const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// =========================================================================================
// 辅助函数：光标旋转逻辑
// =========================================================================================

/**
 * 获取基于 Handle 的基础光标旋转角度 (CSS角度，0=n, 45=ne, ...)
 */
const getHandleBaseAngle = (handle: ResizeHandle): number => {
  switch (handle) {
    case 'n':
      return 0;
    case 'ne':
      return 45;
    case 'e':
      return 90;
    case 'se':
      return 135;
    case 's':
      return 180;
    case 'sw':
      return 225;
    case 'w':
      return 270;
    case 'nw':
      return 315;
    default:
      return 0;
  }
};

/**
 * 将角度规范化到 [0, 360) 范围内
 */
const normalizeAngle = (angle: number): number => {
  return (angle % 360) + (angle < 0 ? 360 : 0);
};

// =========================================================================================
// 状态和计算属性
// =========================================================================================

// 是否处于组合编辑模式
const isEditingGroup = computed(() => !!store.editingGroupId);

// 可见性判断：有选中节点或处于组合编辑模式时显示
const hasSelectedNodes = computed(() => store.activeElements.length > 0 || !!store.editingGroupId);

// 当前用于计算"大框"的目标节点
const overlayNodes = computed<BaseNodeState[]>(() => {
  const editingId = store.editingGroupId;
  if (editingId) {
    const node = store.nodes[editingId];
    if (node) {
      return [node as BaseNodeState];
    }
  }
  return store.activeElements as BaseNodeState[];
});

const allNodesLocked = computed(() =>
  overlayNodes.value.every((node) => (node as BaseNodeState).isLocked)
);

// 选中的节点列表（用于绘制每个子元素的单独虚线框）
const selectedNodes = computed(() => store.activeElements as BaseNodeState[]);

// 单个元素选中框样式（使用绝对坐标）
const getIndividualStyle = (node: BaseNodeState) => {
  const absTransform = store.getAbsoluteTransform(node.id);
  const { x, y, width, height, rotation } = absTransform || node.transform;
  return {
    transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
    transformOrigin: `${width / 2}px ${height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
};

/**
 * 计算旋转后的节点边界框（AABB）
 * 使用绝对坐标，考虑父组合位置
 */
const getRotatedBounds = (node: BaseNodeState) => {
  const absTransform = store.getAbsoluteTransform(node.id);
  const { x, y, width, height, rotation } = absTransform || node.transform;

  if (rotation === 0) {
    return { minX: x, maxX: x + width, minY: y, maxY: y + height };
  }

  const cx = x + width / 2;
  const cy = y + height / 2;

  const corners = [
    { x: x, y: y },
    { x: x + width, y: y },
    { x: x + width, y: y + height },
    { x: x, y: y + height },
  ];

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  corners.forEach((corner) => {
    const dx = corner.x - cx;
    const dy = corner.y - cy;
    const rx = cx + dx * cos - dy * sin;
    const ry = cy + dx * sin + dy * cos;
    minX = Math.min(minX, rx);
    maxX = Math.max(maxX, rx);
    minY = Math.min(minY, ry);
    maxY = Math.max(maxY, ry);
  });

  return { minX, maxX, minY, maxY };
};

// 组合编辑模式下：实时计算当前组合子元素的包围盒
const editingGroupBounds = computed(() => {
  const editingId = store.editingGroupId;
  if (!editingId) return null;

  const group = store.nodes[editingId];
  if (!group || group.type !== NodeType.GROUP) return null;

  const childNodes = group.children
    .map((id) => store.nodes[id])
    .filter((node): node is NodeState => Boolean(node));

  if (childNodes.length === 0) return null;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  childNodes.forEach((child) => {
    // 假设 child 的旋转是相对于画布的绝对旋转
    const bounds = getRotatedBounds(child as BaseNodeState);
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
    rotation: group.transform.rotation || 0, // 组合框的旋转
  };
});

// 计算多选大框的包围盒
const selectionBounds = computed(() => {
  if (editingGroupBounds.value) {
    return editingGroupBounds.value;
  }

  const nodes = overlayNodes.value;
  if (nodes.length === 0) return null;

  // 单选时：返回节点绝对边界（选中框会跟着旋转）
  if (nodes.length === 1) {
    const node = nodes[0];
    const absTransform = store.getAbsoluteTransform(node!.id);
    const transform = absTransform || node!.transform;
    return {
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
      rotation: node!.transform.rotation || 0, // 单选时，使用节点的实际旋转角度
    };
  }

  // 多选时：计算所有节点旋转后的 AABB 并合并 (rotation 设为 0)
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
    rotation: 0, // 多选框（AABB）始终是轴对齐
  };
});

// 大框的样式
const overlayStyle = computed(() => {
  const bounds = selectionBounds.value;
  if (!bounds) return {};

  const rotation = 'rotation' in bounds ? bounds.rotation || 0 : 0;

  return {
    transform: `translate(${bounds.x}px, ${bounds.y}px) rotate(${rotation}deg)`,
    transformOrigin: `${bounds.width / 2}px ${bounds.height / 2}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  };
});

// =========================================================================================
// 控制点样式和动态光标计算
// =========================================================================================
const getHandleStyle = (handle: ResizeHandle) => {
  const scale = 1 / store.viewport.zoom;
  let baseTransform = '';

  // 1. 基础 transform 保持控制点居中
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

  const finalStyle = {
    transform: `${baseTransform} scale(${scale})`,
  };

  // 2. 获取选中框的旋转角度
  // 只有单选或组合编辑时，rotation才可能非0
  const boundsRotation = selectionBounds.value?.rotation || 0;

  // 3. 获取该 handle 对应的基础光标角度 (n-resize = 0deg)
  const baseAngle = getHandleBaseAngle(handle);

  // 4. 计算最终光标角度，并匹配最接近的 resize 类型
  // totalAngle = 基础角度 + 元素旋转角度 + 22.5度偏移 (用于匹配45度区间)
  const totalAngle = normalizeAngle(baseAngle + boundsRotation + 22.5) % 360;

  let finalCursorType: string;

  if (totalAngle >= 0 && totalAngle < 45) {
    finalCursorType = 'n-resize';
  } else if (totalAngle >= 45 && totalAngle < 90) {
    finalCursorType = 'ne-resize';
  } else if (totalAngle >= 90 && totalAngle < 135) {
    finalCursorType = 'e-resize';
  } else if (totalAngle >= 135 && totalAngle < 180) {
    finalCursorType = 'se-resize';
  } else if (totalAngle >= 180 && totalAngle < 225) {
    finalCursorType = 's-resize';
  } else if (totalAngle >= 225 && totalAngle < 270) {
    finalCursorType = 'sw-resize';
  } else if (totalAngle >= 270 && totalAngle < 315) {
    finalCursorType = 'w-resize';
  } else {
    finalCursorType = 'nw-resize';
  }

  return {
    style: finalStyle,
    cursor: finalCursorType,
  };
};

// 触发多选/单选缩放
const onHandleDown = (e: MouseEvent, handle: ResizeHandle) => {
  const bounds = selectionBounds.value;
  if (!bounds || !toolManagerRef?.value || store.activeElements.length === 0) return;

  // 核心修复：阻止事件冒泡和默认行为，避免状态被覆盖
  e.stopPropagation();
  e.preventDefault();

  const nodeIds = store.activeElements.map((node) => (node as BaseNodeState).id);

  if (nodeIds.length === 1) {
    if (!nodeIds[0]) return;
    // 单选
    toolManagerRef.value.handleResizeHandleDown(e, nodeIds[0], handle);
  } else {
    // 多选
    toolManagerRef.value.handleMultiResizeDown(e, handle, bounds, nodeIds);
  }
};

// 旋转样式计算
const rotateHandleStyle = computed(() => {
  const bounds = selectionBounds.value;
  if (!bounds) return {};

  const scale = 1 / store.viewport.zoom;

  // 只有单选时才使用节点的 rotation
  const rotation =
    selectedNodes.value.length === 1 && selectedNodes.value[0]
      ? selectedNodes.value[0].transform.rotation
      : 0;

  const quarterHeight = bounds.height / 4;

  return {
    // 旋转 handle 元素本身，使其图标始终正向朝上
    transform: `translateX(-50%) rotate(${-rotation}deg) scale(${scale})`,
    bottom: `${-1.3 * quarterHeight}px`,
    left: '50%',
  };
});

// 旋转控制点鼠标按下事件
const onRotateHandleDown = (e: MouseEvent) => {
  if (!toolManagerRef?.value) return;

  e.stopPropagation();
  e.preventDefault();

  toolManagerRef.value.handleRotateHandleDown(e);
};
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
  z-index: 999;
}

.selection-border {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 1px solid #1890ff;
  pointer-events: none;
  box-sizing: border-box;
}

/* ⚠️ 注意：移除了默认的 cursor 样式，使其可以被动态覆盖 */
.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: #fff;
  border: 1px solid #1890ff;
  border-radius: 50%;
  pointer-events: auto; /* 恢复鼠标事件响应 */
  z-index: 1000;
}

/* 控制点位置 */
.handle-nw {
  top: -4px;
  left: -4px;
}
.handle-n {
  top: -4px;
  left: 50%;
}
.handle-ne {
  top: -4px;
  right: -4px;
}
.handle-e {
  top: 50%;
  right: -4px;
}
.handle-se {
  bottom: -4px;
  right: -4px;
}
.handle-s {
  bottom: -4px;
  left: 50%;
}
.handle-sw {
  bottom: -4px;
  left: -4px;
}
.handle-w {
  top: 50%;
  left: -4px;
}

/* 因为 style 里的 transform 已经包含了 translateX/Y，这里的 CSS 只需要保证默认定位 */
.handle-n,
.handle-s {
  transform: translateX(-50%);
}
.handle-e,
.handle-w {
  transform: translateY(-50%);
}

/* 旋转控制点样式 */
.rotate-handle {
  position: absolute;
  width: 21px;
  height: 21px;
  background-color: #fff;
  border: 1px solid #1890ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  z-index: 1001;
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.rotate-handle:active {
  cursor: grabbing;
}
</style>

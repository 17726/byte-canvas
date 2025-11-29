<template>
  <!-- 遍历渲染所有选中节点的覆盖层 -->
  <div
    v-for="node in store.activeElements"
    :key="node.id"
    class="selection-overlay"
    :style="getOverlayStyle(node)"
    v-show="!node.isLocked"
  >
    <!-- 选中框边框 -->
    <div class="selection-border"></div>

    <!-- 8个控制点 -->
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

// 不再需要 selectedNode 计算属性，直接在模板中遍历 store.activeElements

const getOverlayStyle = (node: BaseNodeState) => {
  return {
    transform: `translate(${node.transform.x}px, ${node.transform.y}px) rotate(${node.transform.rotation}deg)`,
    width: `${node.transform.width}px`,
    height: `${node.transform.height}px`,
  };
};

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

const onHandleDown = (e: MouseEvent, handle: ResizeHandle) => {
  console.log(
    '🖱️ Handle mousedown:',
    handle,
    'toolManager:',
    !!toolManagerRef?.value,
    'selectedNode:',
    !!selectedNode.value
  );
  if (selectedNode.value && toolManagerRef?.value) {
    toolManagerRef.value.handleResizeHandleDown(e, selectedNode.value.id, handle);
  } else {
    console.error('❌ Missing toolManager or selectedNode!', {
      toolManager: !!toolManagerRef?.value,
      selectedNode: !!selectedNode.value,
    });
  }
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

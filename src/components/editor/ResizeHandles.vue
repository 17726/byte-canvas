<template>
  <div class="resize-handles">
    <!-- 八个缩放控制点 -->
    <div
      v-for="handle in handles"
      :key="handle"
      :class="['resize-handle', `resize-handle-${handle}`]"
      @mousedown="handleMouseDown($event, handle)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ResizeHandle } from '@/core/tools/ToolManager';

/**
 * 缩放控制点组件
 * 职责：渲染8个缩放控制点，并转发鼠标事件
 */

const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const emit = defineEmits<{
  handleDown: [e: MouseEvent, handle: ResizeHandle];
}>();

const handleMouseDown = (e: MouseEvent, handle: ResizeHandle) => {
  emit('handleDown', e, handle);
};
</script>

<style scoped>
.resize-handles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: #1890ff;
  border: 1px solid #fff;
  border-radius: 50%;
  pointer-events: auto;
  z-index: 10;
}

/* 四个角 */
.resize-handle-nw {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}

.resize-handle-ne {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}

.resize-handle-se {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}

.resize-handle-sw {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}

/* 四条边 */
.resize-handle-n {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}

.resize-handle-e {
  top: 50%;
  right: -4px;
  transform: translateY(-50%);
  cursor: e-resize;
}

.resize-handle-s {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}

.resize-handle-w {
  top: 50%;
  left: -4px;
  transform: translateY(-50%);
  cursor: w-resize;
}

/* 鼠标悬停效果 */
.resize-handle:hover {
  background-color: #40a9ff;
  transform: scale(1.2);
}

/* 上下边的悬停效果需要考虑已有的 transform */
.resize-handle-n:hover,
.resize-handle-s:hover {
  transform: translateX(-50%) scale(1.2);
}

.resize-handle-e:hover,
.resize-handle-w:hover {
  transform: translateY(-50%) scale(1.2);
}
</style>

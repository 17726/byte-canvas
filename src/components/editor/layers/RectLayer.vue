<template>
  <div class="node-rect" :style="style" :class="{ 'is-selected': isSelected }">
    <!-- 矩形内部可以有内容，或者只是纯色块 -->
    <!-- 选中时显示缩放控制点 -->
    <ResizeHandles v-if="isSelected" @handle-down="handleResizeHandleDown" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { ShapeState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';
import { getDomStyle } from '@/core/renderers/dom';
import { ToolManager } from '@/core/tools/ToolManager';
import type { ResizeHandle } from '@/types/editor';
import ResizeHandles from '../ResizeHandles.vue';

const props = defineProps<{
  node: ShapeState;
}>();

const store = useCanvasStore();
// 注入父组件提供的 toolManager 实例
const toolManager = inject<ToolManager>('toolManager');
if (!toolManager) {
  throw new Error('toolManager must be provided by parent component');
}

// 获取样式 (使用策略模式分离的渲染器)
const style = computed(() => getDomStyle(props.node));

// 选中状态
const isSelected = computed(() => store.activeElementIds.has(props.node.id));

// 处理缩放控制点鼠标按下事件
const handleResizeHandleDown = (e: MouseEvent, handle: ResizeHandle) => {
  toolManager.handleResizeHandleDown(e, props.node.id, handle);
};
</script>

<style scoped>
.node-rect {
  /* 基础样式由 style 绑定控制 */
  box-sizing: border-box;
  transition: box-shadow 0.2s;
  cursor: move; /* 显示四方箭头拖拽光标 */
  user-select: none; /* 禁止文本选择 */
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE/Edge */
}

.is-selected {
  /* 选中时的视觉反馈 */
  outline: 2px solid #1890ff;
  outline-offset: 0; /* 确保 outline 不会触发焦点 */
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
}
</style>

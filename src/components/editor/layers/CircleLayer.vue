<template>
  <div class="node-circle" :style="style" :class="{ 'is-selected': isSelected }">
    <!-- 圆形内部可以有内容，或者只是纯色块 -->
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
import type { ResizeHandle } from '@/types/state';
import ResizeHandles from '../ResizeHandles.vue';

const props = defineProps<{
  node: ShapeState;
}>();

const store = useCanvasStore();
// 注入父组件提供的 toolManager 实例
const toolManager = inject<ToolManager>('toolManager')!;

// 获取样式 (使用策略模式分离的渲染器)
const style = computed(() => {
  const baseStyle = getDomStyle(props.node);

  // 确保圆形样式：宽高相等，border-radius 为 50%
  return {
    ...baseStyle,
    // 防止宽高不一致
    width: baseStyle.width,
    height: baseStyle.width, // 使用宽度作为基准，确保宽高相等
  };
});

// 选中状态
const isSelected = computed(() => store.activeElementIds.has(props.node.id));

// 处理缩放控制点鼠标按下事件
const handleResizeHandleDown = (e: MouseEvent, handle: ResizeHandle) => {
  toolManager.handleResizeHandleDown(e, props.node.id, handle);
};
</script>

<style scoped>
.node-circle {
  /* 基础样式由 style 绑定控制 */
  box-sizing: border-box;
  transition:
    outline 0.2s,
    box-shadow 0.2s;
  /* 确保元素可以正确显示为圆形 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.is-selected {
  /* 选中时的视觉反馈 - 使用 outline 和阴影来突出显示 */
  outline: 2px solid #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
}
</style>

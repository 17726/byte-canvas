<template>
  <!-- 外层容器：用于放置缩放控制点 -->
  <div class="text-layer-wrapper" :style="style">
    <!-- 透明矩形内部写文字，即文本框 -->
    <div class="textBox" :class="{ 'is-selected': isSelected }">
      <div class="text-content" >
        {{ node.props.content }}
      </div>
    </div>
    <!-- 选中时显示缩放控制点（隐藏显示） -->
    <ResizeHandles
      v-if="isSelected"
      class="text-resize-handles"
      @handle-down="handleResizeHandleDown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { TextState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';
import { getDomStyle } from '@/core/renderers/dom';
import { ToolManager } from '@/core/tools/ToolManager';
import type { ResizeHandle } from '@/types/editor';
import ResizeHandles from '../ResizeHandles.vue';

const props = defineProps<{
  node: TextState;
}>();

const store = useCanvasStore();
// 注入父组件提供的 toolManager 实例
const toolManager = inject<ToolManager>('toolManager')!;

// 获取文本框+文本样式 (使用策略模式分离的渲染器)
const style = computed(() => getDomStyle(props.node));

// 选中状态
const isSelected = computed(() => store.activeElementIds.has(props.node.id));

// 处理缩放控制点鼠标按下事件
const handleResizeHandleDown = (e: MouseEvent, handle: ResizeHandle) => {
  toolManager.handleResizeHandleDown(e, props.node.id, handle);
};
</script>

<style scoped>
/* 外层容器：继承所有位置和尺寸样式 */
.text-layer-wrapper {
  position: relative;
}

.is-selected {
  /* 选中时的视觉反馈 */
  outline: 2px solid #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
}

/* 文本框 为文本的父组件(容器) */
.textBox {
  /* 容器样式 */
  width: 100%;
  height: 100%;
  overflow: auto;
  margin: 0;
  background: transparent;
  /* 移除 min-width 和 min-height，避免与数据层缩放不一致 */
  /* 最小尺寸限制已在 ToolManager.resizeText 中处理 */
  cursor: move;
  user-select: none; /* 禁止文本选择 */
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE/Edge */
}

.text-content {
  /* 使用 CSS 变量 */
  font-family: var(--font-family);
  font-size: var(--text-size);
  font-weight: var(--font-weight);
  font-style: var(--font-style);
  color: var(--text-color);
  line-height: var(--line-height);
  transform: scale(var(--text-scale));
  transform-origin: top left;
  text-decoration: var(--text-decoration); /* 应用文本装饰 */

  /* 确保文本正确显示 */
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* 隐藏文本缩放控制点的显示 */
.text-resize-handles :deep(.resize-handle) {
  opacity: 0;
  pointer-events: auto; /* 保留交互功能 */
}

/* 鼠标悬停时显示控制点（可选） */
.text-layer-wrapper:hover .text-resize-handles :deep(.resize-handle) {
  opacity: 0.5;
}

.text-resize-handles :deep(.resize-handle):hover {
  opacity: 1 !important;
}
</style>

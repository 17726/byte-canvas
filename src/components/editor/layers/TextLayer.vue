<template>
  <!-- 外层容器：用于放置缩放控制点 -->
  <div class="text-layer-wrapper" :style="style">
    <!-- 透明矩形内部写文字，即文本框 -->
    <div class="textBox" :class="{ 'is-selected': isSelected }">
      <div class="text-content">
        {{ node.props.content }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TextState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';
import { getDomStyle } from '@/core/renderers/dom';

const props = defineProps<{
  node: TextState;
}>();

const store = useCanvasStore();

// 获取文本框+文本样式 (使用策略模式分离的渲染器)
const style = computed(() => getDomStyle(props.node));

// 选中状态
const isSelected = computed(() => store.activeElementIds.has(props.node.id));
</script>

<style scoped>
/* 外层容器：继承所有位置和尺寸样式 */
.text-layer-wrapper {
  position: relative;
}

.is-selected {
  /* 选中时的视觉反馈 */
  /* outline: 2px solid #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2); */
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
  text-decoration-line: var(--text-decoration-line);
  transform-origin: top left;
  /* 确保文本正确显示 */
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>

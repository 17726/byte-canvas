<template>
  <div class="node-rect" :style="style" :class="{ 'is-selected': isSelected }">
    <!-- 矩形内部可以有内容，或者只是纯色块 -->
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import type { ShapeState } from '@/types/state';

import { useSelectionStore } from '@/store/selectionStore';
import { getDomStyle } from '@/core/renderers/dom';

const props = defineProps<{
  node: ShapeState;
}>();

const selectionStore = useSelectionStore();

// 获取样式 (使用策略模式分离的渲染器)
const style = computed(() => getDomStyle(props.node) as CSSProperties);

// 选中状态
const isSelected = computed(() => selectionStore.activeElementIds.has(props.node.id));
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
</style>

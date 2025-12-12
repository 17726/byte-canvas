<template>
  <div class="node-circle" :style="style" :class="{ 'is-selected': isSelected }"></div>
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
const style = computed(() => {
  const baseStyle = getDomStyle(props.node) as CSSProperties;
  // 确保圆形样式：宽高相等，border-radius 为 50%
  return {
    ...baseStyle,
    // FIXME: 视图层不应强制修改数据表现。如果数据层 width != height，这里强制相等会导致碰撞检测（基于数据）与视觉（基于这里）不一致。
  };
});

// 选中状态
const isSelected = computed(() => selectionStore.activeElementIds.has(props.node.id));
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
  cursor: move; /* 显示拖拽光标 */
  user-select: none; /* 禁止文本选择，防止出现输入光标 */
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}
</style>

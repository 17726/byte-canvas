<template>
  <!-- 透明矩形内部写文字，即文本框 -->
  <div class="textBox" :style="style" :class="{ 'is-selected': isSelected } " >
    {{node.props.content}}
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

.is-selected {
  /* 选中时的视觉反馈 */
  outline: 2px dashed #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
}

/* 虚线文本框 为文本的父组件 */
.textBox {
  /* 容器样式 */
  overflow: auto;
  margin: 0;
  min-height: 80px;
  min-width: 150px;
  background: transparent;

  /* 布局样式 */
  box-sizing: border-box;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

</style>

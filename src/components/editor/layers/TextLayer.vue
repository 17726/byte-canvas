<template>
  <!-- 透明矩形内部写文字，即文本框 -->
  <div class="textBox" :style="style" :class="{ 'is-selected': isSelected } " >
    <div class="text-content">
      {{node.props.content}}
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

.is-selected {
  /* 选中时的视觉反馈 */
  outline: 2px solid #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
}

/* 文本框 为文本的父组件(容器) */
.textBox {
  /* 容器样式 */
  overflow: auto;
  margin: 0;
  /* FIXME: CSS 最小尺寸可能导致视觉大小 > 数据尺寸(transform.width/height)。
     这会导致碰撞检测（基于数据）失效（看起来点中了但没选中）。
     建议：移除 min-wh，或者实现文本内容变化时自动更新 Store 尺寸的逻辑。 */
  min-height: 80px;
  min-width: 150px;
  background: transparent;
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

  /* 确保文本正确显示 */
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

</style>

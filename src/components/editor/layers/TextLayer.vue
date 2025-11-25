<template>
  <!-- 透明矩形内部写文字，即文本框 -->
  <div class="textBox" :style="style" :class="{ 'is-selected': isSelected } " >
        <!-- 文本本身 -->
        <div class="container-text">
          <h3>响应式简单文本</h3>
          <p>这段文本的样式由CSS变量控制，而这些变量将会根据容器尺寸和用户设置动态变化。</p>
      </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ShapeState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';
import { getDomStyle } from '@/core/renderers/dom';



const props = defineProps<{
  node: ShapeState;
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

  /* 文本样式 */
  font-size: calc(var(--text-size) * var(--text-scale));
  color: var(--text-color);
  line-height: var(--line-height);

  /* 布局样式 */
  box-sizing: border-box;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

</style>

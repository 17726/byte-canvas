<template>
  <div class="node-image" :style="style" :class="{ 'is-selected': isSelected }">
    <img :src="imageUrl" :alt="node.name || 'Image'" :style="filterStyle" />
  </div>
</template>

<script setup lang="ts">
import { getDomStyle } from '@/core/renderers/dom';
import { useCanvasStore } from '@/store/canvasStore';
import type { ImageState } from '@/types/state';
import { computed } from 'vue';

const props = defineProps<{
  node: ImageState;
}>();

const store = useCanvasStore();

// 获取样式 (使用策略模式分离的渲染器)
const style = computed(() => getDomStyle(props.node));

// 选中状态
const isSelected = computed(() => store.activeElementIds.has(props.node.id));

// 图片URL
const imageUrl = computed(() => props.node.props.imageUrl || 'https://images.unsplash.com/photo-1763634048525-5ca118fe6c05?q=80&w=985&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D');

// 滤镜样式
const filterStyle = computed(() => {
  const filters: string[] = [];

  // 灰度滤镜
  if (props.node.props.filters?.grayscale) {
    filters.push(`grayscale(${props.node.props.filters.grayscale}%)`);
  }

  // 模糊滤镜
  if (props.node.props.filters?.blur) {
    filters.push(`blur(${props.node.props.filters.blur}px)`);
  }

  // 亮度滤镜
  if (props.node.props.filters?.brightness) {
    filters.push(`brightness(${props.node.props.filters.brightness}%)`);
  }

  // 对比度滤镜
  if (props.node.props.filters?.contrast) {
    filters.push(`contrast(${props.node.props.filters.contrast}%)`);
  }

  // 饱和度滤镜
  if (props.node.props.filters?.saturate) {
    filters.push(`saturate(${props.node.props.filters.saturate}%)`);
  }

  // 色相旋转滤镜
  if (props.node.props.filters?.hueRotate) {
    filters.push(`hue-rotate(${props.node.props.filters.hueRotate}deg)`);
  }

  // 透明度滤镜
  if (props.node.props.filters?.opacity) {
    filters.push(`opacity(${props.node.props.filters.opacity}%)`);
  }

  // 反转滤镜
  if (props.node.props.filters?.invert) {
    filters.push(`invert(${props.node.props.filters.invert}%)`);
  }

  // 棕褐色滤镜
  if (props.node.props.filters?.sepia) {
    filters.push(`sepia(${props.node.props.filters.sepia}%)`);
  }

  return {
    filter: filters.length > 0 ? filters.join(' ') : 'none',
  };
});
</script>

<style scoped>
.node-image {
  /* 基础样式由 style 绑定控制 */
  box-sizing: border-box;
  transition: box-shadow 0.2s;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.is-selected {
  /* 选中时的视觉反馈 */
  outline: 2px solid #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
}
</style>

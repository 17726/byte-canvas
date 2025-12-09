<template>
  <div class="node-image" :style="style" :class="{ 'is-selected': isSelected }">
    <img :src="imageUrl" :alt="node.name || 'Image'" :style="filterStyle" />
  </div>
</template>

<script setup lang="ts">
import { getDomStyle } from '@/core/renderers/dom';
import { useSelectionStore } from '@/store/selectionStore';
import type { ImageState } from '@/types/state';
import { computed, type CSSProperties } from 'vue';

const props = defineProps<{
  node: ImageState;
}>();

const selectionStore = useSelectionStore();

// 获取样式 (使用策略模式分离的渲染器)
const style = computed(() => getDomStyle(props.node) as CSSProperties);

// 选中状态
const isSelected = computed(() => selectionStore.activeElementIds.has(props.node.id));

// 图片URL
const imageUrl = computed(
  () => props.node.props.imageUrl || import.meta.env.BASE_URL + 'uploads/images/img-test_1.jpg'
);

// 滤镜样式
const filterStyle = computed(() => {
  const filters: string[] = [];

  // 灰度滤镜 (default: 0%)
  if (
    props.node.props.filters?.grayscale !== undefined &&
    props.node.props.filters.grayscale !== 0
  ) {
    filters.push(`grayscale(${props.node.props.filters.grayscale}%)`);
  }

  // 模糊滤镜 (default: 0px)
  if (props.node.props.filters?.blur !== undefined && props.node.props.filters.blur !== 0) {
    filters.push(`blur(${props.node.props.filters.blur}px)`);
  }

  // 亮度滤镜 (default: 100%)
  if (
    props.node.props.filters?.brightness !== undefined &&
    props.node.props.filters.brightness !== 100
  ) {
    filters.push(`brightness(${props.node.props.filters.brightness}%)`);
  }

  // 对比度滤镜 (default: 100%)
  if (
    props.node.props.filters?.contrast !== undefined &&
    props.node.props.filters.contrast !== 100
  ) {
    filters.push(`contrast(${props.node.props.filters.contrast}%)`);
  }

  // 饱和度滤镜 (default: 100%)
  if (
    props.node.props.filters?.saturate !== undefined &&
    props.node.props.filters.saturate !== 100
  ) {
    filters.push(`saturate(${props.node.props.filters.saturate}%)`);
  }

  // 色相旋转滤镜 (default: 0deg)
  if (
    props.node.props.filters?.hueRotate !== undefined &&
    props.node.props.filters.hueRotate !== 0
  ) {
    filters.push(`hue-rotate(${props.node.props.filters.hueRotate}deg)`);
  }

  // 透明度滤镜 (default: 100%)
  if (
    props.node.props.filters?.filterOpacity !== undefined &&
    props.node.props.filters.filterOpacity !== 100
  ) {
    filters.push(`opacity(${props.node.props.filters.filterOpacity}%)`);
  }

  // 反转滤镜 (default: 0%)
  if (props.node.props.filters?.invert !== undefined && props.node.props.filters.invert !== 0) {
    filters.push(`invert(${props.node.props.filters.invert}%)`);
  }

  // 棕褐色滤镜 (default: 0%)
  if (props.node.props.filters?.sepia !== undefined && props.node.props.filters.sepia !== 0) {
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
  cursor: move; /* 显示四方箭头拖拽光标 */
  user-select: none; /* 禁止文本选择 */
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE/Edge */
}

.node-image img {
  width: 100%;
  height: 100%;
  object-fit: fill;
  display: block;
  /** NOTE: 让鼠标事件从img穿透到父容器div
      因为我们监听的是div上的mousedown 同时禁止事件冒泡 这里不穿透的话光标在img上时无法拖拽*/
  pointer-events: none;
}
</style>

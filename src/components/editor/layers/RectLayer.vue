<template>
  <div class="node-rect" :style="style" :class="{ 'is-selected': isSelected }">
    <!-- 矩形内部可以有内容，或者只是纯色块 -->
    <!-- 选中时显示缩放控制点 -->
    <ResizeHandles v-if="isSelected" @handle-down="handleResizeHandleDown" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { ShapeState } from '@/types/state';
import { RectNode } from '@/core/nodes/RectNode';
import { useCanvasStore } from '@/store/canvasStore';
import ResizeHandles from '../ResizeHandles.vue';
import { ToolManager, type ResizeHandle } from '@/core/tools/ToolManager';

const props = defineProps<{
  node: ShapeState;
}>();

const store = useCanvasStore();
// 注入父组件提供的 toolManager 实例
const toolManager = inject<ToolManager>('toolManager')!;

// 实例化逻辑类 (注意：这里每次渲染都会 new，对于 MVP 来说性能可接受)
// 优化方案：在 Store 中缓存 Node 实例，或者使用享元模式
const nodeLogic = computed(() => new RectNode(props.node));

// 获取样式
const style = computed(() => nodeLogic.value.getStyle());

// 选中状态
const isSelected = computed(() => store.activeElementIds.has(props.node.id));

// 处理缩放控制点鼠标按下事件
const handleResizeHandleDown = (e: MouseEvent, handle: ResizeHandle) => {
  toolManager.handleResizeHandleDown(e, props.node.id, handle);
};
</script>

<style scoped>
.node-rect {
  /* 基础样式由 style 绑定控制 */
  box-sizing: border-box;
  transition: box-shadow 0.2s;
}

.is-selected {
  /* 选中时的视觉反馈 */
  outline: 2px solid #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
}
</style>

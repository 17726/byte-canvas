<template>
  <div
    v-if="activeNode"
    class="node-highlight"
    :style="highlightStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { worldToClient } from '@/core/utils/geometry';

// 提前定义节点的类型（如果项目已有类型声明，可复用）
interface NodeElement {
  transform: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  style: {
    zIndex: number; // 明确zIndex是数字类型
  };
}

const canvasStore = useCanvasStore();

// 获取当前选中的第一个节点（严格类型）
const activeNode = computed((): NodeElement | null => {
  const activeNodes = canvasStore.activeElements;
  // 增加类型守卫，确保是合法节点
  return activeNodes.length === 1 && isNodeElement(activeNodes[0])
    ? activeNodes[0]
    : null;
});

// 类型守卫：校验是否为合法节点
function isNodeElement(node: unknown): node is NodeElement {
  if (!node) return false;
  const n = node as NodeElement;
  return typeof n.transform?.x === 'number'
    && typeof n.transform?.y === 'number'
    && typeof n.style?.zIndex === 'number';
}

// 计算高亮矩形的样式（完全类型安全）
const highlightStyle = computed((): Record<string, string | number> => {
  if (!activeNode.value) return {};

  const node = activeNode.value;
  const viewport = canvasStore.viewport;

  // 1. 基础坐标（兜底默认值，防止NaN）
  const nodeX = node.transform.x || 0;
  const nodeY = node.transform.y || 0;
  const nodeWidth = node.transform.width || 0;

  // 2. 转换为屏幕坐标（确保返回值有x/y）
  const clientPos = worldToClient(viewport, nodeX, nodeY);
  const clientX = typeof clientPos.x === 'number' ? clientPos.x : 0;
  const clientY = typeof clientPos.y === 'number' ? clientPos.y : 0;

  // 3. 计算高亮位置（兜底防止负数/NaN）
  const highlightWidth = 200;
  const highlightLeft = Math.max(0, clientX + nodeWidth / 2 - highlightWidth / 2); // 防止left为负
  const highlightTop = Math.max(0, clientY - 15); // 防止top为负

  // 4. 样式对象（所有属性类型明确）
  return {
    left: `${highlightLeft}px`,
    top: `${highlightTop}px`,
    width: `${highlightWidth}px`,
    height: '3px',
    zIndex: node.style.zIndex + 5, // 数字类型（CSS的zIndex支持数字）
    position: 'absolute',
    pointerEvents: 'none',
    transition: 'transform 0.1s ease' // 把过渡移到style里，避免scoped样式覆盖
  };
});
</script>

<style scoped>
.node-highlight {
  position: absolute;
  background-color: #165DFF;
  pointer-events: none;
  /* 移除transition，移到动态style里，避免优先级问题 */
}
</style>

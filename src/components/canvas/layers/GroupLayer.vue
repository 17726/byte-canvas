<template>
  <div
    class="group-layer"
    :style="groupStyle"
    @mousedown="handleMouseDown"
    @dblclick="handleDoubleClick"
  >
    <!-- 渲染组合内的所有子节点 -->
    <component
      v-for="child in childNodes"
      :key="child.id"
      :is="getComponentType(child.type)"
      :node="child"
      :isGroupChild="true"
      @mousedown="handleChildMouseDown($event, child.id)"
    />

    <!-- 组合编辑模式指示器 -->
    <div v-if="isEditing" class="group-edit-indicator">
      <span class="edit-label">编辑组合中</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, defineAsyncComponent, type Ref } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';
import { NodeType, type GroupState, type NodeState } from '@/types/state';
import type { ToolManager } from '@/core/ToolManager';
import { GroupService } from '@/core/services/GroupService';
import RectLayer from './RectLayer.vue';
import CircleLayer from './CircleLayer.vue';
import TextLayer from './TextLayer.vue';
import ImageLayer from './ImageLayer.vue';

// 递归组件：异步导入自身以支持嵌套组合
const GroupLayerSelf = defineAsyncComponent(() => import('./GroupLayer.vue'));

interface Props {
  node: GroupState;
}

const props = defineProps<Props>();
const store = useCanvasStore();
const selectionStore = useSelectionStore();
const toolManagerRef = inject<Ref<ToolManager | null>>('toolManager');

// 获取组合内的所有子节点
const childNodes = computed(() => {
  return props.node.children
    .map((id) => store.nodes[id])
    .filter((node): node is NodeState => Boolean(node));
});

// 组合样式
const groupStyle = computed(() => {
  const { x, y, width, height, rotation } = props.node.transform;
  const { opacity } = props.node.style;

  return {
    transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
    width: `${width}px`,
    height: `${height}px`,
    opacity: opacity,
    transformOrigin: `${width / 2}px ${height / 2}px`,
  };
});

// 是否正在编辑此组合
const isEditing = computed(() => selectionStore.editingGroupId === props.node.id);

// 组件映射
const getComponentType = (type: NodeType) => {
  switch (type) {
    case NodeType.RECT:
      return RectLayer;
    case NodeType.CIRCLE:
      return CircleLayer;
    case NodeType.TEXT:
      return TextLayer;
    case NodeType.IMAGE:
      return ImageLayer;
    case NodeType.GROUP:
      return GroupLayerSelf; // 递归渲染嵌套组合
    default:
      return 'div';
  }
};

// 检查此组合是否可以被直接选中
// 只有顶层组合或父组合正在编辑时，才能直接选中此组合
const isSelectable = computed(() => {
  // 顶层组合总是可选
  if (props.node.parentId === null) return true;
  // 嵌套组合只有在其父组合正在编辑时才可选
  return selectionStore.editingGroupId === props.node.parentId;
});

// 处理组合的鼠标按下事件
const handleMouseDown = (e: MouseEvent) => {
  // 如果正在编辑此组合，不拦截事件，让子元素处理
  if (isEditing.value) return;

  // 如果此组合不可直接选中（嵌套组合且父组合未在编辑），不处理，让事件冒泡
  if (!isSelectable.value) return;

  // 否则，选中整个组合
  if (toolManagerRef?.value) {
    toolManagerRef.value.handleNodeDown(e, props.node.id);
  }
};

// 双击进入组合编辑模式
const handleDoubleClick = (e: MouseEvent) => {
  // 如果此组合不可选中，不处理
  if (!isSelectable.value) return;

  e.stopPropagation();
  GroupService.enterGroupEdit(store, props.node.id);
};

// 编辑模式下，处理子元素的点击
const handleChildMouseDown = (e: MouseEvent, childId: string) => {
  // 如果此组合不可选中（嵌套组合且父组合未在编辑），不处理，让事件冒泡到上层
  if (!isSelectable.value) return;

  if (!isEditing.value) {
    // 非编辑模式，选中整个组合
    e.stopPropagation();
    if (toolManagerRef?.value) {
      toolManagerRef.value.handleNodeDown(e, props.node.id);
    }
    return;
  }

  // 编辑模式下，选中具体的子元素
  e.stopPropagation();
  if (toolManagerRef?.value) {
    toolManagerRef.value.handleNodeDown(e, childId);
  }
};
</script>

<style scoped>
.group-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
  cursor: move;
}

.group-layer.editing {
  pointer-events: none;
}

.group-edit-indicator {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(24, 144, 255, 0.9);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
}

.edit-label {
  font-weight: 500;
}
</style>

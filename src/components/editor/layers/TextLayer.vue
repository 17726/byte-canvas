<template>
  <!-- 外层容器：用于放置缩放控制点 -->
  <div class="text-layer-wrapper" :style="style" >
    <!-- 透明矩形内部写文字，即文本框 -->
    <div
      ref="editor"
      class="textBox"
      :class="{ 'is-editing': isEditing }"
      contenteditable="true"
      v-html="HTMLstring"
      @input="(e) => handleContentChange(e, props.node.id)"
      @keyup="() => handleSelectionChange(props.node.id)"
      @mouseup="(e) => handleMouseUpAndSelection(e, props.node.id)"
      @mousemove="handleMouseMove"
      @mousedown="(e) => handleMouseDown(e, props.node.id)"
      @dblclick="(e) => enterEditing(e, props.node.id)"
      @blur="() => handleBlur(props.node.id)"
      @click="(e) => handleTextBoxClick(e, props.node.id)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref,type Ref, watch, type CSSProperties, onMounted, onUnmounted, inject } from 'vue';
import type { TextState } from '@/types/state';
import { getDomStyle } from '@/core/renderers/dom';
import type { ToolManager } from '@/core/ToolManager';
import { useCanvasStore } from '@/store/canvasStore';

const props = defineProps<{
  node: TextState;
}>();

// 1. 注入全局 ToolManager 实例（唯一依赖，不直接接触任何 Handler）
const toolManagerRef = inject<Ref<ToolManager | null>>('toolManager');

const store = useCanvasStore();
const editor = ref<HTMLElement | null>(null);

// 计算属性：文本HTML渲染（不变）
const HTMLstring = computed(() => getDomStyle(props.node));

// 计算属性：组件样式（不变）
const style = computed((): CSSProperties => {
  const text = props.node as TextState & {
    transform: NonNullable<TextState['transform']>;
    style: NonNullable<TextState['style']>;
  };

  const { transform, style: nodeStyle } = text;
  const { x = 0, y = 0, width = 200, height = 80, rotation = 0 } = transform;
  const {
    backgroundColor = 'transparent',
    borderWidth = 0,
    borderStyle = 'none',
    borderColor = 'transparent',
    opacity = 1,
    zIndex = 1
  } = nodeStyle;

  return {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    boxSizing: 'border-box',
    backgroundColor,
    borderWidth: `${borderWidth}px`,
    borderStyle,
    borderColor,
    opacity,
    zIndex,
    outline: 'none !important',
    outlineOffset: '0',
    boxShadow: 'none !important',
    overflow: 'hidden',
  };
});

// 计算属性：编辑态（通过 ToolManager 间接获取，不直接访问 Handler）
const isEditing = computed(() => {
  return toolManagerRef?.value?.getTextEditingState();
});

// 激活节点状态（从 Store 直接获取，不依赖 Handler）
const isActiveNode = computed(() => {
  return store.activeElementIds.has(props.node.id);
});

// 监听activeElementIds变化，强制保留编辑态节点激活（通过 Store 操作，不依赖 Handler）
watch(
  () => Array.from(store.activeElementIds),
  (newActiveIds) => {
    if (isEditing.value && !newActiveIds.includes(props.node.id)) {
      store.setActive([props.node.id]);
    }
  },
  { deep: true }
);

// 监听选区变化（同步到全局，通过 ToolManager 转发）
watch(
  () => [isActiveNode.value, isEditing.value],
  ([isActive, editing]) => {
    if (isActive && editing) {
      toolManagerRef?.value?.handleTextSelectionChange(props.node.id);
    } else {
      // 若需清空全局选区，可在 ToolManager 新增 clearGlobalTextSelection() 方法
      store.updateGlobalTextSelection(null);
    }
  },
  { immediate: true, deep: true }
);

// 2. 所有事件处理：只调用 ToolManager 方法，不直接接触 Handler
const handleContentChange = (e: Event, id: string) => {
  toolManagerRef?.value?.handleTextInput(e, id); // 调用 ToolManager 文本输入处理
};

const handleSelectionChange = (id: string) => {
  toolManagerRef?.value?.handleTextSelectionChange(id); // 调用 ToolManager 选区变化处理
};

const enterEditing = (e: MouseEvent, id: string) => {
  toolManagerRef?.value?.handleNodeDoubleClick(e, id); // 调用 ToolManager 节点双击事件（内部路由到文本编辑）
};

const handleMouseDown = (e: MouseEvent, id: string) => {
  toolManagerRef?.value?.handleNodeDown(e, id); // 调用 ToolManager 节点按下事件（内部含文本编辑态判断）
};

const handleMouseMove = (e: MouseEvent) => {
  toolManagerRef?.value?.handleMouseMove(e); // 调用 ToolManager 全局鼠标移动事件（内部含文本选区更新）
};

const handleMouseUpAndSelection = (e: MouseEvent, id: string) => {
  toolManagerRef?.value?.handleMouseUp(); // 调用 ToolManager 全局鼠标抬起事件
  toolManagerRef?.value?.handleTextMouseUp(e, id); // 调用 ToolManager 文本鼠标抬起处理
};

const handleBlur = (id: string) => {
  toolManagerRef?.value?.handleTextBlur(id); // 调用 ToolManager 文本失焦处理
};

const handleTextBoxClick = (e: MouseEvent, id: string) => {
  toolManagerRef?.value?.handleTextClick(e, id); // 调用 ToolManager 文本点击处理
};

// 3. 组件生命周期：只调用 ToolManager 方法
onMounted(() => {
  toolManagerRef?.value?.initTextEditor(editor.value); // 调用 ToolManager 初始化文本编辑器
});

onUnmounted(() => {
  toolManagerRef?.value?.destroy(); // 调用 ToolManager 销毁文本编辑器资源
});
</script>

<style scoped>
/* 样式部分保持不变 */
.textBox {
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  cursor: move;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  padding: 2px 4px;
}

.textBox.is-editing {
  cursor: text;
  user-select: auto;
  -webkit-user-select: auto;
  -moz-user-select: auto;
  -ms-user-select: auto;
  pointer-events: auto;
}

.textBox::selection,
.textBox *::selection {
  background-color: rgba(0, 122, 255, 0.1) !important;
}

.textBox::-moz-selection,
.textBox *::-moz-selection {
  background-color: rgba(0, 122, 255, 0.1) !important;
}
</style>
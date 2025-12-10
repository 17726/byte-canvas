<template>
  <!-- 外层容器：用于放置缩放控制点 -->
  <div class="text-layer-wrapper" :style="style">
    <!-- 透明矩形内部写文字，即文本框 -->
    <div
      :ref="`editor_${props.node.id}`"
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
      @click.stop
      @dragstart="handleDragStart"
      @compositionstart="() => (isComposing = true)"
      @compositionend="
        (e) => {
          isComposing = false;
          handleContentChange(e, props.node.id);
        }
      "
    ></div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  type Ref,
  watch,
  type CSSProperties,
  onMounted,
  onUnmounted,
  inject,
  nextTick,
} from 'vue';
import type { TextState } from '@/types/state';
import { getDomStyle } from '@/core/renderers/dom';
import type { ToolManager } from '@/core/ToolManager';
import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';
import { getCurrentInstance } from 'vue';

const props = defineProps<{
  node: TextState;
}>();

// 1. 注入全局 ToolManager 实例（唯一依赖，不直接接触任何 Handler）
const toolManagerRef = inject<Ref<ToolManager | null>>('toolManager');

const store = useCanvasStore();
const selectionStore = useSelectionStore();
// 每个组件实例的editorRefs，只存当前节点的DOM（对象里只有一个键）
const editorRefs = ref<Record<string, HTMLElement | null>>({});
const isComposing = ref(false);

// 2. 收集当前节点的editor ref
const collectCurrentEditorRef = () => {
  const proxy = getCurrentInstance()?.proxy; // 先定义并获取proxy
  const refKey = `editor_${props.node.id}`;
  const editorEl = proxy?.$refs[refKey] as HTMLElement | undefined; // 安全取值
  if (editorEl) {
    // 加保护
    editorRefs.value[props.node.id] = editorEl;
  }
};

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
    zIndex = 1,
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
  return selectionStore.activeElementIds.has(props.node.id);
});

// 监听activeElementIds变化，强制保留编辑态节点激活（通过 Store 操作，不依赖 Handler）
// 文本组件内的局部状态，仅能在当前组件访问
const currentSelection = ref<{ start: number; end: number } | null>(null);

// 文本组件：合并 watch 监听器（核心修复）
// 合并监听 currentSelection 和 isActiveNode，统一管理选区同步逻辑
watch(
  [currentSelection, isActiveNode],
  ([newSelection, isActive]) => {
    console.log('watch-选区/激活变化：', { newSelection, isActive });
    if (isActive && newSelection) {
      console.log('文本组件内updateGlobalSelection:', newSelection);
      store.updateGlobalTextSelection(newSelection); // 激活且有选区时同步
    } else {
      store.updateGlobalTextSelection(null); // 其他情况清空
    }
  },
  { immediate: true, deep: true }
);

// 组件内定义执行锁
const isSettingActive = ref(false);

watch(
  () => selectionStore.activeElementIds,
  async (newActiveSet) => {
    // 加锁：如果正在设置，直接返回
    if (isSettingActive.value) return;

    const newActiveIds = [...newActiveSet];
    if (isEditing.value && !newActiveIds.includes(props.node.id)) {
      const targetId = [props.node.id];
      const isSame =
        targetId.length === newActiveSet.size && targetId.every((id) => newActiveSet.has(id));

      if (!isSame) {
        isSettingActive.value = true;
        try {
          // 延迟执行，避免和响应式更新竞态
          await nextTick();
          selectionStore.setActive(targetId);
        } finally {
          // 解锁
          isSettingActive.value = false;
        }
      }
    }
  },
  { flush: 'post' }
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
  if (isComposing.value) return; // 组合态时跳过处理
  toolManagerRef?.value?.handleTextInput(e, id); // 调用 ToolManager 文本输入处理
};

const handleSelectionChange = (id: string) => {
  toolManagerRef?.value?.handleTextSelectionChange(id); // 调用 ToolManager 选区变化处理
};

const enterEditing = (e: MouseEvent, id: string) => {
  //console.log('双击的节点：', e.target);
  //console.log('即将进入编辑态的节点id：', id);
  toolManagerRef?.value?.handleNodeDoubleClick(e, id); // 调用 ToolManager 节点双击事件（内部路由到文本编辑）
};

const handleMouseDown = (e: MouseEvent, id: string) => {
  const node = store.nodes[id] as TextState | undefined;
  const parentId = node?.parentId;

  // 1. 文本是组合子节点 && 父组合当前不在“编辑组合模式”
  //    → 单击时行为应当是：选中父组合，不进入文本编辑，也不出现光标
  if (parentId && selectionStore.editingGroupId !== parentId) {
    // 阻止 contenteditable 的默认聚焦/光标行为
    e.preventDefault();
    // 把这次按下事件交给父组合节点，模仿圆形/矩形那种“选中组合”的效果
    toolManagerRef?.value?.handleNodeDown(e, parentId);
    // 防止事件继续冒泡到 GroupLayer 的 @mousedown 等，避免重复处理
    e.stopPropagation();
    return;
  }

  // 2. 其他情况（独立文本，或父组合已经在编辑模式下）
  //    交给当前文本节点处理：
  //    - TextSelectionHandler.handleMouseDown 会在非编辑态下 preventDefault，避免单击直接进入编辑
  //    - 双击通过 handleNodeDoubleClick → enterEditing 才真正进入文本编辑态
  toolManagerRef?.value?.handleNodeDown(e, id);
};

const handleMouseMove = (e: MouseEvent) => {
  toolManagerRef?.value?.handleMouseMove(e); // 调用 ToolManager 全局鼠标移动事件（内部含文本选区更新）
};

//编辑态下同步选区到全局
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

// 3. 修改onMounted：传入「节点ID + 对应editor」初始化
onMounted(() => {
  collectCurrentEditorRef();
  const currentEditor = editorRefs.value[props.node.id];
  if (!currentEditor) return;
  // 调用修改后的initTextEditor，传入节点ID和editor
  toolManagerRef?.value?.initTextEditor(props.node.id, currentEditor);
});

onUnmounted(() => {
  // 只清理当前组件的 editor 引用
  delete editorRefs.value[props.node.id];
  toolManagerRef?.value?.removeTextEditor(props.node.id);
});

// 核心：禁用拖拽复制/虚影，保留选中文本
const handleDragStart = (e: DragEvent) => {
  e.preventDefault(); // 仅拦截dragstart的默认行为
};
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

/* 文本选中样式（兼容不同浏览器） */
.textBox::selection,
.textBox *::selection {
  background-color: rgba(0, 122, 255, 0.1) !important;
}

.textBox::-moz-selection,
.textBox *::-moz-selection {
  background-color: rgba(0, 122, 255, 0.1) !important;
}
</style>

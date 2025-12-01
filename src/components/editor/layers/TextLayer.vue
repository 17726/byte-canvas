<template>
  <!-- 外层容器：用于放置缩放控制点 -->
  <div class="text-layer-wrapper" :style="style" >
    <!-- 透明矩形内部写文字，即文本框 -->
    <div
      ref="editor"
      class="textBox"
      :class="{ 'is-editing': isEditing }"
      contenteditable="true"
      placeholder="双击编辑文本"
      v-html="HTMLstring"
      @input="handleContentChange"
      @keyup="handleSelectionChange"
      @mouseup="handleMouseUp,handleSelectionChange"
      @mousemove="handleMouseMove"
      @mousedown="handleMouseDown"
      @dblclick="enterEditing"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties, nextTick } from 'vue';
import type { TextState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';
import { getDomStyle } from '@/core/renderers/dom';

const props = defineProps<{
  node: TextState;
}>();

const store = useCanvasStore();
const HTMLstring = computed(() => getDomStyle(props.node));
const style = computed((): CSSProperties => {
  // 类型断言 + 容错：确保 transform 和 style 存在（避免 undefined 报错）
  const text = props.node as TextState & {
    transform: NonNullable<TextState['transform']>;
    style: NonNullable<TextState['style']>;
  };

  // 解构属性 + 默认值兜底（双重保障，避免 undefined）
  const { transform, style: nodeStyle } = text; // 重命名 style 为 nodeStyle，避免重名
  const {
    x = 0,
    y = 0,
    width = 200,
    height = 80,
    rotation = 0
  } = transform;
  const {
    backgroundColor = 'transparent', // 默认透明
    borderWidth = 0, // 默认无边框
    borderStyle = 'none', // 默认无边框样式
    borderColor = 'transparent', // 默认透明边框
    opacity = 1, // 默认不透明
    zIndex = 1 // 默认层级
  } = nodeStyle;

  // 样式映射（补充去除边框的关键样式）
  return {
    // --- 布局属性---
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center', // 优化：旋转中心点默认居中（更合理）
    boxSizing: 'border-box', // 优化：确保 border 不影响宽高计算

    // --- 外观属性（补充默认值 + 去除边框）---
    backgroundColor,
    borderWidth: `${borderWidth}px`,
    borderStyle,
    borderColor,
    opacity,
    zIndex,
    outline: 'none !important', // 关键：去除浏览器默认聚焦边框
    outlineOffset: '0', // 优化：确保无偏移轮廓
    boxShadow: 'none !important', // 优化：避免阴影被误认为边框

    // --- 额外优化：文本容器交互体验 ---
    overflow: 'hidden', // 超出容器范围隐藏（避免文本溢出）
  };
});

const editor = ref<HTMLElement | null>(null);

//编辑状态
const isEditing = ref(false);

// 选中状态
const isSelected = computed(() => store.activeElementIds.has(props.node.id));

// 文本组件内的局部状态，仅能在当前组件访问
const currentSelection = ref<{ start: number; end: number } | null>(null);

// 处理内容变化（同步content到结构化数据）
const handleContentChange = (e: Event) => {
  const target = e.target as HTMLElement;
  store.updateNode(props.node.id, {
    props: { ...props.node.props, content: target.innerText }
  });
};

// 监听：判断当前文本组件是否是激活节点
const isActiveNode = computed(() => {
  const activeNode = store.activeElements[0];
  return activeNode?.id === props.node.id; // 通过 id 匹配激活节点
});

// 同步局部选区到全局 Pinia（仅当当前是激活节点时）
watch(
  [currentSelection, isActiveNode], // 监听局部选区和激活状态
  ([newSelection, isActive]) => {
    if (isActive) {
      // 当前组件是激活节点，同步选区到全局
      store.updateGlobalTextSelection(newSelection);
    } else if (store.globalTextSelection) {
      // 当前组件不是激活节点，且全局选区属于该节点，清空全局选区
      store.updateGlobalTextSelection(null);
    }
  },
  { immediate: true } // 初始渲染时立即执行一次
);

// 处理选区变化（计算局部选区）
const handleSelectionChange = () => {
  // 仅在编辑状态下计算选区（优化，避免无用计算）
  if (!isEditing.value) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    currentSelection.value = null;
    return;
  }

  const range = selection.getRangeAt(0);
  // 仅当选区在当前编辑区内时，才更新局部选区
  if (editor.value && !editor.value.contains(range.commonAncestorContainer)) {
    currentSelection.value = null;
    return;
  }

  const content = props.node.props.content;
  // （建议替换为精确选区计算逻辑）
  const start = content.indexOf(range.toString());
  if (start !== -1) {
    currentSelection.value = {
      start,
      end: start + range.toString().length
    };
  }
};

// 双击进入编辑状态
const enterEditing = (event: MouseEvent) => {
  event.stopPropagation();
  if (!isSelected.value) return;

  isEditing.value = true;

  nextTick(() => {
    if (editor.value) {
      editor.value.focus();
    }
  });
};

const handleMouseDown = (e: MouseEvent) => {
  if (isEditing.value) {
    e.stopPropagation(); // 阻止事件冒泡到上层节点
  }
};

const handleMouseMove = (e: MouseEvent) => {
  if (isEditing.value) {
    e.stopPropagation();
  }
};

const handleMouseUp = (e: MouseEvent) => {
  if (isEditing.value) {
    e.stopPropagation();
  }
};

</script>

<style scoped>
.text-layer-wrapper {
  position: relative;
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
  overflow: visible !important;
}

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

/* 修复：聚焦伪类写法（无语法错误） */
.textBox:focus,
.textBox:focus-visible,
.textBox.is-editing:focus,
.textBox.is-editing:focus-visible {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
  -webkit-tap-highlight-color: transparent !important;
}

.textBox.is-editing {
  cursor: text;
  user-select: auto;
  -webkit-user-select: auto;
  -moz-user-select: auto;
  -ms-user-select: auto;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* 修复1：移除可能报错的 :has 选择器（如果不需要），或替换为兼容写法 */
/* 如果你需要 :has 功能，需配置 PostCSS 兼容插件；暂时不需要可直接删除 */

/* 修复2：Vue3 深度选择器写法（替换旧的 ::v-deep） */
/* 如果你需要穿透 scoped 样式，用 :deep() 替代 ::v-deep（Vue3 标准写法） */
:deep(.text-layer-wrapper.selected) {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* 修复3：文本选中样式（确保语法正确） */
.textBox::selection,
.textBox *::selection {
  background-color: rgba(0, 122, 255, 0.1) !important;
  border: none !important;
  outline: none !important;
}

.textBox::-moz-selection,
.textBox *::-moz-selection {
  background-color: rgba(0, 122, 255, 0.1) !important;
  border: none !important;
  outline: none !important;
}
</style>
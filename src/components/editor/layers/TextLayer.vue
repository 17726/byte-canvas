<template>
  <!-- 外层容器：用于放置缩放控制点 -->
  <div class="text-layer-wrapper" :style="style" >
    <!-- 透明矩形内部写文字，即文本框 -->
    <div
      ref="editor"
      class="textBox"
      :class="{ 'is-editing': textSelectionHandler.isEditing }"
      contenteditable="true"

      v-html="HTMLstring"
      @input="handleContentChange"
      @keyup="handleSelectionChange"
      @mouseup="handleMouseUpAndSelection($event, props.node)"
      @mousemove="handleMouseMove"
      @mousedown="handleMouseDown"
      @dblclick="enterEditing"
      @blur="handleBlur"
      @click="handleTextBoxClick"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties, onMounted, onUnmounted } from 'vue';
import type { TextState } from '@/types/state';
import { getDomStyle } from '@/core/renderers/dom';
import { textSelectionHandler } from '@/core/handlers/TextSeletionHandler';
import { TextService } from '@/core/services/TextService';

const props = defineProps<{
  node: TextState;
}>();

const editor = ref<HTMLElement | null>(null);

// 计算属性：文本HTML渲染
const HTMLstring = computed(() => getDomStyle(props.node));

// 计算属性：组件样式
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

// 选中状态（从store派生）
//const isSelected = computed(() => textSelectionHandler['store'].activeElementIds.has(props.node.id));

// 激活节点状态（从handler获取）
const isActiveNode = computed(() => textSelectionHandler.isActiveNode(props.node));

// 监听activeElementIds变化，强制保留编辑态节点激活
watch(
  () => Array.from(textSelectionHandler['store'].activeElementIds),
  (newActiveIds) => {
    if (textSelectionHandler.isEditing && !newActiveIds.includes(props.node.id)) {
      textSelectionHandler['store'].setActive([props.node.id]); // 强制激活当前节点
    }
  },
  { deep: true }
);

// 监听选区变化（同步到全局）
watch(
  () => [textSelectionHandler.currentSelection, isActiveNode.value],
  ([newSelection, isActive]) => {
    // 类型守卫：确保 newSelection 是正确的选区对象（排除 boolean 和 null）
    const isValidSelection = (
      typeof newSelection === 'object' &&
      newSelection !== null &&
      'start' in newSelection &&
      'end' in newSelection
    );

    if (isActive && isValidSelection) {
      // 此时 TypeScript 能确定 newSelection 是正确类型
      textSelectionHandler.updateGlobalSelection(newSelection);
    } else {
      textSelectionHandler.updateGlobalSelection(null);
    }
  },
  { immediate: true, deep: true }
);

// 事件代理：内容变化（调用无状态服务）
const handleContentChange = (e: Event) => {
  TextService.handleContentChange(
    e,
    props.node,
    () => textSelectionHandler.saveCursorPosition(),
    (pos) => textSelectionHandler.restoreCursorPosition(pos)
  );
};

// 事件代理：选区变化（调用handler）
const handleSelectionChange = () => {
  textSelectionHandler.handleSelectionChange(props.node);
};

// 事件代理：双击进入编辑（调用handler）
const enterEditing = (event: MouseEvent) => {
  textSelectionHandler.enterEditing(event, props.node);
};

// 事件代理：鼠标按下（调用handler）
const handleMouseDown = (e: MouseEvent) => {
  textSelectionHandler.handleMouseDown(e);
};

// 事件代理：鼠标移动（调用handler）
const handleMouseMove = (e: MouseEvent) => {
  textSelectionHandler.handleMouseMove(e);
};

// 事件代理：鼠标抬起（调用handler）
const handleMouseUpAndSelection = (e: MouseEvent, node: TextState) => {
  textSelectionHandler.handleMouseUpAndSelection(e, node);
};

// 事件代理：失焦处理（调用handler）
const handleBlur = () => {
  textSelectionHandler.handleBlur(props.node);
};

// 事件代理：文本框点击（调用handler）
const handleTextBoxClick = (e: MouseEvent) => {
  textSelectionHandler.handleTextBoxClick(e, props.node);
};

// 组件挂载初始化
onMounted(() => {
  // 初始化编辑器引用
  textSelectionHandler.init(editor.value);
  // 注册全局鼠标按下事件
  document.addEventListener('mousedown', textSelectionHandler.handleGlobalMousedown, true);
});

// 组件卸载清理
onUnmounted(() => {
  // 移除全局事件监听
  document.removeEventListener('mousedown', textSelectionHandler.handleGlobalMousedown, true);
  // 清理handler状态
  textSelectionHandler.destroy();
});
</script>

<style scoped>
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
  /* 编辑态保留 auto，正常响应事件 */
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
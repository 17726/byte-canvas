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
      @blur="handleBlur"
      @click="handleTextBoxClick"
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
  // 关键1：更新 content 前，先保存当前光标位置
  const savedCursorPos = saveCursorPosition();

  // 关键2：更新 store 中的 content（会触发 v-html 重新渲染）
  store.updateNode(props.node.id, {
    props: { ...props.node.props, content: target.innerText }
  });

  // 关键3：DOM 重新渲染后，恢复光标位置
  restoreCursorPosition(savedCursorPos);
};

// 新增：保存当前光标位置（返回保存的位置信息）
const saveCursorPosition = (): {
  parent: Node | null;
  offset: number;
} => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { parent: null, offset: 0 };
  }
  const range = selection.getRangeAt(0);
  // 记录光标所在的父节点和偏移量（核心：精准定位光标位置）
  return {
    parent: range.commonAncestorContainer,
    offset: range.startOffset,
  };
};

// 新增：恢复光标位置（接收保存的位置信息）
const restoreCursorPosition = (savedPos: { parent: Node | null; offset: number }) => {
  if (!editor.value || !savedPos.parent || !isEditing.value) return;

  const selection = window.getSelection();
  if (!selection) return;

  // 等待 DOM 完全渲染（确保 v-html 已更新）
  nextTick(() => {
    // 找到保存的父节点（兼容 DOM 重新渲染后的结构）
    const parentNode = findMatchingNode(editor.value!, savedPos.parent!);
    if (!parentNode) return;

    // 创建新的选区，恢复光标位置
    const range = document.createRange();
    range.setStart(parentNode, savedPos.offset);
    range.collapse(true); // 光标折叠（不选中文本，只定位光标）

    selection.removeAllRanges();
    selection.addRange(range);
  });
};

// 辅助函数：递归查找 DOM 重新渲染后对应的父节点（兼容 HTML 结构变化）
const findMatchingNode = (root: HTMLElement, targetNode: Node): Node | null => {
  // 如果根节点就是目标节点，直接返回
  if (root === targetNode) return root;

  // 递归查找子节点（匹配文本内容和节点类型）
  const childNodes = Array.from(root.childNodes);
  for (const node of childNodes) {
    if (node.nodeType === targetNode.nodeType && node.textContent === targetNode.textContent) {
      return node;
    }
    const found = findMatchingNode(node as HTMLElement, targetNode);
    if (found) return found;
  }
  return null;
};

// 监听：判断当前文本组件是否是激活节点
const isActiveNode = computed(() => {
  const activeNode = store.activeElements[0];
  return activeNode?.id === props.node.id; // 通过 id 匹配激活节点
});

// 同步局部选区到全局 Pinia（仅当当前是激活节点时）
watch(
  currentSelection, // 只监听选区变化（简化依赖）
  (newSelection) => {
    // 只有当前节点是激活节点，才同步选区到全局
    if (isActiveNode.value) {
      store.updateGlobalTextSelection(newSelection);
    } else if (store.globalTextSelection) {
      // 非激活节点时，清空全局选区（避免干扰）
      store.updateGlobalTextSelection(null);
    }
  },
  { immediate: true, deep: true } // 深度监听 + 初始执行
);

// 补充：监听激活状态变化，同步选区
watch(
  isActiveNode,
  (isActive) => {
    if (isActive) {
      // 激活当前节点时，同步当前选区到全局
      store.updateGlobalTextSelection(currentSelection.value);
    } else {
      // 取消激活时，清空全局选区
      store.updateGlobalTextSelection(null);
    }
  }
);

// 处理选区变化（计算局部选区）
const handleSelectionChange = () => {
  if (!isEditing.value || !editor.value) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    currentSelection.value = null;
    return;
  }

  const range = selection.getRangeAt(0);
  // 仅当选区在当前编辑区内时，才计算选区（避免跨组件选区）
  if (!editor.value.contains(range.commonAncestorContainer)) {
    currentSelection.value = null;
    return;
  }

  // 精准计算选中文本在 content 中的 start 和 end（替换 indexOf 方案）
  const getTextOffset = (node: Node, root: HTMLElement): number => {
    let offset = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) break;
      offset += currentNode.textContent?.length || 0;
    }
    return offset;
  };

  // 计算选区起始位置
  const startNode = range.startContainer;
  const startOffset = range.startOffset;
  const baseOffset = getTextOffset(startNode, editor.value);
  const totalStart = baseOffset + startOffset;

  // 计算选区结束位置
  const endNode = range.endContainer;
  const endOffset = range.endOffset;
  const endBaseOffset = getTextOffset(endNode, editor.value);
  const totalEnd = endBaseOffset + endOffset;

  // 确保 start <= end（避免反向选择导致的异常）
  const start = Math.min(totalStart, totalEnd);
  const end = Math.max(totalStart, totalEnd);

  // 仅当选区有效（start < end）时，才更新 currentSelection
  if (start < end) {
    currentSelection.value = { start, end };
  } else {
    currentSelection.value = null;
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
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor.value);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  });
};

const handleMouseDown = (e: MouseEvent) => {
  if (isEditing.value) {
    e.stopPropagation(); // 阻止事件冒泡到上层节点
  }else{
    // 阻止文本框聚焦（避免单击时光标出现，不进入编辑态）
    e.preventDefault();
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
    handleSelectionChange(); // 编辑状态下计算选区
  }
};

const handleBlur = () => {
  isEditing.value = false;
  // 关键1：主动让文本框失去焦点，避免聚焦残留
  editor.value?.blur();
  // 关键2：清空局部选区，避免状态干扰
  currentSelection.value = null;
  // 关键3：同步清空全局选区（确保全局状态一致）
  if (isActiveNode.value) {
    store.updateGlobalTextSelection(null);
  }
};

const handleTextBoxClick = (e: MouseEvent) => {
  if (!isEditing.value) {
    // 关键1：阻止文本框聚焦（避免单击时光标出现，不进入编辑态）
    e.preventDefault();
    // 关键2：阻止文本框选中文字（非编辑态不需要选中文本）
    e.stopPropagation();

    // 核心：执行选中逻辑（单击的核心需求）
    if (!isSelected.value) {
      store.activeElementIds = new Set([props.node.id]);
    }

    // 关键3：强制让文本框失焦（兜底，避免意外聚焦）
    editor.value?.blur();
  } else {
    // 编辑状态下，正常响应点击（选中文本、输入等）
    e.stopPropagation();
  }
};
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
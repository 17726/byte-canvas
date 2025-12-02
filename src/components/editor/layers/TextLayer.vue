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
      @mouseup="handleMouseUpAndSelection"
      @mousemove="handleMouseMove"
      @mousedown="handleMouseDown"
      @dblclick="enterEditing"
      @blur="handleBlur"
      @click="handleTextBoxClick"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties, nextTick, onMounted, onUnmounted } from 'vue';
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
// 文本组件：优化 isActiveNode 计算逻辑（编辑态强制为true）
// 监听：判断当前文本组件是否是激活节点
const isActiveNode = computed(() => {
  const activeNode = store.activeElements[0];
  const baseActive = activeNode?.id === props.node.id;
  // 关键：编辑态时，强制返回true（锁定激活状态）
  const result = isEditing.value ? true : baseActive;
  console.log('当前节点是否激活：', result, '编辑态：', isEditing.value);
  return result;
});

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

// 文本组件：拆分 watch 监听器（核心修复）
// 监听器1：仅监听选区变化（有选区且激活时才同步）
watch(
  currentSelection,
  (newSelection) => {
    console.log('watch-选区变化：', { newSelection, isActive: isActiveNode.value });
    if (isActiveNode.value && newSelection) {
      store.updateGlobalTextSelection(newSelection); // 同步有效选区
    }
    // 只有当选区为 null 且激活时，才清空（避免误清空）
    else if (isActiveNode.value && newSelection === null) {
      store.updateGlobalTextSelection(null);
    }
  },
  { immediate: false, deep: true } // 关闭 immediate：初始不触发（避免误清空）
);

// 监听器2：仅监听激活状态变化
watch(
  isActiveNode,
  (isActive) => {
    console.log('watch-激活状态变化：', isActive);
    if (isActive && currentSelection.value) {
      store.updateGlobalTextSelection(currentSelection.value); // 激活时同步现有选区
    } else if (!isActive) {
      store.updateGlobalTextSelection(null); // 未激活时清空（合理场景）
    }
  },
  { immediate: true } // 初始触发：确认激活状态
);

watch(
  () => Array.from(store.activeElementIds),
  (newActiveIds) => {
    if (isEditing.value && !newActiveIds.includes(props.node.id)) {
      console.log('编辑态：强制保留当前节点激活');
      store.setActive([props.node.id]); // 强制激活当前节点
    }
  },
  { deep: true }
);

// 处理选区变化（计算局部选区）
const handleSelectionChange = () => {
  if (!isEditing.value || !editor.value) {
    //console.log('选区计算：未进入编辑态或无编辑器节点');
    currentSelection.value = null;
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    //console.log('选区计算：无有效选区（未选中或光标未选中文本）');
    currentSelection.value = null;
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.value.contains(range.commonAncestorContainer)) {
    //console.log('选区计算：选区不在当前编辑器内');
    currentSelection.value = null;
    return;
  }

  // 精准计算选中文本的 start 和 end（原有逻辑保留）
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

  const startNode = range.startContainer;
  const startOffset = range.startOffset;
  const baseOffset = getTextOffset(startNode, editor.value);
  const totalStart = baseOffset + startOffset;

  const endNode = range.endContainer;
  const endOffset = range.endOffset;
  const endBaseOffset = getTextOffset(endNode, editor.value);
  const totalEnd = endBaseOffset + endOffset;

  const start = Math.min(totalStart, totalEnd);
  const end = Math.max(totalStart, totalEnd);

  // 关键日志：输出计算结果
  //console.log('选区计算结果：', { start, end, content: props.node.props.content });

  if (start < end) {
    currentSelection.value = { start, end };
    //console.log('currentSelection 赋值：', currentSelection.value);
  } else {
    //console.log('选区计算：start >= end（无效选区）');
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

// 合并 mouseup 和选区计算（确保鼠标选中必触发）
const handleMouseUpAndSelection = (e: MouseEvent) => {
  //console.log('mouseup 事件触发'); // 调试日志
  if (isEditing.value) {
    e.stopPropagation();
    handleSelectionChange(); // 直接调用选区计算
  }
  // 非编辑态下，事件正常冒泡（不影响选中节点）
};

// 标记：是否正在点击工具栏（初始为false）
const isClickingToolbar = ref(false);

// 全局点击监听：判断点击目标是否在工具栏内
const handleGlobalMousedown = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  // 直接通过 DOM 查找工具栏（不依赖事件冒泡）
  const toolbar = document.querySelector('.context-toolbar');
  const isClickToolbar = toolbar
    ? toolbar.contains(target) // 用 contains 更可靠，不依赖 closest
    : false;

  isClickingToolbar.value = isClickToolbar;
  //console.log('全局 mousedown 捕获：是否点击工具栏', isClickingToolbar.value);
};



// 文本组件：修改 handleBlur 逻辑（核心修复）
const handleBlur = () => {
  //console.log('文本组件失焦：', { isClickingToolbar: isClickingToolbar.value });

  if (isClickingToolbar.value) {
    // 点击工具栏 → 保留编辑态+重新聚焦
    //console.log('点击工具栏，保留编辑态');
    editor.value?.focus(); // 立即重新聚焦，不中断编辑
  } else {
    // 点击其他区域 → 正常退出
    //console.log('点击非工具栏区域，退出编辑态');
    isEditing.value = false;
    if (!store.activeElementIds.has(props.node.id)) {
      store.updateGlobalTextSelection(null);
    }
  }
};

const handleTextBoxClick = (e: MouseEvent) => {
  if (!isEditing.value) {
    // 关键1：阻止文本框聚焦（避免单击时光标出现，不进入编辑态）
    e.preventDefault();
    // 关键2：阻止文本框选中文字（非编辑态不需要选中文本）
    // e.stopPropagation();

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

// 组件挂载时添加全局监听，卸载时移除（避免内存泄漏）
onMounted(() => {
  // 捕获阶段监听：即使事件被阻止冒泡，document 也能捕获到
  document.addEventListener('mousedown', handleGlobalMousedown, true);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleGlobalMousedown, true);
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
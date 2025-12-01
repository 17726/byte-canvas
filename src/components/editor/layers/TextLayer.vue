<template>
  <!-- 外层容器：用于放置缩放控制点 -->
  <div class="text-layer-wrapper" :style="style">
    <!-- 透明矩形内部写文字，即文本框 -->
    <div
      class="textBox"
      :class="{ 'is-selected': isSelected, 'is-editing': isEditing }"
      @dblclick="handleDoubleClick"
    >
      <!-- 显示模式：非编辑状态下显示文本 -->
      <div
        v-if="!isEditing"
        class="text-content text-base-styles text-layout text-rendering"
        v-html="formattedContent"
      >
      </div>

      <!-- 编辑模式：编辑状态下显示输入框 -->
      <textarea
        v-else
        ref="textInput"
        v-model="editingContent"
        class="text-edit-input text-base-styles text-layout text-rendering"
        @blur="handleBlur"
        @keydown.esc="handleEsc"
        @keydown.enter.exact.prevent="handleEnter"
        @keydown.shift.enter="handleShiftEnter"
        @mousedown="handleTextMouseDown"
        @mouseup="handleTextMouseUp"
        @mousemove="handleTextMouseMove"
        @select="handleTextSelect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import type { TextState } from '@/types/state';
import { useCanvasStore } from '@/store/canvasStore';
import { getDomStyle } from '@/core/renderers/dom';

const props = defineProps<{
  node: TextState;
}>();

const store = useCanvasStore();

// 编辑状态相关
const isEditing = ref(false);
const editingContent = ref('');
const textInput = ref<HTMLTextAreaElement | null>(null);

// 选择状态相关
const selectionStart = ref(0);
const selectionEnd = ref(0);
const isSelecting = ref(false);

// 获取样式
const style = computed(() => getDomStyle(props.node));

// 格式化内容（显示模式下）
const formattedContent = computed(() => {
  const content = props.node.props.content || '双击编辑文本';

  // 如果有内联样式，应用样式
  if (props.node.props.inlineStyles && props.node.props.inlineStyles.length > 0) {
    return applyInlineStyles(content, props.node.props.inlineStyles);
  }

  // 否则返回原始内容
  return content.replace(/\n/g, '<br>');
});

// 应用内联样式到文本
const applyInlineStyles = (content: string, inlineStyles: any[]) => {
  let formatted = content;

  // 按位置倒序应用样式，避免位置偏移（html标签影响下标）
  inlineStyles
    .sort((a, b) => b.start - a.start)
    .forEach(style => {
      //提取需要样式的文本段
      const selectedText = formatted.substring(style.start, style.end);
      //为文本段添加HTML标签
      const styledText = wrapWithStyles(selectedText, style.styles);
      //拼接：前面部分 + 带样式文本 + 后面部分
      formatted = formatted.substring(0, style.start) + styledText + formatted.substring(style.end);
    });

  return formatted.replace(/\n/g, '<br>');
};

// 用样式包装文本
const wrapWithStyles = (text: string, styles: any) => {
  let wrapped = text;

  if (styles.fontWeight === 'bold' || 700) {
    wrapped = `<strong>${wrapped}</strong>`;
  }
  if (styles.fontStyle === 'italic') {
    wrapped = `<em>${wrapped}</em>`;
  }
  if (styles.textDecoration === 'underline') {
    wrapped = `<u>${wrapped}</u>`;
  }
  if (styles.textDecoration === 'line-through') {
    wrapped = `<s>${wrapped}</s>`;
  }
  if (styles.color) {
    wrapped = `<span style="color: ${styles.color}">${wrapped}</span>`;
  }

  return wrapped;
};


// 显示内容
// const displayContent = computed(() => {
//   return props.node.props.content || '双击此处编辑文本';
// });

// 选中状态
const isSelected = computed(() => store.activeElementIds.has(props.node.id));

// 双击进入编辑
const handleDoubleClick = (event: MouseEvent) => {
  event.stopPropagation();
  if (!isSelected.value) return;

  isEditing.value = true;
  editingContent.value = props.node.props.content || '';

  nextTick(() => {
    if (textInput.value) {
      textInput.value.focus();
      textInput.value.select();
    }
  });
};

// 文本选择事件处理
const handleTextSelect = () => {
  if (textInput.value) {
    selectionStart.value = textInput.value.selectionStart;
    selectionEnd.value = textInput.value.selectionEnd;
    console.log(`选择了文本: ${selectionStart.value} - ${selectionEnd.value}`);
  }b
};

// 鼠标按下事件
const handleTextMouseDown = (event: MouseEvent) => {
  event.stopPropagation();
  isSelecting.value = true;
};

// textarea 鼠标移动事件
const handleTextMouseMove = (event: MouseEvent) => {
  if (isSelecting.value) {
    // 如果正在选择文本，阻止事件冒泡
    event.stopPropagation();
  }
};

// 鼠标释放事件
const handleTextMouseUp = (event: MouseEvent) => {
  // 阻止事件冒泡
  event.stopPropagation();
  isSelecting.value = false;
  handleTextSelect();
};

// 保存内容
const saveContent = () => {
  if (isEditing.value) {
    store.updateNode(props.node.id, {
      props: {
        ...props.node.props,
        content: editingContent.value
      }
    });
    isEditing.value = false;
  }
};

// 取消编辑
const cancelEditing = () => {
  isEditing.value = false;
  editingContent.value = props.node.props.content || '';
  store.setActive([]);
};

// 事件处理
const handleBlur = () => saveContent();
const handleEsc = () => cancelEditing();
const handleEnter = () => saveContent();
// .prevent，所以会执行默认行为（插入换行）
const handleShiftEnter = () => {
  console.log('Shift+Enter，插入换行');
  // 不需要额外代码，浏览器会自动插入换行
};

</script>

<style scoped>
.text-layer-wrapper {
  position: relative;
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
}

.textBox.is-editing {
  cursor: text;
  user-select: auto;
  -webkit-user-select: auto;
  -moz-user-select: auto;
  -ms-user-select: auto;
}

/* 基础文本样式 */
.text-base-styles {
  font-family: var(--font-family);
  font-size: var(--text-size);
  font-weight: var(--font-weight);
  font-style: var(--font-style);
  color: var(--text-color);
  line-height: var(--line-height);
  transform: scale(var(--text-scale));
  transform-origin: top left;
  padding: 8px;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  width: 100%;
  height: 100%;
}

/* 布局和装饰样式 */
.text-layout {
  width: 100%;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
}

/* 文本渲染样式 */
.text-rendering {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* 具体组件的样式 */
.text-content {
  text-decoration-line: var(--text-decoration-line);
}

.text-content :deep(strong) {
  font-weight: bold;  /* 确保strong标签显示为加粗 */
}

.text-content :deep(em) {
  font-style: italic;  /* 确保em标签显示为斜体 */
}

.text-content :deep(u) {
  text-decoration: underline;  /* 确保u标签显示下划线 */
}

.text-content :deep(s) {
  text-decoration: line-through;  /* 确保s标签显示删除线 */
}

.text-edit-input {
  resize: none;
  outline: none;
  border: none;
  background: transparent;
}
</style>
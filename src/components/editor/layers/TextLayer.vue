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
        class="text-content"
      >
        {{ displayContent }}
      </div>

      <!-- 编辑模式：编辑状态下显示输入框 -->
      <textarea
        v-else
        ref="textInput"
        v-model="editingContent"
        class="text-edit-input"
        @blur="handleBlur"
        @keydown.esc="handleEsc"
        @keydown.enter.exact.prevent="handleEnter"
        @keydown.shift.enter="handleShiftEnter"
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

// 获取样式
const style = computed(() => getDomStyle(props.node));

// 显示内容
const displayContent = computed(() => {
  return props.node.props.content || '双击此处编辑文本';
});

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

.text-content {
  font-family: var(--font-family);
  font-size: var(--text-size);
  font-weight: var(--font-weight);
  font-style: var(--font-style);
  color: var(--text-color);
  line-height: var(--line-height);
  transform: scale(var(--text-scale));
  text-decoration-line: var(--text-decoration-line);
  transform-origin: top left;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  padding: 8px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
}

.text-edit-input {
  font-family: var(--font-family);
  font-size: var(--text-size);
  font-weight: var(--font-weight);
  font-style: var(--font-style);
  color: var(--text-color);
  line-height: var(--line-height);
  transform: scale(var(--text-scale));
  transform-origin: top left;
  width: 100%;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
  resize: none;
  outline: none;
  border: none;
  background: transparent;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
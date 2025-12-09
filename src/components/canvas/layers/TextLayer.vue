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
import { getCurrentInstance } from 'vue';

const props = defineProps<{
  node: TextState;
}>();

// 1. 注入全局 ToolManager 实例（唯一依赖，不直接接触任何 Handler）
const toolManagerRef = inject<Ref<ToolManager | null>>('toolManager');

const store = useCanvasStore();
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
  return store.activeElementIds.has(props.node.id);
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
  () => store.activeElementIds,
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
          store.setActive(targetId);
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

  // 在 TextService 处理之前，先保存光标位置（使用事件发生时的文本内容）
  const editorEl = editorRefs.value[id];
  let savedCursorOffset = -1;
  if (editorEl) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const walkRoot = editorEl;

      try {
        // 使用更准确的方法计算光标位置：遍历整个编辑器内的所有节点（包括文本节点和BR节点）
        const walker = document.createTreeWalker(
          walkRoot,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              // 接受文本节点和BR元素节点
              if (node.nodeType === Node.TEXT_NODE) {
                return NodeFilter.FILTER_ACCEPT;
              }
              if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_SKIP;
            },
          }
        );

        let currentNode: Node | null = null;
        let offset = 0;
        let found = false;

        while ((currentNode = walker.nextNode())) {
          // 先检查光标是否在BR节点之后（range.endContainer 是BR的父元素，且 endOffset 指向BR之后）
          if (
            currentNode.nodeType === Node.ELEMENT_NODE &&
            (currentNode as Element).tagName === 'BR'
          ) {
            const parent = currentNode.parentNode;
            if (parent === range.endContainer && range.endOffset > 0) {
              // 检查BR节点在父元素中的位置
              const brIndex = Array.from(parent.childNodes).indexOf(currentNode);
              if (brIndex >= 0 && range.endOffset === brIndex + 1) {
                // 光标在这个BR节点之后
                savedCursorOffset = offset + 1;
                found = true;
                break;
              }
            }
          }

          // 检查光标是否在当前节点
          if (currentNode === range.endContainer) {
            // 如果是文本节点，使用 endOffset
            if (currentNode.nodeType === Node.TEXT_NODE) {
              savedCursorOffset = offset + range.endOffset;
              found = true;
              break;
            } else if (
              currentNode.nodeType === Node.ELEMENT_NODE &&
              (currentNode as Element).tagName === 'BR'
            ) {
              // 如果是BR节点，光标在BR之后
              savedCursorOffset = offset + 1;
              found = true;
              break;
            }
          }

          // 计算当前节点的长度（在检查之后计算，因为如果光标在当前节点内，我们已经处理了）
          if (currentNode.nodeType === Node.TEXT_NODE) {
            offset += currentNode.textContent?.length || 0;
          } else if (
            currentNode.nodeType === Node.ELEMENT_NODE &&
            (currentNode as Element).tagName === 'BR'
          ) {
            // BR节点算作1个字符（换行符）
            offset += 1;
          }
        }

        // 如果没找到匹配的节点，使用 innerText 长度（包含换行）
        if (!found) {
          const innerText = walkRoot.innerText || '';
          savedCursorOffset = innerText.length;
        }
      } catch (err) {
        // 如果计算失败，使用 innerText 长度作为后备
        const innerText = walkRoot.innerText || '';
        savedCursorOffset = innerText.length;
      }
    }
  }

  toolManagerRef?.value?.handleTextInput(e, id); // 调用 ToolManager 文本输入处理

  // 延迟调整文本框高度，确保 TextService 的光标恢复已完成
  nextTick(() => {
    nextTick(() => {
      const editorEl = editorRefs.value[id];
      if (!editorEl) return;

      const node = store.nodes[id] as TextState | undefined;
      if (!node) return;

      const fontSize = node.props.fontSize || 16;
      const lineHeight = node.props.lineHeight || 1.6;
      const minHeight = fontSize * lineHeight;
      const currentHeight = node.transform.height;

      // 临时设置高度为 auto，获取准确的内容高度
      const originalHeight = editorEl.style.height;
      const originalOverflow = editorEl.style.overflow;
      editorEl.style.height = 'auto';
      editorEl.style.overflow = 'hidden';

      // 获取实际内容高度
      const scrollHeight = editorEl.scrollHeight;

      // 恢复原始样式
      editorEl.style.height = originalHeight;
      editorEl.style.overflow = originalOverflow;

      const newHeight = Math.max(scrollHeight, minHeight);

      // 恢复光标位置的函数（在 TextService 恢复之后执行）
      const restoreCursor = () => {
        if (savedCursorOffset >= 0) {
          // 再等一个 tick，确保 TextService 的光标恢复已完成
          nextTick(() => {
            nextTick(() => {
              const selection = window.getSelection();
              if (!selection) return;

              const innerText = editorEl.innerText || '';
              const safeOffset = Math.min(savedCursorOffset, innerText.length);

              // 确保偏移量有效（不能小于0）
              if (safeOffset < 0) return;

              // 使用更准确的方法恢复光标位置：遍历所有节点（包括文本节点和BR节点）
              const walker = document.createTreeWalker(
                editorEl,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                {
                  acceptNode: (node) => {
                    // 接受文本节点和BR元素节点
                    if (node.nodeType === Node.TEXT_NODE) {
                      return NodeFilter.FILTER_ACCEPT;
                    }
                    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
                      return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                  },
                }
              );

              let currentNode: Node | null = null;
              let currentOffset = 0;

              while ((currentNode = walker.nextNode())) {
                let nodeLength = 0;
                if (currentNode.nodeType === Node.TEXT_NODE) {
                  nodeLength = currentNode.textContent?.length || 0;
                } else if (
                  currentNode.nodeType === Node.ELEMENT_NODE &&
                  (currentNode as Element).tagName === 'BR'
                ) {
                  // BR节点算作1个字符（换行符）
                  nodeLength = 1;
                }

                if (currentOffset + nodeLength >= safeOffset) {
                  const offsetInNode = safeOffset - currentOffset;
                  const range = document.createRange();

                  if (currentNode.nodeType === Node.TEXT_NODE) {
                    // 文本节点：设置到文本内的偏移位置
                    const textOffset = Math.min(offsetInNode, nodeLength);
                    range.setStart(currentNode, textOffset);
                    range.collapse(true);
                  } else if (
                    currentNode.nodeType === Node.ELEMENT_NODE &&
                    (currentNode as Element).tagName === 'BR'
                  ) {
                    // BR节点：光标在BR之后
                    if (offsetInNode >= 1) {
                      // 光标在BR之后
                      range.setStartAfter(currentNode);
                    } else {
                      // 光标在BR之前（不应该发生，但为了安全）
                      range.setStartBefore(currentNode);
                    }
                    range.collapse(true);
                  }

                  selection.removeAllRanges();
                  selection.addRange(range);
                  return;
                }

                currentOffset += nodeLength;
              }

              // 如果没找到匹配的节点，尝试在末尾设置光标
              if (innerText.length > 0) {
                // 找到最后一个文本节点或BR节点
                const allNodes: Node[] = [];
                const walker2 = document.createTreeWalker(
                  editorEl,
                  NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                  {
                    acceptNode: (node) => {
                      if (node.nodeType === Node.TEXT_NODE) {
                        return NodeFilter.FILTER_ACCEPT;
                      }
                      if (
                        node.nodeType === Node.ELEMENT_NODE &&
                        (node as Element).tagName === 'BR'
                      ) {
                        return NodeFilter.FILTER_ACCEPT;
                      }
                      return NodeFilter.FILTER_SKIP;
                    },
                  }
                );
                let node: Node | null = null;
                while ((node = walker2.nextNode())) {
                  allNodes.push(node);
                }

                if (allNodes.length > 0) {
                  const lastNode = allNodes[allNodes.length - 1];
                  const range = document.createRange();

                  if (lastNode.nodeType === Node.TEXT_NODE) {
                    range.setStart(lastNode, lastNode.textContent?.length || 0);
                  } else {
                    range.setStartAfter(lastNode);
                  }

                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
              }
            });
          });
        }
      };

      // 只有当新高度大于当前高度时才更新（避免高度缩小）
      // 允许1px的误差，避免因为计算精度问题导致的频繁更新
      if (newHeight > currentHeight + 1) {
        store.updateNode(id, {
          transform: { ...node.transform, height: newHeight },
        });

        // 高度更新后恢复光标位置
        restoreCursor();
      } else {
        // 即使高度不需要更新，也要确保光标位置正确（TextService 的恢复可能失败）
        restoreCursor();
      }
    });
  });
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
  if (parentId && store.editingGroupId !== parentId) {
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

  // 初始化高度为字体高度
  nextTick(() => {
    const fontSize = props.node.props.fontSize || 16;
    const lineHeight = props.node.props.lineHeight || 1.6;
    const minHeight = fontSize * lineHeight;

    if (props.node.transform.height < minHeight) {
      store.updateNode(props.node.id, {
        transform: { ...props.node.transform, height: minHeight },
      });
    }
  });
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
  white-space: pre-wrap;
  word-wrap: break-word;
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

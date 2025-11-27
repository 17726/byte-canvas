<!-- 属性面板 -->
<template>
  <a-space direction="vertical" size="large" class="property-panel">
    <!-- 1. 颜色设置 -->
    <a-space>
      <!-- 填充色 (仅形状) -->
      <a-color-picker
        v-if="showFillColor"
        v-model="fillColor"
        size="small"
        show-text
        disabled-alpha
      />
      <!-- 边框色 (形状) 或 文本色 (文本) -->
      <a-color-picker v-model="strokeColor" size="small" show-text disabled-alpha />
    </a-space>

    <!-- 2. 坐标尺寸 -->
    <a-space>
      <a-input-number v-model="x" :precision="2" :style="{ width: '80px' }" placeholder="X">
        <template #prefix>X</template>
      </a-input-number>
      <a-input-number v-model="y" :precision="2" :style="{ width: '80px' }" placeholder="Y">
        <template #prefix>Y</template>
      </a-input-number>
    </a-space>

    <!-- 3. 样式属性 (边框宽度) -->
    <a-space>
      <a-input-number v-model="borderWidth" :min="0" :style="{ width: '100px' }" placeholder="边框">
        <template #prefix>边框</template>
      </a-input-number>
    </a-space>

    <!-- 4. 文本样式 (仅文本节点显示) -->
    <a-button-group v-if="isTextSelected">
      <a-button @click="toggleBold" :type="isBold ? 'primary' : 'secondary'">B</a-button>
      <a-button @click="toggleItalic" :type="isItalic ? 'primary' : 'secondary'">I</a-button>
      <a-button @click="toggleUnderline" :type="isUnderline ? 'primary' : 'secondary'">U</a-button>
      <a-button @click="toggleStrikethrough" :type="isStrikethrough ? 'primary' : 'secondary'"
        >S</a-button
      >
    </a-button-group>

    <!-- 5. 层级操作 -->
    <a-button-group>
      <a-button @click="moveLayerUp">上移</a-button>
      <a-button @click="moveLayerDown">下移</a-button>
    </a-button-group>
  </a-space>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type NodeState, type TextState } from '@/types/state';

const store = useCanvasStore();

// --- 核心辅助函数 (ViewModel) ---

/** 获取第一个选中节点的值 (用于回显) */
function getFirstValue<T>(getter: (node: NodeState) => T, defaultValue: T): T {
  const first = store.activeElements[0];
  if (!first) return defaultValue;
  return getter(first) ?? defaultValue;
}

/** 批量更新所有选中节点 */
function updateSelectedNodes(updater: (node: NodeState) => Partial<NodeState> | null) {
  store.activeElements.forEach((node) => {
    const patch = updater(node);
    if (patch) {
      store.updateNode(node.id, patch);
    }
  });
}

// --- 计算属性 (双向绑定) ---

// 1. 坐标 X/Y
const x = computed({
  get: () => getFirstValue((n) => n.transform.x, 0),
  set: (val) => updateSelectedNodes((n) => ({ transform: { ...n.transform, x: val ?? 0 } })),
});

const y = computed({
  get: () => getFirstValue((n) => n.transform.y, 0),
  set: (val) => updateSelectedNodes((n) => ({ transform: { ...n.transform, y: val ?? 0 } })),
});

// 2. 颜色逻辑
const showFillColor = computed(() => {
  const first = store.activeElements[0];
  return first && (first.type === NodeType.RECT || first.type === NodeType.CIRCLE);
});

const fillColor = computed({
  get: () => getFirstValue((n) => n.style.backgroundColor, '#ffffff'),
  set: (val) => updateSelectedNodes((n) => ({ style: { ...n.style, backgroundColor: val } })),
});

// 描边色/文本色 复用逻辑
const strokeColor = computed({
  get: () => {
    const first = store.activeElements[0];
    if (first?.type === NodeType.TEXT) {
      return (first as TextState).props.color;
    }
    return first?.style.borderColor ?? '#000000';
  },
  set: (val) =>
    updateSelectedNodes((n) => {
      if (n.type === NodeType.TEXT) {
        return { props: { ...(n as TextState).props, color: val } };
      }
      return { style: { ...n.style, borderColor: val } };
    }),
});

// 3. 边框宽度
const borderWidth = computed({
  get: () => getFirstValue((n) => n.style.borderWidth, 0),
  set: (val) => {
    updateSelectedNodes((node) => ({
      style: { ...node.style, borderWidth: val ?? 0 },
    }));
  },
});

// 4. 文本样式逻辑
const isTextSelected = computed(() => store.activeElements.some((n) => n.type === NodeType.TEXT));

const isBold = computed(() =>
  getFirstValue((n) => (n as TextState).props?.fontWeight === 700, false)
);
const toggleBold = () =>
  updateSelectedNodes((n) => {
    if (n.type !== NodeType.TEXT) return null;
    const textNode = n as TextState;
    return {
      props: { ...textNode.props, fontWeight: textNode.props.fontWeight === 700 ? 400 : 700 },
    };
  });

const isItalic = computed(() =>
  getFirstValue((n) => (n as TextState).props?.fontStyle === 'italic', false)
);
const toggleItalic = () =>
  updateSelectedNodes((n) => {
    if (n.type !== NodeType.TEXT) return null;
    const textNode = n as TextState;
    return {
      props: {
        ...textNode.props,
        fontStyle: textNode.props.fontStyle === 'italic' ? 'normal' : 'italic',
      },
    };
  });

const isUnderline = computed(() => getFirstValue((n) => (n as TextState).props?.underline, false));
const toggleUnderline = () =>
  updateSelectedNodes((n) => {
    if (n.type !== NodeType.TEXT) return null;
    const textNode = n as TextState;
    return { props: { ...textNode.props, underline: !textNode.props.underline } };
  });

const isStrikethrough = computed(() =>
  getFirstValue((n) => (n as TextState).props?.strikethrough, false)
);
const toggleStrikethrough = () =>
  updateSelectedNodes((n) => {
    if (n.type !== NodeType.TEXT) return null;
    const textNode = n as TextState;
    return { props: { ...textNode.props, strikethrough: !textNode.props.strikethrough } };
  });

// 5. 层级操作
const moveLayerUp = () =>
  updateSelectedNodes((n) => ({ style: { ...n.style, zIndex: n.style.zIndex + 1 } }));
const moveLayerDown = () =>
  updateSelectedNodes((n) => ({ style: { ...n.style, zIndex: n.style.zIndex - 1 } }));
</script>

<style scoped>
.property-panel {
  padding: 16px;
  height: 100%;
  width: 100%;
  overflow-y: auto;
  background-color: var(--color-bg-2);
}
</style>

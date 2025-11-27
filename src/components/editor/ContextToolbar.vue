<template>
  <div v-if="isVisible" class="context-toolbar" :style="positionStyle" @mousedown.stop>
    <!-- Shape Controls -->
    <template v-if="isShape">
      <div class="tool-item">
        <a-color-picker size="mini" v-model="fillColor" trigger="hover" show-text disabled-alpha />
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-color-picker size="mini" v-model="strokeColor" trigger="hover" />
      </div>
      <div class="tool-item">
        <a-input-number
          size="mini"
          v-model="strokeWidth"
          :min="0"
          :max="20"
          style="width: 50px"
          hide-button
        />
      </div>
    </template>

    <!-- Text Controls -->
    <template v-if="isText">
      <div class="tool-item">
        <a-input-number
          size="mini"
          v-model="fontSize"
          :min="12"
          :max="100"
          style="width: 50px"
          hide-button
        />
      </div>
      <div class="tool-item">
        <a-button size="mini" :type="isBold ? 'primary' : 'text'" @click="toggleBold">
          <icon-text-bold />
        </a-button>
      </div>
      <div class="tool-item">
        <a-button size="mini" :type="isItalic ? 'primary' : 'text'" @click="toggleItalic">
          <icon-text-italic />
        </a-button>
      </div>
      <div class="tool-item">
        <a-button size="mini" :type="isUnderline ? 'primary' : 'text'" @click="toggleUnderline">
          <icon-text-underline />
        </a-button>
      </div>
      <div class="tool-item">
        <a-button
          size="mini"
          :type="isStrikethrough ? 'primary' : 'text'"
          @click="toggleStrikethrough"
        >
          <icon-strikethrough />
        </a-button>
      </div>
      <div class="tool-item">
        <a-color-picker size="mini" v-model="textColor" trigger="hover" />
      </div>
    </template>

    <div class="divider"></div>

    <!-- Common -->
    <div class="tool-item">
      <a-button size="mini" status="danger" type="text" @click="handleDelete">
        <icon-delete />
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type ShapeState, type TextState } from '@/types/state';
import { worldToClient } from '@/core/utils/geometry';
import {
  Delete as IconDelete,
  TextBold as IconTextBold,
  TextItalic as IconTextItalic,
  TextUnderline as IconTextUnderline,
  Strikethrough as IconStrikethrough,
} from '@icon-park/vue-next';

const store = useCanvasStore();

// 获取当前选中的第一个节点
const activeNode = computed(() => {
  const ids = Array.from(store.activeElementIds);
  if (ids.length !== 1) return null;
  return store.nodes[ids[0]];
});

const isVisible = computed(() => !!activeNode.value && !store.isInteracting);

// 计算位置
const positionStyle = computed(() => {
  if (!activeNode.value) return {};

  const node = activeNode.value;
  const { x, y, width, rotation } = node.transform;

  // 计算节点在屏幕上的位置（相对于 CanvasStage 容器）
  // 注意：这里简化了旋转的处理，仅基于包围盒左上角和宽度计算中心点
  // 如果需要更精确的跟随旋转，需要计算旋转后的包围盒
  const worldCenter = {
    x: x + width / 2,
    y: y,
  };

  const clientPos = worldToClient(store.viewport, worldCenter.x, worldCenter.y);

  return {
    top: `${clientPos.y - 12}px`,
    left: `${clientPos.x}px`,
    transform: 'translate(-50%, -100%)', // 居中并向上偏移
  };
});

// 类型判断
const isShape = computed(() => {
  return activeNode.value?.type === NodeType.RECT || activeNode.value?.type === NodeType.CIRCLE;
});

const isText = computed(() => {
  return activeNode.value?.type === NodeType.TEXT;
});

// --- Shape Actions ---
const fillColor = computed({
  get: () => (activeNode.value as ShapeState)?.style.backgroundColor || '#000000',
  set: (val) =>
    store.updateNode(activeNode.value!.id, {
      style: { ...activeNode.value!.style, backgroundColor: val },
    }),
});

const strokeColor = computed({
  get: () => (activeNode.value as ShapeState)?.style.borderColor || '#000000',
  set: (val) =>
    store.updateNode(activeNode.value!.id, {
      style: { ...activeNode.value!.style, borderColor: val },
    }),
});

const strokeWidth = computed({
  get: () => (activeNode.value as ShapeState)?.style.borderWidth || 0,
  set: (val) =>
    store.updateNode(activeNode.value!.id, {
      style: { ...activeNode.value!.style, borderWidth: val as number },
    }),
});

// --- Text Actions ---
const fontSize = computed({
  get: () => (activeNode.value as TextState)?.props.fontSize || 14,
  set: (val) => store.updateNode(activeNode.value!.id, { props: { fontSize: val as number } }),
});

const isBold = computed(() => {
  return ((activeNode.value as TextState)?.props.fontWeight || 400) >= 700;
});

const toggleBold = () => {
  const current = (activeNode.value as TextState)?.props.fontWeight || 400;
  store.updateNode(activeNode.value!.id, { props: { fontWeight: current >= 700 ? 400 : 700 } });
};

const isItalic = computed(() => {
  return (activeNode.value as TextState)?.props.fontStyle === 'italic';
});

const toggleItalic = () => {
  const current = (activeNode.value as TextState)?.props.fontStyle || 'normal';
  store.updateNode(activeNode.value!.id, {
    props: { fontStyle: current === 'italic' ? 'normal' : 'italic' },
  });
};

const isUnderline = computed(() => {
  return (activeNode.value as TextState)?.props.underline || false;
});

const toggleUnderline = () => {
  const current = (activeNode.value as TextState)?.props.underline || false;
  store.updateNode(activeNode.value!.id, { props: { underline: !current } });
};

const isStrikethrough = computed(() => {
  return (activeNode.value as TextState)?.props.strikethrough || false;
});

const toggleStrikethrough = () => {
  const current = (activeNode.value as TextState)?.props.strikethrough || false;
  store.updateNode(activeNode.value!.id, { props: { strikethrough: !current } });
};

const textColor = computed({
  get: () => (activeNode.value as TextState)?.props.color || '#000000',
  set: (val) => store.updateNode(activeNode.value!.id, { props: { color: val } }),
});

// --- Common Actions ---
const handleDelete = () => {
  if (activeNode.value) {
    store.deleteNode(activeNode.value.id);
  }
};
</script>

<style scoped>
.context-toolbar {
  position: absolute;
  z-index: 1000;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background-color: var(--color-bg-5);
  background-color: #232324; /* 强制深色背景 */
  border-radius: 20px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  gap: 8px;
  pointer-events: auto;
}

.tool-item {
  display: flex;
  align-items: center;
}

.divider {
  width: 1px;
  height: 16px;
  background-color: rgba(255, 255, 255, 0.2);
}

/* 覆盖 Arco 样式以适应深色工具栏 */
:deep(.arco-btn-text) {
  color: #fff;
}
:deep(.arco-btn-text:hover) {
  background-color: rgba(255, 255, 255, 0.1);
}
:deep(.arco-input-number) {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: none;
}
:deep(.arco-input-number-input) {
  color: #fff;
}
</style>

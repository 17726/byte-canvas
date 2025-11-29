<template>
  <div v-if="isVisible" class="context-toolbar" :style="positionStyle" @mousedown.stop>
    <!-- Common Properties (Opacity & Layer) -->
    <div class="tool-section">
      <div class="tool-item" title="不透明度">
        <span class="label">Opacity</span>
        <a-slider
          v-model="opacity"
          :min="0"
          :max="1"
          :step="0.01"
          style="width: 60px; margin-left: 8px"
          size="mini"
        />
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-button size="mini" type="text" @click="bringToFront" title="置于最前">
          <icon-bring-to-front />
        </a-button>
        <a-button size="mini" type="text" @click="sendToBack" title="置于最底">
          <icon-send-to-back />
        </a-button>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Shape Controls -->
    <template v-if="isShape">
      <div class="tool-item">
        <a-color-picker size="mini" v-model="fillColor" trigger="hover" disabled-alpha />
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-color-picker size="mini" v-model="strokeColor" trigger="hover" />
      </div>
      <div class="tool-item">
        边框：
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
        字号：
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

    <!-- Delete -->
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
  BringToFrontOne as IconBringToFront,
  SentToBack as IconSendToBack,
} from '@icon-park/vue-next';

const store = useCanvasStore();

// 获取当前选中的第一个节点（ContextToolbar 仅在单选时显示）
const activeNode = computed(() => {
  const ids = Array.from(store.activeElementIds);
  if (ids.length !== 1) return null;
  return store.nodes[ids[0]!];
});

// 显示条件：有且仅有一个选中节点，并且不在其他交互中（如拖拽）
const isVisible = computed(() => !!activeNode.value && !store.isInteracting);

// 计算属性工具栏在屏幕中的位置，用 worldToClient 将世界坐标转换为 DOM 客户端坐标
// 说明：由于 ContextToolbar 本身放在视口外层 (不受 viewport transform)，因此需要将节点的世界坐标映射到 client 坐标
// 计算工具栏在页面中的绝对位置：以节点的中心为锚点向上偏移
const positionStyle = computed(() => {
  if (!activeNode.value) return {};

  const node = activeNode.value;
  const { x, y, width } = node.transform;

  // 计算节点在屏幕上的位置（相对于 CanvasStage 容器）
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

// --- Common Actions (对选中节点的操作，例如置于最前 / 置于最底 / 删除) ---
const opacity = computed({
  get: () => activeNode.value?.style.opacity ?? 1,
  set: (val) => {
    if (activeNode.value) {
      store.updateNode(activeNode.value.id, {
        style: { ...activeNode.value.style, opacity: val as number },
      });
    }
  },
});

const bringToFront = () => {
  if (!activeNode.value) return;
  const id = activeNode.value.id;
  const order = [...store.nodeOrder];
  const index = order.indexOf(id);
  if (index > -1) {
    order.splice(index, 1);
    order.push(id);
    store.nodeOrder = order;
    store.version++;
  }
};

const sendToBack = () => {
  if (!activeNode.value) return;
  const id = activeNode.value.id;
  const order = [...store.nodeOrder];
  const index = order.indexOf(id);
  if (index > -1) {
    order.splice(index, 1);
    order.unshift(id);
    store.nodeOrder = order;
    store.version++;
  }
};

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
// 1. 安全获取当前文本节点 (Computed)
// 这样后面就不用每次都写 (activeNode.value as TextState) 了
const activeTextNode = computed(() => {
  const node = store.activeElements[0];
  if (node?.type === NodeType.TEXT) {
    return node as TextState;
  }
  return null;
});

// 2. 封装通用更新函数 (核心优化)
// key 是 TextState['props'] 的键名，value 是对应的值
const updateTextProp = (key: keyof TextState['props'], value: any) => {
  if (!activeTextNode.value) return;

  // ✅ 关键点：使用 as Partial<TextState> 告诉 TS 这是文本节点的更新补丁
  store.updateNode(activeTextNode.value.id, {
    props: { [key]: value },
  } as Partial<TextState>);
};

// --- 具体的属性绑定 ---

const fontSize = computed({
  get: () => activeTextNode.value?.props.fontSize || 14,
  set: (val) => updateTextProp('fontSize', val),
});

const textColor = computed({
  get: () => activeTextNode.value?.props.color || '#000000',
  set: (val) => updateTextProp('color', val),
});

// --- 样式开关 (Toggle) ---

const isBold = computed(() => {
  const fw = activeTextNode.value?.props.fontWeight || 400;
  return fw >= 700;
});
const toggleBold = () => {
  // 如果当前是粗体，设为 400，否则设为 700
  updateTextProp('fontWeight', isBold.value ? 400 : 700);
};

const isItalic = computed(() => activeTextNode.value?.props.fontStyle === 'italic');
const toggleItalic = () => {
  updateTextProp('fontStyle', isItalic.value ? 'normal' : 'italic');
};

const isUnderline = computed(() => activeTextNode.value?.props.underline || false);
const toggleUnderline = () => {
  updateTextProp('underline', !isUnderline.value);
};

const isStrikethrough = computed(() => activeTextNode.value?.props.strikethrough || false);
const toggleStrikethrough = () => {
  updateTextProp('strikethrough', !isStrikethrough.value);
};

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
  padding: 6px 12px;
  background-color: var(--color-bg-2); /* 白色背景 */
  border-radius: 8px; /* 圆角矩形 */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1); /* 柔和阴影 */
  gap: 8px;
  pointer-events: auto;
  border: 1px solid var(--color-border-2);
  flex-wrap: nowrap
}

.tool-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-item {
  display: flex;
  align-items: center;
}

.label {
  font-size: 12px;
  color: var(--color-text-2);
  margin-right: 4px;
}

.divider {
  width: 1px;
  height: 16px;
  background-color: var(--color-border-2);
}
</style>

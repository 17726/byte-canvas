<template>
  <div v-if="isVisible" class="context-toolbar" :style="positionStyle" @mousedown.stop>
    <!-- Shape Controls -->
    <template v-if="isShape">
      <div class="tool-item">
        <a-tooltip position="bottom" content="填充色">
          <a-color-picker
            :popup-offset="-150"
            :popup-translate="[-100, -160]"
            size="mini"
            v-model="fillColor"
            trigger="hover"
            disabled-alpha
          />
        </a-tooltip>
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-tooltip position="bottom" content="边框色">
          <a-color-picker
            :popup-offset="-150"
            :popup-translate="[-100, -160]"
            size="mini"
            v-model="strokeColor"
            trigger="hover"
          />
        </a-tooltip>
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <span style="width: 50px">边框：</span>
        <a-input-number
          size="mini"
          v-model="strokeWidth"
          style="width: 50px"
          class="input-demo"
          :min="0"
          :max="100"
        />
      </div>
    </template>

    <!-- Text Controls -->
    <template v-if="isText">
      <div class="tool-item" style="width: 85px">
        字号:
        <a-input-number
          size="mini"
          v-model="fontSize"
          style="width: 50px; margin-left: 2px"
          class="input-demo"
          :min="12"
          :max="100"
        />
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-popover trigger="click" position="top" content-class="toolbar-popover-content">
          <a-tooltip position="top" content="文本样式">
            <a-button size="mini" type="text">
              <icon-text />
            </a-button>
          </a-tooltip>
          <template #content>
            <div class="popover-grid">
              <a-tooltip content="加粗" :mouse-enter-delay="0.5">
                <a-button size="mini" :type="isBold ? 'primary' : 'text'" @click="toggleBold">
                  <icon-text-bold />
                </a-button>
              </a-tooltip>
              <a-tooltip content="倾斜" :mouse-enter-delay="0.5">
                <a-button size="mini" :type="isItalic ? 'primary' : 'text'" @click="toggleItalic">
                  <icon-text-italic />
                </a-button>
              </a-tooltip>
              <a-tooltip content="下划线" :mouse-enter-delay="0.5">
                <a-button
                  size="mini"
                  :type="isUnderline ? 'primary' : 'text'"
                  @click="toggleUnderline"
                >
                  <icon-text-underline />
                </a-button>
              </a-tooltip>
              <a-tooltip content="删除线" :mouse-enter-delay="0.5">
                <a-button
                  size="mini"
                  :type="isStrikethrough ? 'primary' : 'text'"
                  @click="toggleStrikethrough"
                >
                  <icon-strikethrough />
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </a-popover>
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-tooltip position="bottom" content="文本颜色">
          <a-color-picker
            :popup-offset="-150"
            :popup-translate="[-100, -160]"
            size="mini"
            v-model="computedTextColor"
            trigger="hover"
          />
        </a-tooltip>
      </div>
    </template>

    <!-- Image Controls -->
    <template v-if="isImage">
      <!-- 预留图片滤镜区域，后续恢复时直接取消注释即可 -->
    </template>
    <div class="divider" v-if="isShape || isText"></div>
    <!-- Common Properties (Opacity & Layer) -->
    <div class="tool-section">
      <div class="tool-item">
        <a-tooltip placement="top" title="不透明度" :mouseEnterDelay="0.3" content="透明度">
          <span class="label" style="cursor: help; display: flex; align-items: center">
            <svg
              class="icon"
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                d="M102.4 716.8v-204.8h204.8v204.8z m0-409.6V102.4h204.8v204.8z"
                opacity=".8"
                fill="#1296db"
              ></path>
              <path
                d="M307.2 921.6v-204.8h204.8v204.8z m0-409.6V307.2h204.8v204.8z"
                opacity=".6"
                fill="#1296db"
              ></path>
              <path
                d="M512 716.8v-204.8h204.8v204.8z m0-409.6V102.4h204.8v204.8z"
                opacity=".4"
                fill="#1296db"
              ></path>
              <path
                d="M716.8 921.6v-204.8h204.8v204.8z m0-409.6V307.2h204.8v204.8z"
                opacity=".2"
                fill="#1296db"
              ></path>
            </svg>
          </span>
        </a-tooltip>
        <a-slider
          v-model="opacity"
          :min="0"
          :max="1"
          :step="0.01"
          style="width: 60px; margin-left: 4px"
          size="mini"
          :tooltip-visible="false"
        />
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-popover trigger="click" position="bottom" content-class="layer-popover">
          <a-tooltip placement="top" content="图层顺序">
            <a-button size="mini" type="text">
              <icon-layers />
            </a-button>
          </a-tooltip>
          <!-- 展开的内容（添加提示文字） -->
          <template #content>
            <div class="popover-row">
              <a-button size="mini" type="text" @click="bringToFront" long>
                <template #icon><icon-bring-to-front /></template>
                置于顶层
              </a-button>
              <a-button size="mini" type="text" @click="sendToBack" long>
                <template #icon><icon-send-to-back /></template>
                置于底层
              </a-button>
            </div>
          </template>
        </a-popover>
      </div>
    </div>
    <div class="divider"></div>
    <div class="tool-item">
      <a-tooltip placement="top" content="删除">
        <a-button size="mini" status="danger" type="text" @click="handleDelete">
          <icon-delete />
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, type Ref } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { useStyleSync } from '@/composables/useStyleSync';
import { type TextDecorationValue, type TextState } from '@/types/state';
import { worldToClient } from '@/core/utils/geometry';
// import { DEFAULT_IMAGE_FILTERS, DEFAULT_IMAGE_URL } from '@/config/defaults';
import {
  Delete as IconDelete,
  TextBold as IconTextBold,
  TextItalic as IconTextItalic,
  TextUnderline as IconTextUnderline,
  Strikethrough as IconStrikethrough,
  BringToFrontOne as IconBringToFront,
  SentToBack as IconSendToBack,
  Layers as IconLayers, // 新增图标
  Text as IconText, // 新增图标
} from '@icon-park/vue-next';
import { ToolManager } from '@/core/ToolManager';

const store = useCanvasStore();
const toolManagerRef = inject<Ref<ToolManager>>('toolManager');

// 使用 useStyleSync 进行属性绑定
const {
  activeNode,
  isShape,
  isText,
  isImage,
  isGroup,
  opacity,
  fillColor,
  strokeColor,
  strokeWidth,
  fontSize,
  textColor,
} = useStyleSync();

// 显示条件：有且仅有一个选中节点，并且不在其他交互中（如拖拽）
const isVisible = computed(() => !!activeNode.value && !store.isInteracting && !isGroup.value);

// 计算属性工具栏在屏幕中的位置，用 worldToClient 将世界坐标转换为 DOM 客户端坐标
// 说明：由于 ContextToolbar 本身放在视口外层 (不受 viewport transform)，因此需要将节点的世界坐标映射到 client 坐标
// 计算工具栏在页面中的绝对位置：以节点的中心为锚点向上偏移
const positionStyle = computed(() => {
  if (!activeNode.value) return {};

  // 使用绝对坐标，保证组合编辑模式下子元素位置正确
  const absTransform =
    store.getAbsoluteTransform(activeNode.value.id) || activeNode.value.transform;
  const { x, y, width } = absTransform;

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

// 类型判断和基础属性已从 useStyleSync 导入

// --- Common Actions (对选中节点的操作，例如置于最前 / 置于最底 / 删除) ---

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
// fillColor, strokeColor, strokeWidth 已从 useStyleSync 导入

// --- Text Actions ---
// fontSize, textColor 已从 useStyleSync 导入

// 颜色计算属性：支持局部/全局颜色修改
const computedTextColor = computed({
  get: () => textColor.value,
  set: (val: string) => {
    const selection = store.globalTextSelection;
    if (selection && activeNode.value) {
      toolManagerRef?.value?.handleColorChange(activeNode.value.id, val);
    } else {
      textColor.value = val;
    }
  },
});

// --- 样式开关 (Toggle) ---

//粗体
const isBold = computed(() => {
  const activeId = activeNode.value?.id;
  if (!activeId || !isText.value) return false;

  const node = store.nodes[activeId] as TextState;
  // 使用 store 中的全局选区状态（响应式）
  const selection = store.globalTextSelection;
  const { inlineStyles = [], fontWeight: globalFontWeight } = node.props;
  const isGlobalBold = globalFontWeight === 'bold' || globalFontWeight === 700;

  // 如果没有选区，直接返回全局状态
  if (!selection) return isGlobalBold;

  const { start, end } = selection;

  // 1. 检查行内样式：是否有覆盖选中范围的 bold 样式
  const hasInlineBold = inlineStyles.some(
    (style) =>
      style.start <= start &&
      style.end >= end &&
      (style.styles.fontWeight === 'bold' || style.styles.fontWeight === 700)
  );
  if (hasInlineBold) return true;

  // 检查选中范围是否被行内样式覆盖
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontWeight !== undefined
  );

  return isGlobalBold && !hasInlineOverride;
});

const toggleBold = () => {
  const activeId = activeNode.value?.id;
  if (!activeId) return;

  const selection = store.globalTextSelection;
  if (selection) {
    toolManagerRef?.value?.handleToggleBold(activeId);
  } else {
    // 全局切换
    const current = fontWeight.value;
    const isBold = current === 'bold' || current === 700;
    fontWeight.value = isBold ? 'normal' : 'bold';
  }
};

//斜体
const isItalic = computed(() => {
  const activeId = activeNode.value?.id;
  if (!activeId || !isText.value) return false;

  const node = store.nodes[activeId] as TextState;
  const selection = store.globalTextSelection;
  const { inlineStyles = [], fontStyle: globalFontStyle } = node.props;
  const isGlobalItalic = globalFontStyle === 'italic';

  if (!selection) return isGlobalItalic;

  const { start, end } = selection;

  const hasInlineItalic = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontStyle === 'italic'
  );
  if (hasInlineItalic) return true;

  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontStyle !== undefined
  );

  return isGlobalItalic && !hasInlineOverride;
});

const toggleItalic = () => {
  const activeId = activeNode.value?.id;
  if (!activeId) return;

  const selection = store.globalTextSelection;
  if (selection) {
    toolManagerRef?.value?.handleToggleItalic(activeId);
  } else {
    // 全局切换 (fontStyle 不在 useStyleSync 中，需手动更新)
    const node = store.nodes[activeId] as TextState;
    const current = node.props.fontStyle;
    store.updateNode(activeId, {
      props: { ...node.props, fontStyle: current === 'italic' ? 'normal' : 'italic' },
    });
  }
};

//下划线
const isUnderline = computed(() => {
  const activeId = activeNode.value?.id;
  if (!activeId || !isText.value) return false;

  const node = store.nodes[activeId] as TextState;
  const selection = store.globalTextSelection;
  const { inlineStyles = [], textDecoration: globalTextDecoration } = node.props;

  const hasUnderlineValue = (value?: TextDecorationValue) => {
    if (!value) return false;
    return value.split(' ').includes('underline');
  };

  const isGlobalUnderline = hasUnderlineValue(globalTextDecoration);

  if (!selection) return isGlobalUnderline;

  const { start, end } = selection;

  const hasInlineUnderline = inlineStyles.some(
    (style) =>
      style.start <= start && style.end >= end && hasUnderlineValue(style.styles.textDecoration)
  );
  if (hasInlineUnderline) return true;

  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.textDecoration !== undefined
  );

  return isGlobalUnderline && !hasInlineOverride;
});

const toggleUnderline = () => {
  const activeId = activeNode.value?.id;
  if (!activeId) return;

  const selection = store.globalTextSelection;
  if (selection) {
    toolManagerRef?.value?.handleToggleUnderline(activeId);
  } else {
    // 全局切换
    const node = store.nodes[activeId] as TextState;
    const current = node.props.textDecoration || 'none';
    const parts = current === 'none' ? [] : current.split(' ');

    // Toggle underline
    if (parts.includes('underline')) {
      const index = parts.indexOf('underline');
      parts.splice(index, 1);
    } else {
      parts.push('underline');
    }

    // Ensure standard order: underline then line-through
    const hasUnderline = parts.includes('underline');
    const hasLineThrough = parts.includes('line-through');
    const newParts: string[] = [];
    if (hasUnderline) newParts.push('underline');
    if (hasLineThrough) newParts.push('line-through');

    const next = (newParts.length > 0 ? newParts.join(' ') : 'none') as TextDecorationValue;
    store.updateNode(activeId, {
      props: { ...node.props, textDecoration: next },
    });
  }
};

//删除线
const isStrikethrough = computed(() => {
  const activeId = activeNode.value?.id;
  if (!activeId || !isText.value) return false;

  const node = store.nodes[activeId] as TextState;
  const selection = store.globalTextSelection;
  const { inlineStyles = [], textDecoration: globalTextDecoration } = node.props;

  const hasStrikethroughValue = (value?: TextDecorationValue) => {
    if (!value) return false;
    return value.split(' ').includes('line-through');
  };

  const isGlobalStrikethrough = hasStrikethroughValue(globalTextDecoration);

  if (!selection) return isGlobalStrikethrough;

  const { start, end } = selection;

  const hasInlineStrikethrough = inlineStyles.some(
    (style) =>
      style.start <= start && style.end >= end && hasStrikethroughValue(style.styles.textDecoration)
  );
  if (hasInlineStrikethrough) return true;

  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.textDecoration !== undefined
  );

  return isGlobalStrikethrough && !hasInlineOverride;
});

const toggleStrikethrough = () => {
  const activeId = activeNode.value?.id;
  if (!activeId) return;

  const selection = store.globalTextSelection;
  if (selection) {
    toolManagerRef?.value?.handleToggleStrikethrough(activeId);
  } else {
    // 全局切换
    const node = store.nodes[activeId] as TextState;
    const current = node.props.textDecoration || 'none';
    const parts = current === 'none' ? [] : current.split(' ');

    // Toggle line-through
    if (parts.includes('line-through')) {
      const index = parts.indexOf('line-through');
      parts.splice(index, 1);
    } else {
      parts.push('line-through');
    }

    // Ensure standard order: underline then line-through
    const hasUnderline = parts.includes('underline');
    const hasLineThrough = parts.includes('line-through');
    const newParts: string[] = [];
    if (hasUnderline) newParts.push('underline');
    if (hasLineThrough) newParts.push('line-through');

    const next = (newParts.length > 0 ? newParts.join(' ') : 'none') as TextDecorationValue;
    store.updateNode(activeId, {
      props: { ...node.props, textDecoration: next },
    });
  }
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

.filter-options {
  display: flex;
  gap: 10px;
  align-items: center;
}
.filter-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}
.filter-preview {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  border: 2px solid #e5e5e5;
  transition: all 0.2s ease;
}
.filter-preview.active {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}
.filter-name {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}
.layer-popover {
  padding: 8px !important; /* 调整内边距 */
  min-width: 120px; /* 固定最小宽度，避免文字挤压 */
}

/* 提示文字样式 */
.popover-tip {
  text-align: center; /* 文字居中 */
  font-size: 12px; /* 字号适配 mini 按钮 */
  color: #666; /* 浅灰色，区分按钮文字 */
  padding: 0 0 6px 0; /* 与按钮保持间距 */
  border-bottom: 1px solid #f0f0f0; /* 加分割线，视觉更清晰 */
  margin-bottom: 6px;
}

/* 按钮行样式优化 */
.popover-row {
  display: flex;
  flex-direction: column; /* 按钮垂直排列 */
  gap: 4px; /* 按钮之间的间距 */
}
</style>

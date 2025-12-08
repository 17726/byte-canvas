<template>
  <div v-if="isVisible" class="context-toolbar" :style="positionStyle" @mousedown.stop>
    <!-- Shape Controls -->
    <template v-if="isShape || isText">
      <div class="tool-item">
        <a-tooltip content="填充颜色" :mouse-enter-delay="0.5">
          <a-color-picker
            position="left"
            popup-offset="30"
            :popup-translate="[0, 50]"
            size="mini"
            v-model="fillColor"
            trigger="hover"
            disabled-alpha
          />
        </a-tooltip>
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-popover trigger="click" position="top" content-class="toolbar-popover-content">
          <a-button size="mini" type="text" padding="0">
            <icon-menu style="font-size: 20px; width: 24px" />
          </a-button>
          <template #content>
            <div class="popover-grid" style="display: flex; gap: 10px; align-items: center">
              <a-tooltip content="边框颜色" :mouse-enter-delay="0.5">
                <a-color-picker
                  position="left"
                  popup-offset="30"
                  size="mini"
                  v-model="strokeColor"
                  trigger="hover"
                />
              </a-tooltip>
              <a-tooltip content="边框大小" :mouse-enter-delay="0.5">
                <a-input-number
                  size="mini"
                  v-model="strokeWidth"
                  style="width: 50px"
                  class="input-demo"
                  :min="0"
                  :max="100"
                />
              </a-tooltip>
            </div>
          </template>
        </a-popover>
      </div>
    </template>

    <!-- Text Controls -->
    <template v-if="isText">
      <div class="tool-item" style="width: 100px">
        <a-input-number
          size="mini"
          v-model="fontSize"
          style="width: 90px; margin-left: 2px"
          class="input-demo"
          :min="12"
          :max="100"
          mode="button"
        />
      </div>
      <div class="divider"></div>
      <div class="tool-item">
        <a-tooltip content="文本颜色" :mouse-enter-delay="0.5">
          <a-color-picker
            :popup-offset="-150"
            :popup-translate="[-100, -160]"
            size="mini"
            @change="handleColorChange"
            trigger="hover"
          >
          </a-color-picker>
        </a-tooltip>
      </div>
      <div class="tool-item">
        <a-tooltip content="加粗" :mouse-enter-delay="0.5">
          <a-button size="mini" :type="isBold ? 'primary' : 'text'" @click="toggleBold">
            <icon-text-bold />
          </a-button>
        </a-tooltip>
      </div>
      <div class="tool-item">
        <a-tooltip content="倾斜" :mouse-enter-delay="0.5">
          <a-button size="mini" :type="isItalic ? 'primary' : 'text'" @click="toggleItalic">
            <icon-text-italic />
          </a-button>
        </a-tooltip>
      </div>
      <div class="tool-item">
        <a-tooltip content="下划线" :mouse-enter-delay="0.5">
          <a-button size="mini" :type="isUnderline ? 'primary' : 'text'" @click="toggleUnderline">
            <icon-text-underline />
          </a-button>
        </a-tooltip>
      </div>
      <div class="tool-item">
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

    <!-- Image Controls -->
    <template v-if="isImage">
      <!-- 预留图片滤镜区域，后续恢复时直接取消注释即可 -->
    </template>
    <div class="divider" v-if="isShape || isText"></div>
    <!-- Common Properties (Opacity & Layer) -->
    <div class="tool-section">
      <div class="tool-item">
        <a-tooltip placement="top" :mouseEnterDelay="0.3" content="不透明度">
          <span class="label" style="cursor: default; display: flex; align-items: center">
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
        <a-popover trigger="click" position="right" content-class="layer-popover">
          <a-tooltip placement="top" content="图层顺序">
            <a-button fontsize="24px" type="text">
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
import { NodeType, type TextDecorationValue, type TextState } from '@/types/state';
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
  // Text as IconText, // 新增图标
} from '@icon-park/vue-next';
import { ToolManager } from '@/core/ToolManager';
import { IconFontColors, IconMenu } from '@arco-design/web-vue/es/icon';
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
// 1. 安全获取当前文本节点 (Computed)
// 这样后面就不用每次都写 (activeNode.value as TextState) 了
const activeTextNode = computed(() => {
  const node = store.activeElements[0];
  if (node?.type === NodeType.TEXT) {
    return node as TextState;
  }
  return null;
});

// const textColor = computed({
//   //NOTE: 关于调色板图标样式的响应还有待商榷 这个get响应逻辑是错的但先不改（可画不变）
//   get: () => activeTextNode.value?.props.color || '#000000',
//   set: (val) =>
//     activeTextNode.value && toolManagerRef?.value.handleColorChange(activeTextNode.value.id, val),
// });

const handleColorChange = (selectedColor: string) => {
  // 1. 过滤无效值（和你之前修复的逻辑一致）
  if (!selectedColor) return;

  // 2. 触发原有修改颜色的逻辑
  if (activeTextNode.value && toolManagerRef?.value) {
    toolManagerRef.value.handleColorChange(activeTextNode.value.id, selectedColor);
  }
};

// --- 样式开关 (Toggle) ---

//粗体
const isBold = computed(() => {
  const selection = toolManagerRef?.value.getCurrentSelection();
  if (!activeTextNode.value || !selection) return false;

  const { start, end } = selection;
  const { inlineStyles = [], fontWeight: globalFontWeight } = activeTextNode.value.props;

  // 1. 检查行内样式：是否有覆盖选中范围的 bold 样式
  const hasInlineBold = inlineStyles.some(
    (style) =>
      style.start <= start &&
      style.end >= end &&
      // 行内样式的 fontWeight 可能是 'bold' 或 700（两种都表示加粗）
      (style.styles.fontWeight === 'bold' || style.styles.fontWeight === 700)
  );
  if (hasInlineBold) return true;

  // 2. 检查全局样式：若没有行内样式覆盖，且全局是加粗，则返回 true
  // 全局样式的 fontWeight 可能是 'bold' 或 number 类型（700 对应加粗）
  const isGlobalBold = globalFontWeight === 'bold' || globalFontWeight === 700;

  // 检查选中范围是否被行内样式覆盖（只要有行内样式修改 fontWeight，就不算全局生效）
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontWeight !== undefined // 只要设置了行内 fontWeight，无论值是什么，都算覆盖
  );

  return isGlobalBold && !hasInlineOverride;
});

const toggleBold = () => {
  const activeId = Array.from(store.activeElementIds)[0];
  if (activeId) {
    console.log('设置粗体');
    toolManagerRef?.value.handleToggleBold(activeId);
    console.log('设置粗体完毕');
  }
};

//斜体
const isItalic = computed(() => {
  const selection = toolManagerRef?.value.getCurrentSelection();
  if (!activeTextNode.value || !selection) return false;

  const { start, end } = selection;
  const { inlineStyles = [], fontStyle: globalFontStyle } = activeTextNode.value.props;

  // 1. 检查行内样式：是否有覆盖选中范围的 italic 样式
  const hasInlineItalic = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontStyle === 'italic'
  );
  if (hasInlineItalic) return true;

  // 2. 检查全局样式：若没有行内样式覆盖，且全局是 italic，则返回 true
  const isGlobalItalic = globalFontStyle === 'italic';

  // 检查选中范围是否被行内样式覆盖（只要有行内样式修改 fontStyle，就不算全局生效）
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontStyle !== undefined // 只要设置了行内 fontStyle，无论值是什么，都算覆盖
  );

  return isGlobalItalic && !hasInlineOverride;
});

const toggleItalic = () => {
  const activeId = Array.from(store.activeElementIds)[0];
  if (activeId) {
    toolManagerRef?.value.handleToggleItalic(activeId);
  }
};

//下划线
const isUnderline = computed(() => {
  const selection = toolManagerRef?.value.getCurrentSelection();
  if (!activeTextNode.value || !selection) return false;

  const { start, end } = selection;
  const { inlineStyles = [], textDecoration: globalTextDecoration } = activeTextNode.value.props;

  // 辅助函数：判断 textDecoration 是否包含下划线
  const hasUnderlineValue = (value?: TextDecorationValue) => {
    if (!value) return false;
    // 处理多值情况（如 "underline line-through" 同时存在下划线和删除线）
    return value.split(' ').includes('underline');
  };

  // 1. 检查行内样式：是否有覆盖选中范围的下划线样式
  const hasInlineUnderline = inlineStyles.some(
    (style) =>
      style.start <= start && style.end >= end && hasUnderlineValue(style.styles.textDecoration)
  );
  if (hasInlineUnderline) return true;

  // 2. 检查全局样式：若没有行内样式覆盖，且全局有下划线，则返回 true
  const isGlobalUnderline = hasUnderlineValue(globalTextDecoration);

  // 检查选中范围是否被行内样式覆盖（只要有行内样式修改 textDecoration，就不算全局生效）
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.textDecoration !== undefined // 只要设置了行内 textDecoration，无论值是什么，都算覆盖
  );

  return isGlobalUnderline && !hasInlineOverride;
});
const toggleUnderline = () => {
  const activeId = Array.from(store.activeElementIds)[0];
  if (activeId) {
    toolManagerRef?.value.handleToggleUnderline(activeId);
  }
};

//删除线
const isStrikethrough = computed(() => {
  const selection = toolManagerRef?.value.getCurrentSelection();
  if (!activeTextNode.value || !selection) return false;

  const { start, end } = selection;
  const { inlineStyles = [], textDecoration: globalTextDecoration } = activeTextNode.value.props;

  // 辅助函数：判断 textDecoration 是否包含删除线
  const hasStrikethroughValue = (value?: TextDecorationValue) => {
    if (!value) return false;
    // 处理可能的多值情况（如 "underline line-through"）
    return value.split(' ').includes('line-through');
  };

  // 1. 检查行内样式：是否有覆盖选中范围的删除线样式
  const hasInlineStrikethrough = inlineStyles.some(
    (style) =>
      style.start <= start && style.end >= end && hasStrikethroughValue(style.styles.textDecoration)
  );
  if (hasInlineStrikethrough) return true;

  // 2. 检查全局样式：若没有行内样式覆盖，且全局有删除线，则返回 true
  const isGlobalStrikethrough = hasStrikethroughValue(globalTextDecoration);

  // 检查选中范围是否被行内样式覆盖（只要有行内样式修改 textDecoration，就不算全局生效）
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.textDecoration !== undefined // 只要设置了行内 textDecoration，无论值是什么，都算覆盖
  );

  return isGlobalStrikethrough && !hasInlineOverride;
});
const toggleStrikethrough = () => {
  const activeId = Array.from(store.activeElementIds)[0];
  if (activeId) {
    toolManagerRef?.value.handleToggleStrikethrough(activeId);
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

.arco-btn-size-mini {
  height: 24px;
  padding: 0 1px;
  font-size: 16px;
  border-radius: var(--border-radius-small);
}
</style>

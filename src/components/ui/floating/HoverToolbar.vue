<template>
  <!-- 核心修改：使用 Teleport 将工具栏挂载到 body 上，避开画布的 Scale 和事件干扰 -->
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="context-toolbar"
      :style="positionStyle"
      @mousedown.stop
      @wheel.stop
    >
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
            />
          </a-tooltip>
        </div>
        <div class="divider"></div>
        <div class="tool-item">
          <a-popover trigger="hover" position="top" content-class="toolbar-popover-content">
            <a-button size="mini" type="text" padding="0">
              <icon-sort style="font-size: 20px; width: 24px" />
            </a-button>
            <template #content>
              <div class="popover-grid" style="display: flex; gap: 10px; align-items: center">
                边框：
                <a-tooltip content="边框颜色" :mouse-enter-delay="0.5">
                  <a-color-picker
                    position="left"
                    popup-offset="60"
                    size="mini"
                    v-model="strokeColor"
                    trigger="hover"
                  />
                </a-tooltip>
                <a-tooltip content="边框大小" :mouse-enter-delay="0.5">
                  <a-input-number
                    size="mini"
                    v-model="strokeWidth"
                    style="width: 80px"
                    class="input-demo"
                    :min="0"
                    :max="100"
                    mode="button"
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
              <icon-font-colors style="font-size: 20px; width: 24px; color: #165dff" />
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
        <!-- 预留图片滤镜区域 -->
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

          <!-- 滑动条组件 -->
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
          <a-popover trigger="hover" position="right" content-class="layer-popover">
            <a-tooltip placement="top" content="图层顺序">
              <a-button fontsize="24px" type="text">
                <icon-layers />
              </a-button>
            </a-tooltip>
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
  </Teleport>
</template>

<script setup lang="ts">
import { computed, inject, type Ref, type CSSProperties } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { useStyleSync } from '@/composables/useStyleSync';
import { NodeType, type TextDecorationValue, type TextState } from '@/types/state';
import { worldToClient } from '@/core/utils/geometry';
import {
  Delete as IconDelete,
  TextBold as IconTextBold,
  TextItalic as IconTextItalic,
  TextUnderline as IconTextUnderline,
  Strikethrough as IconStrikethrough,
  BringToFrontOne as IconBringToFront,
  SentToBack as IconSendToBack,
  Layers as IconLayers,
} from '@icon-park/vue-next';
import { ToolManager } from '@/core/ToolManager';
import { IconMenu } from '@arco-design/web-vue/es/icon';
import { IconFontColors, IconSort } from '@arco-design/web-vue/es/icon';
const store = useCanvasStore();
const toolManagerRef = inject<Ref<ToolManager>>('toolManager');

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

// 显示条件
const isVisible = computed(() => !!activeNode.value && !store.isInteracting && !isGroup.value);

// 计算位置 - 修改为 fixed 定位以配合 Teleport
const positionStyle = computed<CSSProperties>(() => {
  if (!activeNode.value) return {};
  const absTransform =
    store.getAbsoluteTransform(activeNode.value.id) || activeNode.value.transform;
  const { x, y, width } = absTransform;
  const worldCenter = {
    x: x + width / 2,
    y: y,
  };

  // worldToClient 得到的通常是相对于视口的坐标
  const clientPos = worldToClient(store.viewport, worldCenter.x, worldCenter.y);

  return {
    // 关键修改：强制使用 fixed 定位，因为 Teleport 到了 body
    position: 'fixed',
    top: `${clientPos.y + 50}px`,
    left: `${clientPos.x}px`,
    transform: 'translate(-50%, -100%)',
    zIndex: 1002, // 确保层级最高
  };
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

const activeTextNode = computed(() => {
  const node = store.activeElements[0];
  if (node?.type === NodeType.TEXT) {
    return node as TextState;
  }
  return null;
});

const handleColorChange = (selectedColor: string) => {
  if (!selectedColor) return;
  if (activeTextNode.value && toolManagerRef?.value) {
    toolManagerRef.value.handleColorChange(activeTextNode.value.id, selectedColor);
  }
};

// --- Font Style Toggles (保持不变) ---
const isBold = computed(() => {
  const selection = toolManagerRef?.value.getCurrentSelection();
  if (!activeTextNode.value || !selection) return false;
  const { start, end } = selection;
  const { inlineStyles = [], fontWeight: globalFontWeight } = activeTextNode.value.props;
  const hasInlineBold = inlineStyles.some(
    (style) =>
      style.start <= start &&
      style.end >= end &&
      (style.styles.fontWeight === 'bold' || style.styles.fontWeight === 700)
  );
  if (hasInlineBold) return true;
  const isGlobalBold = globalFontWeight === 'bold' || globalFontWeight === 700;
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontWeight !== undefined
  );
  return isGlobalBold && !hasInlineOverride;
});

const toggleBold = () => {
  const activeId = Array.from(store.activeElementIds)[0];
  if (activeId) {
    toolManagerRef?.value.handleToggleBold(activeId);
  }
};

const isItalic = computed(() => {
  const selection = toolManagerRef?.value.getCurrentSelection();
  if (!activeTextNode.value || !selection) return false;
  const { start, end } = selection;
  const { inlineStyles = [], fontStyle: globalFontStyle } = activeTextNode.value.props;
  const hasInlineItalic = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontStyle === 'italic'
  );
  if (hasInlineItalic) return true;
  const isGlobalItalic = globalFontStyle === 'italic';
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.fontStyle !== undefined
  );
  return isGlobalItalic && !hasInlineOverride;
});

const toggleItalic = () => {
  const activeId = Array.from(store.activeElementIds)[0];
  if (activeId) {
    toolManagerRef?.value.handleToggleItalic(activeId);
  }
};

const isUnderline = computed(() => {
  const selection = toolManagerRef?.value.getCurrentSelection();
  if (!activeTextNode.value || !selection) return false;
  const { start, end } = selection;
  const { inlineStyles = [], textDecoration: globalTextDecoration } = activeTextNode.value.props;
  const hasUnderlineValue = (value?: TextDecorationValue) => {
    if (!value) return false;
    return value.split(' ').includes('underline');
  };
  const hasInlineUnderline = inlineStyles.some(
    (style) =>
      style.start <= start && style.end >= end && hasUnderlineValue(style.styles.textDecoration)
  );
  if (hasInlineUnderline) return true;
  const isGlobalUnderline = hasUnderlineValue(globalTextDecoration);
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.textDecoration !== undefined
  );
  return isGlobalUnderline && !hasInlineOverride;
});

const toggleUnderline = () => {
  const activeId = Array.from(store.activeElementIds)[0];
  if (activeId) {
    toolManagerRef?.value.handleToggleUnderline(activeId);
  }
};

const isStrikethrough = computed(() => {
  const selection = toolManagerRef?.value.getCurrentSelection();
  if (!activeTextNode.value || !selection) return false;
  const { start, end } = selection;
  const { inlineStyles = [], textDecoration: globalTextDecoration } = activeTextNode.value.props;
  const hasStrikethroughValue = (value?: TextDecorationValue) => {
    if (!value) return false;
    return value.split(' ').includes('line-through');
  };
  const hasInlineStrikethrough = inlineStyles.some(
    (style) =>
      style.start <= start && style.end >= end && hasStrikethroughValue(style.styles.textDecoration)
  );
  if (hasInlineStrikethrough) return true;
  const isGlobalStrikethrough = hasStrikethroughValue(globalTextDecoration);
  const hasInlineOverride = inlineStyles.some(
    (style) => style.start <= start && style.end >= end && style.styles.textDecoration !== undefined
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
/* 注意：由于使用了 Teleport，scoped 样式依然生效，但结构上 .context-toolbar 直接位于 body 下 */
.context-toolbar {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background-color: var(--color-bg-2);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  gap: 8px;

  /* 关键：确保鼠标事件有效，并防止文本选择 */
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
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

/* ... 其他样式保持不变 ... */
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
  padding: 8px !important;
  min-width: 120px;
}
.popover-tip {
  text-align: center;
  font-size: 12px;
  color: #666;
  padding: 0 0 6px 0;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 6px;
}
.popover-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.arco-btn-size-mini {
  height: 24px;
  padding: 0 1px;
  font-size: 16px;
  border-radius: var(--border-radius-small);
}
</style>

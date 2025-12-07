<template>
  <div class="property-panel">
    <div v-if="isCanvas" class="panel-content">
      <div class="panel-header">
        <span class="node-type">画布设置</span>
      </div>
      <div class="panel-section">
        <div class="panel-section">
          <div class="section-title">网格</div>
          <div class="prop-item">
            <span class="label">显示网格</span>
            <a-switch v-model:checked="store.viewport.isGridVisible" />
          </div>
          <div class="prop-item">
            <span class="label">样式</span>
            <a-radio-group v-model="store.viewport.gridStyle" size="mini">
              <a-radio value="dot">点</a-radio>
              <a-radio value="line">线</a-radio>
              <a-radio value="none">无</a-radio>
            </a-radio-group>
          </div>
          <div class="prop-item">
            <span class="label">网格颜色</span>
            <a-color-picker v-model="store.viewport.gridDotColor" size="small" show-text />
          </div>
          <div class="prop-item">
            <span class="label">间距</span>
            <a-input-number v-model="store.viewport.gridSize" size="small" :min="8" :max="200" />
          </div>
          <div class="prop-item">
            <span class="label">粗细</span>
            <a-input-number v-model="store.viewport.gridDotSize" size="small" :min="1" :max="8" />
          </div>
        </div>
      </div>
      <a-divider style="margin: 12px 0" />
      <div class="panel-section">
        <div class="section-title">背景与主题</div>
        <div class="prop-item">
          <span class="label">背景色</span>
          <a-color-picker v-model="store.viewport.backgroundColor" size="small" show-text />
        </div>
        <div class="prop-item">
          <span class="label">主题</span>
          <div class="preset-buttons">
            <a-button
              v-for="theme in presets"
              :key="theme.name"
              size="mini"
              type="text"
              @click="applyPreset(theme)"
              >{{ theme.name }}</a-button
            >
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      <div v-if="!hasSelection" class="empty-state">
        <a-empty description="未选中元素" />
      </div>

      <div v-else class="panel-content">
        <div class="panel-header">
          <span class="node-type">
            {{
              selectionCount > 1
                ? `已选中 ${selectionCount} 个元素`
                : displayNode?.type?.toUpperCase()
            }}
          </span>
          <span class="node-id" v-if="selectionCount === 1">#{{ displayNode?.id?.slice(-4) }}</span>
        </div>

        <div class="panel-section">
          <div class="section-title">变换</div>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number v-model="batchX" size="small" :precision="2">
                <template #prefix>X</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="batchY" size="small" :precision="2">
                <template #prefix>Y</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number v-model="batchWidth" size="small" :min="1" :precision="2">
                <template #prefix>W</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="batchHeight" size="small" :min="1" :precision="2">
                <template #prefix>H</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="24">
              <a-input-number v-model="batchRotation" size="small">
                <template #prefix>∠</template>
                <template #suffix>°</template>
              </a-input-number>
              <span class="section-title">旋转角度</span>
              <a-slider
                v-model="batchRotation"
                :min="-180"
                :max="180"
                :step="0.1"
                show-input
                size="small"
                @dblclick="batchRotation = 0"
              />
            </a-col>
          </a-row>
        </div>
        <a-divider style="margin: 12px 0" />

        <div class="panel-section">
          <div class="label">外观</div>
          <div class="prop-item" v-if="canEditShapeStyle && !isImage">
            <span class="label">填充</span>
            <div class="flex-row">
              <a-color-picker v-model="fillColorTemp" size="small" @change="applyFillColor" />
            </div>
          </div>
          <div class="prop-item" v-if="canEditShapeStyle">
            <span class="label">描边</span>
            <div class="flex-row">
              <a-color-picker
                v-model="strokeColorTemp"
                size="small"
                @change="handleStrokeColorChange"
              />
              <a-input-number
                v-model="strokeWidthTemp"
                size="small"
                style="width: 80px"
                :min="0"
                @change="handleStrokeWidthChange"
              >
                <template #suffix>px</template>
              </a-input-number>
            </div>
          </div>
          <div class="prop-item">
            <div class="section-title">不透明度</div>
            <a-slider
              v-model="batchOpacity"
              :min="0"
              :max="1"
              :step="0.01"
              show-input
              size="small"
            />
          </div>

          <template v-if="isRect">
            <div class="prop-item">
              <span class="label">圆角 (%)</span>
              <a-slider
                v-model="batchCornerRadius"
                :min="0"
                :max="50"
                :step="1"
                show-input
                size="small"
              />
            </div>
          </template>
        </div>
        <a-divider style="margin: 12px 0" />

        <div class="panel-section" v-if="isText || isShape || isImage || isGroup">
          <div class="section-title">属性</div>
          <div class="common">
            <span class="label">z-Index</span>
            <a-input-number v-model="batchZIndex" size="small" :min="1" mode="button" />
          </div>
          <br />
          <template v-if="canEditText">
            <div class="prop-item">
              <div class="section-title">内容</div>
              <a-textarea v-model="textContent" :auto-size="{ minRows: 2, maxRows: 5 }" />
            </div>
            <div class="prop-item">
              <div class="section-title">字号</div>
              <a-input-number v-model="fontSize" size="small" :min="1" />
            </div>
            <div class="prop-item">
              <div class="section-title">字重</div>
              <a-select v-model="fontWeight" size="small">
                <a-option :value="400">Normal</a-option>
                <a-option :value="700">Bold</a-option>
              </a-select>
            </div>
            <div class="prop-item">
              <div class="section-title">颜色</div>
              <a-color-picker v-model="textColor" show-text size="small" />
            </div>
          </template>

          <template v-if="isImage">
            <div class="prop-item">
              <span class="label">滤镜</span>
              <div class="filter-options">
                <div class="filter-item" @click="selectFilter('grayscale')">
                  <div class="filter-preview" :class="{ active: selectedFilter === 'grayscale' }">
                    <div
                      class="filter-preview-inner"
                      :style="{
                        backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                        filter: 'grayscale(100%) contrast(110%) brightness(95%)',
                      }"
                    ></div>
                  </div>
                  <span class="filter-name">黑白</span>
                </div>
                <div class="filter-item" @click="selectFilter('blur')">
                  <div class="filter-preview" :class="{ active: selectedFilter === 'blur' }">
                    <div
                      class="filter-preview-inner"
                      :style="{
                        backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                        filter: 'blur(5px) brightness(98%) opacity(95%)',
                      }"
                    ></div>
                  </div>
                  <span class="filter-name">模糊</span>
                </div>
                <div class="filter-item" @click="selectFilter('vintage')">
                  <div class="filter-preview" :class="{ active: selectedFilter === 'vintage' }">
                    <div
                      class="filter-preview-inner"
                      :style="{
                        backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                        filter:
                          'sepia(60%) contrast(115%) brightness(95%) saturate(85%) hue-rotate(-10deg) ',
                      }"
                    ></div>
                  </div>
                  <span class="filter-name">复古</span>
                </div>
                <div class="filter-item" @click="selectFilter('reset')">
                  <div class="filter-preview" :class="{ active: selectedFilter === 'reset' }">
                    <div
                      class="filter-preview-inner"
                      :style="{
                        backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                        filter: 'none',
                      }"
                    ></div>
                  </div>
                  <span class="filter-name">重置</span>
                </div>
              </div>
            </div>
            <div class="prop-item">
              <div class="section-title">滤镜参数</div>
              <div class="filter-param-item">
                <div class="filter-param-label">灰度</div>
                <a-slider
                  v-model="grayscale"
                  :min="0"
                  :max="100"
                  :step="1"
                  show-input
                  size="small"
                  @dblclick="grayscale = 0"
                />
              </div>
              <div class="filter-param-item">
                <div class="filter-param-label">模糊</div>
                <a-slider
                  v-model="blur"
                  :min="0"
                  :max="20"
                  :step="0.1"
                  show-input
                  size="small"
                  @dblclick="blur = 0"
                />
              </div>
              <div class="filter-param-item">
                <div class="filter-param-label">亮度</div>
                <a-slider
                  v-model="brightness"
                  :min="0"
                  :max="200"
                  :step="1"
                  show-input
                  size="small"
                  @dblclick="brightness = 100"
                />
              </div>
              <div class="filter-param-item">
                <div class="filter-param-label">对比度</div>
                <a-slider
                  v-model="contrast"
                  :min="0"
                  :max="200"
                  :step="1"
                  show-input
                  size="small"
                  @dblclick="contrast = 100"
                />
              </div>
              <div class="filter-param-item">
                <div class="filter-param-label">饱和度</div>
                <a-slider
                  v-model="saturate"
                  :min="0"
                  :max="200"
                  :step="1"
                  show-input
                  size="small"
                  @dblclick="saturate = 100"
                />
              </div>
              <div class="filter-param-item">
                <div class="filter-param-label">色相旋转</div>
                <a-slider
                  v-model="hueRotate"
                  :min="0"
                  :max="360"
                  :step="1"
                  show-input
                  size="small"
                  @dblclick="hueRotate = 0"
                />
              </div>
              <div class="filter-param-item">
                <div class="filter-param-label">滤镜透明度</div>
                <a-slider
                  v-model="filterOpacity"
                  :min="0"
                  :max="100"
                  :step="1"
                  show-input
                  size="small"
                  @dblclick="filterOpacity = 100"
                />
              </div>
              <div class="filter-param-item">
                <div class="filter-param-label">反转</div>
                <a-slider
                  v-model="invert"
                  :min="0"
                  :max="100"
                  :step="1"
                  show-input
                  size="small"
                  @dblclick="invert = 0"
                />
              </div>
              <div class="filter-param-item">
                <div class="filter-param-label">棕褐色</div>
                <a-slider
                  v-model="sepia"
                  :min="0"
                  :max="100"
                  :step="1"
                  show-input
                  size="small"
                  @dblclick="sepia = 0"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
// 依然保留 useStyleSync 获取一些基础状态，但我们会覆盖掉其中的单点更新逻辑
import { useStyleSync } from '@/composables/useStyleSync';
import {
  NodeType,
  type GroupState,
  type ImageState,
  type NodeState,
  type TextState,
} from '@/types/state';
import { DEFAULT_CANVAS_THEMES, DEFAULT_IMAGE_FILTERS, DEFAULT_IMAGE_URL } from '@/config/defaults';

const store = useCanvasStore();
const ui = useUIStore();
const { activeNode: syncActiveNode } = useStyleSync();

// --- Core Multi-Selection Logic ---

// 1. 计算是否选中了元素
const selectionCount = computed(() => store.activeElementIds.size);
const hasSelection = computed(() => selectionCount.value > 0);

// 2. 获取"显示节点" (Display Node)
// 当多选时，我们通常使用最后选中的那个节点作为 UI 回显的基准 (Primary Selection)
// 或者使用 activeNode (如果 useStyleSync 返回的是单个有效节点)
const displayNode = computed<NodeState | null>(() => {
  if (syncActiveNode.value) return syncActiveNode.value;
  const ids = Array.from(store.activeElementIds);
  if (ids.length === 0) return null;
  // 获取最后一个选中的ID作为主节点
  const lastId = ids[ids.length - 1];
  return store.nodes[lastId!] || null;
});

// 3. 辅助判断类型 (基于 displayNode)
const isGroup = computed(() => displayNode.value?.type === NodeType.GROUP);
const isRect = computed(() => displayNode.value?.type === NodeType.RECT);
const isShape = computed(
  () => displayNode.value?.type === NodeType.RECT || displayNode.value?.type === NodeType.CIRCLE
);
const isText = computed(() => displayNode.value?.type === NodeType.TEXT);
const isImage = computed(() => displayNode.value?.type === NodeType.IMAGE);

// --- Batch Update Helpers ---

/**
 * 批量更新所有选中的节点
 * @param updateFn 回调函数，接收 nodeId 和 node 对象，返回要更新的 Partial<NodeState> 或 null
 */
const batchUpdate = (updateFn: (id: string, node: NodeState) => Partial<NodeState> | null) => {
  store.activeElementIds.forEach((id) => {
    const node = store.nodes[id];
    if (!node) return;
    const patch = updateFn(id, node);
    if (patch) {
      store.updateNode(id, patch);
    }
  });
};

// --- Transform Bindings (Batch) ---

// 创建一个计算属性生成器，用于 Transform 属性
const createBatchTransform = (key: keyof NodeState['transform']) => {
  return computed({
    get: () => displayNode.value?.transform[key] ?? 0,
    set: (val: number) => {
      batchUpdate((id, node) => ({
        transform: { ...node.transform, [key]: val },
      }));
    },
  });
};

const batchX = createBatchTransform('x');
const batchY = createBatchTransform('y');
const batchWidth = createBatchTransform('width');
const batchHeight = createBatchTransform('height');
const batchRotation = createBatchTransform('rotation');

// --- Appearance Bindings (Batch) ---

const batchOpacity = computed({
  get: () => displayNode.value?.style.opacity ?? 1,
  set: (val: number) => {
    batchUpdate((id, node) => ({
      style: { ...node.style, opacity: val },
    }));
  },
});

const batchZIndex = computed({
  get: () => displayNode.value?.style.zIndex ?? 0,
  set: (val: number) => {
    batchUpdate((id, node) => ({
      style: { ...node.style, zIndex: val },
    }));
  },
});

const batchCornerRadius = computed({
  get: () => (displayNode.value as any)?.props?.cornerRadius ?? 0,
  set: (val: number) => {
    batchUpdate((id, node) => {
      if (node.type === NodeType.RECT) {
        return { props: { ...node.props, cornerRadius: val } } as any;
      }
      return null;
    });
  },
});

// Style Logic (Fill & Stroke)
const fillColorTemp = ref('#ffffff');
const strokeColorTemp = ref('#000000');
const strokeWidthTemp = ref(0);
const ignoreFillChange = ref(false);
const ignoreStrokeColorChange = ref(false);
const isSyncingShapeStyle = ref(false);

const canEditShapeStyle = computed(() => isShape.value || isGroup.value);

// Helper: 提取颜色值
const extractColorValue = (input: unknown, fallback: string) => {
  if (typeof input === 'string') return input;
  if (typeof input === 'object' && input) {
    if ('hex' in input) return (input as { hex: string }).hex;
    if ('value' in input) return (input as { value: string }).value;
  }
  return fallback;
};
const extractNumericValue = (input: unknown, fallback: number) => {
  if (typeof input === 'number') return input;
  // 简单处理，实际可复用原有的 robust logic
  return Number(input) || fallback;
};

// Sync Logic: 当 displayNode 变化时更新临时变量
const syncShapeStyleTemps = () => {
  if (!displayNode.value) return;
  // 简化的同步逻辑：直接取 displayNode 的样式
  isSyncingShapeStyle.value = true;
  ignoreFillChange.value = true;
  ignoreStrokeColorChange.value = true;

  fillColorTemp.value = displayNode.value.style.backgroundColor || '#ffffff';
  strokeColorTemp.value = displayNode.value.style.borderColor || '#000000';
  strokeWidthTemp.value = displayNode.value.style.borderWidth || 0;

  nextTick(() => {
    ignoreFillChange.value = false;
    ignoreStrokeColorChange.value = false;
    isSyncingShapeStyle.value = false;
  });
};

watch(() => displayNode.value?.id, syncShapeStyleTemps, { immediate: true });

const applyFillColor = (newColor?: unknown) => {
  if (isSyncingShapeStyle.value) return;
  if (newColor !== undefined && ignoreFillChange.value) {
    ignoreFillChange.value = false;
    return;
  }
  const color = extractColorValue(newColor, fillColorTemp.value);
  fillColorTemp.value = color;

  // 批量应用填充色
  batchUpdate((id, node) => {
    // 只有形状和组合可以设置背景色
    if (
      node.type === NodeType.RECT ||
      node.type === NodeType.CIRCLE ||
      node.type === NodeType.GROUP
    ) {
      return { style: { ...node.style, backgroundColor: color } };
    }
    return null;
  });
};

const handleStrokeColorChange = (value: unknown) => {
  if (isSyncingShapeStyle.value) return;
  if (ignoreStrokeColorChange.value) {
    ignoreStrokeColorChange.value = false;
    return;
  }
  const color = extractColorValue(value, strokeColorTemp.value);
  strokeColorTemp.value = color;

  batchUpdate((id, node) => {
    if (
      node.type === NodeType.RECT ||
      node.type === NodeType.CIRCLE ||
      node.type === NodeType.GROUP
    ) {
      return { style: { ...node.style, borderColor: color } };
    }
    return null;
  });
};

const handleStrokeWidthChange = (value: unknown) => {
  if (isSyncingShapeStyle.value) return;
  const width = extractNumericValue(value, strokeWidthTemp.value);
  strokeWidthTemp.value = width;

  batchUpdate((id, node) => {
    if (
      node.type === NodeType.RECT ||
      node.type === NodeType.CIRCLE ||
      node.type === NodeType.GROUP
    ) {
      return { style: { ...node.style, borderWidth: width } };
    }
    return null;
  });
};

// --- Text Specific (Batch) ---

// 收集所有选中的文本节点（包括组合内的）
const allSelectedTextNodes = computed(() => {
  const nodes: TextState[] = [];
  store.activeElementIds.forEach((id) => {
    const node = store.nodes[id];
    if (!node) return;
    if (node.type === NodeType.TEXT) {
      nodes.push(node as TextState);
    } else if (node.type === NodeType.GROUP) {
      // 简单递归查找组合内的文本（可选，保持与原逻辑一致）
      // 原逻辑 collectGroupDescendants
      const traverse = (childIds: string[]) => {
        childIds.forEach((cid) => {
          const child = store.nodes[cid];
          if (child?.type === NodeType.TEXT) nodes.push(child as TextState);
          if (child?.type === NodeType.GROUP) traverse((child as GroupState).children);
        });
      };
      traverse((node as GroupState).children);
    }
  });
  return nodes;
});

const canEditText = computed(() => allSelectedTextNodes.value.length > 0);
const primaryTextNode = computed(() => allSelectedTextNodes.value[0] || null);

const applyTextProps = (propsPatch: Partial<TextState['props']>) => {
  allSelectedTextNodes.value.forEach((node) => {
    store.updateNode(node.id, { props: propsPatch } as any);
  });
};

// Text Computed Props
const textContent = computed({
  get: () => primaryTextNode.value?.props.content || '',
  set: (val) => applyTextProps({ content: val }),
});
const fontSize = computed({
  get: () => primaryTextNode.value?.props.fontSize || 12,
  set: (val) => applyTextProps({ fontSize: val }),
});
const fontWeight = computed({
  get: () => primaryTextNode.value?.props.fontWeight || 400,
  set: (val) => applyTextProps({ fontWeight: val }),
});
const textColor = computed({
  get: () => primaryTextNode.value?.props.color || '#000000',
  set: (val) => applyTextProps({ color: val }),
});

// --- Image & Filters (Batch) ---
// 预览图片仅使用主节点
const previewImage = computed(
  () => (displayNode.value as ImageState)?.props?.imageUrl || DEFAULT_IMAGE_URL
);
const defaultImage = DEFAULT_IMAGE_URL;
const selectedFilter = ref<string | null>(null);

// 批量生成滤镜计算属性
function createFilterComputed(
  filterKey: keyof ImageState['props']['filters'],
  defaultValue: number
) {
  return computed({
    get: () => (displayNode.value as ImageState)?.props?.filters?.[filterKey] ?? defaultValue,
    set: (val: number) => {
      batchUpdate((id, node) => {
        if (node.type === NodeType.IMAGE) {
          const imgNode = node as ImageState;
          return {
            props: {
              ...imgNode.props,
              filters: { ...imgNode.props.filters, [filterKey]: val },
            },
          } as any;
        }
        return null;
      });
    },
  });
}

const grayscale = createFilterComputed('grayscale', 0);
const blur = createFilterComputed('blur', 0);
const brightness = createFilterComputed('brightness', 100);
const contrast = createFilterComputed('contrast', 100);
const saturate = createFilterComputed('saturate', 100);
const hueRotate = createFilterComputed('hueRotate', 0);
const filterOpacity = createFilterComputed('filterOpacity', 100);
const invert = createFilterComputed('invert', 0);
const sepia = createFilterComputed('sepia', 0);

// Filter Presets (Batch Applied)
const applyFilterPreset = (preset: Partial<ImageState['props']['filters']>) => {
  batchUpdate((id, node) => {
    if (node.type === NodeType.IMAGE) {
      // 合并默认滤镜和预设滤镜
      return {
        props: {
          ...(node as ImageState).props,
          filters: { ...DEFAULT_IMAGE_FILTERS, ...preset },
        },
      } as any;
    }
    return null;
  });
};

const selectFilter = (filterType: string) => {
  selectedFilter.value = filterType;
  switch (filterType) {
    case 'grayscale':
      applyFilterPreset({ grayscale: 100, contrast: 110, brightness: 95 });
      break;
    case 'blur':
      applyFilterPreset({ blur: 8, brightness: 98, filterOpacity: 95 });
      break;
    case 'vintage':
      applyFilterPreset({ sepia: 60, contrast: 115, brightness: 95, saturate: 85, hueRotate: -10 });
      break;
    case 'reset':
      applyFilterPreset({}); // Reset to defaults
      break;
  }
};

// --- Canvas Settings ---
const isCanvas = computed(() => ui.activePanel === 'canvas');
const presets = DEFAULT_CANVAS_THEMES as {
  name: string;
  background: string;
  gridColor: string;
  gridSize: number;
}[];

function applyPreset(theme: {
  name: string;
  background: string;
  gridColor: string;
  gridSize: number;
}) {
  store.viewport.backgroundColor = theme.background;
  store.viewport.gridDotColor = theme.gridColor;
  store.viewport.gridSize = theme.gridSize;
}
</script>

<style scoped>
.property-panel {
  height: 100%;
  background-color: var(--color-bg-2);
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-3);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-weight: bold;
  color: var(--color-text-1);
}

.node-id {
  color: var(--color-text-3);
  font-size: 12px;
  font-weight: normal;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-3);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.prop-row {
  margin-bottom: 8px;
}

.prop-item {
  margin-bottom: 12px;
}

.label {
  display: block;
  font-size: 12px;
  font-weight: bold;
  color: var(--color-text-2);
  margin-bottom: 4px;
}

.flex-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-selector {
  margin: 10px 0;
}

.filter-options {
  display: flex;
  gap: 10px;
  max-width: 100%;
  overflow-x: auto;
  padding: 5px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.filter-preview {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  border: 2px solid #e5e5e5;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.filter-preview-inner {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
}

.filter-preview.active {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.filter-preview:hover {
  transform: scale(1.05);
}

.filter-name {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}

.filter-param-item {
  margin-bottom: 12px;
}

.filter-param-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-3);
  margin-bottom: 6px;
  display: block;
}
</style>

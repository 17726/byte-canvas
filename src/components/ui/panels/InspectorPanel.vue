<template>
  <div class="property-panel">
    <!-- Canvas Settings Mode -->
    <div v-if="isCanvas" class="panel-content">
      <div class="panel-header">
        <span class="node-type">画布设置</span>
      </div>
      <div class="panel-section">
        <div class="panel-section">
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
        <a-divider style="margin: 12px 0" />
        <div class="panel-section">
          <div class="section-title">性能工具</div>
          <a-button type="outline" size="small" long @click="openPerformancePanel"
            >性能测试</a-button
          >
          <div class="helper-text">点击后在左侧弹出性能测试工具</div>
        </div>
      </div>
    </div>

    <div v-else>
      <div v-if="isMultiSelection" class="panel-content">
        <div class="panel-header">
          <span class="node-type">多选元素</span>
          <span class="node-id">{{ multiSelectionCount }} 个对象</span>
        </div>

        <div class="panel-section">
          <div class="section-title">变换 (整体)</div>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number v-model="multiX" size="small" :precision="2">
                <template #prefix>X</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="multiY" size="small" :precision="2">
                <template #prefix>Y</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number
                v-model="multiW"
                size="small"
                :min="1"
                :precision="2"
                placeholder="混合"
              >
                <template #prefix>W</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number
                v-model="multiH"
                size="small"
                :min="1"
                :precision="2"
                placeholder="混合"
              >
                <template #prefix>H</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="24">
              <span class="section-title">统一旋转角度</span>
              <a-slider
                v-model="multiRotation"
                :min="-180"
                :max="180"
                :step="0.1"
                show-input
                size="small"
              />
            </a-col>
          </a-row>
        </div>
        <a-divider style="margin: 12px 0" />

        <div class="panel-section">
          <div class="label">外观</div>

          <div class="prop-item" v-if="multiHasShape">
            <span class="section-title">填充 (统一)</span>
            <div class="flex-row">
              <a-color-picker v-model="multiFill" size="small" />
            </div>
          </div>

          <div class="prop-item" v-if="multiHasShape">
            <span class="section-title">描边 (统一)</span>
            <div class="flex-row">
              <a-color-picker v-model="multiStrokeColor" size="small" />
              <a-input-number v-model="multiStrokeWidth" size="small" style="width: 80px" :min="0">
                <template #suffix>px</template>
              </a-input-number>
            </div>
          </div>

          <div class="prop-item">
            <div class="section-title">不透明度</div>
            <a-slider
              v-model="multiOpacity"
              :min="0"
              :max="1"
              :step="0.01"
              show-input
              size="small"
            />
          </div>
        </div>
        <a-divider style="margin: 12px 0" />

        <div class="panel-section">
          <div class="label">属性</div>
          <div class="common">
            <span class="section-title">z-Index</span>
            <a-input-number
              v-model="multiZIndex"
              size="small"
              :min="1"
              mode="button"
              style="margin-top: 8px"
            />
          </div>

          <template v-if="multiHasText">
            <a-divider style="margin: 12px 0" />
            <div class="label">文字样式</div>
            <div class="prop-item">
              <div class="section-title">字号</div>
              <a-input-number v-model="multiFontSize" size="small" :min="1" />
            </div>
            <div class="prop-item">
              <div class="section-title">字重</div>
              <a-select v-model="multiFontWeight" size="small">
                <a-option :value="400">Normal</a-option>
                <a-option :value="700">Bold</a-option>
              </a-select>
            </div>
            <div class="prop-item">
              <div class="section-title">颜色</div>
              <a-color-picker v-model="multiTextColor" show-text size="small" />
            </div>
          </template>
        </div>
      </div>

      <div v-else-if="!activeNode" class="empty-state">
        <a-empty description="未选中元素" />
      </div>
      <!-- Node Property Mode -->
      <div v-else class="panel-content">
        <div class="panel-header">
          <span class="node-type">{{ activeNode?.type?.toUpperCase() }}</span>
          <span class="node-id">#{{ activeNode?.id?.slice(-4) }}</span>
        </div>
        <!-- Section 1: 变换 (Transform) -->
        <div class="panel-section">
          <div class="section-title">变换</div>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number v-model="transformX" size="small" :precision="2">
                <template #prefix>X</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="transformY" size="small" :precision="2">
                <template #prefix>Y</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number v-model="transformW" size="small" :min="1" :precision="2">
                <template #prefix>W</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="transformH" size="small" :min="1" :precision="2">
                <template #prefix>H</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="24">
              <span class="section-title">旋转角度</span>
              <a-slider
                v-model="transformRotation"
                :min="-180"
                :max="180"
                :step="0.1"
                show-input
                size="small"
                @dblclick="resetRotationToZero"
              />
            </a-col>
          </a-row>
        </div>
        <a-divider style="margin: 12px 0" />
        <!-- Section 2: 外观 (Appearance) -->
        <div class="panel-section">
          <div class="label">外观</div>
          <!-- Fill -->
          <div class="prop-item" v-if="canEditShapeStyle && !isImage">
            <span class="section-title">填充</span>
            <div class="flex-row">
              <a-color-picker v-model="fillColorTemp" size="small" @change="applyFillColor" />
            </div>
          </div>
          <!-- Stroke -->
          <div class="prop-item" v-if="canEditShapeStyle">
            <span class="section-title">描边</span>
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
          <!-- Opacity -->
          <div class="prop-item">
            <div class="section-title">不透明度</div>
            <a-slider v-model="opacity" :min="0" :max="1" :step="0.01" show-input size="small" />
          </div>
          <template v-if="isRect">
            <div class="prop-item">
              <span class="section-title">圆角 (%)</span>
              <a-slider
                v-model="cornerRadius"
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
        <!-- Section 3: 特有属性 (Specific) -->
        <div class="panel-section" v-if="isText || isShape || isImage || isGroup">
          <div class="label">属性</div>
          <div class="common">
            <span class="section-title">z-Index</span>
            <a-input-number
              v-model="zIndex"
              size="small"
              :min="1"
              mode="button"
              style="margin-top: 8px"
            />
          </div>
          <br />
          <!-- Text Specific -->
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
              <a-color-picker :value="textColor" show-text size="small" />
            </div>
          </template>
          <!-- Image Specific -->
          <template v-if="isImage">
            <div class="prop-item">
              <span class="label">滤镜</span>
              <div class="filter-options">
                <!-- 黑白滤镜 -->
                <div class="filter-item" @click="selectFilter('grayscale')">
                  <div class="filter-preview" :class="{ active: selectedFilter === 'grayscale' }">
                    <!-- 新增内部层：仅承载背景图和滤镜 -->
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
                <!-- 模糊滤镜 -->
                <div class="filter-item" @click="selectFilter('blur')">
                  <div class="filter-preview" :class="{ active: selectedFilter === 'blur' }">
                    <!-- 新增内部层：仅承载背景图和滤镜 -->
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
                <!-- 复古滤镜 -->
                <div class="filter-item" @click="selectFilter('vintage')">
                  <div class="filter-preview" :class="{ active: selectedFilter === 'vintage' }">
                    <!-- 新增内部层：仅承载背景图和滤镜 -->
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
                <!-- 重置滤镜 -->
                <div class="filter-item" @click="selectFilter('reset')">
                  <div class="filter-preview" :class="{ active: selectedFilter === 'reset' }">
                    <!-- 新增内部层：仅承载背景图和滤镜 -->
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
            <!-- 滤镜参数调节 -->
            <div class="prop-item">
              <!-- 灰度 -->
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

              <!-- 模糊 -->
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

              <!-- 亮度 -->
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

              <!-- 对比度 -->
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

              <!-- 饱和度 -->
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

              <!-- 色相旋转 -->
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

              <!-- 滤镜透明度 -->
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

              <!-- 反转 -->
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

              <!-- 棕褐色 -->
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
import { useSelectionStore } from '@/store/selectionStore';
import { useUIStore } from '@/store/uiStore';
import { useStyleSync } from '@/composables/useStyleSync';
import {
  NodeType,
  type GroupState,
  type ImageState,
  type NodeState,
  type TextState,
} from '@/types/state';
import { DEFAULT_CANVAS_THEMES, DEFAULT_IMAGE_FILTERS, DEFAULT_IMAGE_URL } from '@/config/defaults';
import { GroupService } from '@/core/services/GroupService';

const store = useCanvasStore();
const selectionStore = useSelectionStore();
const ui = useUIStore();

// 使用 useStyleSync 进行属性绑定（基础变换和通用属性）
const {
  activeNode,
  isShape,
  isText,
  isImage,
  isGroup,
  isRect,
  x: transformX,
  y: transformY,
  width: transformW,
  height: transformH,
  rotation: transformRotation,
  opacity,
  cornerRadius,
} = useStyleSync();

// 说明：PropertyPanel 有两种模式：'canvas' (显示画布设置) 与 'node' (显示节点属性)
// 由 store.activePanel 决定，store.isPanelExpanded 控制面板折叠/展开

const isCanvas = computed(() => ui.activePanel === 'canvas');
const presets = DEFAULT_CANVAS_THEMES as {
  name: string;
  background: string;
  gridColor: string;
  gridSize: number;
}[];

/**
 * 应用预设主题到视口：包括背景色、网格颜色与间距
 */
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

const openPerformancePanel = () => {
  ui.setPanelExpanded(true);
  ui.setActivePanel('canvas');
  ui.setPerformancePanelVisible(true);
};

// --- Helpers ---
// isShape, isText, isImage, isGroup 已从 useStyleSync 导入

function collectGroupDescendants(group: GroupState): NodeState[] {
  const result: NodeState[] = [];
  const traverse = (childIds: string[]) => {
    childIds.forEach((childId) => {
      const child = store.nodes[childId];
      if (!child) return;
      result.push(child);
      if (child.type === NodeType.GROUP) {
        traverse((child as GroupState).children);
      }
    });
  };
  traverse(group.children);
  return result;
}

const groupDescendants = computed(() => {
  if (!isGroup.value || !activeNode.value) return [];
  return collectGroupDescendants(activeNode.value as GroupState);
});

const groupTextNodes = computed(() =>
  groupDescendants.value.filter((node): node is TextState => node.type === NodeType.TEXT)
);

const canEditShapeStyle = computed(() => isShape.value || isGroup.value);

const textTargets = computed<TextState[]>(() => {
  if (isText.value && activeNode.value?.type === NodeType.TEXT) {
    return [activeNode.value as TextState];
  }
  if (isGroup.value) {
    return groupTextNodes.value;
  }
  return [];
});

const primaryTextNode = computed(() => textTargets.value[0] ?? null);
const canEditText = computed(() => textTargets.value.length > 0);

function applyTextProps(propsPatch: Partial<TextState['props']>) {
  textTargets.value.forEach((node) => {
    store.updateNode(node.id, { props: propsPatch } as Partial<TextState>);
  });
}

// --- Transform Bindings ---
// transformX, transformY, transformW, transformH, transformRotation 已从 useStyleSync 导入

const resetRotationToZero = () => {
  if (!activeNode.value) return;
  transformRotation.value = 0;
};

// --- Appearance Bindings ---
const fillColorTemp = ref('#ffffff');
const strokeColorTemp = ref('#000000');
const strokeWidthTemp = ref(0);
const isSyncingShapeStyle = ref(false);
const ignoreFillChange = ref(false);
const ignoreStrokeColorChange = ref(false);

const extractColorValue = (input: unknown, fallback: string) => {
  if (typeof input === 'string') return input;
  if (typeof input === 'object' && input) {
    if ('hex' in input && typeof (input as { hex?: string }).hex === 'string') {
      return (input as { hex: string }).hex;
    }
    if ('value' in input && typeof (input as { value?: string }).value === 'string') {
      return (input as { value: string }).value;
    }
  }
  return fallback;
};

const extractNumericValue = (input: unknown, fallback: number) => {
  if (typeof input === 'number' && !Number.isNaN(input)) return input;
  if (typeof input === 'string' && input.trim() !== '' && !Number.isNaN(Number(input))) {
    return Number(input);
  }
  if (typeof input === 'object' && input) {
    if ('value' in input) {
      const candidate = (input as { value?: number | string }).value;
      if (typeof candidate === 'number' && !Number.isNaN(candidate)) return candidate;
      if (
        typeof candidate === 'string' &&
        candidate.trim() !== '' &&
        !Number.isNaN(Number(candidate))
      ) {
        return Number(candidate);
      }
    }
  }
  return fallback;
};

// 记录最后选中的子节点ID（用于退出编辑模式时读取正确的样式）
const lastSelectedChildId = ref<string | null>(null);

// Reset lastSelectedChildId when active node changes to a different group, to null, or to a non-shape/non-group node
watch(
  () => activeNode.value?.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      const node = activeNode.value;
      // Reset if switching groups or to non-shape/non-group nodes
      if (
        !node ||
        (node.type !== NodeType.RECT &&
          node.type !== NodeType.CIRCLE &&
          node.type !== NodeType.GROUP)
      ) {
        lastSelectedChildId.value = null;
      }
    }
  }
);
const syncShapeStyleTemps = () => {
  if (!activeNode.value || !canEditShapeStyle.value) return;
  // 对于组合节点，不读取组合节点本身的 style，而是读取最后选中的形状子节点的 style
  // 如果没有最后选中的子节点，则读取第一个形状子节点的 style
  // 这样可以避免在退出编辑模式时触发样式同步
  if (isGroup.value) {
    const groupNode = activeNode.value as GroupState;
    // 优先使用最后选中的子节点
    let targetChild: NodeState | null = null;
    if (lastSelectedChildId.value) {
      const child = store.nodes[lastSelectedChildId.value];
      if (
        child &&
        (child.type === NodeType.RECT || child.type === NodeType.CIRCLE) &&
        groupNode.children.includes(child.id)
      ) {
        targetChild = child;
      }
    }
    // 如果没有最后选中的子节点，或者最后选中的子节点不是形状节点，则使用第一个形状子节点
    if (!targetChild) {
      targetChild =
        groupNode.children
          .map((id) => store.nodes[id])
          .find(
            (child) => child && (child.type === NodeType.RECT || child.type === NodeType.CIRCLE)
          ) || null;
    }

    if (targetChild) {
      isSyncingShapeStyle.value = true;
      ignoreFillChange.value = true;
      ignoreStrokeColorChange.value = true;
      fillColorTemp.value = targetChild.style.backgroundColor || '#ffffff';
      strokeColorTemp.value = targetChild.style.borderColor || '#000000';
      strokeWidthTemp.value = targetChild.style.borderWidth || 0;
      nextTick(() => {
        ignoreFillChange.value = false;
        ignoreStrokeColorChange.value = false;
        isSyncingShapeStyle.value = false;
      });
    } else {
      // 如果没有形状子节点，使用默认值
      ignoreFillChange.value = true;
      ignoreStrokeColorChange.value = true;
      fillColorTemp.value = '#ffffff';
      strokeColorTemp.value = '#000000';
      strokeWidthTemp.value = 0;
      nextTick(() => {
        ignoreFillChange.value = false;
        ignoreStrokeColorChange.value = false;
      });
    }
    return;
  }
  // 对于非组合节点，记录当前节点ID（可能是子节点）
  if (activeNode.value.type === NodeType.RECT || activeNode.value.type === NodeType.CIRCLE) {
    lastSelectedChildId.value = activeNode.value.id;
  }
  isSyncingShapeStyle.value = true;
  ignoreFillChange.value = true;
  ignoreStrokeColorChange.value = true;
  fillColorTemp.value = activeNode.value.style.backgroundColor || '#ffffff';
  strokeColorTemp.value = activeNode.value.style.borderColor || '#000000';
  strokeWidthTemp.value = activeNode.value.style.borderWidth || 0;
  nextTick(() => {
    ignoreFillChange.value = false;
    ignoreStrokeColorChange.value = false;
    isSyncingShapeStyle.value = false;
  });
};

watch(
  () => ({
    id: activeNode.value?.id,
    bg: activeNode.value?.style.backgroundColor,
    borderColor: activeNode.value?.style.borderColor,
    borderWidth: activeNode.value?.style.borderWidth,
    canEdit: canEditShapeStyle.value,
  }),
  () => {
    syncShapeStyleTemps();
  },
  { immediate: true }
);

const applyFillColor = (newColor?: unknown) => {
  if (!activeNode.value || !canEditShapeStyle.value) return;
  if (newColor !== undefined && ignoreFillChange.value) {
    ignoreFillChange.value = false;
    return;
  }
  if (isSyncingShapeStyle.value && newColor !== undefined) return;
  const color = extractColorValue(newColor, fillColorTemp.value);
  fillColorTemp.value = color;
  if (activeNode.value.style.backgroundColor === color) return;

  // 判断是否为 Group 节点
  if (activeNode.value.type === NodeType.GROUP) {
    GroupService.updateGroupStyle(store, activeNode.value.id, { backgroundColor: color });
  } else {
    store.updateNode(activeNode.value.id, {
      style: { ...activeNode.value.style, backgroundColor: color },
    });
  }
};

const applyStrokeStyle = (options?: { color?: unknown; width?: number }) => {
  if (!activeNode.value || !canEditShapeStyle.value) return;
  if (options?.color !== undefined) {
    if (ignoreStrokeColorChange.value) {
      ignoreStrokeColorChange.value = false;
      return;
    }
    if (isSyncingShapeStyle.value) return;
    strokeColorTemp.value = extractColorValue(options.color, strokeColorTemp.value);
  } else if (isSyncingShapeStyle.value) {
    return;
  }
  if (typeof options?.width === 'number') {
    strokeWidthTemp.value = options.width;
  }

  const nextColor = strokeColorTemp.value;
  const nextWidth = strokeWidthTemp.value;

  const colorChanged = activeNode.value.style.borderColor !== nextColor;
  const widthChanged = activeNode.value.style.borderWidth !== nextWidth;

  if (!colorChanged && !widthChanged) return;

  // 判断是否为 Group 节点
  if (activeNode.value.type === NodeType.GROUP) {
    GroupService.updateGroupStyle(store, activeNode.value.id, {
      borderColor: nextColor,
      borderWidth: nextWidth,
    });
  } else {
    store.updateNode(activeNode.value.id, {
      style: {
        ...activeNode.value.style,
        borderColor: nextColor,
        borderWidth: nextWidth,
      },
    });
  }
};

const handleStrokeColorChange = (value: unknown) => {
  applyStrokeStyle({ color: value });
};

const handleStrokeWidthChange = (value: unknown) => {
  if (isSyncingShapeStyle.value) return;
  const width = extractNumericValue(value, strokeWidthTemp.value);
  applyStrokeStyle({ width });
};
// opacity 已从 useStyleSync 导入

const zIndex = computed({
  get: () => activeNode.value?.style.zIndex ?? 1,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      style: { ...activeNode.value.style, zIndex: val as number },
    }),
});

// --- Specific Bindings ---
// Text
const textContent = computed({
  get: () => primaryTextNode.value?.props.content || '',
  set: (val) => {
    if (!canEditText.value) return;
    applyTextProps({ content: val as string });
  },
});
const fontSize = computed({
  get: () => primaryTextNode.value?.props.fontSize || 12,
  set: (val) => {
    if (!canEditText.value) return;
    applyTextProps({ fontSize: val as number });
  },
});
const fontWeight = computed({
  get: () => primaryTextNode.value?.props.fontWeight || 400,
  set: (val) => {
    if (!canEditText.value) return;
    applyTextProps({ fontWeight: val as number });
  },
});
const textColor = computed({
  get: () => primaryTextNode.value?.props.color || '#000000',
  set: (val) => {
    if (!canEditText.value) return;
    applyTextProps({ color: val as string });
  },
});

// Shape
// cornerRadius 已从 useStyleSync 导入

//Image
// 选中的滤镜
const selectedFilter = ref<string | null>(null);
// 预览图片（可以使用当前选中图片的缩略图）
const previewImage = computed(() => {
  // 这里可以返回当前选中图片的URL
  return (activeNode.value as ImageState)?.props?.imageUrl || DEFAULT_IMAGE_URL;
});
// 默认预览图片（当没有选中图片时使用）
const defaultImage = DEFAULT_IMAGE_URL;
// 滤镜参数计算属性
// 灰度
const grayscale = computed({
  get: () => (activeNode.value as ImageState)?.props?.filters?.grayscale ?? 0,
  set: (val) => {
    if (!activeNode.value || activeNode.value.type !== NodeType.IMAGE) return;
    store.updateNode(activeNode.value.id, {
      props: {
        ...activeNode.value.props,
        filters: {
          ...activeNode.value.props.filters,
          grayscale: val as number,
        },
      },
    } as Partial<ImageState>);
  },
});
// 模糊
const blur = computed({
  get: () => (activeNode.value as ImageState)?.props?.filters?.blur ?? 0,
  set: (val) => {
    if (!activeNode.value || activeNode.value.type !== NodeType.IMAGE) return;
    store.updateNode(activeNode.value.id, {
      props: {
        ...activeNode.value.props,
        filters: {
          ...activeNode.value.props.filters,
          blur: val as number,
        },
      },
    } as Partial<ImageState>);
  },
});
// 亮度
const brightness = computed({
  get: () => (activeNode.value as ImageState)?.props?.filters?.brightness ?? 100,
  set: (val) => {
    if (!activeNode.value || activeNode.value.type !== NodeType.IMAGE) return;
    store.updateNode(activeNode.value.id, {
      props: {
        ...activeNode.value.props,
        filters: {
          ...activeNode.value.props.filters,
          brightness: val as number,
        },
      },
    } as Partial<ImageState>);
  },
});
// 对比度
const contrast = computed({
  get: () => (activeNode.value as ImageState)?.props?.filters?.contrast ?? 100,
  set: (val) => {
    if (!activeNode.value || activeNode.value.type !== NodeType.IMAGE) return;
    store.updateNode(activeNode.value.id, {
      props: {
        ...activeNode.value.props,
        filters: {
          ...activeNode.value.props.filters,
          contrast: val as number,
        },
      },
    } as Partial<ImageState>);
  },
});
// 饱和度
const saturate = computed({
  get: () => (activeNode.value as ImageState)?.props?.filters?.saturate ?? 100,
  set: (val) => {
    if (!activeNode.value || activeNode.value.type !== NodeType.IMAGE) return;
    store.updateNode(activeNode.value.id, {
      props: {
        ...activeNode.value.props,
        filters: {
          ...activeNode.value.props.filters,
          saturate: val as number,
        },
      },
    } as Partial<ImageState>);
  },
});
// 色相旋转
const hueRotate = computed({
  get: () => (activeNode.value as ImageState)?.props?.filters?.hueRotate ?? 0,
  set: (val) => {
    if (!activeNode.value || activeNode.value.type !== NodeType.IMAGE) return;
    store.updateNode(activeNode.value.id, {
      props: {
        ...activeNode.value.props,
        filters: {
          ...activeNode.value.props.filters,
          hueRotate: val as number,
        },
      },
    } as Partial<ImageState>);
  },
});
// 滤镜透明度
// Helper to create filter computed properties
function createFilterComputed(
  filterKey: keyof ImageState['props']['filters'],
  defaultValue: number
) {
  return computed({
    get: () => (activeNode.value as ImageState)?.props?.filters?.[filterKey] ?? defaultValue,
    set: (val) => {
      if (!activeNode.value || activeNode.value.type !== NodeType.IMAGE) return;
      store.updateNode(activeNode.value.id, {
        props: {
          ...activeNode.value.props,
          filters: {
            ...activeNode.value.props.filters,
            [filterKey]: val as number,
          },
        },
      } as Partial<ImageState>);
    },
  });
}

const filterOpacity = createFilterComputed('filterOpacity', 100);
// 反相
const invert = createFilterComputed('invert', 0);
// 棕褐色调
const sepia = createFilterComputed('sepia', 0);
// 选择滤镜
const selectFilter = (filterType: string) => {
  selectedFilter.value = filterType;

  switch (filterType) {
    case 'grayscale':
      grayscaleFilter();
      break;
    case 'blur':
      blurFilter();
      break;
    case 'vintage':
      vintageFilter();
      break;
    case 'reset':
      resetFilter();
      break;
  }
};

const grayscaleFilter = () => {
  selectionStore.activeElements.forEach((element) => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: {
            grayscale: 100,
            contrast: 110,
            brightness: 95,
          },
        },
      });
    }
  });
};

const blurFilter = () => {
  selectionStore.activeElements.forEach((element) => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: {
            blur: 8,
            brightness: 98,
            filterOpacity: 95,
          },
        },
      });
    }
  });
};

const vintageFilter = () => {
  selectionStore.activeElements.forEach((element) => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: {
            sepia: 60, // 棕褐色调
            contrast: 115, // 增强对比度
            brightness: 95, // 降低亮度
            saturate: 85, // 降低饱和度
            hueRotate: -10, // 轻微色相偏移
          },
        },
      });
    }
  });
};

const resetFilter = () => {
  selectionStore.activeElements.forEach((element) => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: DEFAULT_IMAGE_FILTERS,
        },
      });
    }
  });
};

// --- 新增：多选相关逻辑 ---
const isMultiSelection = computed(() => selectionStore.activeElements.length > 1);
const multiSelectionCount = computed(() => selectionStore.activeElements.length);

/**
 * 封装批量更新逻辑（上锁/解锁），用于支持撤销/重做
 * @param action 执行更新的回调函数
 */
const executeBatchUpdate = (action: () => void) => {
  // 假设 store 提供了 startBatch 和 endBatch (或类似 snapshot/lock 机制)
  // 如果没有暴露这些方法，请确保在 store 中实现或替换为实际的 lock/unlock 方法
  if (store.startBatch) {
    store.startBatch();
  }
  try {
    action();
  } finally {
    if (store.endBatch) {
      store.endBatch();
    }
  }
};

/**
 * 获取多选元素的包围盒（Bounding Box）
 */
const getMultiSelectionBounds = () => {
  const elements = selectionStore.activeElements;
  if (elements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((el) => {
    minX = Math.min(minX, el.transform.x);
    minY = Math.min(minY, el.transform.y);
    maxX = Math.max(maxX, el.transform.x + el.transform.width);
    maxY = Math.max(maxY, el.transform.y + el.transform.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

// 1. 变换 (Transform)
// X/Y: 获取左上角最小值；设置时移动所有元素（保持相对位置）
const multiX = computed({
  get: () => {
    return getMultiSelectionBounds().x;
  },
  set: (val: number) => {
    executeBatchUpdate(() => {
      const currentMinX = getMultiSelectionBounds().x;
      const delta = val - currentMinX;
      selectionStore.activeElements.forEach((el) => {
        store.updateNode(el.id, { transform: { ...el.transform, x: el.transform.x + delta } });
      });
    });
  },
});

const multiY = computed({
  get: () => {
    return getMultiSelectionBounds().y;
  },
  set: (val: number) => {
    executeBatchUpdate(() => {
      const currentMinY = getMultiSelectionBounds().y;
      const delta = val - currentMinY;
      selectionStore.activeElements.forEach((el) => {
        store.updateNode(el.id, { transform: { ...el.transform, y: el.transform.y + delta } });
      });
    });
  },
});

// W/H: 显示为框选包围框的宽高；设置时按照比例缩放所有子元素
const multiW = computed({
  get: () => {
    return getMultiSelectionBounds().width;
  },
  set: (val: number | undefined) => {
    if (val === undefined || val <= 0) return;
    executeBatchUpdate(() => {
      const bounds = getMultiSelectionBounds();
      const scale = val / bounds.width;

      selectionStore.activeElements.forEach((el) => {
        // 计算元素相对于包围盒左边缘的偏移，并应用缩放
        const relativeX = el.transform.x - bounds.x;
        const newX = bounds.x + relativeX * scale;
        const newWidth = el.transform.width * scale;

        store.updateNode(el.id, {
          transform: {
            ...el.transform,
            x: newX,
            width: newWidth,
          },
        });
      });
    });
  },
});

const multiH = computed({
  get: () => {
    return getMultiSelectionBounds().height;
  },
  set: (val: number | undefined) => {
    if (val === undefined || val <= 0) return;
    executeBatchUpdate(() => {
      const bounds = getMultiSelectionBounds();
      const scale = val / bounds.height;

      selectionStore.activeElements.forEach((el) => {
        // 计算元素相对于包围盒上边缘的偏移，并应用缩放
        const relativeY = el.transform.y - bounds.y;
        const newY = bounds.y + relativeY * scale;
        const newHeight = el.transform.height * scale;

        store.updateNode(el.id, {
          transform: {
            ...el.transform,
            y: newY,
            height: newHeight,
          },
        });
      });
    });
  },
});

const multiRotation = computed({
  get: () => {
    const elements = selectionStore.activeElements;
    if (elements.length === 0) return 0;
    if (!elements[0]) return 0;
    const firstR = elements[0].transform.rotation;
    return elements.every((el) => el.transform.rotation === firstR) ? firstR : 0;
  },
  set: (val: number) => {
    executeBatchUpdate(() => {
      selectionStore.activeElements.forEach((el) => {
        store.updateNode(el.id, { transform: { ...el.transform, rotation: val } });
      });
    });
  },
});

// 2. 外观 (Appearance)
const multiHasShape = computed(() => {
  return selectionStore.activeElements.some(
    (el) => el.type === NodeType.RECT || el.type === NodeType.CIRCLE || el.type === NodeType.GROUP
  );
});

const multiFill = computed({
  get: () => {
    const elements = selectionStore.activeElements.filter(
      (el) => el.type === NodeType.RECT || el.type === NodeType.CIRCLE || el.type === NodeType.GROUP
    );
    if (elements.length === 0) return '';
    if (!elements[0]) return;
    const firstColor = elements[0].style.backgroundColor;
    // 如果颜色都一样返回颜色，否则返回 undefined (ColorPicker 会显示混合或默认)
    return elements.every((el) => el.style.backgroundColor === firstColor) ? firstColor : undefined;
  },
  set: (val: any) => {
    executeBatchUpdate(() => {
      const color = extractColorValue(val, '');
      selectionStore.activeElements.forEach((el) => {
        if (el.type === NodeType.RECT || el.type === NodeType.CIRCLE) {
          store.updateNode(el.id, { style: { ...el.style, backgroundColor: color } });
        } else if (el.type === NodeType.GROUP) {
          GroupService.updateGroupStyle(store, el.id, { backgroundColor: color });
        }
      });
    });
  },
});

const multiStrokeColor = computed({
  get: () => {
    const elements = selectionStore.activeElements.filter(
      (el) => el.type === NodeType.RECT || el.type === NodeType.CIRCLE || el.type === NodeType.GROUP
    );
    if (elements.length === 0) return '';
    if (!elements[0]) return;
    const firstColor = elements[0].style.borderColor;
    return elements.every((el) => el.style.borderColor === firstColor) ? firstColor : undefined;
  },
  set: (val: any) => {
    executeBatchUpdate(() => {
      const color = extractColorValue(val, '');
      selectionStore.activeElements.forEach((el) => {
        if (el.type === NodeType.RECT || el.type === NodeType.CIRCLE) {
          store.updateNode(el.id, { style: { ...el.style, borderColor: color } });
        } else if (el.type === NodeType.GROUP) {
          GroupService.updateGroupStyle(store, el.id, { borderColor: color });
        }
      });
    });
  },
});

const multiStrokeWidth = computed({
  get: () => {
    const elements = selectionStore.activeElements.filter(
      (el) => el.type === NodeType.RECT || el.type === NodeType.CIRCLE || el.type === NodeType.GROUP
    );
    if (elements.length === 0) return 0;
    if (!elements[0]) return;
    const firstW = elements[0].style.borderWidth;
    return elements.every((el) => el.style.borderWidth === firstW) ? firstW : undefined;
  },
  set: (val: number | undefined) => {
    if (val === undefined) return;
    executeBatchUpdate(() => {
      selectionStore.activeElements.forEach((el) => {
        if (el.type === NodeType.RECT || el.type === NodeType.CIRCLE) {
          store.updateNode(el.id, { style: { ...el.style, borderWidth: val } });
        } else if (el.type === NodeType.GROUP) {
          GroupService.updateGroupStyle(store, el.id, { borderWidth: val });
        }
      });
    });
  },
});

const multiOpacity = computed({
  get: () => {
    const elements = selectionStore.activeElements;
    if (elements.length === 0) return 1;
    if (!elements[0]) return;
    const firstOp = elements[0].style.opacity ?? 1;
    return elements.every((el) => (el.style.opacity ?? 1) === firstOp) ? firstOp : 1;
  },
  set: (val: number) => {
    executeBatchUpdate(() => {
      selectionStore.activeElements.forEach((el) => {
        store.updateNode(el.id, { style: { ...el.style, opacity: val } });
      });
    });
  },
});

const multiZIndex = computed({
  get: () => {
    const elements = selectionStore.activeElements;
    if (elements.length === 0) return 1;
    if (!elements[0]) return;
    const firstZ = elements[0].style.zIndex ?? 1;
    return elements.every((el) => (el.style.zIndex ?? 1) === firstZ) ? firstZ : undefined;
  },
  set: (val: number | undefined) => {
    if (val === undefined) return;
    executeBatchUpdate(() => {
      selectionStore.activeElements.forEach((el) => {
        store.updateNode(el.id, { style: { ...el.style, zIndex: val } });
      });
    });
  },
});

// 3. 文字 (Text)
const multiHasText = computed(() => {
  return selectionStore.activeElements.some((el) => el.type === NodeType.TEXT);
});

const multiTextNodes = computed(() => {
  return selectionStore.activeElements.filter((el): el is TextState => el.type === NodeType.TEXT);
});

const multiFontSize = computed({
  get: () => {
    const texts = multiTextNodes.value;
    if (texts.length === 0) return 12;
    if (!texts[0]) return;
    const firstS = texts[0].props.fontSize;
    return texts.every((t) => t.props.fontSize === firstS) ? firstS : undefined;
  },
  set: (val: number | undefined) => {
    if (val === undefined) return;
    executeBatchUpdate(() => {
      multiTextNodes.value.forEach((t) => {
        store.updateNode(t.id, { props: { ...t.props, fontSize: val } } as Partial<TextState>);
      });
    });
  },
});

const multiFontWeight = computed({
  get: () => {
    const texts = multiTextNodes.value;
    if (texts.length === 0) return 400;
    if (!texts[0]) return;
    const firstW = texts[0].props.fontWeight;
    return texts.every((t) => t.props.fontWeight === firstW) ? firstW : undefined;
  },
  set: (val: number | undefined) => {
    if (val === undefined) return;
    executeBatchUpdate(() => {
      multiTextNodes.value.forEach((t) => {
        store.updateNode(t.id, { props: { ...t.props, fontWeight: val } } as Partial<TextState>);
      });
    });
  },
});

const multiTextColor = computed({
  get: () => {
    const texts = multiTextNodes.value;
    if (texts.length === 0) return '#000000';
    if (!texts[0]) return;
    const firstC = texts[0].props.color;
    return texts.every((t) => t.props.color === firstC) ? firstC : undefined;
  },
  set: (val: any) => {
    executeBatchUpdate(() => {
      const color = extractColorValue(val, '');
      multiTextNodes.value.forEach((t) => {
        store.updateNode(t.id, { props: { ...t.props, color: color } } as Partial<TextState>);
      });
    });
  },
});
</script>

<style scoped>
/* 原有样式保持不变 */
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

.helper-text {
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 6px;
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
  margin-bottom: 8px;
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
  max-width: 100%; /* 或者固定宽度 */
  overflow-x: auto; /* 水平方向滚动 */
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
  border: 2px solid #e5e5e5; /* 边框保留在父层，无滤镜 */
  transition: all 0.2s ease;
  position: relative; /* 作为内部层的定位容器 */
  overflow: hidden; /* 裁剪内部层的圆角，和父层保持一致 */
}

/* 新增：承载背景图和滤镜的内部层 */
.filter-preview-inner {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  /* 滤镜仅作用于这个内部层，边框层不受影响 */
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

/* 滤镜参数调节样式 */
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

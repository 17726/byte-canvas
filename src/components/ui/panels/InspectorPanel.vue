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
      </div>
    </div>
    <!-- Node Properties Mode -->
    <div v-else>
      <div v-if="!displayNode" class="empty-state">
        <a-empty description="未选中元素" />
      </div>
      <div v-else class="panel-content">
        <div class="panel-header">
          <template v-if="isMultiSelect">
            <span class="node-type">多选</span>
            <span class="node-id">{{ store.activeElements.length }} 个元素</span>
          </template>
          <template v-else>
            <span class="node-type">{{ displayNode?.type?.toUpperCase() }}</span>
            <span class="node-id">#{{ displayNode?.id?.slice(-4) }}</span>
          </template>
        </div>
        <!-- Section 1: 变换 (Transform) -->
        <div class="panel-section">
          <div class="section-title">变换</div>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number v-model="displayX" size="small" :precision="2">
                <template #prefix>X</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="displayY" size="small" :precision="2">
                <template #prefix>Y</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number v-model="displayW" size="small" :min="1" :precision="2">
                <template #prefix>W</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="displayH" size="small" :min="1" :precision="2">
                <template #prefix>H</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="24">
              <span class="section-title">旋转角度</span>
              <a-slider
                v-model="transformRotationPanel"
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
            <a-slider
              v-model="panelOpacity"
              :min="0"
              :max="1"
              :step="0.01"
              show-input
              size="small"
            />
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
              v-model="displayZIndex"
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
              <!-- 黑白滤镜 -->
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

const store = useCanvasStore();
const ui = useUIStore();

// 使用 useStyleSync 进行属性绑定（基础变换和通用属性）
// 拦截原生的 activeNode 和 isGroup，以便在多选时进行重写
const {
  activeNode: syncActiveNode,
  isShape,
  isText,
  isImage,
  isGroup: syncIsGroup,
  isRect,
  x: transformX,
  y: transformY,
  width: transformW,
  height: transformH,
  rotation: transformRotation,
  opacity,
  cornerRadius,
} = useStyleSync();

// --- 多选逻辑扩展 (Multi-Selection Logic) ---

// 判断是否为多选模式：当前无单一聚焦节点，但 store 中有多个选中元素
const isMultiSelect = computed(() => {
  return !syncActiveNode.value && store.activeElements.length > 1;
});

// 计算多选时的包围盒（虚拟节点的尺寸）
// Helper: get the four corners of a rectangle after rotation
function getRotatedCorners(transform: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}) {
  const { x, y, width, height, rotation } = transform;
  const rad = ((rotation || 0) * Math.PI) / 180;
  const cx = x + width / 2;
  const cy = y + height / 2;
  // Rectangle corners relative to center
  const corners = [
    { dx: -width / 2, dy: -height / 2 },
    { dx: width / 2, dy: -height / 2 },
    { dx: width / 2, dy: height / 2 },
    { dx: -width / 2, dy: height / 2 },
  ];
  // Rotate and translate corners
  return corners.map(({ dx, dy }) => {
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    return { x: cx + rx, y: cy + ry };
  });
}

const selectionBounds = computed(() => {
  if (!isMultiSelect.value) return null;
  const elements = store.activeElements.filter(Boolean);
  if (elements.length === 0) return null;

  // Collect all corners of all elements
  const allCorners: { x: number; y: number }[] = [];
  for (const e of elements) {
    if (!e) continue;
    const t = e.transform;
    const corners = getRotatedCorners({
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      rotation: t.rotation || 0,
    });
    allCorners.push(...corners);
  }
  if (allCorners.length === 0) return null;
  const minX = Math.min(...allCorners.map((c) => c.x));
  const minY = Math.min(...allCorners.map((c) => c.y));
  const maxX = Math.max(...allCorners.map((c) => c.x));
  const maxY = Math.max(...allCorners.map((c) => c.y));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
});

// 构建用于显示的 Node 代理
// 如果是单选，返回 syncActiveNode；如果是多选，返回一个虚拟的 GROUP 节点
const displayNode = computed(() => {
  if (syncActiveNode.value) return syncActiveNode.value;
  if (isMultiSelect.value && selectionBounds.value) {
    // 创建一个假的 Group 节点结构，骗过 UI 渲染
    return {
      id: 'selection-group-temp',
      type: NodeType.GROUP,
      x: selectionBounds.value.x,
      y: selectionBounds.value.y,
      width: selectionBounds.value.width,
      height: selectionBounds.value.height,
      rotation: 0,
      children: store.activeElements.filter((e): e is NodeState => !!e).map((e) => e.id),
      style: {
        zIndex: Math.max(...store.activeElements.map((e) => e!.style.zIndex || 1)),
        opacity: 1, // 默认不透明度
      },
      props: {},
    } as unknown as NodeState;
  }
  return null;
});

// 重写 activeNode 供内部逻辑使用
const activeNode = displayNode;

// 编辑组模式检测（双击组进入编辑模式时为 true）
const isEditingGroup = computed(() => !!store.editingGroupId);

// 分别定义三种“组”状态
const isRealGroup = computed(() => syncIsGroup.value); // 真实组节点
const isVirtualGroup = computed(() => isMultiSelect.value); // 多选虚拟组
const isInGroupEditMode = computed(() => isEditingGroup.value); // 编辑组模式
// 统一“组”判定，兼容真实组合、虚拟多选组合与编辑模式
const isGroup = computed(
  () => isRealGroup.value || isVirtualGroup.value || isInGroupEditMode.value
);

// --- 显示用的变换属性 ---
// 如果是单选，双向绑定到 useStyleSync 的 ref
// 如果是多选，只读显示计算出的包围盒数据 (避免直接修改导致逻辑复杂，或者需要 store 支持批量更新)
const displayX = computed({
  get: () => (isMultiSelect.value ? (selectionBounds.value?.x ?? 0) : transformX.value),
  set: (val) => {
    if (!isMultiSelect.value) {
      transformX.value = val;
      return;
    }

    // 多选时：将所有选中元素整体平移到新的 X（按 delta 平移）
    const bounds = selectionBounds.value;
    if (!bounds) return;
    const dx = val - bounds.x;
    if (dx === 0) return;

    store.activeElements.forEach((n) => {
      if (!n) return;
      store.updateNode(n.id, { transform: { ...n.transform, x: n.transform.x + dx } });
    });
  },
});

const displayY = computed({
  get: () => (isMultiSelect.value ? (selectionBounds.value?.y ?? 0) : transformY.value),
  set: (val) => {
    if (!isMultiSelect.value) {
      transformY.value = val;
      return;
    }

    const bounds = selectionBounds.value;
    if (!bounds) return;
    const dy = val - bounds.y;
    if (dy === 0) return;

    store.activeElements.forEach((n) => {
      if (!n) return;
      store.updateNode(n.id, { transform: { ...n.transform, y: n.transform.y + dy } });
    });
  },
});

const displayW = computed({
  get: () => (isMultiSelect.value ? (selectionBounds.value?.width ?? 0) : transformW.value),
  set: (val) => {
    if (!isMultiSelect.value) {
      transformW.value = val;
      return;
    }

    const bounds = selectionBounds.value;
    if (!bounds || bounds.width === 0) return;
    const scaleX = val / bounds.width;
    if (!isFinite(scaleX) || scaleX <= 0) return;

    store.activeElements.forEach((n) => {
      if (!n) return;
      const node = n;
      const offsetX = node.transform.x - bounds.x;
      const newX = bounds.x + offsetX * scaleX;
      const newWidth = Math.max(1, node.transform.width * scaleX);
      store.updateNode(node.id, {
        transform: { ...node.transform, x: newX, width: newWidth },
      });
    });
  },
});

const displayH = computed({
  get: () => (isMultiSelect.value ? (selectionBounds.value?.height ?? 0) : transformH.value),
  set: (val) => {
    if (!isMultiSelect.value) {
      transformH.value = val;
      return;
    }

    const bounds = selectionBounds.value;
    if (!bounds || bounds.height === 0) return;
    const scaleY = val / bounds.height;
    if (!isFinite(scaleY) || scaleY <= 0) return;

    store.activeElements.forEach((n) => {
      if (!n) return;
      const node = n;
      const offsetY = node.transform.y - bounds.y;
      const newY = bounds.y + offsetY * scaleY;
      const newHeight = Math.max(1, node.transform.height * scaleY);
      store.updateNode(node.id, {
        transform: { ...node.transform, y: newY, height: newHeight },
      });
    });
  },
});

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

// --- Helpers ---
// isShape, isText, isImage 来自 useStyleSync，isGroup 为统一的组态标识

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
  // 支持两种 group 情形：1) 正在编辑的真实组合（editingGroupId） 2) 通过 activeNode 表示的组合（或虚拟多选 group）
  if (!isGroup.value) return [];

  // 优先处理编辑模式下的真实组合
  if (isEditingGroup.value) {
    const gid = store.editingGroupId;
    if (!gid) return [];
    const groupNode = store.nodes[gid] as GroupState | undefined;
    if (!groupNode) return [];
    if (!groupNode.children) return [];
    return collectGroupDescendants(groupNode);
  }

  // 其他情况：使用 activeNode（可能是虚拟的临时 group）
  if (!activeNode.value) return [];
  const node = activeNode.value as GroupState;
  if (!node.children) {
    // 多选模式：递归收集所有选中元素的后代
    return store.activeElements
      .flatMap((e) => (e?.type === NodeType.GROUP ? collectGroupDescendants(e as GroupState) : [e]))
      .filter(Boolean);
  }
  return collectGroupDescendants(node);
});

const groupTextNodes = computed(() =>
  groupDescendants.value.filter((node): node is TextState => node!.type === NodeType.TEXT)
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
  // 重置当前面板所指向的旋转（支持组合子元素与单选）
  transformRotationPanel.value = 0;
};

// 面板专用的旋转绑定：支持组合模式下操作子元素的旋转，也支持单选与多选
const transformRotationPanel = computed<number>({
  get: () => {
    // 组合编辑模式：如果 lastSelectedChildId 存在，优先读取子元素的旋转
    if (isGroup.value && lastSelectedChildId.value) {
      const child = store.nodes[lastSelectedChildId.value];
      if (child) return child.transform.rotation ?? 0;
    }

    // 多选模式（非组合编辑）：返回 0 或者第一个选中元素的旋转作为回显
    if (isMultiSelect.value) {
      const first = store.activeElements.find((n) => !!n);
      return first ? (first!.transform.rotation ?? 0) : 0;
    }

    // 单选 / 默认：使用 useStyleSync 提供的绑定
    return transformRotation.value ?? 0;
  },
  set: (val: number) => {
    // 组合编辑模式：如果存在 lastSelectedChildId，则更新子元素的旋转
    if (isGroup.value && lastSelectedChildId.value) {
      const childId = lastSelectedChildId.value;
      const node = store.nodes[childId];
      if (node) {
        store.updateNode(childId, { transform: { ...node.transform, rotation: val } });
      }
      return;
    }

    // 多选时：对所有选中元素统一设置旋转（覆盖每个元素的 rotation）
    if (isMultiSelect.value) {
      store.activeElements.forEach((n) => {
        if (!n) return;
        store.updateNode(n.id, { transform: { ...n.transform, rotation: val } });
      });
      return;
    }

    // 单选：委托给 useStyleSync 的 binding
    transformRotation.value = val;
  },
});

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

  // 多选模式下：简单取第一个元素的样式作为显示
  if (isMultiSelect.value) {
    const firstShape = store.activeElements.find(
      (e) => e!.type === NodeType.RECT || e!.type === NodeType.CIRCLE
    );
    if (firstShape) {
      fillColorTemp.value = firstShape.style.backgroundColor || '#ffffff';
      strokeColorTemp.value = firstShape.style.borderColor || '#000000';
      strokeWidthTemp.value = firstShape.style.borderWidth || 0;
    } else {
      // 如果多选中没有形状，给默认值
      fillColorTemp.value = '#ffffff';
      strokeColorTemp.value = '#000000';
      strokeWidthTemp.value = 0;
    }
    return;
  }

  // 对于组合节点，不读取组合节点本身的 style，而是读取最后选中的形状子节点的 style
  // 如果没有最后选中的子节点，则读取第一个形状子节点的 style
  // 这样可以避免在退出编辑模式时触发样式同步
  if (isGroup.value) {
    // 如果是在组合编辑模式，优先使用 store.editingGroupId 对应的真实组节点
    const groupNode = isEditingGroup.value
      ? (store.nodes[store.editingGroupId as string] as GroupState)
      : (activeNode.value as GroupState);
    // 优先使用最后选中的子节点
    let targetChild: NodeState | null = null;
    if (lastSelectedChildId.value) {
      const child = store.nodes[lastSelectedChildId.value];
      if (
        child &&
        (child.type === NodeType.RECT || child.type === NodeType.CIRCLE) &&
        groupNode &&
        Array.isArray(groupNode.children) &&
        groupNode.children.includes(child.id)
      ) {
        targetChild = child;
      }
    }
    // 如果没有最后选中的子节点，或者最后选中的子节点不是形状节点，则使用第一个形状子节点
    if (!targetChild) {
      if (groupNode && Array.isArray(groupNode.children)) {
        targetChild =
          groupNode.children
            .map((id) => store.nodes[id])
            .find(
              (child) => child && (child.type === NodeType.RECT || child.type === NodeType.CIRCLE)
            ) || null;
      } else {
        targetChild = null;
      }
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
    isMultiSelect: isMultiSelect.value,
    isEditingGroup: isEditingGroup.value,
    lastSelectedChild: lastSelectedChildId.value,
    descendants: groupDescendants.value.length,
  }),
  () => {
    syncShapeStyleTemps();
  },
  { immediate: true }
);

// 如果是多选模式，应用颜色到所有选中的形状
const applyFillColor = (newColor?: unknown) => {
  // 修改逻辑：支持多选与组合编辑
  if (!canEditShapeStyle.value) return;
  if (!activeNode.value && !isMultiSelect.value && !isEditingGroup.value) return;

  if (newColor !== undefined && ignoreFillChange.value) {
    ignoreFillChange.value = false;
    return;
  }
  if (isSyncingShapeStyle.value && newColor !== undefined) return;
  const color = extractColorValue(newColor, fillColorTemp.value);
  fillColorTemp.value = color;

  // 组合编辑模式：优先修改最后选中的子元素，否则修改组中所有形状子元素
  if (isEditingGroup.value) {
    if (lastSelectedChildId.value) {
      const child = store.nodes[lastSelectedChildId.value];
      if (child && (child.type === NodeType.RECT || child.type === NodeType.CIRCLE)) {
        if (child.style.backgroundColor !== color) {
          store.updateNode(child.id, { style: { ...child.style, backgroundColor: color } });
        }
      }
      return;
    }

    // 无指定子节点，批量更新组内所有形状
    groupDescendants.value.forEach((node) => {
      if (!node) return;
      if (node.type === NodeType.RECT || node.type === NodeType.CIRCLE) {
        if (node.style.backgroundColor !== color) {
          store.updateNode(node.id, { style: { ...node.style, backgroundColor: color } });
        }
      }
    });
    return;
  }

  // 多选处理：更新所有选中的形状和组合
  if (isMultiSelect.value) {
    store.activeElements.forEach((node) => {
      if (!node) return;
      if (
        node.type === NodeType.RECT ||
        node.type === NodeType.CIRCLE ||
        node.type === NodeType.GROUP
      ) {
        if (node.style.backgroundColor !== color) {
          store.updateNode(node.id, { style: { ...node.style, backgroundColor: color } });
        }
      }
    });
    return;
  }

  // 单选处理
  if (!activeNode.value) return;
  if (activeNode.value.style.backgroundColor === color) return;
  store.updateNode(activeNode.value.id, {
    style: { ...activeNode.value.style, backgroundColor: color },
  });
};

const applyStrokeStyle = (options?: { color?: unknown; width?: number }) => {
  if (!canEditShapeStyle.value) return;
  if (!activeNode.value && !isMultiSelect.value && !isEditingGroup.value) return;

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

  // 组合编辑模式：优先修改最后选中的子元素，否则修改组中所有形状子元素
  if (isEditingGroup.value) {
    if (lastSelectedChildId.value) {
      const child = store.nodes[lastSelectedChildId.value];
      if (child && (child.type === NodeType.RECT || child.type === NodeType.CIRCLE)) {
        const colorChanged = child.style.borderColor !== nextColor;
        const widthChanged = child.style.borderWidth !== nextWidth;
        if (colorChanged || widthChanged) {
          store.updateNode(child.id, {
            style: { ...child.style, borderColor: nextColor, borderWidth: nextWidth },
          });
        }
      }
      return;
    }

    groupDescendants.value.forEach((node) => {
      if (!node) return;
      if (node.type === NodeType.RECT || node.type === NodeType.CIRCLE) {
        const colorChanged = node.style.borderColor !== nextColor;
        const widthChanged = node.style.borderWidth !== nextWidth;
        if (colorChanged || widthChanged) {
          store.updateNode(node.id, {
            style: { ...node.style, borderColor: nextColor, borderWidth: nextWidth },
          });
        }
      }
    });
    return;
  }

  // 多选处理：更新所有选中的形状和组合
  if (isMultiSelect.value) {
    store.activeElements.forEach((node) => {
      if (!node) return;
      if (
        node.type === NodeType.RECT ||
        node.type === NodeType.CIRCLE ||
        node.type === NodeType.GROUP
      ) {
        const colorChanged = node.style.borderColor !== nextColor;
        const widthChanged = node.style.borderWidth !== nextWidth;
        if (colorChanged || widthChanged) {
          store.updateNode(node.id, {
            style: { ...node.style, borderColor: nextColor, borderWidth: nextWidth },
          });
        }
      }
    });
    return;
  }

  // 单选处理
  const colorChanged = activeNode.value!.style.borderColor !== nextColor;
  const widthChanged = activeNode.value!.style.borderWidth !== nextWidth;

  if (!colorChanged && !widthChanged) return;

  store.updateNode(activeNode.value!.id, {
    style: {
      ...activeNode.value!.style,
      borderColor: nextColor,
      borderWidth: nextWidth,
    },
  });
};

const handleStrokeColorChange = (value: unknown) => {
  applyStrokeStyle({ color: value });
};

const handleStrokeWidthChange = (value: unknown) => {
  if (isSyncingShapeStyle.value) return;
  const width = extractNumericValue(value, strokeWidthTemp.value);
  applyStrokeStyle({ width });
};

// 面板专用的不透明度绑定：支持组合编辑、多选、单选
const panelOpacity = computed<number>({
  get: () => {
    // 组合编辑模式：如果有 lastSelectedChildId，取该子元素的 opacity
    if (isEditingGroup.value && lastSelectedChildId.value) {
      const child = store.nodes[lastSelectedChildId.value];
      if (child) return child.style.opacity ?? 1;
    }

    // 多选模式：取所有选中元素的平均 opacity，或第一个元素的值作为回显
    if (isMultiSelect.value) {
      const first = store.activeElements.find((n) => !!n);
      return first ? (first!.style.opacity ?? 1) : 1;
    }

    // 单选 / 默认：使用 useStyleSync 提供的绑定
    return opacity.value ?? 1;
  },
  set: (val: number) => {
    const clampedVal = Math.max(0, Math.min(1, val)); // 约束到 [0, 1]

    // 组合编辑模式：如果存在 lastSelectedChildId，则仅更新该子元素
    if (isEditingGroup.value && lastSelectedChildId.value) {
      const childId = lastSelectedChildId.value;
      const node = store.nodes[childId];
      if (node) {
        store.updateNode(childId, { style: { ...node.style, opacity: clampedVal } });
      }
      return;
    }

    // 多选时：对所有选中元素统一设置 opacity
    if (isMultiSelect.value) {
      store.lockHistory(() => {
        store.activeElements.forEach((n) => {
          if (!n) return;
          store.updateNode(n.id, { style: { ...n.style, opacity: clampedVal } });
        });
      });
      return;
    }

    // 单选：委托给 useStyleSync 的 binding
    opacity.value = clampedVal;
  },
});

// opacity 已从 useStyleSync 导入

// 修改 zIndex 计算属性以支持多选显示 (取最大值)
const displayZIndex = computed({
  get: () => {
    if (isMultiSelect.value) {
      return Math.max(...store.activeElements.map((e) => e!.style.zIndex || 1));
    }
    return activeNode.value?.style.zIndex ?? 1;
  },
  set: (val) => {
    const newZ = val as number;
    if (isMultiSelect.value) {
      store.lockHistory(() => {
        store.activeElements.forEach((node) => {
          if (!node) return;
          store.updateNode(node.id, { style: { ...node.style, zIndex: newZ } });
        });
      });
      return;
    }
    if (activeNode.value) {
      store.updateNode(activeNode.value.id, {
        style: { ...activeNode.value.style, zIndex: newZ },
      });
    }
  },
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
  store.activeElements.forEach((element) => {
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
  store.activeElements.forEach((element) => {
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
  store.activeElements.forEach((element) => {
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
  store.activeElements.forEach((element) => {
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

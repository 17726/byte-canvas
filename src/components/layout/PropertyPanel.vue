<template>
  <div class="property-panel">
    <!-- Canvas Settings Mode -->
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

    <!-- Node Property Mode -->
    <div v-else>
      <div v-if="!activeNode" class="empty-state">
        <a-empty description="未选中元素" />
      </div>
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
              <a-input-number v-model="transformX" size="small" mode="button">
                <template #prefix>X</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="transformY" size="small" mode="button">
                <template #prefix>Y</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="12">
              <a-input-number v-model="transformW" size="small" :min="1" mode="button">
                <template #prefix>W</template>
              </a-input-number>
            </a-col>
            <a-col :span="12">
              <a-input-number v-model="transformH" size="small" :min="1" mode="button">
                <template #prefix>H</template>
              </a-input-number>
            </a-col>
          </a-row>
          <a-row :gutter="8" class="prop-row">
            <a-col :span="24">
              <a-input-number v-model="transformRotation" size="small" mode="button">
                <template #prefix>∠</template>
                <template #suffix>°</template>
              </a-input-number>
            </a-col>
          </a-row>
        </div>

        <a-divider style="margin: 12px 0" />

        <!-- Section 2: 外观 (Appearance) -->
        <div class="panel-section">
          <div class="section-title">外观</div>

          <!-- Fill -->
          <div class="prop-item" v-if="!isImage">
            <span class="label">填充</span>
            <a-color-picker v-model="fillColor" show-text size="small" />
          </div>

          <!-- Stroke -->
          <div class="prop-item" >
            <span class="label">描边</span>
            <div class="flex-row">
              <a-color-picker v-model="strokeColor" size="small" />
              <a-input-number v-model="strokeWidth" size="small" style="width: 80px" :min="0">
                <template #suffix>px</template>
              </a-input-number>
            </div>
          </div>

          <!-- Opacity -->
          <div class="prop-item">
            <span class="label">不透明度</span>
            <a-slider v-model="opacity" :min="0" :max="1" :step="0.01" show-input size="small" />
          </div>
        </div>

        <a-divider style="margin: 12px 0" />

        <!-- Section 3: 特有属性 (Specific) -->
        <div class="panel-section" v-if="isText || isShape || isImage">
          <div class="section-title">属性</div>

          <!-- Text Specific -->
          <template v-if="isText">
            <div class="prop-item">
              <span class="label">内容</span>
              <a-textarea v-model="textContent" :auto-size="{ minRows: 2, maxRows: 5 }" />
            </div>
            <div class="prop-item">
              <span class="label">字号</span>
              <a-input-number v-model="fontSize" size="small" :min="1" />
            </div>
            <div class="prop-item">
              <span class="label">字重</span>
              <a-select v-model="fontWeight" size="small">
                <a-option :value="400">Normal</a-option>
                <a-option :value="700">Bold</a-option>
              </a-select>
            </div>
            <div class="prop-item">
              <span class="label">颜色</span>
              <a-color-picker v-model="textColor" show-text size="small" />
            </div>
          </template>

          <!-- Shape Specific -->
          <template v-if="isRect">
            <div class="prop-item">
              <span class="label">圆角 (%)</span>
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

          <!-- Image Specific -->
          <template v-if="isImage">
            <div class="prop-item">
              <span class="label">滤镜</span>
              <div class="filter-options">

                <!-- 黑白滤镜 -->
                <div class="filter-item" @click="selectFilter('grayscale')">
                  <div
                    class="filter-preview"
                    :class="{ active: selectedFilter === 'grayscale' }"
                    :style="{
                      backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                      filter: 'grayscale(100%) contrast(110%) brightness(95%)'
                    }"
                  ></div>
                  <span class="filter-name">黑白</span>
                </div>

                <!-- 模糊滤镜 -->
                <div class="filter-item" @click="selectFilter('blur')">
                  <div
                    class="filter-preview"
                    :class="{ active: selectedFilter === 'blur' }"
                    :style="{
                      backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                      filter: 'blur(8px) brightness(98%) opacity(95%)'
                    }"
                  ></div>
                  <span class="filter-name">模糊</span>
                </div>

                <!-- 复古滤镜 -->
                <div class="filter-item" @click="selectFilter('vintage')">
                  <div
                    class="filter-preview"
                    :class="{ active: selectedFilter === 'vintage' }"
                    :style="{
                      backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                      filter: 'sepia(60%) contrast(115%) brightness(95%) saturate(85%) hue-rotate(-10deg) '
                    }"
                  ></div>
                  <span class="filter-name">复古</span>
                </div>

                <!-- 重置滤镜 -->
                <div class="filter-item" @click="selectFilter('reset')">
                  <div
                    class="filter-preview"
                    :class="{ active: selectedFilter === 'reset' }"
                    :style="{
                      backgroundImage: 'url(' + (previewImage || defaultImage) + ')',
                      filter: 'none'
                    }"
                  ></div>
                  <span class="filter-name">重置</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { NodeType, type ImageState, type ShapeState, type TextState } from '@/types/state';
import { DEFAULT_CANVAS_THEMES, DEFAULT_IMAGE_FILTERS, DEFAULT_IMAGE_URL } from '@/config/defaults';

const store = useCanvasStore();
const ui = useUIStore();
// 说明：PropertyPanel 有两种模式：'canvas' (显示画布设置) 与 'node' (显示节点属性)
// 由 store.activePanel 决定，store.isPanelExpanded 控制面板折叠/展开

const activeNode = computed(() => {
  const ids = Array.from(store.activeElementIds);
  if (ids.length !== 1) return null;
  const id = ids[0]!;
  return store.nodes[id];
});

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
const isShape = computed(
  () => activeNode.value?.type === NodeType.RECT || activeNode.value?.type === NodeType.CIRCLE
);
const isText = computed(() => activeNode.value?.type === NodeType.TEXT);
const isRect = computed(
  () => isShape.value && (activeNode.value as ShapeState)?.shapeType === 'rect'
);
const isImage = computed(() => activeNode.value?.type === NodeType.IMAGE);
// const hasFill = computed(() => isShape.value);
// const hasStroke = computed(() => isShape.value);

// --- Transform Bindings ---
const transformX = computed({
  get: () => activeNode.value?.transform.x || 0,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      transform: { ...activeNode.value.transform, x: val as number },
    }),
});
const transformY = computed({
  get: () => activeNode.value?.transform.y || 0,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      transform: { ...activeNode.value.transform, y: val as number },
    }),
});
const transformW = computed({
  get: () => activeNode.value?.transform.width || 0,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      transform: { ...activeNode.value.transform, width: val as number },
    }),
});
const transformH = computed({
  get: () => activeNode.value?.transform.height || 0,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      transform: { ...activeNode.value.transform, height: val as number },
    }),
});
const transformRotation = computed({
  get: () => activeNode.value?.transform.rotation || 0,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      transform: { ...activeNode.value.transform, rotation: val as number },
    }),
});

// --- Appearance Bindings ---
const fillColor = computed({
  get: () => (activeNode.value as ShapeState)?.style.backgroundColor || '#ffffff',
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      style: { ...activeNode.value.style, backgroundColor: val },
    }),
});
const strokeColor = computed({
  get: () => (activeNode.value as ShapeState)?.style.borderColor || '#000000',
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      style: { ...activeNode.value.style, borderColor: val },
    }),
});
const strokeWidth = computed({
  get: () => (activeNode.value as ShapeState)?.style.borderWidth || 0,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      style: { ...activeNode.value.style, borderWidth: val as number },
    }),
});
const opacity = computed({
  get: () => activeNode.value?.style.opacity ?? 1,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, {
      style: { ...activeNode.value.style, opacity: val as number },
    }),
});

// --- Specific Bindings ---
// Text
const textContent = computed({
  get: () => (activeNode.value as TextState)?.props.content || '',

  set: (val) =>
    activeNode.value && store.updateNode(activeNode.value.id, { props: { content: val } } as any),
});
const fontSize = computed({
  get: () => (activeNode.value as TextState)?.props.fontSize || 12,

  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, { props: { fontSize: val as number } } as any),
});
const fontWeight = computed({
  get: () => (activeNode.value as TextState)?.props.fontWeight || 400,

  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, { props: { fontWeight: val as number } } as any),
});
const textColor = computed({
  get: () => (activeNode.value as TextState)?.props.color || '#000000',

  set: (val) =>
    activeNode.value && store.updateNode(activeNode.value.id, { props: { color: val } } as any),
});

// Shape
const cornerRadius = computed({
  get: () => (activeNode.value as ShapeState)?.props.cornerRadius || 0,

  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, { props: { cornerRadius: val as number } } as any),
});

//Image

// 选中的滤镜
const selectedFilter = ref(null);

// 预览图片（可以使用当前选中图片的缩略图）
const previewImage = computed(() => {
  // 这里可以返回当前选中图片的URL
  return (activeNode.value as ImageState)?.props?.imageUrl || DEFAULT_IMAGE_URL;
});

// 默认预览图片（当没有选中图片时使用）
const defaultImage = DEFAULT_IMAGE_URL;

// 选择滤镜
const selectFilter = (filterType) => {
  selectedFilter.value = filterType;

  switch(filterType) {
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
  store.activeElements.forEach(element => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: {
            grayscale: 100,
            contrast: 110,
            brightness: 95
          }
        }
      });
    }
  });
};

const blurFilter = () => {
  store.activeElements.forEach(element => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: {
            blur: 8,
            brightness: 98,
            filterOpacity: 95
          }
        }
      });
    }
  });
};

const vintageFilter = () => {
  store.activeElements.forEach(element => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: {
            sepia: 60,             // 棕褐色调
            contrast: 115,         // 增强对比度
            brightness: 95,        // 降低亮度
            saturate: 85,          // 降低饱和度
            hueRotate: -10         // 轻微色相偏移
          }
        }
      });
    }
  });
};

const resetFilter = () => {
  store.activeElements.forEach(element => {
    if (element && element.id && element.type === 'image') {
      store.updateNode(element.id, {
        props: {
          ...element.props,
          filters: DEFAULT_IMAGE_FILTERS
        }
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
  margin-bottom: 8px;
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
  background-size: cover;
  background-position: center;
  border: 2px solid #e5e5e5;
  transition: all 0.2s ease;
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
</style>

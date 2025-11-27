<template>
  <div class="property-panel">
    <div v-if="!activeNode" class="empty-state">
      <a-empty description="未选中元素" />
    </div>

    <div v-else class="panel-content">
      <div class="panel-header">
        <span class="node-type">{{ activeNode.type.toUpperCase() }}</span>
        <span class="node-id">#{{ activeNode.id.slice(-4) }}</span>
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
        <div class="prop-item" v-if="hasFill">
          <span class="label">填充</span>
          <a-color-picker v-model="fillColor" show-text size="small" />
        </div>

        <!-- Stroke -->
        <div class="prop-item" v-if="hasStroke">
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
      <div class="panel-section" v-if="isText || isShape">
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
        <template v-if="isShape && activeNode.shapeType === 'rect'">
          <div class="prop-item">
            <span class="label">圆角 (%)</span>
            <a-slider v-model="cornerRadius" :min="0" :max="50" :step="1" show-input size="small" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type ShapeState, type TextState } from '@/types/state';

const store = useCanvasStore();

const activeNode = computed(() => {
  const ids = Array.from(store.activeElementIds);
  if (ids.length !== 1) return null;
  return store.nodes[ids[0]];
});

// --- Helpers ---
const isShape = computed(
  () => activeNode.value?.type === NodeType.RECT || activeNode.value?.type === NodeType.CIRCLE
);
const isText = computed(() => activeNode.value?.type === NodeType.TEXT);
const hasFill = computed(() => isShape.value);
const hasStroke = computed(() => isShape.value);

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
    activeNode.value && store.updateNode(activeNode.value.id, { props: { content: val } }),
});
const fontSize = computed({
  get: () => (activeNode.value as TextState)?.props.fontSize || 12,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, { props: { fontSize: val as number } }),
});
const fontWeight = computed({
  get: () => (activeNode.value as TextState)?.props.fontWeight || 400,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, { props: { fontWeight: val as number } }),
});
const textColor = computed({
  get: () => (activeNode.value as TextState)?.props.color || '#000000',
  set: (val) =>
    activeNode.value && store.updateNode(activeNode.value.id, { props: { color: val } }),
});

// Shape
const cornerRadius = computed({
  get: () => (activeNode.value as ShapeState)?.props.cornerRadius || 0,
  set: (val) =>
    activeNode.value &&
    store.updateNode(activeNode.value.id, { props: { cornerRadius: val as number } }),
});
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
  color: var(--color-text-2);
  margin-bottom: 4px;
}

.flex-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>

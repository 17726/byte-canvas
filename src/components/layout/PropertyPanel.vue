<!-- 属性面板 -->
<template>
  <div class="property-panel">
    <a-space direction="vertical" size="large" style="width: 100%">
      <!-- 颜色设置区域 -->
      <a-space>
        <!-- 填充色/背景色 -->
        <div class="color-item">
          <span class="label">填充</span>
          <a-color-picker v-model="fillColor" size="mini" show-text />
        </div>
        <!-- 边框色 -->
        <div class="color-item">
          <span class="label">描边</span>
          <a-color-picker v-model="borderColor" size="mini" show-text />
        </div>
        <!-- 文本颜色 (仅文本节点显示) -->
        <div class="color-item" v-if="isTextNode">
          <span class="label">文字</span>
          <a-color-picker v-model="textColor" size="mini" show-text />
        </div>
      </a-space>

      <!-- 坐标与尺寸区域 -->
      <a-space>
        <a-input-number
          v-model="x"
          :disabled="!hasSelection"
          :precision="2"
          placeholder="X"
          hide-button
          class="input-coord"
        >
          <template #prefix>X</template>
        </a-input-number>
        <a-input-number
          v-model="y"
          :disabled="!hasSelection"
          :precision="2"
          placeholder="Y"
          hide-button
          class="input-coord"
        >
          <template #prefix>Y</template>
        </a-input-number>
      </a-space>

      <!-- 样式属性区域 -->
      <a-space>
        <a-input-number
          v-model="borderWidth"
          :disabled="!hasSelection"
          :min="0"
          placeholder="边框"
          class="input-coord"
        >
          <template #prefix>边框</template>
        </a-input-number>
      </a-space>

      <!-- 层级操作 -->
      <a-button-group type="secondary" size="small">
        <a-button @click="moveLayer('up')">上移一层</a-button>
        <a-button @click="moveLayer('down')">下移一层</a-button>
      </a-button-group>

      <!-- 文本样式操作 (仅当选中包含文本时显示) -->
      <a-button-group type="text" size="small" v-if="isTextNode">
        <a-button @click="logFeature('Bold')">B</a-button>
        <a-button @click="logFeature('Strike')">S</a-button>
        <a-button @click="logFeature('Italic')">I</a-button>
        <a-button @click="logFeature('Underline')">U</a-button>
      </a-button-group>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type BaseNodeState, type TextState } from '@/types/state';

const store = useCanvasStore();

// =================================================================================
// 1. 逻辑抽象层 (Logic Abstraction)
//    这些函数充当了 "ViewModel" 的角色，将 UI 操作转换为 Store 的原子更新。
// =================================================================================

/**
 * 核心辅助函数：批量更新选中节点
 * @param updater 一个回调函数，接收当前节点，返回需要更新的属性对象 (Partial State)
 */
const updateSelectedNodes = (updater: (node: BaseNodeState) => Partial<BaseNodeState> | null) => {
  store.activeElements.forEach((node) => {
    if (!node || !node.id) return;

    const patch = updater(node);
    if (patch) {
      store.updateNode(node.id, patch);
    }
  });
};

/**
 * 核心辅助函数：获取第一个选中节点的值（用于回显）
 * @param getter 读取属性的函数
 * @param defaultValue 默认值
 */
const getFirstSelectionValue = <T,>(getter: (node: BaseNodeState) => T, defaultValue: T): T => {
  const first = store.activeElements[0];
  if (!first) return defaultValue;
  try {
    return getter(first) ?? defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

// =================================================================================
// 2. 视图模型绑定 (ViewModel Binding)
//    使用 computed get/set 替代 watch，实现干净的双向绑定
// =================================================================================

const hasSelection = computed(() => store.activeElements.length > 0);

const isTextNode = computed(() => {
  const first = store.activeElements[0];
  return first && first.type === NodeType.TEXT;
});

// --- 坐标属性 (X/Y) ---

const x = computed({
  get: () => getFirstSelectionValue((n) => n.transform.x, 0),
  set: (val) => {
    // NOTE: 属性面板修改坐标通常是"绝对定位"语义，即"对齐到 X"。
    updateSelectedNodes((node) => ({
      transform: { ...node.transform, x: val },
    }));
  },
});

const y = computed({
  get: () => getFirstSelectionValue((n) => n.transform.y, 0),
  set: (val) => {
    updateSelectedNodes((node) => ({
      transform: { ...node.transform, y: val },
    }));
  },
});

// --- 样式属性 (Colors) ---

// 填充色 (Background Color)
const fillColor = computed({
  get: () => getFirstSelectionValue((n) => n.style.backgroundColor, 'transparent'),
  set: (val) => {
    updateSelectedNodes((node) => ({
      style: { ...node.style, backgroundColor: val },
    }));
  },
});

// 边框色 (Border Color)
const borderColor = computed({
  get: () => getFirstSelectionValue((n) => n.style.borderColor, '#000000'),
  set: (val) => {
    updateSelectedNodes((node) => ({
      style: { ...node.style, borderColor: val },
    }));
  },
});

// 文本颜色 (Text Color)
const textColor = computed({
  get: () =>
    getFirstSelectionValue((n) => {
      if (n.type === NodeType.TEXT && (n as TextState).props) {
        return (n as TextState).props.color;
      }
      return '#000000';
    }, '#000000'),
  set: (val) => {
    updateSelectedNodes((node) => {
      if (node.type === NodeType.TEXT) {
        return {
          props: { ...(node as TextState).props, color: val },
        };
      }
      return null;
    });
  },
});

// 边框宽度
const borderWidth = computed({
  get: () => getFirstSelectionValue((n) => n.style.borderWidth, 0),
  set: (val) => {
    updateSelectedNodes((node) => ({
      style: { ...node.style, borderWidth: val },
    }));
  },
});

// =================================================================================
// 3. 操作指令 (Actions)
// =================================================================================

const moveLayer = (direction: 'up' | 'down') => {
  updateSelectedNodes((node) => {
    const currentZ = node.style.zIndex || 0;
    return {
      style: {
        ...node.style,
        zIndex: direction === 'up' ? currentZ + 1 : Math.max(0, currentZ - 1),
      },
    };
  });
};

const logFeature = (name: string) => {
  console.log(`[Feature Pending] ${name} style toggle`);
};
</script>

<style scoped>
.property-panel {
  padding: 12px;
  background-color: var(--color-bg-2);
  border-left: 1px solid var(--color-border);
  height: 100%;
  overflow-y: auto;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 12px;
  color: var(--color-text-3);
}

.input-coord {
  width: 100px;
}
</style>

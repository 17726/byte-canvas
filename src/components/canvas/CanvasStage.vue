<template>
  <div
    class="canvas-stage"
    ref="stageRef"
    @mousedown="handleMouseDown"
    @wheel="handleWheel"
    @contextmenu="handleContextMenu"
    :style="stageStyle"
    :class="{ 'is-creating': isCreating }"
  >
    <!--
      视口层 (Viewport Layer)
      职责：应用全局的平移(Translate)和缩放(Scale)
      说明：所有节点都被渲染在这层上，因此此处的 transform 会影响节点在屏幕上的最终位置/大小
      对应文档：L4 渲染层 - 画布容器
    -->
    <!-- 框选视觉层 -->
    <div v-if="isBoxSelecting" class="box-select-overlay" :style="boxSelectStyle"></div>

    <!-- 视口层 -->
    <div class="canvas-viewport" :style="viewportStyle">
      <!--
        图元渲染层 (Node Rendering Layer)
        职责：遍历 Store 中的节点列表进行渲染
        对应文档：L4 渲染层 - 响应式渲染
      -->
      <!-- 图元渲染层 -->
      <component
        v-for="node in store.visibleRenderList"
        :key="node!.id"
        :is="getComponentType(node!.type)"
        :node="node"
        @mousedown="handleNodeDown($event, node!.id)"
        @dblclick="handleNodeDoubleClick($event, node!.id)"
        @contextmenu="handleNodeContextMenu($event, node!.id)"
      />

      <!-- 预览节点（Ghost Node）- 创建模式下显示 -->
      <component
        v-if="store.previewNode"
        :key="'preview-' + store.previewNode.id"
        :is="getComponentType(store.previewNode.type)"
        :node="store.previewNode"
        class="preview-node"
      />

      <!-- 选中覆盖层 (处理拖拽缩放) -->
      <SelectionOverlay />
    </div>

    <!-- 悬浮属性栏 (Context Toolbar) - 放在视口外，但跟随节点坐标 -->
    <!-- 注意：ContextToolbar 读取 store.activeElementIds 并计算屏幕位置，它不直接受 viewport transform 的 DOM 影响，
          因此 implement 上需要使用 worldToClient 等工具方法计算位置 -->
    <ContextToolbar />

    <!-- 组合工具栏 - 多选时显示组合/解组合按钮 -->
    <GroupToolbar />

    <!-- 辅助信息：显示当前视口状态 -->
    <div class="debug-info" @click="resetViewport" title="点击恢复默认视图">
      Zoom: {{ (store.viewport.zoom * 100).toFixed(0) }}% <br />
      X: {{ store.viewport.offsetX.toFixed(0) }} <br />
      Y: {{ store.viewport.offsetY.toFixed(0) }}
    </div>

    <!-- 性能测试面板 -->
    <PerformanceTestPanel v-if="ui.showPerformancePanel" />
  </div>
</template>

<script setup lang="ts">
import {
  DEFAULT_CANVAS_BG,
  DEFAULT_GRID_DOT_COLOR,
  DEFAULT_GRID_DOT_SIZE,
  DEFAULT_VIEWPORT,
} from '@/config/defaults';
import { GroupService } from '@/core/services/GroupService';
import { ToolManager } from '@/core/ToolManager';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNodeActions } from '@/composables/useNodeActions';
import { NodeType } from '@/types/state';
import { computed, onMounted, onUnmounted, provide, ref, watch, type CSSProperties } from 'vue';
import GroupToolbar from '../ui/floating/GroupActions.vue';
import ContextToolbar from '../ui/floating/HoverToolbar.vue';
import CircleLayer from './layers/CircleLayer.vue';
import GroupLayer from './layers/GroupLayer.vue';
import ImageLayer from './layers/ImageLayer.vue';
import RectLayer from './layers/RectLayer.vue';
import TextLayer from './layers/TextLayer.vue';
import SelectionOverlay from './SelectionOverlay.vue';
import PerformanceTestPanel from '../performance/PerformanceTestPanel.vue';

const store = useCanvasStore();
const ui = useUIStore();
const stageRef = ref<HTMLElement | null>(null);

// 使用 useNodeActions 提供的操作方法（带 UI 反馈）
const { deleteSelected, copy, cut, paste, groupSelected, ungroupSelected, selectAll } =
  useNodeActions();

// 空格键状态（迁移自ToolManager，统一在组件内维护）
const isSpacePressed = ref(false);

// 创建模式状态（用于交互锁定）
const isCreating = computed(() => store.creationTool !== 'select');

// 创建 toolManager ref 并立即 provide（解决依赖注入时序问题）
const toolManagerRef = ref<ToolManager | null>(null);
provide('toolManager', toolManagerRef);

// 1. 视口样式计算
const viewportStyle = computed(() => ({
  transform: `translate(${store.viewport.offsetX}px, ${store.viewport.offsetY}px) scale(${store.viewport.zoom})`,
  transformOrigin: '0 0', // 从左上角开始变换
}));

// 背景样式计算 (点阵效果)
const stageStyle = computed(() => {
  const bg = store.viewport.backgroundColor || DEFAULT_CANVAS_BG; // use store setting

  // 基础样式：先初始化背景色 + 光标样式
  const style: CSSProperties = {
    backgroundColor: bg,
    // 光标优先级：空格平移 > 创建模式 > 默认
    cursor: isSpacePressed.value
      ? store.isInteracting
        ? 'grabbing'
        : 'grab'
      : isCreating.value
        ? 'crosshair'
        : 'default',
  };

  // 网格不可见时，直接返回基础样式（含光标）
  if (!store.viewport.isGridVisible) {
    return style;
  }

  // 原有网格样式计算逻辑（不变）
  const gridSize = Math.max(8, store.viewport.gridSize) * store.viewport.zoom; // 防止 zoom=0 或 gridSize 太小影响显示
  const offsetX = store.viewport.offsetX;
  const offsetY = store.viewport.offsetY;
  const dotColor = store.viewport.gridDotColor || DEFAULT_GRID_DOT_COLOR;
  const dotSize = store.viewport.gridDotSize || DEFAULT_GRID_DOT_SIZE; // px
  const gridStyle = store.viewport.gridStyle || 'dot';

  if (gridStyle === 'dot') {
    style.backgroundImage = `radial-gradient(${dotColor} ${dotSize}px, transparent ${dotSize}px)`;
    style.backgroundSize = `${gridSize}px ${gridSize}px`;
    style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  } else if (gridStyle === 'line') {
    // Use two repeating-linear-gradients to draw grid lines
    const lineColor = dotColor;
    style.backgroundImage = `linear-gradient(0deg, ${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`;
    style.backgroundSize = `${gridSize}px ${gridSize}px`;
    style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  }

  return style;
});

// 重置视口
const resetViewport = () => {
  store.viewport.zoom = DEFAULT_VIEWPORT.zoom;
  store.viewport.offsetX = DEFAULT_VIEWPORT.offsetX;
  store.viewport.offsetY = DEFAULT_VIEWPORT.offsetY;
};

// 2. 组件映射工厂
const getComponentType = (type: NodeType) => {
  switch (type) {
    case NodeType.RECT:
      return RectLayer;
    case NodeType.CIRCLE:
      return CircleLayer;
    case NodeType.TEXT:
      return TextLayer;
    case NodeType.IMAGE:
      return ImageLayer;
    case NodeType.GROUP:
      return GroupLayer;
    default:
      return 'div';
  }
};

// 框选状态响应式数据
const isBoxSelecting = ref(false);
const boxSelectStart = ref({ x: 0, y: 0 });
const boxSelectEnd = ref({ x: 0, y: 0 });

// 框选样式计算
const boxSelectStyle = computed(() => {
  const start = boxSelectStart.value;
  const end = boxSelectEnd.value;

  // 【修复】SelectionHandler 已输出 Container 坐标，直接使用
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  // 修正：如果 left/top 小于 0，需要调整 width/height 以保持视觉一致性
  // 否则 Math.max(0, left) 会导致框选框“粘”在边缘但尺寸不变，造成视觉误差
  const clampedLeft = Math.max(0, left);
  const clampedTop = Math.max(0, top);
  const clampedWidth = Math.max(0, width - (clampedLeft - left));
  const clampedHeight = Math.max(0, height - (clampedTop - top));

  return {
    left: `${clampedLeft}px`,
    top: `${clampedTop}px`,
    width: `${clampedWidth}px`,
    height: `${clampedHeight}px`,
  };
});

// 3. 事件转发 -> 逻辑层 (ToolManager)
// 滚轮缩放
const handleWheel = (e: WheelEvent) => {
  if (!toolManagerRef.value) return; // 防御性判断
  toolManagerRef.value.handleWheel(e);
};

// 画布鼠标按下
const handleMouseDown = (e: MouseEvent) => {
  if (!toolManagerRef.value) return;
  toolManagerRef.value.handleMouseDown(e);
};

// 全局鼠标移动
const handleMouseMove = (e: MouseEvent) => {
  if (!toolManagerRef.value) return;
  toolManagerRef.value.handleMouseMove(e);
  // 同步框选状态到Vue组件
  const boxState = toolManagerRef.value.getBoxSelectState();
  isBoxSelecting.value = boxState.isBoxSelecting;
  boxSelectStart.value = boxState.boxSelectStart;
  boxSelectEnd.value = boxState.boxSelectEnd;
};

// 全局鼠标抬起
const handleMouseUp = () => {
  if (!toolManagerRef.value) return;
  toolManagerRef.value.handleMouseUp();
  isBoxSelecting.value = false;
};

// 节点鼠标按下
const handleNodeDown = (e: MouseEvent, id: string) => {
  // 注意：这里传入 e，以便 ToolManager 处理 stopPropagation 或其他逻辑
  if (!toolManagerRef.value) return;
  toolManagerRef.value.handleNodeDown(e, id);
};

// 节点双击事件（进入组合编辑模式）
const handleNodeDoubleClick = (e: MouseEvent, id: string) => {
  if (!toolManagerRef.value) return;
  toolManagerRef.value.handleNodeDoubleClick(e, id);
};

// 处理画布右键菜单
const handleContextMenu = (e: MouseEvent) => {
  e.preventDefault(); // 阻止默认右键菜单

  // 如果没有选中任何节点，则取消选中
  const nodeLayer = (e.target as Element).closest('.node-layer');
  if (!nodeLayer || !store.activeElementIds.has(nodeLayer.id)) {
    store.setActive([]);
  }

  // 转发到ToolManager处理
  if (toolManagerRef.value) {
    toolManagerRef.value.handleContextMenu(e);
  }
};

// 处理节点右键菜单
const handleNodeContextMenu = (e: MouseEvent, id: string) => {
  e.preventDefault(); // 阻止默认右键菜单
  e.stopPropagation(); // 阻止事件冒泡到画布

  // 如果节点未被选中，将其设为唯一选中项
  if (!store.activeElementIds.has(id)) {
    store.setActive([id]);
  }

  // 转发到ToolManager处理
  if (toolManagerRef.value) {
    toolManagerRef.value.handleNodeContextMenu(e);
  }
};

// 注意：创建节点的逻辑已迁移至 ToolPanel，直接使用 NodeFactory
// deleteSelected 等操作已由 useNodeActions 提供（带 UI 反馈）

// 键盘事件处理（整合所有键盘逻辑：快捷键 + 空格键）
const handleKeyDown = (e: KeyboardEvent) => {
  // 忽略输入框内的键盘事件
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

  // 空格键按下（迁移自ToolManager）
  if (e.code === 'Space') {
    isSpacePressed.value = true;
    e.preventDefault(); // 阻止空格的默认行为（页面滚动）
    return;
  }

  // Escape: 取消创建模式或退出组合编辑模式
  if (e.key === 'Escape') {
    e.preventDefault();
    // 优先处理创建模式
    if (toolManagerRef.value?.creationHandler?.isCreating()) {
      toolManagerRef.value.creationHandler.reset();
      return;
    }
    // 其次处理组合编辑模式
    if (store.editingGroupId) {
      GroupService.exitGroupEdit(store);
      return;
    }
  }

  // Ctrl/Cmd + G: 组合（使用 useNodeActions，带 UI 反馈）
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'g') {
    e.preventDefault();
    groupSelected();
    return;
  }

  // Ctrl/Cmd + Shift + G: 解组合（使用 useNodeActions，带 UI 反馈）
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
    e.preventDefault();
    ungroupSelected();
    return;
  }

  // Ctrl/Cmd + C: 复制（使用 useNodeActions，带 UI 反馈）
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    copy();
    return;
  }

  // Ctrl/Cmd + X: 剪切（使用 useNodeActions，带 UI 反馈）
  if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
    e.preventDefault();
    cut();
    return;
  }

  // Ctrl/Cmd + V: 粘贴（使用 useNodeActions，带 UI 反馈）
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    paste();
    return;
  }

  // Ctrl/Cmd + Z: 撤销
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    store.undo();
    return;
  }

  // Ctrl/Cmd + Y: 重做
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    store.redo();
    return;
  }
  // Ctrl/Cmd + Shift + Z: 重做
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    store.redo();
    return;
  }

  // Delete / Backspace: 删除选中元素（使用 useNodeActions，带 UI 反馈）
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelected();
    return;
  }
  // Ctrl/Cmd + A: 全选（复用 useNodeActions，保持与右键菜单一致）
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    selectAll();
    return;
  }
};

// 空格键松开（迁移自ToolManager）
const handleKeyUp = (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    isSpacePressed.value = false;
  }
};

// 窗口失去焦点时重置空格键状态（迁移自ToolManager）
const handleWindowBlur = () => {
  isSpacePressed.value = false;
};

// 监听创建工具变化，同步到 CreationHandler
watch(
  () => store.creationTool,
  (newTool) => {
    // 【修复】增加非空检查
    const handler = toolManagerRef.value?.creationHandler;
    if (handler) {
      handler.setTool(newTool);
    }
  }
);

// 全局事件监听（整合所有事件：鼠标 + 键盘）
onMounted(() => {
  // 1. 初始化 toolManager，传入空格键状态获取函数
  toolManagerRef.value = new ToolManager(stageRef.value, () => isSpacePressed.value);

  // 2. 绑定全局事件（鼠标 + 键盘）
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleWindowBlur);
});

// 解绑全局事件（防止内存泄漏）
onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('blur', handleWindowBlur);

  // 销毁 toolManager
  toolManagerRef.value?.destroy();
});
</script>

<style scoped>
.canvas-stage {
  width: 100%;
  height: 100%;
  overflow: hidden; /* 隐藏超出视口的内容 */
  /* background color moved to inline stageStyle */
  position: relative;
  /* cursor: grab; */ /* 暂时禁用拖拽手势 */
}
/* .canvas-stage:active {
  cursor: grabbing;
} */

.canvas-viewport {
  width: 100%;
  height: 100%;
  /* 硬件加速 */
  will-change: transform;
}

.debug-info {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

/* 预览节点样式 - 半透明且禁用鼠标事件 */
.preview-node {
  pointer-events: none !important;
}

/* 框选样式 */
.box-select-overlay {
  position: absolute;
  background: rgba(66, 133, 244, 0.2);
  border: 1px solid rgba(66, 133, 244, 0.8);
  pointer-events: none;
  z-index: 100;
}

/* 创建模式交互锁定 - 只禁用节点组件 */
.canvas-stage.is-creating .canvas-viewport > :not(.preview-node):not(.selection-overlay) {
  pointer-events: none !important;
}

.debug-info:hover {
  background: rgba(0, 0, 0, 0.7);
}
</style>

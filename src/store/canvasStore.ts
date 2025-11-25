// stores/canvasStore.ts
import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import type { BaseNodeState } from '@/types/state';

export const useCanvasStore = defineStore('canvas', () => {
  // 1. 核心数据
  // 使用 Record 存储，对应调研报告中的 "State/Node分离" 思想
   const nodes = ref<Record<string, BaseNodeState | undefined>>({});
  const nodeOrder = ref<string[]>([]); // 决定渲染顺序
  const version = ref(0); //脏标记计数器，可以理解为版本号，每次Node改动都要将其+1
  // 2. 视口状态 (应用在容器层，不传递给单个 Node)
  const viewport = reactive({
    canvasWidth: 0,
    canvasHeight: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,

    // --- 辅助 (并给出默认值) ---
    rotation: 0,              // 默认不旋转
    backgroundColor: '#ffffff', // 默认白底
    isGridVisible: true,      // 默认显示网格
    gridSize: 20,             // 默认 20px 网格
    isSnapToGrid: true        // 默认开启吸附

  });

  // 3. 交互状态
  // 优化：使用 Set 提高查找性能
  const activeElementIds = ref<Set<string>>(new Set());

  // 优化：交互锁，防止拖拽过程中触发昂贵操作(如自动保存)
  const isInteracting = ref(false);

  // Getters
  // 获取排序后的渲染列表，供 v-for 使用
  const renderList = computed(() => {
    return nodeOrder.value.map((id) => nodes.value[id]).filter(Boolean);
  });

  // Actions
  // 1. 更新节点
  function updateNode(id: string, patch: Partial<BaseNodeState>) {
    if (!nodes.value[id]) return;
    // 细粒度更新，Vue 组件只会更新变更的 Props
    Object.assign(nodes.value[id], patch);
    // 每次修改数据，手动触发版本号自增
    // 这样外部监听 version 就能知道数据变了
    version.value++;
  }

  // 2. 添加节点
  function addNode(node: BaseNodeState) {
    nodes.value[node.id] = node;
    nodeOrder.value.push(node.id);
    version.value++; // 触发更新
  }

  // 3. 删除节点
  function deleteNode(id: string) {
    if (!nodes.value[id]) return;
    delete nodes.value[id];
    nodeOrder.value = nodeOrder.value.filter((nId) => nId !== id);
    activeElementIds.value.delete(id); // 清除选中态
    version.value++; // 触发更新
  }

  function setActive(ids: string[]) {
    activeElementIds.value = new Set(ids);
  }

  function toggleSelection(id: string) {
    if (activeElementIds.value.has(id)) {
      activeElementIds.value.delete(id);
    } else {
      activeElementIds.value.add(id);
    }
  }

  return {
    nodes,
    nodeOrder,
    version,
    viewport,
    activeElementIds,
    isInteracting,
    renderList,
    updateNode,
    addNode,
    deleteNode,
    setActive,
    toggleSelection,
  };
});

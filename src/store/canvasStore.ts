// stores/canvasStore.ts
import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import type { NodeState } from '@/types/state';
import { DEFAULT_VIEWPORT } from '@/config/defaults';

export const useCanvasStore = defineStore('canvas', () => {
  // 1. 核心数据
  // 使用 Record 存储，对应调研报告中的 "State/Node分离" 思想
  const nodes = ref<Record<string, NodeState>>({});
  const nodeOrder = ref<string[]>([]); // 决定渲染顺序
  const version = ref(0); //脏标记计数器，可以理解为版本号，每次Node改动都要将其+1
  // 2. 视口状态 (应用在容器层，不传递给单个 Node)
  const viewport = reactive({
    canvasWidth: 0,
    canvasHeight: 0,
    ...DEFAULT_VIEWPORT,
  });

  // 3. 交互状态
  // 优化：使用 Set 提高查找性能
  const activeElementIds = ref<Set<string>>(new Set());

  // 优化：交互锁，防止拖拽过程中触发昂贵操作(如自动保存)
  const isInteracting = ref(false);
  // 右侧面板展示模式：'node' | 'canvas'
  const activePanel = ref<'node' | 'canvas'>('node');
  // 面板折叠/展开
  const isPanelExpanded = ref(false);

  // Getters
  // 获取排序后的渲染列表，供 v-for 使用
  const renderList = computed(() => {
    return nodeOrder.value.map((id) => nodes.value[id]).filter(Boolean);
  });

  const activeElements = computed(() => {
    return Array.from(activeElementIds.value)
      .map((id) => nodes.value[id])
      .filter(Boolean);
  });

  // Actions
  // 1. 更新节点
  function updateNode(id: string, patch: Partial<NodeState>) {
    const node = nodes.value[id];
    if (!node) return;

    // 核心优化：处理 props 的深度合并 (Deep Merge for props)
    // 防止 updateNode(id, { props: { fontSize: 20 } }) 导致 content 等其他属性丢失
    // 使用类型守卫或 'in' 操作符检查 props 是否存在于 patch 中
    if ('props' in patch && patch.props) {
      // 这里需要断言，因为 TS 无法确定 node 和 patch 是同一种类型
      // 但在业务逻辑上，我们保证 id 对应的 node 类型是稳定的
      const currentNode = node as any;
      const patchProps = patch.props as any;

      currentNode.props = {
        ...currentNode.props,
        ...patchProps,
      };

      // 合并除 props 外的其他属性 (transform, style, etc.)
      const { props, ...rest } = patch;
      Object.assign(node, rest);
    } else {
      // 普通更新
      Object.assign(node, patch);
    }

    // 每次修改数据，手动触发版本号自增
    // 这样外部监听 version 就能知道数据变了
    version.value++;
  }

  // 2. 添加节点
  function addNode(node: NodeState) {
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

  function setActivePanel(panel: 'node' | 'canvas') {
    activePanel.value = panel;
  }

  function setPanelExpanded(expanded: boolean) {
    isPanelExpanded.value = expanded;
  }

  return {
    nodes,
    nodeOrder,
    version,
    viewport,
    activeElementIds,
    isInteracting,
    renderList,
    activeElements,
    updateNode,
    addNode,
    deleteNode,
    setActive,
    toggleSelection,
    activePanel,
    isPanelExpanded,
    setActivePanel,
    setPanelExpanded,
  };
});

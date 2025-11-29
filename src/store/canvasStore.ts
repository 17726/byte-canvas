// stores/canvasStore.ts
import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import type { NodeState, ShapeState, TextState, ImageState, ViewportState } from '@/types/state';
import { DEFAULT_VIEWPORT } from '@/config/defaults';
import { loadFromLocalStorage, createDebouncedSave, clearLocalStorage } from './persistence';

// 全局画布状态管理（Pinia store）
// 说明：该 store 管理整个编辑器的核心状态，包括节点、渲染顺序、视口、交互态等。
export const useCanvasStore = defineStore('canvas', () => {
  // 1. 核心数据
  // 使用 Record 存储，对应调研报告中的 "State/Node分离" 思想
  // 节点字典：key 为节点 ID，value 为 NodeState
  const nodes = ref<Record<string, NodeState>>({});
  const nodeOrder = ref<string[]>([]); // 决定渲染顺序
  const version = ref(0); //脏标记计数器，可以理解为版本号，每次Node改动都要将其+1
  // 2. 视口状态 (应用在容器层，不传递给单个 Node)
  // 视口状态：控制画布缩放/平移/网格等全局设置
  const viewport = reactive({
    canvasWidth: 0,
    canvasHeight: 0,
    ...DEFAULT_VIEWPORT,
  });

  // 3. 交互状态
  // 优化：使用 Set 提高查找性能
  // 选中元素集合（Set 便于添加/删除/查重）
  const activeElementIds = ref<Set<string>>(new Set());

  // 优化：交互锁，防止拖拽过程中触发昂贵操作(如自动保存)
  const isInteracting = ref(false);
  // 注意：activePanel 与 isPanelExpanded 为 UI 控制字段，已迁移至 uiStore

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

  // Actions - 操作函数
  // 1. 更新节点
  /**
   * 更新节点：强制合并 props（浅合并）以避免覆盖未传入的值
   * @param id 要更新的节点 ID
   * @param patch 部分更新对象（允许对 transform/style/props 单独合并）
   */
  function updateNode(id: string, patch: Partial<NodeState>) {
    const node = nodes.value[id];
    if (!node) return;

    // 核心优化：处理 props 的深度合并 (Deep Merge for props)
    // 防止 updateNode(id, { props: { fontSize: 20 } }) 导致 content 等其他属性丢失
    // 使用类型守卫或 'in' 操作符检查 props 是否存在于 patch 中
    if ('props' in patch && patch.props) {
      // 这里需要断言，因为 TS 无法确定 node 的具体子类型（rect/text/image)
      const currentNode = node as NodeState & { props?: Record<string, unknown> };
      const patchProps = patch.props as Record<string, unknown>;

      currentNode.props = {
        ...(currentNode.props as Record<string, unknown>),
        ...patchProps,
      };

      // 合并除 props 外的其他属性 (transform, style, etc.)
      // 使用解构赋值分离 props，避免使用 delete 和 any
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { props, ...rest } = patch as Partial<ShapeState | TextState | ImageState>;
      Object.assign(node, rest);
    } else {
      // 普通更新
      Object.assign(node, patch);
    }

    // 每次修改数据，手动触发版本号自增，外部可通过监听 version 做缓存/网络保存等优化
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

  // ==================== 持久化功能 ====================

  // 创建防抖保存函数（500ms 防抖，避免频繁写入）
  const debouncedSave = createDebouncedSave(500);

  /**
   * 初始化：从 localStorage 恢复状态
   * 说明：应在应用启动时调用一次
   */
  function initFromStorage() {
    const stored = loadFromLocalStorage();
    if (!stored) return;

    const { data } = stored;

    // 恢复节点数据
    if (data.nodes) {
      nodes.value = data.nodes;
    }

    // 恢复节点顺序
    if (data.nodeOrder) {
      nodeOrder.value = data.nodeOrder;
    }

    // 恢复视口状态（保留动态计算的 canvasWidth/canvasHeight）
    if (data.viewport) {
      Object.assign(viewport, data.viewport);
    }

    console.log('[CanvasStore] 状态已从 localStorage 恢复');
  }

  /**
   * 手动保存当前状态到 localStorage
   */
  function saveToStorage() {
    debouncedSave(nodes.value, nodeOrder.value, viewport as ViewportState);
  }

  /**
   * 清除 localStorage 中的状态并重置画布
   */
  function clearStorage() {
    clearLocalStorage();
    nodes.value = {};
    nodeOrder.value = [];
    activeElementIds.value = new Set();
    Object.assign(viewport, DEFAULT_VIEWPORT);
    version.value = 0;
    console.log('[CanvasStore] 画布已重置');
  }

  // 监听状态变化，自动保存（使用 version 作为脏标记）
  // 注意：仅在非交互状态时保存，避免拖拽过程中频繁写入
  watch(
    () => version.value,
    () => {
      if (!isInteracting.value) {
        saveToStorage();
      }
    }
  );

  // 监听交互状态结束后保存
  watch(
    () => isInteracting.value,
    (newVal, oldVal) => {
      // 交互结束时触发保存
      if (oldVal === true && newVal === false) {
        saveToStorage();
      }
    }
  );

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
    // 持久化相关
    initFromStorage,
    saveToStorage,
    clearStorage,
    // UI 状态请使用 uiStore 中的 activePanel 和 isPanelExpanded
  };
});

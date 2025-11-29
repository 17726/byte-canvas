// stores/canvasStore.ts
import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import type { NodeState, ShapeState, TextState, ImageState, ViewportState } from '@/types/state';
import { DEFAULT_VIEWPORT } from '@/config/defaults';
import {
  loadFromLocalStorage,
  createDebouncedSave,
  clearLocalStorage,
  saveClipboard,
  loadClipboard,
  clearClipboard,
  type ClipboardData,
} from './persistence';
import { v4 as uuidv4 } from 'uuid';
import { cloneDeep } from 'lodash-es';

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

  // 4. 批量删除节点（仅触发一次 version 更新）
  function deleteNodes(ids: string[]) {
    if (ids.length === 0) return;

    const idsToDelete = ids.filter((id) => nodes.value[id]);
    if (idsToDelete.length === 0) return;

    // 批量删除节点
    idsToDelete.forEach((id) => {
      delete nodes.value[id];
      activeElementIds.value.delete(id);
    });

    // 一次性过滤 nodeOrder
    const deleteSet = new Set(idsToDelete);
    nodeOrder.value = nodeOrder.value.filter((nId) => !deleteSet.has(nId));

    // 仅触发一次版本更新
    version.value++;
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

  // 初始化保护标志，确保只初始化一次
  let isInitialized = false;

  /**
   * 初始化：从 localStorage 恢复状态
   * 说明：应在应用启动时调用一次，重复调用会被忽略
   */
  function initFromStorage(): boolean {
    // 防止重复初始化
    if (isInitialized) {
      console.warn('[CanvasStore] initFromStorage 已被调用过，忽略重复调用');
      return false;
    }

    isInitialized = true;

    const stored = loadFromLocalStorage();
    if (!stored) return false;

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
    return true;
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

  // 统一监听持久化条件：version 变化 + 交互状态
  // 保存时机：
  // 1. version 变化且非交互状态时立即保存
  // 2. 交互结束时（isInteracting: true -> false）保存
  watch(
    () => ({ version: version.value, interacting: isInteracting.value }),
    (newState, oldState) => {
      const versionChanged = newState.version !== oldState?.version;
      const interactionEnded = oldState?.interacting === true && newState.interacting === false;

      // 交互结束时保存（无论 version 是否变化）
      if (interactionEnded) {
        saveToStorage();
        return;
      }

      // version 变化且非交互状态时保存
      if (versionChanged && !newState.interacting) {
        saveToStorage();
      }
    }
  );

  // ==================== 复制/剪切/粘贴功能 ====================

  // 粘贴偏移量（避免重叠）
  const PASTE_OFFSET = 20;
  // 记录连续粘贴次数（用于递增偏移）
  let pasteCount = 0;
  let lastClipboardTimestamp = 0;

  /**
   * 复制选中的元素
   */
  function copySelected(): boolean {
    const selectedIds = Array.from(activeElementIds.value);
    if (selectedIds.length === 0) {
      console.log('[Clipboard] 没有选中的元素');
      return false;
    }

    // 深拷贝选中的节点
    const nodesToCopy = selectedIds
      .map((id) => nodes.value[id])
      .filter((node): node is NodeState => Boolean(node))
      .map((node) => cloneDeep(node));

    const clipboardData: ClipboardData = {
      type: 'copy',
      nodes: nodesToCopy,
      timestamp: Date.now(),
    };

    saveClipboard(clipboardData);
    pasteCount = 0; // 重置粘贴计数
    return true;
  }

  /**
   * 剪切选中的元素
   */
  function cutSelected(): boolean {
    const selectedIds = Array.from(activeElementIds.value);
    if (selectedIds.length === 0) {
      console.log('[Clipboard] 没有选中的元素');
      return false;
    }

    // 深拷贝选中的节点
    const nodesToCut = selectedIds
      .map((id) => nodes.value[id])
      .filter((node): node is NodeState => Boolean(node))
      .map((node) => cloneDeep(node));

    const clipboardData: ClipboardData = {
      type: 'cut',
      nodes: nodesToCut,
      timestamp: Date.now(),
    };

    saveClipboard(clipboardData);

    // 批量删除原节点（仅触发一次 version 更新）
    deleteNodes(selectedIds);
    pasteCount = 0; // 重置粘贴计数
    return true;
  }

  /**
   * 粘贴元素
   */
  function paste(): boolean {
    const clipboardData = loadClipboard();
    if (!clipboardData || clipboardData.nodes.length === 0) {
      console.log('[Clipboard] 剪贴板为空');
      return false;
    }

    // 检查是否是新的剪贴板内容，重置粘贴计数
    if (clipboardData.timestamp !== lastClipboardTimestamp) {
      pasteCount = 0;
      lastClipboardTimestamp = clipboardData.timestamp;
    }

    pasteCount++;
    const offset = PASTE_OFFSET * pasteCount;

    const newIds: string[] = [];

    clipboardData.nodes.forEach((node) => {
      // 生成新的 ID
      const newId = uuidv4();
      const newNode: NodeState = {
        ...cloneDeep(node),
        id: newId,
        transform: {
          ...node.transform,
          x: node.transform.x + offset,
          y: node.transform.y + offset,
        },
      };

      addNode(newNode);
      newIds.push(newId);
    });

    // 选中新粘贴的元素
    setActive(newIds);

    // 如果是剪切操作，粘贴后清除剪贴板（只能粘贴一次）
    if (clipboardData.type === 'cut') {
      clearClipboard();
    }

    console.log(`[Clipboard] 粘贴 ${newIds.length} 个元素`);
    return true;
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
    deleteNodes,
    setActive,
    toggleSelection,
    // 持久化相关
    initFromStorage,
    saveToStorage,
    clearStorage,
    // 复制/剪切/粘贴
    copySelected,
    cutSelected,
    paste,
    // UI 状态请使用 uiStore 中的 activePanel 和 isPanelExpanded
  };
});

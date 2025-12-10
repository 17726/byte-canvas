/**
 * @file canvasStore.ts
 * @description Canvas Store - 画布状态管理中心
 *
 * 职责：
 * 1. 管理所有节点数据（nodes）和渲染顺序（nodeOrder）
 * 2. 管理视口状态（zoom, offsetX, offsetY）
 * 3. 管理选中状态（activeElementIds）和组合编辑状态（editingGroupId）
 * 4. 提供节点的增删改查操作
 * 5. 处理复制/剪切/粘贴操作
 * 6. 管理本地存储的持久化
 *
 * 特点：
 * - 使用 Pinia 进行状态管理
 * - State/Node 分离：节点存储在 Record 中，渲染顺序单独维护
 * - 脏标记机制：version 字段追踪变更，优化重渲染
 * - 性能优化：使用 Set 管理选中状态，提高查找效率
 * - 自动保存：通过 debounce 实现自动保存到 LocalStorage
 * - 坐标转换：提供绝对坐标计算（支持嵌套组合）
 *
 * 包含状态：
 * - nodes: 节点字典（Record<id, NodeState>）
 * - nodeOrder: 渲染顺序数组
 * - version: 脏标记计数器
 * - viewport: 视口状态（zoom, offset, canvasSize）
 * - activeElementIds: 选中元素集合（Set）
 * - isInteracting: 交互锁（防止交互时触发自动保存）
 * - editingGroupId: 当前编辑的组合 ID
 *
 * 包含方法列表：
 * 节点操作：
 * - updateNode: 更新单个节点
 * - addNode: 添加节点到画布
 * - deleteNode: 删除单个节点
 * - deleteNodes: 批量删除节点
 *
 * 选中操作：
 * - setActive: 设置选中状态
 * - toggleSelection: 切换节点选中状态
 *
 * 持久化操作：
 * - initFromStorage: 从 LocalStorage 加载
 * - saveToStorage: 保存到 LocalStorage
 * - clearStorage: 清空 LocalStorage
 *
 * 剪贴板操作：
 * - copySelected: 复制选中节点
 * - cutSelected: 剪切选中节点
 * - paste: 粘贴节点
 *
 * 辅助方法：
 * - getAbsoluteTransform: 计算节点的绝对坐标
 * - getSelectionBounds: 计算选中节点的包围盒
 *
 * 计算属性：
 * - renderList: 按顺序的可渲染节点列表
 * - activeElements: 选中的节点列表
 * - visibleRenderList: 可见的节点列表（过滤不可见节点）
 * - canGroup: 是否可以组合选中节点
 * - canUngroup: 是否可以解散选中节点
 */

// stores/canvasStore.ts
import { defineStore } from 'pinia';
import { ref, reactive, computed, watch, readonly } from 'vue';
import type { NodeState, ShapeState, TextState, ImageState, ViewportState } from '@/types/state';
import { NodeType } from '@/types/state';
import { DEFAULT_VIEWPORT } from '@/config/defaults';
import { calculateBounds } from '@/core/utils/geometry';
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

/**
 * Canvas Store
 *
 * 管理整个编辑器的核心状态，包括节点、渲染顺序、视口、交互状态等
 */
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

  // ==================== 组合编辑状态 ====================
  // 当前正在编辑的组合 ID（双击组合进入编辑模式）
  const editingGroupId = ref<string | null>(null);

  // ==================== 创建工具状态 ====================
  // 当前激活的创建工具（类似 Figma 的工具选择）
  const creationTool = ref<import('@/types/editor').CanvasToolType>('select');
  // 创建工具选项（如图片URL等）
  const creationToolOptions = ref<import('@/types/editor').CreationToolOptions>({});
  // 预览节点（Ghost Node，用于拖拽创建时的半透明预览）
  const previewNode = ref<NodeState | null>(null);

  // ==================== 历史记录（Undo/Redo） ====================
  type CanvasSnapshot = {
    nodes: Record<string, NodeState>;
    nodeOrder: string[];
    viewport: ViewportState;
    activeElementIds: string[];
    editingGroupId: string | null;
  };

  const historyStack = ref<CanvasSnapshot[]>([]);
  const redoStack = ref<CanvasSnapshot[]>([]);
  const MAX_HISTORY = 50;
  let isRestoringSnapshot = false;
  let isHistoryLocked = false;

  const canUndo = computed(() => historyStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  const createSnapshot = (): CanvasSnapshot => ({
    nodes: cloneDeep(nodes.value),
    nodeOrder: [...nodeOrder.value],
    viewport: { ...(viewport as ViewportState) },
    activeElementIds: Array.from(activeElementIds.value),
    editingGroupId: editingGroupId.value,
  });

  const pushSnapshot = () => {
    if (isRestoringSnapshot || isHistoryLocked) return;
    historyStack.value.push(createSnapshot());
    if (historyStack.value.length > MAX_HISTORY) {
      historyStack.value.shift();
    }
    redoStack.value = [];
  };

  /**
   * 批量操作时锁定历史记录，避免重复记录快照
   * 使用方式：
   * const unlock = lockHistory();
   * // ... 批量操作
   * unlock();
   */
  const lockHistory = () => {
    const wasLocked = isHistoryLocked;
    if (!wasLocked) {
      pushSnapshot(); // 在锁定前记录一次快照
      isHistoryLocked = true;
    }
    return () => {
      if (!wasLocked) {
        isHistoryLocked = false;
      }
    };
  };

  /**
   * 锁定历史记录但不记录快照（用于自动操作，如调整组合边界）
   * 使用方式：
   * const unlock = lockHistoryWithoutSnapshot();
   * // ... 自动操作
   * unlock();
   */
  const lockHistoryWithoutSnapshot = () => {
    const wasLocked = isHistoryLocked;
    if (!wasLocked) {
      isHistoryLocked = true;
    }
    return () => {
      if (!wasLocked) {
        isHistoryLocked = false;
      }
    };
  };

  const restoreSnapshot = (snapshot: CanvasSnapshot) => {
    isRestoringSnapshot = true;
    nodes.value = cloneDeep(snapshot.nodes);
    nodeOrder.value = [...snapshot.nodeOrder];
    Object.assign(viewport, snapshot.viewport);
    activeElementIds.value = new Set(snapshot.activeElementIds);
    editingGroupId.value = snapshot.editingGroupId;
    version.value++; // 标记一次变更，触发依赖更新
    // 使用 queueMicrotask 延迟重置标志，确保所有响应式更新都完成后再重置
    // 这样可以避免在恢复快照后触发的异步响应式更新（如 watch 监听器）调用 updateNode 时记录快照
    queueMicrotask(() => {
      isRestoringSnapshot = false;
    });
  };

  const undo = () => {
    if (!historyStack.value.length) return false;
    const current = createSnapshot();
    const previous = historyStack.value.pop()!;
    redoStack.value.push(current);
    restoreSnapshot(previous);
    return true;
  };

  const redo = () => {
    if (!redoStack.value.length) return false;
    const current = createSnapshot();
    const next = redoStack.value.pop()!;
    historyStack.value.push(current);
    restoreSnapshot(next);
    return true;
  };

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

  /**
   * 批量更新多个节点（原子化操作）
   *
   * 特点：
   * - 只记录一次历史快照
   * - 只触发一次 version 更新
   * - 支持 props 深度合并
   *
   * 注意：
   * - transform/style 等嵌套对象不会自动合并，调用方需要预先合并
   * - 示例：updates[id] = { style: { ...node.style, opacity: 0.5 } }
   *
   * @param updates - 节点更新映射 { nodeId: patch }
   */
  function batchUpdateNodes(updates: Record<string, Partial<NodeState>>): void {
    if (Object.keys(updates).length === 0) return;

    // 非交互态下，记录快照以支持撤销（只记录一次）
    if (!isInteracting.value && !isRestoringSnapshot && !isHistoryLocked) {
      pushSnapshot();
    }

    // 遍历所有更新
    Object.entries(updates).forEach(([id, patch]) => {
      const node = nodes.value[id];
      if (!node) return;

      // 处理 props 的深度合并（复用 updateNode 的逻辑）
      if ('props' in patch && patch.props) {
        const currentNode = node as NodeState & { props?: Record<string, unknown> };
        const patchProps = patch.props as Record<string, unknown>;

        currentNode.props = {
          ...(currentNode.props as Record<string, unknown>),
          ...patchProps,
        };

        // 合并除 props 外的其他属性
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { props, ...rest } = patch as Partial<ShapeState | TextState | ImageState>;
        Object.assign(node, rest);
      } else {
        // 普通更新
        Object.assign(node, patch);
      }
    });

    // 批量更新完成后，只触发一次版本更新
    version.value++;
  }

  // 1. 更新节点
  /**
   * 更新节点：强制合并 props（浅合并）以避免覆盖未传入的值
   * @param id 要更新的节点 ID
   * @param patch 部分更新对象（允许对 transform/style/props 单独合并）
   */
  function updateNode(id: string, patch: Partial<NodeState>) {
    const node = nodes.value[id];
    if (!node) return;

    // 非交互态下，记录快照以支持撤销
    // 但如果正在恢复快照或历史锁定，则跳过（避免撤销时重复记录）
    if (!isInteracting.value && !isRestoringSnapshot && !isHistoryLocked) {
      pushSnapshot();
    }

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
    // 如果刚结束交互（isInteracting 刚变为 false），说明交互开始时的快照已经记录了
    // 此时不应该再记录快照，避免重复记录
    // 使用 lockHistoryWithoutSnapshot 来防止在添加节点后可能触发的 updateNode 记录快照
    const unlockHistory = lockHistoryWithoutSnapshot();

    // 只有在非交互状态下才记录快照
    // 如果 isInteracting 为 true，说明交互开始时的 watch 已经记录了快照
    if (!isInteracting.value) {
      pushSnapshot();
    }

    nodes.value[node.id] = node;
    nodeOrder.value.push(node.id);
    version.value++; // 触发更新

    // 解锁历史记录
    unlockHistory();
  }

  // 3. 删除节点（如果是组合，递归删除所有子节点）
  function deleteNode(id: string) {
    const wasLocked = isHistoryLocked;
    if (!wasLocked) {
      pushSnapshot();
      isHistoryLocked = true; // 避免递归删除时重复记录
    }
    const node = nodes.value[id];
    if (!node) return;

    // 如果是组合节点，先递归删除所有子节点
    if (node.type === NodeType.GROUP) {
      const groupNode = node as import('@/types/state').GroupState;
      groupNode.children.forEach((childId) => {
        deleteNode(childId); // 递归删除子节点
      });
    }

    delete nodes.value[id];
    nodeOrder.value = nodeOrder.value.filter((nId) => nId !== id);
    activeElementIds.value.delete(id); // 清除选中态

    // 如果正在编辑这个组合，退出编辑模式
    if (editingGroupId.value === id) {
      editingGroupId.value = null;
    }

    version.value++; // 触发更新

    if (!wasLocked) {
      isHistoryLocked = false;
    }
  }

  // 4. 批量删除节点（仅触发一次 version 更新）
  // 注意：如果包含组合，会递归删除其子节点
  function deleteNodes(ids: string[]) {
    if (ids.length === 0) return;
    pushSnapshot();
    const idsToDelete = ids.filter((id) => nodes.value[id]);
    if (idsToDelete.length === 0) return;

    // 收集所有需要删除的节点（包括组合的子节点）
    const allIdsToDelete = new Set<string>();

    function collectIds(id: string) {
      const node = nodes.value[id];
      if (!node) return;
      allIdsToDelete.add(id);

      // 如果是组合，递归收集子节点
      if (node.type === NodeType.GROUP) {
        const groupNode = node as import('@/types/state').GroupState;
        groupNode.children.forEach((childId) => collectIds(childId));
      }
    }

    idsToDelete.forEach((id) => collectIds(id));

    // 批量删除节点
    allIdsToDelete.forEach((id) => {
      delete nodes.value[id];
      activeElementIds.value.delete(id);

      // 如果正在编辑这个组合，退出编辑模式
      if (editingGroupId.value === id) {
        editingGroupId.value = null;
      }
    });

    // 一次性过滤 nodeOrder
    nodeOrder.value = nodeOrder.value.filter((nId) => !allIdsToDelete.has(nId));

    // 仅触发一次版本更新
    version.value++;
  }

  function setActive(ids: string[]) {
    // activeElementIds：获取当前选中的 Set（避免重复创建）
    const currentActiveSet = activeElementIds.value;
    //预处理新 ids：去重 + 验证有效性（复用 nodes 字典，过滤无效节点 ID）
    const validNewIds = [...new Set(ids)].filter((id) => nodes.value[id]); // 只保留存在的节点 ID

    // 核心：对比新/旧 Set 内容是否一致（复用 currentActiveSet，无需额外创建）
    const isContentSame =
      validNewIds.length === currentActiveSet.size &&
      validNewIds.every((id) => currentActiveSet.has(id));

    // 只有内容不同 + 非交互锁时，才执行更新（避免无意义的响应式触发）
    if (!isContentSame && !isInteracting.value) {
      //直接替换为新 Set（保持原有 Set 性能优化）
      activeElementIds.value = new Set(validNewIds);
      //Node 改动时更新脏标记（符合现有设计逻辑）
      version.value++;
    }
  }

  function toggleSelection(id: string) {
    if (activeElementIds.value.has(id)) {
      activeElementIds.value.delete(id);
    } else {
      activeElementIds.value.add(id);
    }
  }

  // ==================== 创建工具操作 ====================
  /**
   * 设置当前创建工具
   * @param tool 工具类型
   * @param options 工具选项（如图片URL）
   */
  function setCreationTool(
    tool: import('@/types/editor').CanvasToolType,
    options?: import('@/types/editor').CreationToolOptions
  ) {
    creationTool.value = tool;
    creationToolOptions.value = options || {};
  }

  /**
   * 设置预览节点（Ghost Node）
   * @param node 预览节点数据，传 null 清空
   */
  function setPreviewNode(node: NodeState | null) {
    previewNode.value = node;
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
    historyStack.value = [];
    redoStack.value = [];
    pushSnapshot(); // 初始化快照，保证首次撤销可返回到加载状态
    return true;
  }

  /**
   * 手动保存当前状态到 localStorage
   */
  function saveToStorage() {
    debouncedSave.save(nodes.value, nodeOrder.value, viewport as ViewportState);
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
    historyStack.value = [];
    redoStack.value = [];
    console.log('[CanvasStore] 画布已重置');
  }

  // 统一监听持久化条件：version 变化 + 交互状态 + 视口变化
  // 保存时机：
  // 1. version 变化且非交互状态时立即保存
  // 2. 交互结束时（isInteracting: true -> false）保存
  // 3. 视口状态变化时保存（zoom, offsetX, offsetY）
  watch(
    () => ({
      version: version.value,
      interacting: isInteracting.value,
      // 监听视口核心属性变化
      zoom: viewport.zoom,
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY,
    }),
    (newState, oldState) => {
      const versionChanged = newState.version !== oldState?.version;
      const interactionEnded = oldState?.interacting === true && newState.interacting === false;
      const viewportChanged =
        newState.zoom !== oldState?.zoom ||
        newState.offsetX !== oldState?.offsetX ||
        newState.offsetY !== oldState?.offsetY;

      // 交互结束时保存（无论 version 是否变化）
      if (interactionEnded) {
        saveToStorage();
        return;
      }

      // version 变化或视口变化，且非交互状态时保存
      if ((versionChanged || viewportChanged) && !newState.interacting) {
        saveToStorage();
      }
    }
  );

  // 记录交互开始时的快照（如拖拽/旋转/缩放）
  watch(
    () => isInteracting.value,
    (next, prev) => {
      if (next && !prev) {
        pushSnapshot();
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
    const prevLock = isHistoryLocked;
    pushSnapshot(); // 记录粘贴前的状态
    isHistoryLocked = true; // 避免循环内的 addNode 反复写入历史

    /**
     * 深拷贝组合及其所有子节点，生成全新的 ID 和 parentId 关系
     * 关键：避免两个组合共享同一批子节点，导致缩放/移动互相影响
     *
     * 修复：从剪贴板节点映射中读取，而不是从当前画布状态读取
     */
    // 先构建剪贴板节点的 ID 映射，方便查找
    const clipboardNodeMap = new Map<string, NodeState>();
    clipboardData.nodes.forEach((n) => {
      clipboardNodeMap.set(n.id, n);
    });

    const cloneGroupWithChildren = (sourceNode: NodeState, rootOffset: number): string | null => {
      if (sourceNode.type !== NodeType.GROUP) return null;

      const idMap = new Map<string, string>();

      const cloneNodeRecursive = (original: NodeState, parentNewId: string | null) => {
        if (!original) return;

        const newId = uuidv4();
        idMap.set(original.id, newId);

        const isGroup = original.type === NodeType.GROUP;

        // 仅对根组合应用粘贴偏移，子节点保持相对坐标不变
        const shouldApplyOffset = parentNewId === null;

        const clonedNode: NodeState = {
          // 使用深拷贝，避免共享引用（如 props / style）
          ...(cloneDeep(original) as NodeState),
          id: newId,
          parentId: parentNewId,
          transform: {
            ...original.transform,
            x: original.transform.x + (shouldApplyOffset ? rootOffset : 0),
            y: original.transform.y + (shouldApplyOffset ? rootOffset : 0),
          },
        };

        // 先占位 children，等递归完子节点后再用新 ID 列表覆盖
        if (isGroup) {
          (clonedNode as import('@/types/state').GroupState).children = [];
        }

        addNode(clonedNode);

        if (isGroup) {
          const origGroup = original as import('@/types/state').GroupState;
          const newChildren: string[] = [];
          origGroup.children.forEach((childOrigId) => {
            // 从剪贴板映射中查找子节点
            const childNode = clipboardNodeMap.get(childOrigId);
            if (childNode) {
              cloneNodeRecursive(childNode, newId);
              const mappedId = idMap.get(childOrigId);
              if (mappedId) newChildren.push(mappedId);
            }
          });
          (nodes.value[newId] as import('@/types/state').GroupState).children = newChildren;
        }
      };

      cloneNodeRecursive(sourceNode, null);
      return idMap.get(sourceNode.id) ?? null;
    };

    clipboardData.nodes.forEach((node) => {
      // 情况1：普通节点（矩形/圆形/文本/图片）——保持原有逻辑
      if (node.type !== NodeType.GROUP) {
        const newId = uuidv4();
        const newNode: NodeState = {
          ...node,
          id: newId,
          transform: {
            ...node.transform,
            x: node.transform.x + offset,
            y: node.transform.y + offset,
          },
        };

        addNode(newNode);
        newIds.push(newId);
        return;
      }

      // 情况2：组合节点 —— 深拷贝整棵子树，避免共享子节点
      const rootNewId = cloneGroupWithChildren(node, offset);
      if (rootNewId) {
        newIds.push(rootNewId);
      }
    });

    // 选中新粘贴的元素
    setActive(newIds);

    // 如果是剪切操作，粘贴后清除剪贴板（只能粘贴一次）
    if (clipboardData.type === 'cut') {
      clearClipboard();
    }

    console.log(`[Clipboard] 粘贴 ${newIds.length} 个元素`);
    isHistoryLocked = prevLock;
    return true;
  }

  // ==================== 选中部分文本编辑属性功能 ====================

  // 关键修改：用 ref 包裹，创建响应式状态（组合式API核心）
  // ref(null) 表示初始值为 null，泛型指定类型
  const globalTextSelection = ref<{ start: number; end: number } | null>(null);

  // 新增：更新全局选区（供文本组件调用）
  function updateGlobalTextSelection(selection: { start: number; end: number } | null) {
    // 响应式 ref 需通过 .value 赋值
    console.log('触发updateGlobalTextSelection', selection);
    globalTextSelection.value = selection;
    console.log('Pinia 全局选区更新：', selection); // 调试日志（可选）
  }
  // ==================== 组合相关状态（只读计算属性）====================

  /**
   * 获取可渲染的节点列表
   * 始终只渲染顶层节点（parentId为null的节点）
   * 组合编辑模式通过 GroupLayer 内部处理，不影响渲染结构
   */
  const visibleRenderList = computed(() => {
    return nodeOrder.value
      .map((id) => nodes.value[id])
      .filter((node) => node && node.parentId === null);
  });

  /**
   * 检查选中的元素是否可以组合（UI状态）
   */
  const canGroup = computed(() => {
    const ids = Array.from(activeElementIds.value);
    if (ids.length < 2) return false;
    return ids.every((id) => nodes.value[id]);
  });

  /**
   * 检查选中的元素是否可以解组合（UI状态）
   */
  const canUngroup = computed(() => {
    const ids = Array.from(activeElementIds.value);
    return ids.some((id) => {
      const node = nodes.value[id];
      return node && node.type === NodeType.GROUP;
    });
  });

  /**
   * 获取节点的绝对坐标（考虑父组合的位置）
   * 注意：此方法只累加平移，不考虑旋转。如需考虑旋转，请使用 getAbsoluteTransformWithRotation
   */
  function getAbsoluteTransform(
    nodeId: string
  ): { x: number; y: number; width: number; height: number; rotation: number } | null {
    const node = nodes.value[nodeId];
    if (!node) return null;

    let absoluteX = node.transform.x;
    let absoluteY = node.transform.y;
    let currentNode = node;

    // 遍历父链，累加所有父组合的偏移
    while (currentNode.parentId) {
      const parent = nodes.value[currentNode.parentId];
      if (!parent) break;
      absoluteX += parent.transform.x;
      absoluteY += parent.transform.y;
      currentNode = parent;
    }

    return {
      x: absoluteX,
      y: absoluteY,
      width: node.transform.width,
      height: node.transform.height,
      rotation: node.transform.rotation,
    };
  }

  /**
   * 获取节点的绝对坐标和旋转角度（考虑所有父组合的旋转和平移）
   * 递归遍历父链，从内到外逐层应用变换
   */
  function getAbsoluteTransformWithRotation(
    nodeId: string
  ): { x: number; y: number; width: number; height: number; rotation: number } | null {
    const node = nodes.value[nodeId];
    if (!node) return null;

    // 收集所有父组合（从直接父组合到最外层）
    const parentChain: NodeState[] = [];
    let currentNode: NodeState | undefined = node;

    while (currentNode?.parentId) {
      const parentNode = nodes.value[currentNode.parentId];
      if (!parentNode || parentNode.type !== NodeType.GROUP) break;
      parentChain.push(parentNode);
      currentNode = parentNode;
    }

    // 保存子元素的尺寸（在整个转换过程中不变）
    const childWidth = node.transform.width;
    const childHeight = node.transform.height;

    // 从子节点开始，逐层向上应用变换
    // 初始坐标是相对于直接父组合的（子元素左上角）
    let x = node.transform.x;
    let y = node.transform.y;
    // 初始旋转角度是子元素自身的旋转角度
    let rotation = node.transform.rotation || 0;

    // 从内到外遍历父链，累加所有父组合的旋转角度
    for (const parent of parentChain) {
      const parentRotation = parent.transform.rotation || 0;
      rotation += parentRotation; // 累加父组合的旋转角度

      const parentX = parent.transform.x;
      const parentY = parent.transform.y;
      const parentWidth = parent.transform.width;
      const parentHeight = parent.transform.height;
      const parentCenterX = parentWidth / 2;
      const parentCenterY = parentHeight / 2;

      if (parentRotation === 0) {
        // 无旋转：直接累加平移
        x += parentX;
        y += parentY;
      } else {
        // 有旋转：旋转中心是父组合的中心点
        // 当前 x, y 是子元素左上角相对于父组合左上角的坐标
        // 计算子元素中心点相对于父组合左上角的坐标
        const childCenterLocalX = x + childWidth / 2;
        const childCenterLocalY = y + childHeight / 2;

        // 转换为相对于父组合中心的坐标
        const relativeX = childCenterLocalX - parentCenterX;
        const relativeY = childCenterLocalY - parentCenterY;

        // 应用旋转矩阵
        const rad = (parentRotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const rotatedX = relativeX * cos - relativeY * sin;
        const rotatedY = relativeX * sin + relativeY * cos;

        // 计算子元素中心在世界坐标系中的位置（或相对于更上层父组合的坐标）
        const childCenterWorldX = parentX + parentCenterX + rotatedX;
        const childCenterWorldY = parentY + parentCenterY + rotatedY;

        // 从中心反算左上角坐标
        x = childCenterWorldX - childWidth / 2;
        y = childCenterWorldY - childHeight / 2;
      }
    }

    // 归一化旋转角度到 -180 ~ +180° 范围
    rotation = rotation % 360;
    if (rotation > 180) {
      rotation -= 360;
    } else if (rotation < -180) {
      rotation += 360;
    }

    return {
      x,
      y,
      width: childWidth,
      height: childHeight,
      rotation,
    };
  }

  /**
   * 获取选中节点的边界框（供UI使用，使用绝对坐标）
   */
  function getSelectionBounds(nodeIds: string[]) {
    // 创建一个使用绝对坐标的虚拟节点映射
    const absoluteNodes: Record<
      string,
      { transform: { x: number; y: number; width: number; height: number; rotation: number } }
    > = {};

    nodeIds.forEach((id) => {
      const absTransform = getAbsoluteTransform(id);
      if (absTransform) {
        absoluteNodes[id] = { transform: absTransform };
      }
    });

    return calculateBounds(
      absoluteNodes as Record<string, import('@/types/state').BaseNodeState>,
      nodeIds
    );
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
    globalTextSelection,
    // 节点操作
    updateNode,
    batchUpdateNodes,
    addNode,
    deleteNode,
    deleteNodes,
    setActive,
    toggleSelection,
    // 持久化相关
    initFromStorage,
    saveToStorage,
    clearStorage,
    // 历史记录
    undo,
    redo,
    canUndo,
    canRedo,
    // 仅供调试使用(undo/redo栈)
    historyStack: readonly(historyStack),
    redoStack: readonly(redoStack),
    // 复制/剪切/粘贴
    copySelected,
    cutSelected,
    paste,
    // 组合相关状态（只读）
    editingGroupId,
    visibleRenderList,
    canGroup,
    canUngroup,
    getSelectionBounds,
    getAbsoluteTransform,
    getAbsoluteTransformWithRotation,
    // UI 状态请使用 uiStore 中的 activePanel 和 isPanelExpanded
    updateGlobalTextSelection,
    // 批量操作支持
    lockHistory,
    lockHistoryWithoutSnapshot,
    // 创建工具相关
    creationTool,
    creationToolOptions,
    previewNode,
    setCreationTool,
    setPreviewNode,
  };
});

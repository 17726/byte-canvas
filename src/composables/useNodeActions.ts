/**
 * @file useNodeActions.ts
 * @description 节点操作 Composable - 封装所有节点操作逻辑和 UI 反馈
 *
 * 职责：
 * 1. 封装节点的增删改查操作
 * 2. 提供统一的 UI 反馈（Notification）
 * 3. 简化组件中的业务逻辑
 * 4. 提供可复用的节点操作方法
 *
 * 包含方法：
 * - deleteSelected: 删除选中节点
 * - copy: 复制选中节点
 * - cut: 剪切选中节点
 * - paste: 粘贴节点
 * - groupSelected: 组合选中节点
 * - ungroupSelected: 取消组合
 * - bringToFront: 图层置顶
 * - sendToBack: 图层置底
 * - selectAll: 全选
 * - clearSelection: 取消选择
 * - clearCanvas: 清空画布
 *
 * 包含计算属性：
 * - hasSelection: 是否有选中节点
 * - canGroup: 是否可以组合
 * - canUngroup: 是否可以取消组合
 */

import { computed, nextTick } from 'vue';
import { useCanvasStore } from '@/store/canvasStore';
import { useHistoryStore } from '@/store/historyStore';
import { useSelectionStore } from '@/store/selectionStore';
import { GroupService } from '@/core/services/GroupService';
import { Notification } from '@arco-design/web-vue';

export function useNodeActions() {
  const store = useCanvasStore();
  const historyStore = useHistoryStore();
  const selectionStore = useSelectionStore();

  // ==================== 计算属性 ====================

  /**
   * 是否有选中节点
   */
  const hasSelection = computed(() => selectionStore.activeElementIds.size > 0);

  /**
   * 是否可以组合（至少选中 2 个节点）
   */
  const canGroup = computed(() => GroupService.canGroup(store));

  /**
   * 是否可以取消组合（选中的节点中包含组合）
   */
  const canUngroup = computed(() => GroupService.canUngroup(store));
  const canUndo = computed(() => historyStore.canUndo);
  const canRedo = computed(() => historyStore.canRedo);

  // ==================== 节点操作方法 ====================
  const undo = () => historyStore.undo();
  const redo = () => historyStore.redo();

  /**
   * 删除选中的节点
   */
  function deleteSelected(): boolean {
    if (!hasSelection.value) {
      Notification.warning({
        content: '请先选择要删除的元素',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    const selectedIds = Array.from(selectionStore.activeElementIds);
    selectedIds.forEach((id) => store.deleteNode(id));

    Notification.success({
      content: '删除成功',
      closable: true,
      duration: 2000,
    });

    return true;
  }

  /**
   * 复制选中的节点
   */
  function copy(): boolean {
    if (!hasSelection.value) {
      Notification.warning({
        content: '请先选择要复制的元素',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    const success = store.copySelected();

    if (success) {
      Notification.success({
        content: '已复制到剪贴板',
        closable: true,
        duration: 2000,
      });
    }

    return success;
  }

  /**
   * 剪切选中的节点
   */
  function cut(): boolean {
    if (!hasSelection.value) {
      Notification.warning({
        content: '请先选择要剪切的元素',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    const success = store.cutSelected();

    if (success) {
      Notification.success({
        content: '已剪切到剪贴板',
        closable: true,
        duration: 2000,
      });
    }

    return success;
  }

  /**
   * 粘贴节点
   */
  function paste(): boolean {
    const success = store.paste();

    if (success) {
      Notification.success({
        content: '粘贴成功',
        closable: true,
        duration: 2000,
      });
    } else {
      Notification.warning({
        content: '剪贴板为空',
        closable: true,
        duration: 2000,
      });
    }

    return success;
  }

  /**
   * 组合选中的节点
   */
  function groupSelected(): boolean {
    if (!hasSelection.value) {
      Notification.warning({
        content: '请先选择要组合的元素',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    if (selectionStore.activeElementIds.size < 2) {
      Notification.warning({
        content: '至少需要选择两个元素才能进行组合',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    // 检查是否可以组合
    if (!GroupService.canGroup(store)) {
      Notification.warning({
        content: '当前选中的元素无法组合',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    const groupId = GroupService.groupSelected(store);

    if (groupId) {
      Notification.success({
        content: '组合成功',
        closable: true,
        duration: 2000,
      });
      return true;
    }

    return false;
  }

  /**
   * 取消组合
   */
  function ungroupSelected(): boolean {
    if (!hasSelection.value) {
      Notification.warning({
        content: '请先选择要取消组合的元素',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    if (!canUngroup.value) {
      Notification.warning({
        content: '选中的元素中没有组合',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    const ungroupedIds = GroupService.ungroupSelected(store);

    if (ungroupedIds.length > 0) {
      Notification.success({
        content: '已取消组合',
        closable: true,
        duration: 2000,
      });
      return true;
    }

    return false;
  }

  /**
   * 图层置顶
   */
  function bringToFront(): boolean {
    if (!hasSelection.value) {
      Notification.warning({
        content: '请先选择要置顶的元素',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    const selectedIds = Array.from(selectionStore.activeElementIds);

    // 过滤掉不在 nodeOrder 中的 ID（可能是子节点）。
    // 也可能是新添加但未加入 nodeOrder 的节点。更明确地检查 parent 属性。
    const validIds = selectedIds.filter((id) => {
      const node = store.nodes[id];
      // 只允许顶层节点（parent 为 null 或 undefined），且在 nodeOrder 中
      return (
        store.nodeOrder.includes(id) ||
        (node && (node.parentId === null || node.parentId === undefined))
      );
    });

    if (validIds.length === 0) {
      Notification.warning({
        content: '所选元素无法置顶',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    // 从 nodeOrder 中移除这些 ID，然后添加到末尾（末尾表示最上层）
    const otherIds = store.nodeOrder.filter((id) => !validIds.includes(id));
    store.nodeOrder = [...otherIds, ...validIds];

    // 触发更新
    store.version++;

    Notification.success({
      content: '已置于顶层',
      closable: true,
      duration: 2000,
    });

    return true;
  }

  /**
   * 图层置底
   */
  function sendToBack(): boolean {
    if (!hasSelection.value) {
      Notification.warning({
        content: '请先选择要置底的元素',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    const selectedIds = Array.from(selectionStore.activeElementIds);

    // 过滤掉不在 nodeOrder 中的 ID（可能是子节点）
    const validIds = selectedIds.filter((id) => store.nodeOrder.includes(id));

    if (validIds.length === 0) {
      Notification.warning({
        content: '所选元素无法置底',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    // 从 nodeOrder 中移除这些 ID，然后添加到开头（开头表示最底层）
    const otherIds = store.nodeOrder.filter((id) => !validIds.includes(id));
    store.nodeOrder = [...validIds, ...otherIds];

    // 触发更新
    store.version++;

    Notification.success({
      content: '已置于底层',
      closable: true,
      duration: 2000,
    });

    return true;
  }

  /**
   * 全选（选中所有非锁定节点）
   */
  function selectAll(): boolean {
    const allNodeIds = store.nodeOrder.filter((id) => {
      const node = store.nodes[id];
      return node && !node.isLocked;
    });

    if (allNodeIds.length === 0) {
      Notification.warning({
        content: '画布中没有可选择的元素',
        closable: true,
        duration: 2000,
      });
      return false;
    }

    selectionStore.setActive(allNodeIds);

    Notification.success({
      content: '已全选',
      closable: true,
      duration: 2000,
    });

    return true;
  }

  /**
   * 取消选择
   */
  function clearSelection(): boolean {
    if (!hasSelection.value) {
      return false;
    }

    selectionStore.clearSelection();

    Notification.success({
      content: '已取消选择',
      closable: true,
      duration: 2000,
    });

    return true;
  }

  /**
   * 清空画布
   */
  async function clearCanvas(): Promise<void> {
    for (let i = store.nodeOrder.length - 1; i >= 0; --i) {
      const nodeId = store.nodeOrder[i];
      const node = store.nodes[nodeId!];
      if (node && !node.isLocked) store.deleteNode(nodeId!);
    }

    //等 DOM 重绘
    await nextTick();

    Notification.success({
      content: '已清空画布',
      closable: true,
      duration: 2000,
    });
  }

  // ==================== 导出 ====================

  return {
    // 计算属性
    hasSelection,
    canGroup,
    canUngroup,
    canUndo,
    canRedo,

    // 操作方法
    undo,
    redo,
    deleteSelected,
    copy,
    cut,
    paste,
    groupSelected,
    ungroupSelected,
    bringToFront,
    sendToBack,
    selectAll,
    clearSelection,
    clearCanvas,
  };
}

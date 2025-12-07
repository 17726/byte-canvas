/**
 * @file GroupService.ts
 * @description 组合管理服务 - 处理节点组合的所有业务逻辑
 *
 * 职责：
 * 1. 创建和解散节点组合
 * 2. 管理组合编辑模式的进入和退出
 * 3. 自动调整组合边界以适应子元素
 * 4. 同步组合样式到子节点
 *
 * 特点：
 * - 无状态服务：所有方法为静态方法，接收 store 作为参数
 * - 纯业务逻辑：不涉及 UI 交互或事件处理（区别于 Handler）
 * - 支持嵌套组合：可以在组合内部创建子组合
 * - 坐标转换：自动处理绝对坐标与相对坐标的转换
 * - 类型安全：严格的 TypeScript 类型定义
 *
 * 包含方法列表：
 * - groupSelected: 将选中的元素组合成一个组
 * - ungroupSelected: 解散选中的组合节点
 * - enterGroupEdit: 进入组合编辑模式
 * - exitGroupEdit: 退出组合编辑模式
 * - expandGroupToFitChildren: 调整组合边界以精确适应所有子元素
 * - canGroup: 检查选中的元素是否可以组合
 * - canUngroup: 检查选中的元素是否可以解组合
 * - updateGroupStyle: 同步更新组合的样式到所有子节点
 */

import { v4 as uuidv4 } from 'uuid';
import { NodeType, type GroupState, type NodeState } from '@/types/state';
import type { useCanvasStore } from '@/store/canvasStore';

type CanvasStore = ReturnType<typeof useCanvasStore>;

/**
 * 组合管理服务类
 *
 * 提供与组合操作相关的所有静态方法
 */
export class GroupService {
  /**
   * 将选中的元素组合成一个组
   *
   * 支持嵌套组合：可以将已有的组合元素与其他元素一起组合。
   * 在组合编辑模式下，新组合会成为当前编辑组合的子节点。
   *
   * @param store - Canvas Store 实例
   * @returns 新创建的组合 ID，失败时返回 null
   */
  static groupSelected(store: CanvasStore): string | null {
    const selectedIds = Array.from(store.activeElementIds);
    if (selectedIds.length < 2) {
      console.log('[Group] 需要至少选中2个元素才能组合');
      return null;
    }

    // 过滤掉不存在的节点
    const validIds = selectedIds.filter((id) => store.nodes[id]);
    if (validIds.length < 2) {
      console.log('[Group] 有效元素不足2个');
      return null;
    }

    // 组合编辑模式下完全禁止创建新的组合
    const editingGroupId = store.editingGroupId;
    if (editingGroupId) {
      console.warn('[Group] 组合编辑模式下禁止创建新的组合，请先退出组合编辑');
      return null;
    }

    // 计算组合的边界框（使用绝对坐标）
    const bounds = store.getSelectionBounds(validIds);

    // 锁定历史记录，避免在更新子节点时重复记录快照
    // 这样整个组合操作只会记录一次快照，撤销时一次性恢复到组合前的状态
    const unlockHistory = store.lockHistory();

    // 创建新的组合节点
    const groupId = uuidv4();
    const groupNode: GroupState = {
      id: groupId,
      type: NodeType.GROUP,
      name: 'Group',
      transform: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rotation: 0,
      },
      style: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderStyle: 'none',
        borderColor: 'transparent',
        opacity: 1,
        zIndex: 0,
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
      children: validIds,
    };

    // 更新子节点的parentId，并将坐标转换为相对于新组合的坐标
    validIds.forEach((id) => {
      const node = store.nodes[id];
      if (node) {
        // 获取节点的绝对坐标
        const absTransform = store.getAbsoluteTransform(id);
        const absX = absTransform ? absTransform.x : node.transform.x;
        const absY = absTransform ? absTransform.y : node.transform.y;

        // 使用 updateNode 确保响应式更新（此时不会记录快照，因为历史记录已锁定）
        store.updateNode(id, {
          parentId: groupId,
          transform: {
            ...node.transform,
            x: absX - bounds.x,
            y: absY - bounds.y,
          },
        });
      }
    });

    // 添加组合节点到nodes
    store.nodes[groupId] = groupNode;

    // 正常模式：更新nodeOrder
    const orderSet = new Set(validIds);
    const insertIndex = Math.min(
      ...validIds.map((id) => store.nodeOrder.indexOf(id)).filter((i) => i >= 0)
    );
    store.nodeOrder = store.nodeOrder.filter((id: string) => !orderSet.has(id));
    store.nodeOrder.splice(insertIndex, 0, groupId);

    // 选中新创建的组合
    store.setActive([groupId]);

    store.version++;

    // 解锁历史记录
    unlockHistory();

    console.log(`[Group] 创建组合 ${groupId}，包含 ${validIds.length} 个元素`);
    return groupId;
  }

  /**
   * 解散选中的组合节点
   *
   * 只解开最外层的组合，保留内部嵌套的组合结构。
   * 将子节点的相对坐标转换为绝对坐标。
   *
   * @param store - Canvas Store 实例
   * @returns 解组合后的子节点 ID 列表
   */
  static ungroupSelected(store: CanvasStore): string[] {
    const selectedIds = Array.from(store.activeElementIds);
    const ungroupedIds: string[] = [];

    selectedIds.forEach((id) => {
      const node = store.nodes[id];
      if (!node || node.type !== NodeType.GROUP) return;

      const groupNode = node as GroupState;
      const children = [...groupNode.children]; // 复制一份，避免修改原数组时出问题
      const isNested = groupNode.parentId !== null;

      // 恢复子节点的parentId和坐标
      children.forEach((childId) => {
        const child = store.nodes[childId];
        if (child) {
          // 使用 updateNode 确保响应式更新
          store.updateNode(childId, {
            parentId: groupNode.parentId,
            transform: {
              ...child.transform,
              // 将相对坐标转换：加上组合的偏移
              x: child.transform.x + groupNode.transform.x,
              y: child.transform.y + groupNode.transform.y,
            },
          });
          ungroupedIds.push(childId);
        }
      });

      if (isNested && groupNode.parentId) {
        // 如果组合是嵌套的，更新父组合的children数组
        const parentGroup = store.nodes[groupNode.parentId] as GroupState;
        if (parentGroup && parentGroup.type === NodeType.GROUP) {
          // 从父组合的children中移除当前组合，添加其子节点
          const newChildren = parentGroup.children.filter((cid: string) => cid !== id);
          newChildren.push(...children);
          parentGroup.children = newChildren;
        }
      } else {
        // 顶层组合：更新nodeOrder
        const groupIndex = store.nodeOrder.indexOf(id);
        if (groupIndex >= 0) {
          store.nodeOrder.splice(groupIndex, 1, ...children);
        }
      }

      // 删除组合节点
      delete store.nodes[id];

      // 无论是否嵌套，都确保从 nodeOrder 中移除该组合 ID，防止悬空引用
      const indexInOrder = store.nodeOrder.indexOf(id);
      if (indexInOrder >= 0) {
        store.nodeOrder.splice(indexInOrder, 1);
      }
    });

    if (ungroupedIds.length > 0) {
      // 选中解组合后的所有子节点
      store.setActive(ungroupedIds);
      store.version++;
      console.log(`[Ungroup] 解组合完成，释放 ${ungroupedIds.length} 个元素`);
    }

    return ungroupedIds;
  }

  /**
   * 进入组合编辑模式
   *
   * 进入后可以直接编辑组合内部的子节点，并支持嵌套组合创建。
   *
   * @param store - Canvas Store 实例
   * @param groupId - 要编辑的组合 ID
   * @returns true 表示成功进入，false 表示节点不存在或不是组合
   */
  static enterGroupEdit(store: CanvasStore, groupId: string): boolean {
    const node = store.nodes[groupId];
    if (!node || node.type !== NodeType.GROUP) {
      console.warn('[Group] 无法进入编辑模式：节点不存在或不是组合');
      return false;
    }

    store.editingGroupId = groupId;
    store.setActive([]); // 清空选中状态
    console.log(`[Group] 进入组合编辑模式: ${groupId}`);
    return true;
  }

  /**
   * 退出组合编辑模式
   *
   * 退出后会自动选中当前编辑的组合节点。
   *
   * @param store - Canvas Store 实例
   */
  static exitGroupEdit(store: CanvasStore): void {
    if (store.editingGroupId) {
      console.log(`[Group] 退出组合编辑模式: ${store.editingGroupId}`);
      // 选中当前编辑的组合
      store.setActive([store.editingGroupId]);
      store.editingGroupId = null;
    }
  }

  /**
   * 调整组合边界以精确适应所有子元素
   *
   * 支持扩展和收缩边界，考虑子元素旋转。
   * 在组合编辑模式下拖拽或缩放子节点后自动调用。
   *
   * @param store - Canvas Store 实例
   */
  static expandGroupToFitChildren(store: CanvasStore): void {
    const editingGroupId = store.editingGroupId;
    if (!editingGroupId) return;

    const groupNode = store.nodes[editingGroupId] as GroupState;
    if (!groupNode || groupNode.type !== NodeType.GROUP) return;

    const children = groupNode.children
      .map((id: string) => store.nodes[id])
      .filter((node): node is NodeState => Boolean(node));

    if (children.length === 0) return;

    // 计算所有子元素的边界（考虑旋转）
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
      const { x, y, width, height, rotation } = child.transform;

      if (rotation === 0) {
        // 无旋转：直接使用矩形边界
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
      } else {
        // 有旋转：计算旋转后四角的位置
        const cx = x + width / 2;
        const cy = y + height / 2;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const corners = [
          { x: x, y: y },
          { x: x + width, y: y },
          { x: x + width, y: y + height },
          { x: x, y: y + height },
        ];

        corners.forEach((corner) => {
          const dx = corner.x - cx;
          const dy = corner.y - cy;
          const rx = cx + dx * cos - dy * sin;
          const ry = cy + dx * sin + dy * cos;
          minX = Math.min(minX, rx);
          maxX = Math.max(maxX, rx);
          minY = Math.min(minY, ry);
          maxY = Math.max(maxY, ry);
        });
      }
    });

    // 计算新的组合边界
    const newBoundsWidth = maxX - minX;
    const newBoundsHeight = maxY - minY;
    const newGroupX = groupNode.transform.x + minX;
    const newGroupY = groupNode.transform.y + minY;

    // 检查是否需要调整（边界有变化）
    const eps = 0.01; // 浮点数容差
    const needsAdjust =
      Math.abs(minX) > eps ||
      Math.abs(minY) > eps ||
      Math.abs(newBoundsWidth - groupNode.transform.width) > eps ||
      Math.abs(newBoundsHeight - groupNode.transform.height) > eps;

    if (!needsAdjust) return;

    // 锁定历史记录但不记录快照，避免在调整组合边界时记录快照
    // 这个操作是自动的边界调整，不应该作为独立的操作记录到历史中
    // 交互开始时的快照已经记录了初始状态，这个自动调整不应该创建新的快照
    const unlockHistory = store.lockHistoryWithoutSnapshot();

    // 调整所有子元素的相对坐标（相对于新的组合原点）
    const offsetX = -minX;
    const offsetY = -minY;

    children.forEach((child) => {
      store.updateNode(child.id, {
        transform: {
          ...child.transform,
          x: child.transform.x + offsetX,
          y: child.transform.y + offsetY,
        },
      });
    });

    // 更新组合的位置和尺寸
    store.updateNode(editingGroupId, {
      transform: {
        ...groupNode.transform,
        x: newGroupX,
        y: newGroupY,
        width: newBoundsWidth,
        height: newBoundsHeight,
      },
    });

    // 解锁历史记录
    unlockHistory();

    console.log(`[Group] 调整组合边界: ${editingGroupId}`);
  }

  /**
   * 检查选中的元素是否可以组合
   *
   * 需要至少选中 2 个有效节点。
   *
   * @param store - Canvas Store 实例
   * @returns true 表示可以组合，false 表示不可以
   */
  static canGroup(store: CanvasStore): boolean {
    const ids = Array.from(store.activeElementIds);
    if (ids.length < 2) return false;
    const nodesExist = ids.every((id) => store.nodes[id]);
    if (!nodesExist) return false;

    // 组合编辑模式下不允许进行新的组合
    if (store.editingGroupId) return false;

    return true;
  }

  /**
   * 检查选中的元素是否可以解组合
   *
   * 需要至少选中一个组合节点。
   *
   * @param store - Canvas Store 实例
   * @returns true 表示可以解组合，false 表示不可以
   */
  static canUngroup(store: CanvasStore): boolean {
    const ids = Array.from(store.activeElementIds);
    return ids.some((id) => {
      const node = store.nodes[id];
      return node && node.type === NodeType.GROUP;
    });
  }

  /**
   * 更新组合样式并同步到所有子节点
   *
   * 目前仅同步 opacity 属性到子节点。
   *
   * @param store - Canvas Store 实例
   * @param groupId - 组合 ID
   * @param stylePatch - 要更新的样式属性
   */
  static updateGroupStyle(
    store: CanvasStore,
    groupId: string,
    stylePatch: Partial<GroupState['style']>
  ): void {
    const group = store.nodes[groupId] as GroupState;
    if (!group || group.type !== NodeType.GROUP) return;

    // 更新组合自身的样式
    group.style = { ...group.style, ...stylePatch };

    // 如果更新了opacity，同步到所有子节点
    if ('opacity' in stylePatch && stylePatch.opacity !== undefined) {
      const opacityValue = stylePatch.opacity;
      group.children.forEach((childId: string) => {
        const child = store.nodes[childId];
        if (child) {
          child.style = { ...child.style, opacity: opacityValue };
        }
      });
    }

    store.version++;
  }
}

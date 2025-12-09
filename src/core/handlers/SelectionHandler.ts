/**
 * @file SelectionHandler.ts
 * @description 框选处理器 - 处理画布框选交互
 *
 * 职责：
 * 1. 管理框选状态（起点、终点、进行中标记）
 * 2. 处理框选的启动、更新、结束逻辑
 * 3. 根据框选区域计算并选中节点
 * 4. 支持组合编辑模式下的分层选择
 *
 * 特点：
 * - 有状态处理器：维护框选相关的私有状态（区别于 GroupService）
 * - 智能选择：正常模式选顶层节点，编辑模式选当前组合的子节点
 * - 坐标转换：自动将屏幕坐标转换为世界坐标进行碰撞检测
 * - 过滤锁定：自动跳过锁定的节点
 * - 小区域判定：框选面积小于 4 像素时视为点击，取消所有选中
 *
 * 包含方法列表：
 * - constructor: 初始化处理器
 * - getBoxSelectState: 获取框选状态（供 Vue 组件使用）
 * - startBoxSelect: 开始框选
 * - updateBoxSelect: 更新框选终点
 * - finishBoxSelect: 结束框选并计算选中节点
 * - cancelBoxSelect: 取消框选
 * - reset: 重置所有框选状态
 */

import { isNodeHitRectSAT, containerToWorld, eventToContainer } from '@/core/utils/geometry';
import type { ViewportState, BaseNodeState } from '@/types/state';
import type { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';

type CanvasStore = ReturnType<typeof useCanvasStore>;

/**
 * 框选处理器类
 *
 * 负责处理画布上的框选交互逻辑
 */
export class SelectionHandler {
  private store: CanvasStore;
  private selectionStore: ReturnType<typeof useSelectionStore>;
  private stageEl: HTMLElement | null;

  // 框选状态
  private isBoxSelecting = false;
  private boxSelectStart = { x: 0, y: 0 };
  private boxSelectEnd = { x: 0, y: 0 };

  /**
   * 构造框选处理器
   *
   * @param store - Canvas Store 实例
   * @param stageEl - 画布根 DOM 元素，用于坐标转换
   */
  constructor(
    store: CanvasStore,
    stageEl: HTMLElement | null,
    selectionStore: ReturnType<typeof useSelectionStore> = useSelectionStore()
  ) {
    this.store = store;
    this.selectionStore = selectionStore;
    this.stageEl = stageEl;
  }

  /**
   * 获取框选状态
   *
   * 用于 Vue 组件渲染框选矩形
   *
   * @returns 包含 isBoxSelecting、boxSelectStart、boxSelectEnd 的状态对象
   */
  getBoxSelectState() {
    return {
      isBoxSelecting: this.isBoxSelecting,
      boxSelectStart: { ...this.boxSelectStart },
      boxSelectEnd: { ...this.boxSelectEnd },
    };
  }

  /**
   * 开始框选
   *
   * 记录框选起点并设置框选状态
   *
   * @param e - 鼠标事件
   */
  startBoxSelect(e: MouseEvent): void {
    this.isBoxSelecting = true;
    // 【修复】使用 eventToContainer 转换为容器坐标并存储
    const containerPos = eventToContainer(e, this.stageEl);
    this.boxSelectStart = { x: containerPos.x, y: containerPos.y };
    this.boxSelectEnd = { x: containerPos.x, y: containerPos.y };
  }

  /**
   * 更新框选终点
   *
   * 随鼠标移动更新框选区域
   *
   * @param e - 鼠标事件
   */
  updateBoxSelect(e: MouseEvent): void {
    if (!this.isBoxSelecting) return;
    // 【修复】使用 eventToContainer 转换为容器坐标
    const containerPos = eventToContainer(e, this.stageEl);
    this.boxSelectEnd = { x: containerPos.x, y: containerPos.y };
  }

  /**
   * 结束框选，计算并选中区域内的节点
   *
   * 将屏幕坐标转换为世界坐标，进行碰撞检测并更新选中状态。
   * 小于 4 像素的框选视为点击，会取消所有选中。
   */
  finishBoxSelect(): void {
    if (!this.isBoxSelecting) return;

    // 【修复】boxSelectStart/End 已在 start/update 中转换为容器坐标，直接使用
    const minContainerX = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
    const maxContainerX = Math.max(this.boxSelectStart.x, this.boxSelectEnd.x);
    const minContainerY = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
    const maxContainerY = Math.max(this.boxSelectStart.y, this.boxSelectEnd.y);

    // 判断是否为点击（框选面积过小）
    const boxArea = (maxContainerX - minContainerX) * (maxContainerY - minContainerY);
    if (boxArea < 4) {
      // 点击空白处：取消所有选中
      this.selectionStore.clearSelection();
      this.isBoxSelecting = false;
      return;
    }

    // 【修复】使用 containerToWorld 转换为世界坐标
    const viewport = this.store.viewport as ViewportState;
    const worldMin = containerToWorld(viewport, minContainerX, minContainerY);
    const worldMax = containerToWorld(viewport, maxContainerX, maxContainerY);

    // 计算被选中的节点
    const selectedIds: string[] = [];
    const editingGroupId = this.selectionStore.editingGroupId;

    Object.entries(this.store.nodes).forEach(([id, node]) => {
      const baseNode = node as BaseNodeState;

      // 跳过锁定的节点
      if (baseNode.isLocked) return;

      // 只选择当前层级的节点：
      // - 正常模式：只选择顶层节点 (parentId === null)
      // - 编辑模式：只选择当前编辑组合的直接子节点
      if (editingGroupId) {
        // 编辑模式：只选择编辑组合的子节点
        if (baseNode.parentId !== editingGroupId) return;
      } else {
        // 正常模式：只选择顶层节点
        if (baseNode.parentId !== null) return;
      }

      // 使用绝对坐标进行碰撞检测
      const absTransform = this.store.getAbsoluteTransform(id);
      if (!absTransform) return;

      // 创建一个使用绝对坐标的虚拟节点进行检测
      const nodeForHitTest = {
        ...baseNode,
        transform: absTransform,
      };

      if (isNodeHitRectSAT(worldMax.x, worldMax.y, worldMin.x, worldMin.y, nodeForHitTest)) {
        selectedIds.push(id);
      }
    });

    // 更新选中状态
    this.selectionStore.setActive(selectedIds);

    // 重置框选状态
    this.isBoxSelecting = false;
  }

  /**
   * 取消框选
   *
   * 结束框选状态但不更改选中状态
   */
  cancelBoxSelect(): void {
    this.isBoxSelecting = false;
  }

  /**
   * 重置框选状态
   *
   * 清空所有框选相关的状态
   */
  reset(): void {
    this.isBoxSelecting = false;
    this.boxSelectStart = { x: 0, y: 0 };
    this.boxSelectEnd = { x: 0, y: 0 };
  }

  /**
   * 计算选中节点的包围盒
   *
   * 用于多选区域拖拽等功能的边界判断
   *
   * @returns 包围盒信息（x, y, width, height），无选中节点时返回 null
   */
  getSelectedNodesBounds(): { x: number; y: number; width: number; height: number } | null {
    const activeIds = Array.from(this.selectionStore.activeElementIds);
    if (activeIds.length === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    activeIds.forEach((id) => {
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node) return;
      const { x, y, width, height } = node.transform;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * 判断点击位置是否在选中区域内（但不在任何具体节点上）
   *
   * 用于实现多选区域空白处拖拽功能
   *
   * @param e - 鼠标事件
   * @returns true 表示点击在选中区域空白处，false 表示不在或在具体节点上
   */
  isClickInSelectedArea(e: MouseEvent): boolean {
    const bounds = this.getSelectedNodesBounds();
    if (!bounds) return false;

    // 【修复】使用 eventToContainer + containerToWorld 替代手动计算
    const containerPos = eventToContainer(e, this.stageEl);
    const worldPos = containerToWorld(
      this.store.viewport as ViewportState,
      containerPos.x,
      containerPos.y
    );

    // 1. 判断是否在选中区域包围盒内
    if (
      !(
        worldPos.x >= bounds.x &&
        worldPos.x <= bounds.x + bounds.width &&
        worldPos.y >= bounds.y &&
        worldPos.y <= bounds.y + bounds.height
      )
    ) {
      return false;
    }

    // 2. 判断是否不在任何选中节点上
    const activeIds = Array.from(this.selectionStore.activeElementIds);
    for (const id of activeIds) {
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node) continue;
      const { x, y, width, height } = node.transform;
      if (
        worldPos.x >= x &&
        worldPos.x <= x + width &&
        worldPos.y >= y &&
        worldPos.y <= y + height
      ) {
        // 点击在具体节点上，走原有节点拖拽逻辑
        return false;
      }
    }

    return true;
  }
}

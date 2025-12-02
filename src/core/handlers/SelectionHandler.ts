import { isNodeInRect, clientToWorld } from '@/core/utils/geometry';
import type { ViewportState, BaseNodeState } from '@/types/state';
import type { useCanvasStore } from '@/store/canvasStore';

/**
 * SelectionHandler - 框选处理器
 * 
 * 职责：
 * - 管理框选状态（起点、终点、进行中标记）
 * - 处理框选的启动、更新、结束逻辑
 * - 根据框选区域计算并选中节点
 * 
 * 特点：
 * - 有状态处理器：维护框选相关的状态
 * - 支持组合编辑模式：只选择当前层级的节点
 * - 支持碰撞检测：使用绝对坐标进行准确计算
 */

type CanvasStore = ReturnType<typeof useCanvasStore>;

export class SelectionHandler {
  private store: CanvasStore;
  private stageEl: HTMLElement | null;

  // 框选状态
  private isBoxSelecting = false;
  private boxSelectStart = { x: 0, y: 0 };
  private boxSelectEnd = { x: 0, y: 0 };

  constructor(store: CanvasStore, stageEl: HTMLElement | null) {
    this.store = store;
    this.stageEl = stageEl;
  }

  /**
   * 获取框选状态（供 Vue 组件使用）
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
   * @param e 鼠标事件
   */
  startBoxSelect(e: MouseEvent): void {
    this.isBoxSelecting = true;
    this.boxSelectStart = { x: e.clientX, y: e.clientY };
    this.boxSelectEnd = { x: e.clientX, y: e.clientY };
  }

  /**
   * 更新框选终点
   * @param e 鼠标事件
   */
  updateBoxSelect(e: MouseEvent): void {
    if (!this.isBoxSelecting) return;
    this.boxSelectEnd = { x: e.clientX, y: e.clientY };
  }

  /**
   * 结束框选，计算并选中区域内的节点
   */
  finishBoxSelect(): void {
    if (!this.isBoxSelecting) return;

    const stageRect = this.stageEl ? this.stageEl.getBoundingClientRect() : { left: 0, top: 0 };

    // 计算框选矩形（屏幕坐标）
    const minScreenX = Math.min(
      this.boxSelectStart.x - stageRect.left,
      this.boxSelectEnd.x - stageRect.left
    );
    const maxScreenX = Math.max(
      this.boxSelectStart.x - stageRect.left,
      this.boxSelectEnd.x - stageRect.left
    );
    const minScreenY = Math.min(
      this.boxSelectStart.y - stageRect.top,
      this.boxSelectEnd.y - stageRect.top
    );
    const maxScreenY = Math.max(
      this.boxSelectStart.y - stageRect.top,
      this.boxSelectEnd.y - stageRect.top
    );

    // 判断是否为点击（框选面积过小）
    const boxArea = (maxScreenX - minScreenX) * (maxScreenY - minScreenY);
    if (boxArea < 4) {
      // 点击空白处：取消所有选中
      this.store.setActive([]);
      this.isBoxSelecting = false;
      return;
    }

    // 转换为世界坐标
    const viewport = this.store.viewport as ViewportState;
    const worldMin = clientToWorld(viewport, minScreenX, minScreenY);
    const worldMax = clientToWorld(viewport, maxScreenX, maxScreenY);

    // 计算被选中的节点
    const selectedIds: string[] = [];
    const editingGroupId = this.store.editingGroupId;

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

      if (isNodeInRect(worldMax.x, worldMax.y, worldMin.x, worldMin.y, nodeForHitTest)) {
        selectedIds.push(id);
      }
    });

    // 更新选中状态
    this.store.setActive(selectedIds);

    // 重置框选状态
    this.isBoxSelecting = false;
  }

  /**
   * 取消框选
   */
  cancelBoxSelect(): void {
    this.isBoxSelecting = false;
  }

  /**
   * 重置框选状态
   */
  reset(): void {
    this.isBoxSelecting = false;
    this.boxSelectStart = { x: 0, y: 0 };
    this.boxSelectEnd = { x: 0, y: 0 };
  }
}

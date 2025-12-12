/**
 * @file ViewportHandler.ts
 * @description 视口处理器 - 负责画布缩放和平移
 *
 * 职责：
 * 1. 处理画布缩放（鼠标滚轮 + Ctrl/Shift）
 * 2. 处理画布平移（空格 + 拖拽、中键拖拽、触摸板双指平移）
 * 3. 更新 viewport 的 zoom、offsetX、offsetY
 *
 * 特点：
 * - 单一职责：仅处理视口变换，不涉及节点操作
 * - 无状态依赖：仅维护平移相关的临时状态
 * - 类型安全：严格类型定义，无 any
 */

import { useCanvasStore } from '@/store/canvasStore';

/**
 * 视口处理器类
 *
 * 负责处理画布的缩放和平移操作
 */
export class ViewportHandler {
  private store: ReturnType<typeof useCanvasStore>;
  public isPanning = false;
  private lastPanPos = { x: 0, y: 0 };

  /**
   * 构造视口处理器
   * @param store - Canvas Store 实例
   */
  constructor(store: ReturnType<typeof useCanvasStore>) {
    this.store = store;
  }

  /**
   * 处理滚轮事件
   * 根据按键组合决定行为：
   * - 无 Ctrl/Shift：触摸板双指平移
   * - Ctrl/Shift + 滚轮：缩放画布
   * @param e - 滚轮事件
   */
  onWheel(e: WheelEvent): void {
    e.preventDefault();

    // 触摸板双指平移逻辑（无 Ctrl/Shift 键时触发）
    if (!(e.ctrlKey || e.shiftKey) && (e.deltaX !== 0 || e.deltaY !== 0)) {
      // 平移偏移量适配画布缩放比例，保证平移速度一致
      const dx = -e.deltaX / this.store.viewport.zoom;
      const dy = -e.deltaY / this.store.viewport.zoom;
      this.store.viewport.offsetX += dx;
      this.store.viewport.offsetY += dy;
      return; // 平移时跳过缩放逻辑
    }

    // 缩放逻辑
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.max(0.1, Math.min(5, this.store.viewport.zoom + delta));

    // TODO: 以鼠标位置为中心缩放（当前以视口中心缩放）
    this.store.viewport.zoom = newZoom;
  }

  /**
   * 开始平移
   * 记录鼠标起始位置并设置平移状态
   * @param e - 鼠标事件
   */
  startPan(e: MouseEvent): void {
    this.isPanning = true;
    this.lastPanPos.x = e.clientX;
    this.lastPanPos.y = e.clientY;
  }

  /**
   * 更新平移位置
   * 根据鼠标移动距离更新视口偏移
   * @param e - 鼠标事件
   */
  updatePan(e: MouseEvent): void {
    if (!this.isPanning) return;

    const dx = e.clientX - this.lastPanPos.x;
    const dy = e.clientY - this.lastPanPos.y;

    this.store.viewport.offsetX += dx;
    this.store.viewport.offsetY += dy;

    this.lastPanPos.x = e.clientX;
    this.lastPanPos.y = e.clientY;
  }

  /**
   * 结束平移
   * 重置平移状态
   */
  endPan(): void {
    this.isPanning = false;
  }

  /**
   * 检查是否正在平移
   * @returns true 表示正在平移，false 表示未在平移
   */
  isPanActive(): boolean {
    return this.isPanning;
  }

  /**
   * 重置平移状态
   * 清空所有平移相关的状态
   */
  reset(): void {
    this.isPanning = false;
    this.lastPanPos = { x: 0, y: 0 };
  }
}

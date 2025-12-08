/**
 * @file TransformHandler.ts
 * @description
 * 节点变换处理器（TransformHandler）
 *
 * 主要职责：
 *   - 处理画布节点的拖拽、单节点缩放、旋转、多节点缩放等变换操作
 *   - 支持多选节点的统一缩放与对齐，修复多选缩放逻辑
 *   - 增加最小宽高限制及防止节点翻转
 *
 * 状态管理：
 *   - 使用 InternalDragState 跟踪拖拽状态（单节点/区域框）
 *   - 使用 InternalResizeState 跟踪单节点缩放与旋转状态
 *   - 使用 InternalMultiResizeState 跟踪多节点缩放状态，包含每个节点的初始偏移与比例
 *
 * 关键变换算法：
 *   - 节点旋转采用二维旋转矩阵公式：
 *       [x', y'] = [cosθ, -sinθ; sinθ, cosθ] * ([x, y] - center) + center
 *   - 多节点缩放时，节点位置和尺寸按中心点和比例动态调整，确保整体对齐
 *   - 防止节点翻转：缩放时检测宽高方向，限制最小尺寸
 *
 * 方法概览：
 *   - startDrag, updateDrag, endDrag
 *   - startResize, updateResize, endResize
 *   - startMultiResize, updateMultiResize, endMultiResize
 *   - 辅助方法：计算旋转、缩放、边界检测等
 *
 * 相关文件/集成点：
 *   - 依赖 @/store/canvasStore 进行全局状态同步
 *   - 与 SelectionHandler、NodeHandler 等交互以实现复合编辑功能
 *
 * 维护提示：
 *   - 变换逻辑涉及多坐标系转换，注意旋转与缩放的顺序和中心点计算
 *   - 多节点缩放需保持节点间相对位置和比例，防止错位
 */

import { useCanvasStore } from '@/store/canvasStore';
import type { BaseNodeState } from '@/types/state';
import type { ResizeHandle } from '@/types/editor';
import { NodeType } from '@/types/state';

/** 拖拽类型 */
type DragType = 'node' | 'area';

/** 最小节点尺寸限制 */
const MIN_SIZE = 10;

/** 拖拽状态 */
interface InternalDragState {
  isDragging: boolean;
  type: DragType | null;
  nodeId: string;
  startX: number;
  startY: number;
  startNodeX: number;
  startNodeY: number;
  /** 多节点拖拽时，每个节点的初始变换 */
  startTransformMap: Record<string, { x: number; y: number }>;
  /** 是否为区域框拖拽 */
  isMultiAreaDrag: boolean;
}

/** 单节点缩放状态（新增旋转角度和初始顶点记录） */
interface InternalResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  nodeId: string;

  // 鼠标初始状态
  startMouseX: number;
  startMouseY: number;

  // 节点初始变换状态
  startNodeX: number;
  startNodeY: number;
  startWidth: number;
  startHeight: number;
  startRotation: number; // 新增：记录初始旋转角度

  // 新增：记录节点初始的四个顶点坐标（在未旋转坐标系中）
  startCorners: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  };

  // 新增：记录节点的初始中心点
  startCenterX: number;
  startCenterY: number;
}

/** 多选缩放时单个节点的初始状态（增强：记录相对中心的偏移） */
interface NodeStartState {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 相对于大框左上角的偏移（像素） */
  offsetX: number;
  offsetY: number;
  /** 相对于大框的尺寸比例 */
  scaleX: number;
  scaleY: number;
  /** 相对于大框中心的偏移比例（新增：修复中心缩放时的对齐） */
  centerOffsetX: number;
  centerOffsetY: number;
}

/** 多选缩放状态 */
interface InternalMultiResizeState {
  isMultiResizing: boolean;
  handle: ResizeHandle | null;
  nodeIds: string[];
  startBounds: { x: number; y: number; width: number; height: number };
  startMouseX: number;
  startMouseY: number;
  nodeStartStates: Record<string, NodeStartState>;
  // 新增以下字段
  startCenterX: number;
  startCenterY: number;
  startRotation: number;
}

// 在文件顶部或适当位置定义 edgeConfig 的类型和结构
interface EdgeConfig {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
}

// 初始化 edgeConfig（或者在组件/函数中作为参数传递）
const edgeConfig: EdgeConfig = {
  left: false,
  right: false,
  top: false,
  bottom: false,
};

export class TransformHandler {
  private store: ReturnType<typeof useCanvasStore>;

  /** 拖拽状态 */
  private dragState: InternalDragState = {
    isDragging: false,
    type: null,
    nodeId: '',
    startX: 0,
    startY: 0,
    startNodeX: 0,
    startNodeY: 0,
    startTransformMap: {},
    isMultiAreaDrag: false,
  };

  /** 单节点缩放状态 */
  private resizeState: InternalResizeState = {
    isResizing: false,
    handle: null,
    nodeId: '',
    startMouseX: 0,
    startMouseY: 0,
    startNodeX: 0,
    startNodeY: 0,
    startWidth: 0,
    startHeight: 0,
    startRotation: 0,
    startCorners: {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
    },
    startCenterX: 0,
    startCenterY: 0,
  };

  /** 多选缩放状态 */
  private multiResizeState: InternalMultiResizeState = {
    isMultiResizing: false,
    handle: null,
    nodeIds: [],
    startBounds: { x: 0, y: 0, width: 0, height: 0 },
    startMouseX: 0,
    startMouseY: 0,
    nodeStartStates: {},
    startCenterX: 0,
    startCenterY: 0,
    startRotation: 0,
  };

  constructor(store: ReturnType<typeof useCanvasStore>) {
    this.store = store;
  }

  // ==================== 辅助方法 ====================

  /**
   * 将点绕中心点旋转指定角度
   * @param point 点坐标
   * @param center 旋转中心
   * @param rotation 旋转角度（弧度）
   */
  private rotatePoint(
    point: { x: number; y: number },
    center: { x: number; y: number },
    rotation: number
  ): { x: number; y: number } {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  }

  /**
   * 将点反向旋转指定角度（从旋转坐标系转回原始坐标系）
   * @param point 点坐标
   * @param center 旋转中心
   * @param rotation 旋转角度（弧度）
   */
  private unrotatePoint(
    point: { x: number; y: number },
    center: { x: number; y: number },
    rotation: number
  ): { x: number; y: number } {
    // 反向旋转就是旋转 -rotation 角度
    return this.rotatePoint(point, center, -rotation);
  }

  /**
   * 计算矩形的四个顶点坐标（未旋转状态）
   */
  private getRectangleCorners(x: number, y: number, width: number, height: number) {
    return {
      topLeft: { x, y },
      topRight: { x: x + width, y },
      bottomRight: { x: x + width, y: y + height },
      bottomLeft: { x, y: y + height },
    };
  }

  /**
   * 根据控制点确定影响的边和顶点
   */
  private getAffectedEdges(handle: ResizeHandle): {
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
  } {
    switch (handle) {
      case 'nw':
        return { left: true, right: false, top: true, bottom: false };
      case 'n':
        return { left: false, right: false, top: true, bottom: false };
      case 'ne':
        return { left: false, right: true, top: true, bottom: false };
      case 'e':
        return { left: false, right: true, top: false, bottom: false };
      case 'se':
        return { left: false, right: true, top: false, bottom: true };
      case 's':
        return { left: false, right: false, top: false, bottom: true };
      case 'sw':
        return { left: true, right: false, top: false, bottom: true };
      case 'w':
        return { left: true, right: false, top: false, bottom: false };
      default:
        return { left: false, right: false, top: false, bottom: false };
    }
  }

  /**
   * 计算多个节点的整体包围盒（修正：避免空边界框）
   * @param nodeIds 节点ID列表
   */
  private getNodesBounds(nodeIds: string[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (nodeIds.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    const nodes = nodeIds.map((id) => this.store.nodes[id]).filter(Boolean) as BaseNodeState[];
    if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    const minX = Math.min(...nodes.map((n) => n.transform.x));
    const minY = Math.min(...nodes.map((n) => n.transform.y));
    const maxX = Math.max(...nodes.map((n) => n.transform.x + n.transform.width));
    const maxY = Math.max(...nodes.map((n) => n.transform.y + n.transform.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  // ==================== 拖拽操作 ====================

  /**
   * 开始拖拽节点
   */
  startNodeDrag(e: MouseEvent, nodeId: string, isSpacePressed: boolean) {
    if (isSpacePressed) return;
    // 检查：如果当前有任何变换操作正在进行，则直接退出！
    if (this.isTransforming) return;

    const node = this.store.nodes[nodeId];
    if (!node || node.isLocked) return;

    this.store.isInteracting = true;

    const activeIds = Array.from(this.store.activeElementIds);
    const isMultiDrag = activeIds.length > 1;

    const startTransformMap: Record<string, { x: number; y: number }> = {};
    activeIds.forEach((id) => {
      const n = this.store.nodes[id];
      if (n) {
        startTransformMap[id] = { x: n.transform.x, y: n.transform.y };
      }
    });

    this.dragState = {
      isDragging: true,
      type: 'node',
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      startNodeX: node.transform.x,
      startNodeY: node.transform.y,
      startTransformMap,
      isMultiAreaDrag: isMultiDrag,
    };
  }

  /**
   * 更新拖拽位置
   */
  updateDrag(e: MouseEvent) {
    if (!this.dragState.isDragging) return;

    const { startX, startY, startTransformMap } = this.dragState;
    const dx = (e.clientX - startX) / this.store.viewport.zoom;
    const dy = (e.clientY - startY) / this.store.viewport.zoom;

    Object.entries(startTransformMap).forEach(([id, startPos]) => {
      const node = this.store.nodes[id];
      if (!node || node.isLocked) return;

      this.store.updateNode(id, {
        transform: {
          ...node.transform,
          x: startPos.x + dx,
          y: startPos.y + dy,
        },
      });
    });
  }

  /**
   * 结束拖拽
   */
  endDrag() {
    if (this.dragState.isDragging) {
      this.dragState.isDragging = false;
      this.dragState.type = null;
      this.dragState.nodeId = '';
      this.dragState.startTransformMap = {};
      this.dragState.isMultiAreaDrag = false;
      this.store.isInteracting = false;
    }
  }

  // ==================== 单节点缩放操作（已修正 Alt 缩放逻辑 + 最小宽高限制） ====================

  /**
   * 开始单节点缩放
   */
  startResize(e: MouseEvent, nodeId: string, handle: ResizeHandle) {
    // 检查：如果当前有任何变换操作正在进行，则直接退出！
    if (this.isTransforming) return;

    const node = this.store.nodes[nodeId];
    if (!node || node.isLocked) return;

    this.store.isInteracting = true;

    // 重置拖拽状态
    this.dragState.isDragging = false;
    this.dragState.type = null;
    this.dragState.nodeId = '';

    const { transform } = node;
    const { x, y, width, height, rotation } = transform;

    // 计算节点中心点（旋转中心）
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // 记录初始状态
    this.resizeState = {
      isResizing: true,
      handle,
      nodeId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: x,
      startNodeY: y,
      startWidth: width,
      startHeight: height,
      startRotation: rotation * (Math.PI / 180), // 转换为弧度
      startCorners: this.getRectangleCorners(x, y, width, height),
      startCenterX: centerX,
      startCenterY: centerY,
    };
  }

  /**
   * 更新单节点缩放（增加最小尺寸限制，禁止反向翻转）
   */
  updateResize(e: MouseEvent) {
    if (!this.resizeState.isResizing || !this.resizeState.handle) return;

    const {
      handle,
      nodeId,
      startMouseX,
      startMouseY,
      startNodeX,
      startNodeY,
      startWidth,
      startHeight,
      startRotation,
      startCenterX,
      startCenterY,
    } = this.resizeState;

    const node = this.store.nodes[nodeId];
    if (!node) return;

    // ========== 新增：判断是否为图片节点 + 图片角点强制等比标记 ==========
    const isImageNode = node.type === NodeType.IMAGE;
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle);
    const isEdge = ['n', 's', 'e', 'w'].includes(handle);
    // 图片+角点：强制等比（优先级最高，覆盖Shift键判断）
    const forceImageRatio = isImageNode && isCorner;

    // 获取视口信息
    const { zoom } = this.store.viewport;

    // --- 1. 坐标转换：将鼠标位移转换到未旋转坐标系 ---
    const startMouseCanvas = { x: startMouseX / zoom, y: startMouseY / zoom };
    const currentMouseCanvas = { x: e.clientX / zoom, y: e.clientY / zoom };

    const startUnrotated = this.unrotatePoint(
      startMouseCanvas,
      { x: startCenterX, y: startCenterY },
      startRotation
    );
    const currentUnrotated = this.unrotatePoint(
      currentMouseCanvas,
      { x: startCenterX, y: startCenterY },
      startRotation
    );

    let unrotatedDx = currentUnrotated.x - startUnrotated.x;
    let unrotatedDy = currentUnrotated.y - startUnrotated.y;

    // --- 2. 初始化固定点/可动点（基于初始矩形） ---
    let fixedX = startNodeX;
    let fixedY = startNodeY;
    let movableX = startNodeX + startWidth;
    let movableY = startNodeY + startHeight;

    // --- 3. 位移计算：确定 fixed/movable 点的**基础**位置（增加 Clamp 逻辑禁止翻转） ---
    switch (handle) {
      // 四边缩放：仅单轴位移，另一轴锁定
      case 'e':
        movableX = Math.max(startNodeX + startWidth + unrotatedDx, fixedX + MIN_SIZE);
        unrotatedDy = 0; // 锁定 Y 轴位移
        break;
      case 'w':
        fixedX = Math.min(startNodeX + unrotatedDx, movableX - MIN_SIZE);
        unrotatedDy = 0; // 锁定 Y 轴位移
        break;
      case 's':
        movableY = Math.max(startNodeY + startHeight + unrotatedDy, fixedY + MIN_SIZE);
        unrotatedDx = 0; // 锁定 X 轴位移
        break;
      case 'n':
        fixedY = Math.min(startNodeY + unrotatedDy, movableY - MIN_SIZE);
        unrotatedDx = 0; // 锁定 X 轴位移
        break;

      // 角点缩放：双轴位移，固定对角点
      case 'nw': // 固定右下角，移动左上角
        fixedX = Math.min(startNodeX + unrotatedDx, startNodeX + startWidth - MIN_SIZE);
        fixedY = Math.min(startNodeY + unrotatedDy, startNodeY + startHeight - MIN_SIZE);
        movableX = startNodeX + startWidth;
        movableY = startNodeY + startHeight;
        break;
      case 'ne': // 固定左下角，移动右上角
        movableX = Math.max(startNodeX + startWidth + unrotatedDx, startNodeX + MIN_SIZE);
        fixedY = Math.min(startNodeY + unrotatedDy, startNodeY + startHeight - MIN_SIZE);
        fixedX = startNodeX;
        movableY = startNodeY + startHeight;
        break;
      case 'se': // 固定左上角，移动右下角
        movableX = Math.max(startNodeX + startWidth + unrotatedDx, startNodeX + MIN_SIZE);
        movableY = Math.max(startNodeY + startHeight + unrotatedDy, startNodeY + MIN_SIZE);
        fixedX = startNodeX;
        fixedY = startNodeY;
        break;
      case 'sw': // 固定右上角，移动左下角
        fixedX = Math.min(startNodeX + unrotatedDx, startNodeX + startWidth - MIN_SIZE);
        movableY = Math.max(startNodeY + startHeight + unrotatedDy, startNodeY + MIN_SIZE);
        movableX = startNodeX + startWidth;
        fixedY = startNodeY;
        break;
    }

    // --- 5. 处理 Alt 键中心缩放（Alt缩放必须以 startCenterX/Y 为中心） ---
    if (e.altKey) {
      const centerX = startCenterX;
      const centerY = startCenterY;
      const ratio = startWidth / startHeight;

      // ========== 修复1：明确拆分图片强制等比和Shift等比逻辑 ==========
      // 图片角点：强制等比（无视Shift）；非图片角点：Shift触发等比
      const isShiftRatio = e.shiftKey && isCorner;
      const shouldForceRatio = forceImageRatio || isShiftRatio;

      if (shouldForceRatio) {
        // 1. 定义初始尺寸向量（从中心到角点）
        const halfStartW = startWidth / 2;
        const halfStartH = startHeight / 2;

        // 2. 确定初始对角线方向的向量 (vx, vy)
        let vx = 0,
          vy = 0;
        if (handle.includes('e')) vx = halfStartW;
        else if (handle.includes('w')) vx = -halfStartW;
        if (handle.includes('s')) vy = halfStartH;
        else if (handle.includes('n')) vy = -halfStartH;

        // 检查初始尺寸，防止除以零
        const mag = Math.sqrt(vx * vx + vy * vy);
        if (mag === 0) {
          const newW = MIN_SIZE;
          const newH = MIN_SIZE;
          fixedX = centerX - newW / 2;
          movableX = centerX + newW / 2;
          fixedY = centerY - newH / 2;
          movableY = centerY + newH / 2;
          return;
        }

        // 3. 归一化单位向量
        const uvx = vx / mag;
        const uvy = vy / mag;

        // 4. 计算鼠标位移在对角线单位向量上的投影
        const effectiveMoveDistance = unrotatedDx * uvx + unrotatedDy * uvy;

        // 5. 计算新的对角线半长度（应用最小限制）
        const MIN_DIAGONAL_HALF = Math.sqrt((MIN_SIZE / 2) ** 2 + (MIN_SIZE / 2) ** 2);
        let newHalfMag = Math.max(mag + effectiveMoveDistance, MIN_DIAGONAL_HALF);

        // 6. 计算新的缩放因子和等比尺寸
        const scaleFactor = newHalfMag / mag;
        let newW = Math.max(startWidth * scaleFactor, MIN_SIZE);
        let newH = Math.max(startHeight * scaleFactor, MIN_SIZE);

        // 7. 重新计算fixed/movable，确保中心对称
        fixedX = centerX - newW / 2;
        movableX = centerX + newW / 2;
        fixedY = centerY - newH / 2;
        movableY = centerY + newH / 2;
      } else if (isCorner) {
        // 角点中心缩放（Alt 非等比）：仅非图片+非Shift触发
        let deltaW = 0;
        let deltaH = 0;
        if (handle.includes('e')) deltaW = unrotatedDx;
        if (handle.includes('w')) deltaW = -unrotatedDx;
        if (handle.includes('s')) deltaH = unrotatedDy;
        if (handle.includes('n')) deltaH = -unrotatedDy;

        const newW = Math.max(startWidth + deltaW * 2, MIN_SIZE);
        const newH = Math.max(startHeight + deltaH * 2, MIN_SIZE);
        fixedX = centerX - newW / 2;
        movableX = centerX + newW / 2;
        fixedY = centerY - newH / 2;
        movableY = centerY + newH / 2;
      } else if (isEdge) {
        // 边中心缩放（Alt 单轴对称）：原有逻辑完全保留
        switch (handle) {
          case 'e':
          case 'w': {
            let deltaW = handle === 'e' ? unrotatedDx : -unrotatedDx;
            const newW = Math.max(startWidth + deltaW * 2, MIN_SIZE);
            fixedX = centerX - newW / 2;
            movableX = centerX + newW / 2;
            fixedY = startNodeY;
            movableY = startNodeY + startHeight;
            break;
          }
          case 'n':
          case 's': {
            let deltaH = handle === 's' ? unrotatedDy : -unrotatedDy;
            const newH = Math.max(startHeight + deltaH * 2, MIN_SIZE);
            fixedY = centerY - newH / 2;
            movableY = centerY + newH / 2;
            fixedX = startNodeX;
            movableX = startNodeX + startWidth;
            break;
          }
        }
      }
    } else {
      // ========== 修复2：补充非Alt分支的Shift等比逻辑 ==========
      // 图片角点：强制等比；非图片角点：Shift触发等比
      const shiftForceRatio = !isImageNode && e.shiftKey && isCorner;
      const needRatio = forceImageRatio || shiftForceRatio;

      if (needRatio) {
        // 非Alt模式下等比逻辑（兼容图片/非图片+Shift）
        const ratio = startWidth / startHeight;
        // 防止除以零（初始比例异常时兜底）
        const safeRatio = ratio === 0 || isNaN(ratio) ? 1 : ratio;

        // 计算基础宽高变化
        let tempNewWidth = Math.abs(movableX - fixedX);
        let tempNewHeight = Math.abs(movableY - fixedY);

        // ========== 修复3：动态选择等比基准（按鼠标主导位移） ==========
        // 计算鼠标X/Y位移绝对值，判断主导轴（避免固定宽度基准导致比例偏差）
        const dxAbs = Math.abs(unrotatedDx);
        const dyAbs = Math.abs(unrotatedDy);
        const isXMain = dxAbs > dyAbs;

        switch (handle) {
          case 'nw':
          case 'ne':
          case 'se':
          case 'sw':
            // 主导轴为X：以宽度定高度；主导轴为Y：以高度定宽度
            if (isXMain) {
              tempNewHeight = tempNewWidth / safeRatio;
            } else {
              tempNewWidth = tempNewHeight * safeRatio;
            }

            // 修正fixed/movable坐标（适配等比尺寸）
            // X轴修正
            if (handle.includes('w')) {
              fixedX = movableX - tempNewWidth;
            } else {
              movableX = fixedX + tempNewWidth;
            }
            // Y轴修正
            if (handle.includes('n')) {
              fixedY = movableY - tempNewHeight;
            } else {
              movableY = fixedY + tempNewHeight;
            }
            break;
        }

        // 应用最小尺寸限制（保证尺寸有效）
        tempNewWidth = Math.max(tempNewWidth, MIN_SIZE);
        tempNewHeight = Math.max(tempNewHeight, MIN_SIZE);

        // 最终修正坐标（防止翻转）
        fixedX = Math.min(fixedX, movableX);
        movableX = Math.max(fixedX, movableX);
        fixedY = Math.min(fixedY, movableY);
        movableY = Math.max(fixedY, movableY);
      }
    }
    // --- 6. 直接计算最终尺寸（移除最小尺寸限制 -> 已在上面步骤中集成限制） ---
    let newWidth = Math.abs(movableX - fixedX);
    let newHeight = Math.abs(movableY - fixedY);

    // --- 7. 旋转坐标系转换（恢复旋转，精准计算最终位置） ---
    const newUnrotatedX = Math.min(fixedX, movableX);
    const newUnrotatedY = Math.min(fixedY, movableY);
    const newUnrotatedCenter = {
      x: newUnrotatedX + newWidth / 2,
      y: newUnrotatedY + newHeight / 2,
    };
    const rotatedCenter = this.rotatePoint(
      newUnrotatedCenter,
      { x: startCenterX, y: startCenterY },
      startRotation
    );
    const finalX = rotatedCenter.x - newWidth / 2;
    const finalY = rotatedCenter.y - newHeight / 2;

    // --- 8. 更新节点（防抖：避免微小位移重复更新） ---
    const isSame =
      Math.abs(finalX - node.transform.x) < 1e-3 &&
      Math.abs(finalY - node.transform.y) < 1e-3 &&
      Math.abs(newWidth - node.transform.width) < 1e-3 &&
      Math.abs(newHeight - node.transform.height) < 1e-3;
    if (!isSame) {
      this.store.updateNode(nodeId, {
        transform: {
          ...node.transform,
          x: finalX,
          y: finalY,
          width: newWidth,
          height: newHeight,
        },
      });
    }
  }
  /**
   * 结束单节点缩放
   */
  endResize() {
    if (this.resizeState.isResizing) {
      this.resizeState.isResizing = false;
      this.resizeState.handle = null;
      this.resizeState.nodeId = '';
      this.store.isInteracting = false;
    }
  }

  // ==================== 多选缩放操作（核心修复 + 最小宽高限制） ====================

  /**
   * 开始多选缩放（修复：记录节点相对中心的偏移，避免比例计算错误）
   */
  /**
   * 更新多选缩放（严格按照单选矩形逻辑：Shift=等比缩放，Alt=中心缩放，Shift+Alt=等比中心缩放）
   */
  /**
   * 更新多选缩放（完全按照单选逻辑：为每个节点确定固定点和可动点）
   */
  updateMultiResize(e: MouseEvent) {
    const {
      isMultiResizing,
      handle,
      nodeIds,
      startBounds,
      startMouseX,
      startMouseY,
      nodeStartStates,
      startCenterX,
      startCenterY,
      startRotation,
    } = this.multiResizeState;

    if (!isMultiResizing || !handle || nodeIds.length === 0) return;

    // ========== 1. 基础参数初始化 ==========
    const { zoom } = this.store.viewport;
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle);
    const isEdge = ['n', 's', 'e', 'w'].includes(handle);
    const hasShift = e.shiftKey;
    const hasAlt = e.altKey;

    // ========== 2. 坐标转换 ==========
    const startMouseCanvas = { x: startMouseX / zoom, y: startMouseY / zoom };
    const currentMouseCanvas = { x: e.clientX / zoom, y: e.clientY / zoom };

    // 反向旋转到未旋转坐标系
    const startUnrotated = this.unrotatePoint(
      startMouseCanvas,
      { x: startCenterX, y: startCenterY },
      startRotation
    );
    const currentUnrotated = this.unrotatePoint(
      currentMouseCanvas,
      { x: startCenterX, y: startCenterY },
      startRotation
    );

    // 计算未旋转坐标系下的鼠标位移
    const unrotatedDx = currentUnrotated.x - startUnrotated.x;
    const unrotatedDy = currentUnrotated.y - startUnrotated.y;

    // ========== 3. 计算整体边界框的新尺寸（基于固定边角逻辑） ==========
    let fixedX = startBounds.x;
    let fixedY = startBounds.y;
    let movableX = startBounds.x + startBounds.width;
    let movableY = startBounds.y + startBounds.height;

    // 根据手柄确定固定点和可动点
    switch (handle) {
      // 边缩放：固定对边
      case 'e': // 固定左边，移动右边
        movableX = Math.max(startBounds.x + startBounds.width + unrotatedDx, fixedX + MIN_SIZE);
        break;
      case 'w': // 固定右边，移动左边
        fixedX = Math.min(startBounds.x + unrotatedDx, movableX - MIN_SIZE);
        break;
      case 's': // 固定上边，移动下边
        movableY = Math.max(startBounds.y + startBounds.height + unrotatedDy, fixedY + MIN_SIZE);
        break;
      case 'n': // 固定下边，移动上边
        fixedY = Math.min(startBounds.y + unrotatedDy, movableY - MIN_SIZE);
        break;

      // 角缩放：固定对角
      case 'nw': // 固定右下角，移动左上角
        fixedX = Math.min(
          startBounds.x + unrotatedDx,
          startBounds.x + startBounds.width - MIN_SIZE
        );
        fixedY = Math.min(
          startBounds.y + unrotatedDy,
          startBounds.y + startBounds.height - MIN_SIZE
        );
        movableX = startBounds.x + startBounds.width;
        movableY = startBounds.y + startBounds.height;
        break;
      case 'ne': // 固定左下角，移动右上角
        movableX = Math.max(
          startBounds.x + startBounds.width + unrotatedDx,
          startBounds.x + MIN_SIZE
        );
        fixedY = Math.min(
          startBounds.y + unrotatedDy,
          startBounds.y + startBounds.height - MIN_SIZE
        );
        fixedX = startBounds.x;
        movableY = startBounds.y + startBounds.height;
        break;
      case 'se': // 固定左上角，移动右下角
        movableX = Math.max(
          startBounds.x + startBounds.width + unrotatedDx,
          startBounds.x + MIN_SIZE
        );
        movableY = Math.max(
          startBounds.y + startBounds.height + unrotatedDy,
          startBounds.y + MIN_SIZE
        );
        fixedX = startBounds.x;
        fixedY = startBounds.y;
        break;
      case 'sw': // 固定右上角，移动左下角
        fixedX = Math.min(
          startBounds.x + unrotatedDx,
          startBounds.x + startBounds.width - MIN_SIZE
        );
        movableY = Math.max(
          startBounds.y + startBounds.height + unrotatedDy,
          startBounds.y + MIN_SIZE
        );
        movableX = startBounds.x + startBounds.width;
        fixedY = startBounds.y;
        break;
    }

    // ========== 4. 计算基础尺寸 ==========
    let newWidth = Math.abs(movableX - fixedX);
    let newHeight = Math.abs(movableY - fixedY);

    // ========== 5. 应用快捷键逻辑 ==========
    if (hasAlt) {
      const centerX = startCenterX;
      const centerY = startCenterY;

      if (hasShift && isCorner) {
        // Shift+Alt: 等比中心缩放
        const startRatio = startBounds.width / Math.max(startBounds.height, 0.001);
        const scale = newWidth / Math.max(startBounds.width, 0.001);

        newWidth = Math.max(startBounds.width * scale, MIN_SIZE);
        newHeight = Math.max(newWidth / startRatio, MIN_SIZE);

        // 以中心点对称缩放
        fixedX = centerX - newWidth / 2;
        movableX = centerX + newWidth / 2;
        fixedY = centerY - newHeight / 2;
        movableY = centerY + newHeight / 2;
      } else if (isCorner) {
        // Alt: 中心缩放（角点）
        const scaleX = newWidth / Math.max(startBounds.width, 0.001);
        const scaleY = newHeight / Math.max(startBounds.height, 0.001);

        newWidth = Math.max(startBounds.width * scaleX, MIN_SIZE);
        newHeight = Math.max(startBounds.height * scaleY, MIN_SIZE);

        fixedX = centerX - newWidth / 2;
        movableX = centerX + newWidth / 2;
        fixedY = centerY - newHeight / 2;
        movableY = centerY + newHeight / 2;
      } else if (isEdge) {
        // Alt: 中心缩放（边）
        switch (handle) {
          case 'e':
          case 'w':
            const scaleX = newWidth / Math.max(startBounds.width, 0.001);
            newWidth = Math.max(startBounds.width * scaleX, MIN_SIZE);
            fixedX = centerX - newWidth / 2;
            movableX = centerX + newWidth / 2;
            // Y轴保持不变
            fixedY = startBounds.y;
            movableY = startBounds.y + startBounds.height;
            break;
          case 'n':
          case 's':
            const scaleY = newHeight / Math.max(startBounds.height, 0.001);
            newHeight = Math.max(startBounds.height * scaleY, MIN_SIZE);
            fixedY = centerY - newHeight / 2;
            movableY = centerY + newHeight / 2;
            // X轴保持不变
            fixedX = startBounds.x;
            movableX = startBounds.x + startBounds.width;
            break;
        }
      }
    } else if (hasShift && isCorner) {
      // Shift: 等比缩放
      const startRatio = startBounds.width / Math.max(startBounds.height, 0.001);

      // 根据主要移动方向确定主导轴
      const dxAbs = Math.abs(unrotatedDx);
      const dyAbs = Math.abs(unrotatedDy);
      const isXMain = dxAbs > dyAbs;

      if (isXMain) {
        // X轴主导：以宽度定高度
        newHeight = newWidth / startRatio;
      } else {
        // Y轴主导：以高度定宽度
        newWidth = newHeight * startRatio;
      }

      // 确保不小于最小尺寸
      newWidth = Math.max(newWidth, MIN_SIZE);
      newHeight = Math.max(newHeight, MIN_SIZE);

      // 根据手柄修正坐标
      switch (handle) {
        case 'nw':
          fixedX = movableX - newWidth;
          fixedY = movableY - newHeight;
          break;
        case 'ne':
          movableX = fixedX + newWidth;
          fixedY = movableY - newHeight;
          break;
        case 'se':
          movableX = fixedX + newWidth;
          movableY = fixedY + newHeight;
          break;
        case 'sw':
          fixedX = movableX - newWidth;
          movableY = fixedY + newHeight;
          break;
      }
    }

    // ========== 6. 计算最终边界框 ==========
    const finalBounds = {
      x: Math.min(fixedX, movableX),
      y: Math.min(fixedY, movableY),
      width: Math.max(newWidth, MIN_SIZE),
      height: Math.max(newHeight, MIN_SIZE),
    };

    // ========== 7. 确定每个节点的固定边角 ==========
    // 关键修复：为每个节点计算固定边角，而不是统一使用边界框左上角
    const scaleX = finalBounds.width / Math.max(startBounds.width, 0.001);
    const scaleY = finalBounds.height / Math.max(startBounds.height, 0.001);

    nodeIds.forEach((id) => {
      const startState = nodeStartStates[id];
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node || !startState) return;

      // 关键：为每个节点计算固定边角
      let nodeFixedX = startState.x;
      let nodeFixedY = startState.y;
      let nodeMovableX = startState.x + startState.width;
      let nodeMovableY = startState.y + startState.height;

      // 根据手柄确定节点的固定点和可动点
      // 注意：这里需要根据节点的位置关系来确定
      const nodeStartBounds = {
        x: startState.x,
        y: startState.y,
        width: startState.width,
        height: startState.height,
      };

      // 计算节点相对于整体边界框的位置
      const nodeRelativeLeft =
        (nodeStartBounds.x - startBounds.x) / Math.max(startBounds.width, 0.001);
      const nodeRelativeTop =
        (nodeStartBounds.y - startBounds.y) / Math.max(startBounds.height, 0.001);
      const nodeRelativeRight =
        (nodeStartBounds.x + nodeStartBounds.width - startBounds.x) /
        Math.max(startBounds.width, 0.001);
      const nodeRelativeBottom =
        (nodeStartBounds.y + nodeStartBounds.height - startBounds.y) /
        Math.max(startBounds.height, 0.001);

      // 计算新边界框中的节点位置
      const newNodeX = finalBounds.x + nodeRelativeLeft * finalBounds.width;
      const newNodeY = finalBounds.y + nodeRelativeTop * finalBounds.height;
      const newNodeWidth = startState.width * scaleX;
      const newNodeHeight = startState.height * scaleY;

      // 根据缩放类型调整位置
      if (hasAlt) {
        // 中心缩放：基于节点中心点计算
        const nodeCenterX = startState.x + startState.width / 2;
        const nodeCenterY = startState.y + startState.height / 2;

        // 计算节点中心点相对于整体中心点的偏移
        const centerOffsetX = nodeCenterX - startCenterX;
        const centerOffsetY = nodeCenterY - startCenterY;

        // 计算新的整体中心点
        const newCenterX = finalBounds.x + finalBounds.width / 2;
        const newCenterY = finalBounds.y + finalBounds.height / 2;

        // 基于中心点偏移计算节点新位置
        const newCenterOffsetX = centerOffsetX * ((scaleX + scaleY) / 2);
        const newCenterOffsetY = centerOffsetY * ((scaleX + scaleY) / 2);

        const centerAdjustedX = newCenterX + newCenterOffsetX - newNodeWidth / 2;
        const centerAdjustedY = newCenterY + newCenterOffsetY - newNodeHeight / 2;

        // 更新节点
        this.store.updateNode(id, {
          transform: {
            ...node.transform,
            x: centerAdjustedX,
            y: centerAdjustedY,
            width: Math.max(newNodeWidth, MIN_SIZE),
            height: Math.max(newNodeHeight, MIN_SIZE),
          },
        });
      } else {
        // 普通缩放：直接使用相对位置
        this.store.updateNode(id, {
          transform: {
            ...node.transform,
            x: newNodeX,
            y: newNodeY,
            width: Math.max(newNodeWidth, MIN_SIZE),
            height: Math.max(newNodeHeight, MIN_SIZE),
          },
        });
      }
    });
  }

  /**
   * 重新设计的多选缩放开始函数
   */
  startMultiResize(
    e: MouseEvent,
    handle: ResizeHandle,
    startBounds: { x: number; y: number; width: number; height: number },
    nodeIds: string[],
    isSpacePressed: boolean
  ) {
    if (isSpacePressed) return;
    if (this.isTransforming) return;

    // 重置其他状态
    this.dragState.isDragging = false;
    this.dragState.type = null;
    this.dragState.nodeId = '';
    this.resizeState.isResizing = false;

    // 过滤有效节点
    const validNodeIds = nodeIds.filter((id) => {
      const node = this.store.nodes[id];
      return node && !node.isLocked;
    });
    if (validNodeIds.length === 0) return;

    // 重新计算可靠的包围盒
    const calcStartBounds = this.getNodesBounds(validNodeIds);

    // 计算中心点
    const startCenterX = calcStartBounds.x + calcStartBounds.width / 2;
    const startCenterY = calcStartBounds.y + calcStartBounds.height / 2;

    // 记录每个节点的初始状态
    const nodeStartStates: Record<string, any> = {};
    validNodeIds.forEach((id) => {
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node) return;

      // 记录节点的完整变换状态
      nodeStartStates[id] = {
        x: node.transform.x,
        y: node.transform.y,
        width: node.transform.width,
        height: node.transform.height,
        rotation: node.transform.rotation,

        // 相对于整体边界框的位置关系（用于固定边角计算）
        relativeLeft:
          (node.transform.x - calcStartBounds.x) / Math.max(calcStartBounds.width, 0.001),
        relativeTop:
          (node.transform.y - calcStartBounds.y) / Math.max(calcStartBounds.height, 0.001),
        relativeRight:
          (node.transform.x + node.transform.width - calcStartBounds.x) /
          Math.max(calcStartBounds.width, 0.001),
        relativeBottom:
          (node.transform.y + node.transform.height - calcStartBounds.y) /
          Math.max(calcStartBounds.height, 0.001),

        // 中心点相对于整体中心点的偏移
        centerOffsetX: node.transform.x + node.transform.width / 2 - startCenterX,
        centerOffsetY: node.transform.y + node.transform.height / 2 - startCenterY,
      };
    });

    // 初始化多选缩放状态
    this.multiResizeState = {
      isMultiResizing: true,
      handle,
      nodeIds: validNodeIds,
      startBounds: { ...calcStartBounds },
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      nodeStartStates,
      startCenterX,
      startCenterY,
      startRotation: 0, // 多选边界框无旋转
    };

    this.store.isInteracting = true;
  }
  /**
   * 结束多选缩放
   */
  endMultiResize() {
    if (this.multiResizeState.isMultiResizing) {
      this.multiResizeState.isMultiResizing = false;
      this.multiResizeState.handle = null;
      this.multiResizeState.nodeIds = [];
      this.multiResizeState.nodeStartStates = {};
      // 重置新增的字段
      this.multiResizeState.startCenterX = 0;
      this.multiResizeState.startCenterY = 0;
      this.multiResizeState.startRotation = 0;
      this.store.isInteracting = false;
    }
  }

  // ==================== 公共方法 ====================

  /**
   * 获取当前是否正在拖拽
   */
  get isDragging(): boolean {
    return this.dragState.isDragging;
  }

  /**
   * 获取当前是否正在缩放
   */
  get isResizing(): boolean {
    return this.resizeState.isResizing;
  }

  /**
   * 获取当前是否正在多选缩放
   */
  get isMultiResizing(): boolean {
    return this.multiResizeState.isMultiResizing;
  }

  /**
   * 检查是否有任何变换操作正在进行
   */
  get isTransforming(): boolean {
    return (
      this.dragState.isDragging ||
      this.resizeState.isResizing ||
      this.multiResizeState.isMultiResizing
    );
  }

  /**
   * 重置所有变换状态
   */
  reset() {
    this.endDrag();
    this.endResize();
    this.endMultiResize();
  }
}

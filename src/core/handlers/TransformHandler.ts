/**
 * @file TransformHandler.ts
 * @description 节点变换处理器 - 处理节点的拖拽和缩放
 */

import { useCanvasStore } from '@/store/canvasStore';
import type { BaseNodeState } from '@/types/state';
import type { ResizeHandle } from '@/types/editor';

/** 最小节点尺寸限制 */
const MIN_NODE_SIZE = 10;

/** 拖拽类型 */
type DragType = 'node' | 'area';

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

/** 多选缩放时单个节点的初始状态 */
interface NodeStartState {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 相对于大框的偏移比例 */
  offsetX: number;
  offsetY: number;
  /** 相对于大框的尺寸比例 */
  scaleX: number;
  scaleY: number;
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
}

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

  // ==================== 单节点缩放操作（已修正 Alt 缩放逻辑） ====================

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
   * 更新单节点缩放（修复四边缩放时尺寸骤变最小值问题，并修复角点缩放失效问题）
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

    // 获取视口信息
    const { zoom } = this.store.viewport;
    // 标记：是否为角点缩放（双轴）/ 四边缩放（单轴）
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle);
    const isEdge = ['n', 's', 'e', 'w'].includes(handle);

    // --- 1. 坐标转换：将鼠标位移转换到未旋转坐标系 ---
    // 鼠标坐标转画布坐标（考虑缩放）
    const startMouseCanvas = { x: startMouseX / zoom, y: startMouseY / zoom };
    const currentMouseCanvas = { x: e.clientX / zoom, y: e.clientY / zoom };

    // 将鼠标点反向旋转到未旋转坐标系（以节点初始中心为旋转中心）
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

    // 计算未旋转坐标系下的总位移
    let unrotatedDx = currentUnrotated.x - startUnrotated.x;
    let unrotatedDy = currentUnrotated.y - startUnrotated.y;

    // --- 2. 初始化固定点/可动点（基于初始矩形） ---
    let fixedX = startNodeX;
    let fixedY = startNodeY;
    let movableX = startNodeX + startWidth;
    let movableY = startNodeY + startHeight;

    // --- 3. 位移计算：确定 fixed/movable 点的**基础**位置 ---
    switch (handle) {
      // 四边缩放：仅单轴位移，另一轴锁定
      case 'e':
        movableX = startNodeX + startWidth + unrotatedDx;
        unrotatedDy = 0; // 锁定 Y 轴位移
        break;
      case 'w':
        fixedX = startNodeX + unrotatedDx;
        unrotatedDy = 0; // 锁定 Y 轴位移
        break;
      case 's':
        movableY = startNodeY + startHeight + unrotatedDy;
        unrotatedDx = 0; // 锁定 X 轴位移
        break;
      case 'n':
        fixedY = startNodeY + unrotatedDy;
        unrotatedDx = 0; // 锁定 X 轴位移
        break;

      // 角点缩放：双轴位移，固定对角点
      case 'nw': // 固定右下角，移动左上角
        fixedX = startNodeX + unrotatedDx;
        fixedY = startNodeY + unrotatedDy;
        movableX = startNodeX + startWidth;
        movableY = startNodeY + startHeight;
        break;
      case 'ne': // 固定左下角，移动右上角
        movableX = startNodeX + startWidth + unrotatedDx;
        fixedY = startNodeY + unrotatedDy;
        fixedX = startNodeX;
        movableY = startNodeY + startHeight;
        break;
      case 'se': // 固定左上角，移动右下角
        movableX = startNodeX + startWidth + unrotatedDx;
        movableY = startNodeY + startHeight + unrotatedDy;
        fixedX = startNodeX;
        fixedY = startNodeY;
        break;
      case 'sw': // 固定右上角，移动左下角
        fixedX = startNodeX + unrotatedDx;
        movableY = startNodeY + startHeight + unrotatedDy;
        movableX = startNodeX + startWidth;
        fixedY = startNodeY;
        break;
    }

    // --- 4. 处理 Shift 键等比缩放（仅角点生效） ---
    if (e.shiftKey && isCorner) {
      const startRatio = startWidth / Math.max(startHeight, 1e-6); // 避免除零

      // 计算当前宽度和高度
      const currentWidth = Math.abs(movableX - fixedX);
      const currentHeight = Math.abs(movableY - fixedY);

      // 基于鼠标位移的主方向计算统一缩放比例
      const scaleX = currentWidth / startWidth;
      const scaleY = currentHeight / startHeight;
      // 选取绝对值更大的比例作为主导比例
      const scale = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY;

      // 计算等比目标尺寸
      const targetWidth = startWidth * Math.abs(scale);
      const targetHeight = startHeight * Math.abs(scale);

      // 基于 fixed/movable 点和目标尺寸，修正可动点的位置
      switch (handle) {
        case 'nw': // 固定右下角 (movableX, movableY)
          fixedX = movableX - targetWidth;
          fixedY = movableY - targetHeight;
          break;
        case 'ne': // 固定左下角 (fixedX, movableY)
          movableX = fixedX + targetWidth;
          fixedY = movableY - targetHeight;
          break;
        case 'se': // 固定左上角 (fixedX, fixedY)
          movableX = fixedX + targetWidth;
          movableY = fixedY + targetHeight;
          break;
        case 'sw': // 固定右上角 (movableX, fixedY)
          fixedX = movableX - targetWidth;
          movableY = fixedY + targetHeight;
          break;
      }
    }

    // --- 5. 处理 Alt 键中心缩放（Alt缩放必须以 startCenterX/Y 为中心） ---
    if (e.altKey) {
      // 缩放中心必须是初始中心点
      const centerX = startCenterX;
      const centerY = startCenterY;

      if (isCorner) {
        // 角点中心缩放：总位移应用到宽度/高度，并对称修正fixed/movable

        // 1. 计算宽度/高度的变化量（这里是半边变化量）
        let deltaW = 0;
        let deltaH = 0;

        // 根据 handle 确定 x/y 轴位移的正负（dx/dy 代表鼠标在未旋转坐标系下的位移）
        // 半边变化量 = 鼠标位移
        if (handle.includes('e')) deltaW = unrotatedDx;
        if (handle.includes('w')) deltaW = -unrotatedDx;
        if (handle.includes('s')) deltaH = unrotatedDy;
        if (handle.includes('n')) deltaH = -unrotatedDy;

        // 2. 重新计算 fixed/movable，使其关于 startCenter 对称
        // 新的半宽 = 初始半宽 + deltaW
        fixedX = centerX - startWidth / 2 - deltaW;
        movableX = centerX + startWidth / 2 + deltaW;
        fixedY = centerY - startHeight / 2 - deltaH;
        movableY = centerY + startHeight / 2 + deltaH;
      } else if (isEdge) {
        // 边中心缩放：仅单轴变化，该轴对称，另一轴保持不变
        switch (handle) {
          case 'e':
          case 'w':
            // 仅 X 轴对称
            let deltaW = handle === 'e' ? unrotatedDx : -unrotatedDx;
            fixedX = centerX - startWidth / 2 - deltaW;
            movableX = centerX + startWidth / 2 + deltaW;
            // Y 轴保持不变（使用初始坐标）
            fixedY = startNodeY;
            movableY = startNodeY + startHeight;
            break;
          case 'n':
          case 's':
            // 仅 Y 轴对称
            let deltaH = handle === 's' ? unrotatedDy : -unrotatedDy;
            fixedY = centerY - startHeight / 2 - deltaH;
            movableY = centerY + startHeight / 2 + deltaH;
            // X 轴保持不变（使用初始坐标）
            fixedX = startNodeX;
            movableX = startNodeX + startWidth;
            break;
        }
      }
    }

    // --- 6. 最小尺寸限制（精准修正，避免错位） ---
    let newWidth = Math.abs(movableX - fixedX);
    let newHeight = Math.abs(movableY - fixedY);

    // 6.1 宽度最小限制
    if (newWidth < MIN_NODE_SIZE) {
      newWidth = MIN_NODE_SIZE;
      // 根据handle修正坐标（保证固定点不动，修正可动点）
      // 注意：这里需要考虑 Alt 键可能将固定点变为可动点（中心对称）
      const isCentering = e.altKey;

      // 找到中心点（用于 Alt 模式下的居中修正）
      const currentCenterX = (fixedX + movableX) / 2;

      switch (handle) {
        case 'e':
        case 'ne':
        case 'se':
          if (isCentering) {
            // Alt 模式：居中修正
            fixedX = currentCenterX - MIN_NODE_SIZE / 2;
            movableX = currentCenterX + MIN_NODE_SIZE / 2;
          } else {
            // 非 Alt 模式：固定左侧 (fixedX)
            movableX = fixedX + MIN_NODE_SIZE;
          }
          break;
        case 'w':
        case 'nw':
        case 'sw':
          if (isCentering) {
            // Alt 模式：居中修正
            fixedX = currentCenterX - MIN_NODE_SIZE / 2;
            movableX = currentCenterX + MIN_NODE_SIZE / 2;
          } else {
            // 非 Alt 模式：固定右侧 (movableX)
            fixedX = movableX - MIN_NODE_SIZE;
          }
          break;
        case 'n':
        case 's': // 垂直边（n/s），宽度居中
          fixedX = currentCenterX - MIN_NODE_SIZE / 2;
          movableX = currentCenterX + MIN_NODE_SIZE / 2;
          break;
      }
    }

    // 6.2 高度最小限制
    if (newHeight < MIN_NODE_SIZE) {
      newHeight = MIN_NODE_SIZE;
      const isCentering = e.altKey;
      const currentCenterY = (fixedY + movableY) / 2;

      switch (handle) {
        case 's':
        case 'se':
        case 'sw':
          if (isCentering) {
            // Alt 模式：居中修正
            fixedY = currentCenterY - MIN_NODE_SIZE / 2;
            movableY = currentCenterY + MIN_NODE_SIZE / 2;
          } else {
            // 非 Alt 模式：固定上侧 (fixedY)
            movableY = fixedY + MIN_NODE_SIZE;
          }
          break;
        case 'n':
        case 'nw':
        case 'ne':
          if (isCentering) {
            // Alt 模式：居中修正
            fixedY = currentCenterY - MIN_NODE_SIZE / 2;
            movableY = currentCenterY + MIN_NODE_SIZE / 2;
          } else {
            // 非 Alt 模式：固定下侧 (movableY)
            fixedY = movableY - MIN_NODE_SIZE;
          }
          break;
        case 'e':
        case 'w': // 水平边（e/w），高度居中
          fixedY = currentCenterY - MIN_NODE_SIZE / 2;
          movableY = currentCenterY + MIN_NODE_SIZE / 2;
          break;
      }
    }

    // 重新计算最终尺寸（修正后）
    newWidth = Math.abs(movableX - fixedX);
    newHeight = Math.abs(movableY - fixedY);

    // --- 7. 旋转坐标系转换（恢复旋转，精准计算最终位置） ---
    // 未旋转坐标系的新左上角
    const newUnrotatedX = Math.min(fixedX, movableX);
    const newUnrotatedY = Math.min(fixedY, movableY);

    // 未旋转坐标系的新中心点
    const newUnrotatedCenter = {
      x: newUnrotatedX + newWidth / 2,
      y: newUnrotatedY + newHeight / 2,
    };

    // 将新中心点旋转回原旋转坐标系
    // 注意：这里的旋转仍以 startCenterX/Y 为中心，这是正确的。
    const rotatedCenter = this.rotatePoint(
      newUnrotatedCenter,
      { x: startCenterX, y: startCenterY },
      startRotation
    );

    // 最终渲染的左上角坐标（基于旋转后的中心点）
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

  // ==================== 多选缩放操作 ====================

  /**
   * 开始多选缩放
   */
  startMultiResize(
    e: MouseEvent,
    handle: ResizeHandle,
    startBounds: { x: number; y: number; width: number; height: number },
    nodeIds: string[],
    isSpacePressed: boolean
  ) {
    if (isSpacePressed) return;
    // 检查：如果当前有任何变换操作正在进行，则直接退出！
    if (this.isTransforming) return;

    this.dragState.isDragging = false;
    this.dragState.type = null;
    this.dragState.nodeId = '';
    this.dragState.startTransformMap = {};
    this.resizeState.isResizing = false;

    const validNodeIds = nodeIds.filter((id) => {
      const node = this.store.nodes[id];
      return node && !node.isLocked;
    });
    if (validNodeIds.length === 0) return;

    const nodeStartStates: Record<string, NodeStartState> = {};
    validNodeIds.forEach((id) => {
      const node = this.store.nodes[id] as BaseNodeState;
      const offsetX =
        startBounds.width > 0 ? (node.transform.x - startBounds.x) / startBounds.width : 0;
      const offsetY =
        startBounds.height > 0 ? (node.transform.y - startBounds.y) / startBounds.height : 0;
      const scaleX = startBounds.width > 0 ? node.transform.width / startBounds.width : 0;
      const scaleY = startBounds.height > 0 ? node.transform.height / startBounds.height : 0;

      nodeStartStates[id] = {
        x: node.transform.x,
        y: node.transform.y,
        width: node.transform.width,
        height: node.transform.height,
        offsetX,
        offsetY,
        scaleX,
        scaleY,
      };
    });

    this.multiResizeState = {
      isMultiResizing: true,
      handle,
      nodeIds: validNodeIds,
      startBounds: { ...startBounds },
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      nodeStartStates,
    };

    this.store.isInteracting = true;
  }

  /**
   * 更新多选缩放
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
    } = this.multiResizeState;

    if (!isMultiResizing || !handle || nodeIds.length === 0) return;

    const startSignX = Math.sign(startBounds.width || 1);
    const startSignY = Math.sign(startBounds.height || 1);

    let dx = (e.clientX - startMouseX) / this.store.viewport.zoom;
    let dy = (e.clientY - startMouseY) / this.store.viewport.zoom;

    const isShiftPressed = e.shiftKey;
    const shouldEnforceBoundsRatio = isShiftPressed;

    // 尺寸预检测
    let tempNewWidth = startBounds.width;
    let tempNewHeight = startBounds.height;

    switch (handle) {
      case 'nw':
      case 'sw':
      case 'w':
        tempNewWidth = startBounds.width - dx;
        break;
      case 'ne':
      case 'se':
      case 'e':
        tempNewWidth = startBounds.width + dx;
        break;
    }

    switch (handle) {
      case 'nw':
      case 'ne':
      case 'n':
        tempNewHeight = startBounds.height - dy;
        break;
      case 'sw':
      case 'se':
      case 's':
        tempNewHeight = startBounds.height + dy;
        break;
    }

    // 水平方向修正
    if (Math.sign(tempNewWidth || 1) !== startSignX) {
      const lockWidth = MIN_NODE_SIZE * startSignX;
      if (handle.includes('w')) {
        dx = startBounds.width - lockWidth;
      } else if (handle.includes('e')) {
        dx = lockWidth - startBounds.width;
      }
    }

    if (Math.abs(tempNewWidth) < MIN_NODE_SIZE) {
      const isShrinking = (handle.includes('w') && dx > 0) || (handle.includes('e') && dx < 0);

      if (isShrinking) {
        const lockWidth = MIN_NODE_SIZE * startSignX;
        if (handle.includes('w')) {
          dx = startBounds.width - lockWidth;
        } else if (handle.includes('e')) {
          dx = lockWidth - startBounds.width;
        }
      }
    }

    // 垂直方向修正
    if (Math.sign(tempNewHeight || 1) !== startSignY) {
      const lockHeight = MIN_NODE_SIZE * startSignY;
      if (handle.includes('n')) {
        dy = startBounds.height - lockHeight;
      } else if (handle.includes('s')) {
        dy = lockHeight - startBounds.height;
      }
    }

    if (Math.abs(tempNewHeight) < MIN_NODE_SIZE) {
      const isShrinking = (handle.includes('n') && dy > 0) || (handle.includes('s') && dy < 0);

      if (isShrinking) {
        const lockHeight = MIN_NODE_SIZE * startSignY;
        if (handle.includes('n')) {
          dy = startBounds.height - lockHeight;
        } else if (handle.includes('s')) {
          dy = lockHeight - startBounds.height;
        }
      }
    }

    // 计算新边界框
    const newBounds = { ...startBounds };
    switch (handle) {
      case 'nw':
        newBounds.x = startBounds.x + dx;
        newBounds.y = startBounds.y + dy;
        newBounds.width = startBounds.width - dx;
        newBounds.height = startBounds.height - dy;
        break;
      case 'n':
        newBounds.y = startBounds.y + dy;
        newBounds.height = startBounds.height - dy;
        break;
      case 'ne':
        newBounds.y = startBounds.y + dy;
        newBounds.width = startBounds.width + dx;
        newBounds.height = startBounds.height - dy;
        break;
      case 'e':
        newBounds.width = startBounds.width + dx;
        break;
      case 'se':
        newBounds.width = startBounds.width + dx;
        newBounds.height = startBounds.height + dy;
        break;
      case 's':
        newBounds.height = startBounds.height + dy;
        break;
      case 'sw':
        newBounds.x = startBounds.x + dx;
        newBounds.width = startBounds.width - dx;
        newBounds.height = startBounds.height + dy;
        break;
      case 'w':
        newBounds.x = startBounds.x + dx;
        newBounds.width = startBounds.width - dx;
        break;
    }

    // 等比缩放计算
    if (shouldEnforceBoundsRatio) {
      const safeStartHeight =
        Math.abs(startBounds.height) < 1e-6 ? MIN_NODE_SIZE : startBounds.height;

      let ratioBasedWidth = newBounds.width;
      let ratioBasedHeight = newBounds.height;

      const isHorizontal = handle.includes('e') || handle.includes('w');
      const isVertical = handle.includes('n') || handle.includes('s');

      let scaleRatio = 1;
      if (isHorizontal && isVertical) {
        const widthRatio = newBounds.width / startBounds.width;
        const heightRatio = newBounds.height / safeStartHeight;
        scaleRatio = Math.abs(widthRatio) > Math.abs(heightRatio) ? widthRatio : heightRatio;
      } else if (isHorizontal) {
        scaleRatio = newBounds.width / startBounds.width;
      } else if (isVertical) {
        scaleRatio = newBounds.height / safeStartHeight;
      }

      ratioBasedWidth = startBounds.width * scaleRatio;
      ratioBasedHeight = startBounds.height * scaleRatio;

      ratioBasedWidth = Math.max(MIN_NODE_SIZE, Math.abs(ratioBasedWidth)) * startSignX;
      ratioBasedHeight = Math.max(MIN_NODE_SIZE, Math.abs(ratioBasedHeight)) * startSignY;

      if (!e.altKey) {
        if (handle.includes('w')) {
          newBounds.x = startBounds.x + startBounds.width - ratioBasedWidth;
        }
        if (handle.includes('n')) {
          newBounds.y = startBounds.y + startBounds.height - ratioBasedHeight;
        }
      }

      newBounds.width = ratioBasedWidth;
      newBounds.height = ratioBasedHeight;
    }

    // Alt 中心点缩放
    if (e.altKey) {
      const startBoundsCenterX = startBounds.x + startBounds.width / 2;
      const startBoundsCenterY = startBounds.y + startBounds.height / 2;
      newBounds.x = startBoundsCenterX - newBounds.width / 2;
      newBounds.y = startBoundsCenterY - newBounds.height / 2;
    }

    // 最终边界矫正
    if (Math.sign(newBounds.width || 1) !== startSignX) {
      newBounds.width = MIN_NODE_SIZE * startSignX;
    }
    if (Math.sign(newBounds.height || 1) !== startSignY) {
      newBounds.height = MIN_NODE_SIZE * startSignY;
    }
    if (Math.abs(newBounds.width) < MIN_NODE_SIZE) {
      newBounds.width = MIN_NODE_SIZE * startSignX;
    }
    if (Math.abs(newBounds.height) < MIN_NODE_SIZE) {
      newBounds.height = MIN_NODE_SIZE * startSignY;
    }

    // 转换为标准正尺寸表示
    const finalBounds = { ...newBounds };
    if (finalBounds.width < 0) {
      finalBounds.x = newBounds.x + newBounds.width;
      finalBounds.width = -newBounds.width;
    }
    if (finalBounds.height < 0) {
      finalBounds.y = newBounds.y + newBounds.height;
      finalBounds.height = -newBounds.height;
    }

    // 计算缩放比例并应用
    const finalScaleX = newBounds.width / startBounds.width;
    const finalScaleY = newBounds.height / startBounds.height;

    nodeIds.forEach((id) => {
      const startState = nodeStartStates[id];
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node || !startState) return;

      let newNodeWidth = startState.width * finalScaleX;
      let newNodeHeight = startState.height * finalScaleY;
      const newNodeX = finalBounds.x + startState.offsetX * finalBounds.width;
      const newNodeY = finalBounds.y + startState.offsetY * finalBounds.height;

      newNodeWidth = Math.max(MIN_NODE_SIZE, Math.abs(newNodeWidth)) * Math.sign(newNodeWidth || 1);
      newNodeHeight =
        Math.max(MIN_NODE_SIZE, Math.abs(newNodeHeight)) * Math.sign(newNodeHeight || 1);

      let finalNodeWidth = newNodeWidth;
      let finalNodeHeight = newNodeHeight;
      let finalNodeX = newNodeX;
      let finalNodeY = newNodeY;

      if (finalNodeWidth < 0) {
        finalNodeX = newNodeX + newNodeWidth;
        finalNodeWidth = -newNodeWidth;
      }
      if (finalNodeHeight < 0) {
        finalNodeY = newNodeY + newNodeHeight;
        finalNodeHeight = -newNodeHeight;
      }

      this.store.updateNode(id, {
        transform: {
          ...node.transform,
          x: finalNodeX,
          y: finalNodeY,
          width: finalNodeWidth,
          height: finalNodeHeight,
        },
      });
    });
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

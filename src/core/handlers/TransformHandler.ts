/**
 * @file TransformHandler.ts
 * @description 节点变换处理器 - 处理节点的拖拽和缩放
 *
 * 职责：
 * 1. 管理节点拖拽（单个/多个节点、区域框拖拽）
 * 2. 管理节点缩放（单个节点缩放、多选缩放）
 * 3. 处理 Shift/Ctrl 等比缩放
 * 4. 处理组合节点及其子节点的联动变换
 *
 * 特点：
 * - 有状态处理器：维护拖拽和缩放相关的私有状态
 * - 支持多选：可同时拖拽或缩放多个节点，保持相对位置和比例
 * - 组合联动：缩放组合节点时，子节点自动按比例调整
 * - 边界限制：最小尺寸保护，防止节点缩放到无效尺寸
 * - 等比缩放：按住 Shift 键可进行等比缩放
 *
 * 状态管理：
 * - dragState: 拖拽状态（包括多节点拖拽的初始变换映射）
 * - resizeState: 单节点缩放状态（包括组合子节点的初始状态）
 * - multiResizeState: 多选缩放状态（包括所有节点的位置/尺寸比例）
 *
 * 包含方法列表：
 *
 * 生命周期：
 * - constructor: 初始化处理器
 * - reset: 重置所有变换状态
 *
 * 拖拽方法：
 * - startNodeDrag: 开始节点拖拽
 * - updateDrag: 更新拖拽位置
 *
 * 单选缩放方法：
 * - startResize: 开始单节点缩放
 * - updateResize: 更新单节点缩放
 *
 * 多选缩放方法：
 * - startMultiResize: 开始多选缩放
 * - updateMultiResize: 更新多选缩放
 */

import { useCanvasStore } from '@/store/canvasStore';
import type { GroupState, BaseNodeState } from '@/types/state';
import { NodeType } from '@/types/state';
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

/** 单节点缩放状态 */
interface InternalResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  nodeId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startNodeX: number;
  startNodeY: number;
  /** 组合节点的子节点初始状态（相对于父节点） */
  childStartStates?: Record<string, { x: number; y: number; width: number; height: number }>;
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
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startNodeX: 0,
    startNodeY: 0,
    childStartStates: undefined,
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

  // ==================== 拖拽操作 ====================

  /**
   * 开始拖拽节点
   * @param e 鼠标事件
   * @param nodeId 节点ID
   * @param isSpacePressed 是否按下空格键
   */
  startNodeDrag(e: MouseEvent, nodeId: string, isSpacePressed: boolean) {
    // 空格键时不处理节点拖拽
    if (isSpacePressed) return;

    const node = this.store.nodes[nodeId];
    if (!node || node.isLocked) return;

    // 标记交互中
    this.store.isInteracting = true;

    // 准备拖拽状态
    const activeIds = Array.from(this.store.activeElementIds);
    const isMultiDrag = activeIds.length > 1;

    // 存储所有选中节点的初始变换
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
   * @param e 鼠标事件
   */
  updateDrag(e: MouseEvent) {
    if (!this.dragState.isDragging) return;

    const { startX, startY, startTransformMap } = this.dragState;
    const dx = (e.clientX - startX) / this.store.viewport.zoom;
    const dy = (e.clientY - startY) / this.store.viewport.zoom;

    // 遍历所有选中节点，应用相同的偏移
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

  /**
   * 获取当前是否正在拖拽
   */
  get isDragging(): boolean {
    return this.dragState.isDragging;
  }

  // ==================== 单节点缩放操作 ====================

  /**
   * 开始单节点缩放
   * @param e 鼠标事件
   * @param nodeId 节点ID
   * @param handle 缩放控制点
   */
  startResize(e: MouseEvent, nodeId: string, handle: ResizeHandle) {
    const node = this.store.nodes[nodeId];
    if (!node || node.isLocked) return;

    // 标记交互中
    this.store.isInteracting = true;

    // 重置拖拽状态，确保不会与缩放冲突
    this.dragState.isDragging = false;
    this.dragState.type = null;
    this.dragState.nodeId = '';

    // 如果是组合节点，递归存储所有后代节点的初始状态
    let childStartStates:
      | Record<string, { x: number; y: number; width: number; height: number }>
      | undefined;
    if (node.type === NodeType.GROUP) {
      childStartStates = {};

      // 递归收集所有后代节点的初始状态
      const collectDescendants = (groupNode: GroupState) => {
        groupNode.children.forEach((childId) => {
          const child = this.store.nodes[childId];
          if (!child) return;

          // 存储节点相对于其父节点的原始坐标
          childStartStates![childId] = {
            x: child.transform.x,
            y: child.transform.y,
            width: child.transform.width,
            height: child.transform.height,
          };

          // 如果子节点也是组合，递归收集其子节点
          if (child.type === NodeType.GROUP) {
            collectDescendants(child as GroupState);
          }
        });
      };

      collectDescendants(node as GroupState);
    }

    this.resizeState = {
      isResizing: true,
      handle,
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: node.transform.width,
      startHeight: node.transform.height,
      startNodeX: node.transform.x,
      startNodeY: node.transform.y,
      childStartStates,
    };
  }

  /**
   * 更新单节点缩放（核心修正：最小尺寸吸附逻辑 + 禁用拖拽翻转）
   * @param e 鼠标事件
   */
  updateResize(e: MouseEvent) {
    if (!this.resizeState.isResizing || !this.resizeState.handle) return;

    const {
      handle,
      nodeId,
      startX,
      startY,
      startWidth,
      startHeight,
      startNodeX,
      startNodeY,
      childStartStates,
    } = this.resizeState;

    const node = this.store.nodes[nodeId];
    if (!node) return;

    // 记录初始尺寸的符号，用于强制不翻转
    const startSignX = Math.sign(startWidth || 1);
    const startSignY = Math.sign(startHeight || 1);

    // **核心优化：当达到最小尺寸时，将该方向的 dx/dy 设为 0**
    let dx = (e.clientX - startX) / this.store.viewport.zoom;
    let dy = (e.clientY - startY) / this.store.viewport.zoom;

    // 区分“四角拖拽”/“四边拖拽”
    const isCorner = handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';
    const nodeType = node.type;
    const isShiftPressed = e.shiftKey;
    let shouldEnforceRatio = false;

    // 基础规则：图片四角拖拽默认等比
    if (nodeType === NodeType.IMAGE && isCorner) {
      shouldEnforceRatio = true;
    }

    // 叠加Shift键规则：Shift强制等比（覆盖或启用）
    if (isShiftPressed) {
      if (nodeType !== NodeType.IMAGE) {
        shouldEnforceRatio = true;
      }
    }

    // ======================================================
    // 最小尺寸/翻转吸附预检测 (修正 dx, dy)
    // ======================================================

    // 1. 计算当前尝试的新尺寸 (用于预检测)
    let tempNewWidth = startWidth;
    let tempNewHeight = startHeight;

    switch (handle) {
      case 'nw':
      case 'sw':
      case 'w':
        tempNewWidth = startWidth - dx;
        break;
      case 'ne':
      case 'se':
      case 'e':
        tempNewWidth = startWidth + dx;
        break;
    }

    switch (handle) {
      case 'nw':
      case 'ne':
      case 'n':
        tempNewHeight = startHeight - dy;
        break;
      case 'sw':
      case 'se':
      case 's':
        tempNewHeight = startHeight + dy;
        break;
    }

    // 2. 水平方向修正
    // 2a. 翻转修正
    if (Math.sign(tempNewWidth || 1) !== startSignX) {
      // 尺寸尝试翻转，将新尺寸锁定为 MIN_NODE_SIZE * startSignX
      const lockWidth = MIN_NODE_SIZE * startSignX;
      if (handle.includes('w')) {
        // 拖动左侧：dx 应等于 startWidth - lockWidth
        dx = startWidth - lockWidth;
      } else if (handle.includes('e')) {
        // 拖动右侧：dx 应等于 lockWidth - startWidth
        dx = lockWidth - startWidth;
      }
    }

    // 2b. 最小尺寸吸附修正 (防止继续向内缩小)
    if (Math.abs(tempNewWidth) < MIN_NODE_SIZE) {
      const isShrinking =
        (handle.includes('w') && dx > 0) || // 拖动左侧且向右 (缩小)
        (handle.includes('e') && dx < 0); // 拖动右侧且向左 (缩小)

      if (isShrinking) {
        // 锁定尺寸为 MIN_NODE_SIZE，并保留符号
        const lockWidth = MIN_NODE_SIZE * startSignX;

        if (handle.includes('w')) {
          // 拖动左侧：dx 修正为恰好达到最小尺寸
          dx = startWidth - lockWidth;
        } else if (handle.includes('e')) {
          // 拖动右侧：dx 修正为恰好达到最小尺寸
          dx = lockWidth - startWidth;
        }
      }
    }

    // 3. 垂直方向修正 (同理)
    // 3a. 翻转修正
    if (Math.sign(tempNewHeight || 1) !== startSignY) {
      const lockHeight = MIN_NODE_SIZE * startSignY;
      if (handle.includes('n')) {
        dy = startHeight - lockHeight;
      } else if (handle.includes('s')) {
        dy = lockHeight - startHeight;
      }
    }

    // 3b. 最小尺寸吸附修正
    if (Math.abs(tempNewHeight) < MIN_NODE_SIZE) {
      const isShrinking =
        (handle.includes('n') && dy > 0) || // 拖动上侧且向下 (缩小)
        (handle.includes('s') && dy < 0); // 拖动下侧且向上 (缩小)

      if (isShrinking) {
        const lockHeight = MIN_NODE_SIZE * startSignY;

        if (handle.includes('n')) {
          dy = startHeight - lockHeight;
        } else if (handle.includes('s')) {
          dy = lockHeight - startHeight;
        }
      }
    }

    // 4. 等比缩放时，使用修正后的 dx/dy 重新计算另一个轴的修正值
    if (shouldEnforceRatio) {
      const safeStartWidth = Math.abs(startWidth) < 1e-6 ? MIN_NODE_SIZE : startWidth;
      const safeStartHeight = Math.abs(startHeight) < 1e-6 ? MIN_NODE_SIZE : startHeight;
      const baseRatio = safeStartWidth / safeStartHeight;

      // 如果只有其中一个轴被修正，则需要更新另一个轴
      const isHorizontal = handle.includes('e') || handle.includes('w');
      const isVertical = handle.includes('n') || handle.includes('s');

      // **注意：由于翻转和最小尺寸通常是最终的限制，等比逻辑应该在应用 dx/dy 之前进行，
      // 但为了实现“达到最小值后 dx/dy 失效”的精确控制，我们暂时忽略等比导致的二次修正
      // 因为最小尺寸的优先级最高，这里只进行简单的位置和尺寸更新。
      // 等比的最终修正将在步骤3中处理**
    }

    // 步骤1：根据修正后的 dx/dy 重新计算尺寸/位置
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newX = startNodeX;
    let newY = startNodeY;

    switch (handle) {
      case 'nw': // 左上（四角）
        newX = startNodeX + dx;
        newY = startNodeY + dy;
        newWidth = startWidth - dx;
        newHeight = startHeight - dy;
        break;
      case 'n': // 上（四边）
        newY = startNodeY + dy;
        newHeight = startHeight - dy;
        break;
      case 'ne': // 右上（四角）
        newY = startNodeY + dy;
        newWidth = startWidth + dx;
        newHeight = startHeight - dy;
        break;
      case 'e': // 右（四边）
        newWidth = startWidth + dx;
        break;
      case 'se': // 右下（四角）
        newWidth = startWidth + dx;
        newHeight = startHeight + dy;
        break;
      case 's': // 下（四边）
        newHeight = startHeight + dy;
        break;
      case 'sw': // 左下（四角）
        newX = startNodeX + dx;
        newWidth = startWidth - dx;
        newHeight = startHeight + dy;
        break;
      case 'w': // 左（四边）
        newX = startNodeX + dx;
        newWidth = startWidth - dx;
        break;
    }

    // 步骤2：处理Alt键的“中心点缩放”
    const isAltPressed = e.altKey;
    if (isAltPressed) {
      const startCenterX = startNodeX + startWidth / 2;
      const startCenterY = startNodeY + startHeight / 2;

      // 重新计算 Alt 模式下的新尺寸 (基于修正后的 dx/dy)
      const centerDx = handle.includes('w') || handle.includes('e') ? dx : 0;
      const centerDy = handle.includes('n') || handle.includes('s') ? dy : 0;

      // Alt模式下，尺寸变化是常规模式的两倍，但由于修正后的dx/dy已经是最终限制尺寸，
      // 我们直接使用新尺寸，并让中心保持不变

      let altNewWidth =
        startWidth +
        (handle.includes('w') ? -centerDx * 2 : handle.includes('e') ? centerDx * 2 : 0);
      let altNewHeight =
        startHeight +
        (handle.includes('n') ? -centerDy * 2 : handle.includes('s') ? centerDy * 2 : 0);

      // 避免 Alt 模式下重新引入翻转/最小尺寸问题 (因为 dx/dy 已经被修正，所以这里只是防止浮点数问题)
      altNewWidth = Math.max(MIN_NODE_SIZE, Math.abs(altNewWidth)) * startSignX;
      altNewHeight = Math.max(MIN_NODE_SIZE, Math.abs(altNewHeight)) * startSignY;

      newWidth = altNewWidth;
      newHeight = altNewHeight;
      newX = startCenterX - newWidth / 2;
      newY = startCenterY - newHeight / 2;
    }

    // 步骤3：执行等比缩放计算 (如果需要，并保证最小尺寸和翻转已经被步骤5预修正)
    if (shouldEnforceRatio) {
      const safeStartHeight = Math.abs(startHeight) < 1e-6 ? MIN_NODE_SIZE : startHeight;
      const baseRatio = startWidth / safeStartHeight;

      let ratioBasedWidth = newWidth;
      let ratioBasedHeight = newHeight;

      const isHorizontal = handle.includes('e') || handle.includes('w');
      const isVertical = handle.includes('n') || handle.includes('s');

      // 计算缩放比，使用较大的比值来保持等比
      let scaleRatio = 1;
      if (isHorizontal && isVertical) {
        const widthRatio = newWidth / startWidth;
        const heightRatio = newHeight / startHeight;
        scaleRatio = Math.abs(widthRatio) > Math.abs(heightRatio) ? widthRatio : heightRatio;
      } else if (isHorizontal) {
        // 仅水平拖拽，但被强制等比，以水平为基准
        scaleRatio = newWidth / startWidth;
      } else if (isVertical) {
        // 仅垂直拖拽，但被强制等比，以垂直为基准
        scaleRatio = newHeight / startHeight;
      }

      ratioBasedWidth = startWidth * scaleRatio;
      ratioBasedHeight = startHeight * scaleRatio;

      // 确保等比后的尺寸仍然满足最小尺寸和不翻转 (防止浮点数误差)
      ratioBasedWidth = Math.max(MIN_NODE_SIZE, Math.abs(ratioBasedWidth)) * startSignX;
      ratioBasedHeight = Math.max(MIN_NODE_SIZE, Math.abs(ratioBasedHeight)) * startSignY;

      if (nodeType === NodeType.CIRCLE) {
        const absWidth = Math.abs(ratioBasedWidth);
        const absHeight = Math.abs(ratioBasedHeight);
        const maxSize = Math.max(absWidth, absHeight);

        ratioBasedWidth = maxSize * Math.sign(ratioBasedWidth);
        ratioBasedHeight = maxSize * Math.sign(ratioBasedHeight);
      }

      // 调整位置（适配等比后的尺寸）
      // 如果是Alt模式，位置在步骤2已经计算过
      if (!isAltPressed) {
        if (handle.includes('w')) {
          newX = startNodeX + startWidth - ratioBasedWidth;
        }
        if (handle.includes('n')) {
          newY = startNodeY + startHeight - ratioBasedHeight;
        }
      }

      newWidth = ratioBasedWidth;
      newHeight = ratioBasedHeight;
    }

    // 步骤 4：转换为标准正尺寸表示 (处理负值，应用于渲染/存储)
    let finalWidth = newWidth;
    let finalHeight = newHeight;
    let finalX = newX;
    let finalY = newY;

    if (finalWidth < 0) {
      finalX = newX + newWidth;
      finalWidth = -newWidth;
    }

    if (finalHeight < 0) {
      finalY = newY + newHeight;
      finalHeight = -newHeight;
    }

    // 步骤 5：应用缩放（文本仅调整容器）
    if (node.type === NodeType.TEXT) {
      this.store.updateNode(nodeId, {
        transform: {
          ...node.transform,
          x: finalX,
          y: finalY,
          width: finalWidth,
          height: finalHeight,
        },
      });
      return;
    }

    // 非文本节点：应用缩放
    this.store.updateNode(nodeId, {
      transform: {
        ...node.transform,
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
      },
    });

    // 组合节点：同步缩放所有子节点
    if (node.type === NodeType.GROUP && childStartStates) {
      const scaleX = newWidth / startWidth;
      const scaleY = newHeight / startHeight;

      (node as GroupState).children.forEach((childId) => {
        const child = this.store.nodes[childId];
        const childStart = childStartStates[childId];
        if (!child || !childStart) return;

        // 缩放子节点尺寸，并应用最小尺寸保护
        const rawChildWidth = childStart.width * scaleX;
        const rawChildHeight = childStart.height * scaleY;

        // 最小尺寸限制 (保留符号)
        let newChildWidth =
          Math.max(MIN_NODE_SIZE, Math.abs(rawChildWidth)) * Math.sign(rawChildWidth || 1);
        let newChildHeight =
          Math.max(MIN_NODE_SIZE, Math.abs(rawChildHeight)) * Math.sign(rawChildHeight || 1);

        // 子节点的新位置 (相对于父节点)
        let newOffsetX = childStart.x * scaleX;
        let newOffsetY = childStart.y * scaleY;

        // 将子节点转换为标准正尺寸表示
        let finalChildWidth = newChildWidth;
        let finalChildHeight = newChildHeight;
        let finalChildX = newOffsetX;
        let finalChildY = newOffsetY;

        if (finalChildWidth < 0) {
          finalChildX = newOffsetX + newChildWidth;
          finalChildWidth = -newChildWidth;
        }

        if (finalChildHeight < 0) {
          finalChildY = newOffsetY + newChildHeight;
          finalChildHeight = -newChildHeight;
        }

        // 更新子节点
        this.store.updateNode(childId, {
          transform: {
            ...child.transform,
            x: finalChildX,
            y: finalChildY,
            width: finalChildWidth,
            height: finalChildHeight,
          },
        });
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
      this.resizeState.childStartStates = undefined;
      this.store.isInteracting = false;
    }
  }

  /**
   * 获取当前是否正在缩放
   */
  get isResizing(): boolean {
    return this.resizeState.isResizing;
  }

  // ==================== 多选缩放操作 ====================

  /**
   * 开始多选缩放
   * @param e 鼠标事件
   * @param handle 缩放控制点
   * @param startBounds 初始边界框
   * @param nodeIds 节点ID列表
   * @param isSpacePressed 是否按下空格键
   */
  startMultiResize(
    e: MouseEvent,
    handle: ResizeHandle,
    startBounds: { x: number; y: number; width: number; height: number },
    nodeIds: string[],
    isSpacePressed: boolean
  ) {
    // 空格键时不处理多选缩放
    if (isSpacePressed) return;

    // 互斥：重置拖拽/单选缩放状态
    this.dragState.isDragging = false;
    this.dragState.type = null;
    this.dragState.nodeId = '';
    this.dragState.startTransformMap = {};
    this.resizeState.isResizing = false;

    // 过滤锁定节点
    const validNodeIds = nodeIds.filter((id) => {
      const node = this.store.nodes[id];
      return node && !node.isLocked;
    });
    if (validNodeIds.length === 0) return;

    // 初始化每个节点的初始状态
    const nodeStartStates: Record<string, NodeStartState> = {};
    validNodeIds.forEach((id) => {
      const node = this.store.nodes[id] as BaseNodeState;
      // 计算节点相对于大框的偏移比例和尺寸比例
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
   * 更新多选缩放（核心修正：最小尺寸吸附逻辑 + 禁用缩放翻转）
   * @param e 鼠标事件
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

    // 记录初始尺寸的符号，用于强制不翻转
    const startSignX = Math.sign(startBounds.width || 1);
    const startSignY = Math.sign(startBounds.height || 1);

    // **核心优化：当达到最小尺寸时，将该方向的 dx/dy 设为 0**
    let dx = (e.clientX - startMouseX) / this.store.viewport.zoom;
    let dy = (e.clientY - startMouseY) / this.store.viewport.zoom;

    const isShiftPressed = e.shiftKey;
    let shouldEnforceBoundsRatio = isShiftPressed; // 多选时 Shift 键默认强制等比

    // ======================================================
    // 最小尺寸/翻转吸附预检测 (修正 dx, dy)
    // ======================================================

    // 1. 计算当前尝试的新尺寸 (用于预检测)
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

    // 2. 水平方向修正
    // 2a. 翻转修正
    if (Math.sign(tempNewWidth || 1) !== startSignX) {
      // 尺寸尝试翻转
      const lockWidth = MIN_NODE_SIZE * startSignX;
      if (handle.includes('w')) {
        dx = startBounds.width - lockWidth;
      } else if (handle.includes('e')) {
        dx = lockWidth - startBounds.width;
      }
    }

    // 2b. 最小尺寸吸附修正 (防止继续向内缩小)
    if (Math.abs(tempNewWidth) < MIN_NODE_SIZE) {
      const isShrinking =
        (handle.includes('w') && dx > 0) || // 拖动左侧且向右 (缩小)
        (handle.includes('e') && dx < 0); // 拖动右侧且向左 (缩小)

      if (isShrinking) {
        // 锁定尺寸为 MIN_NODE_SIZE，并保留符号
        const lockWidth = MIN_NODE_SIZE * startSignX;

        if (handle.includes('w')) {
          // 拖动左侧：dx 修正为恰好达到最小尺寸
          dx = startBounds.width - lockWidth;
        } else if (handle.includes('e')) {
          // 拖动右侧：dx 修正为恰好达到最小尺寸
          dx = lockWidth - startBounds.width;
        }
      }
    }

    // 3. 垂直方向修正 (同理)
    // 3a. 翻转修正
    if (Math.sign(tempNewHeight || 1) !== startSignY) {
      const lockHeight = MIN_NODE_SIZE * startSignY;
      if (handle.includes('n')) {
        dy = startBounds.height - lockHeight;
      } else if (handle.includes('s')) {
        dy = lockHeight - startBounds.height;
      }
    }

    // 3b. 最小尺寸吸附修正
    if (Math.abs(tempNewHeight) < MIN_NODE_SIZE) {
      const isShrinking =
        (handle.includes('n') && dy > 0) || // 拖动上侧且向下 (缩小)
        (handle.includes('s') && dy < 0); // 拖动下侧且向上 (缩小)

      if (isShrinking) {
        const lockHeight = MIN_NODE_SIZE * startSignY;

        if (handle.includes('n')) {
          dy = startBounds.height - lockHeight;
        } else if (handle.includes('s')) {
          dy = lockHeight - startBounds.height;
        }
      }
    }

    // 步骤1：计算大框的基础尺寸/位置（使用修正后的 dx/dy）
    const newBounds = { ...startBounds };
    switch (handle) {
      case 'nw': // 左上
        newBounds.x = startBounds.x + dx;
        newBounds.y = startBounds.y + dy;
        newBounds.width = startBounds.width - dx;
        newBounds.height = startBounds.height - dy;
        break;
      case 'n': // 上
        newBounds.y = startBounds.y + dy;
        newBounds.height = startBounds.height - dy;
        break;
      case 'ne': // 右上
        newBounds.y = startBounds.y + dy;
        newBounds.width = startBounds.width + dx;
        newBounds.height = startBounds.height - dy;
        break;
      case 'e': // 右
        newBounds.width = startBounds.width + dx;
        break;
      case 'se': // 右下
        newBounds.width = startBounds.width + dx;
        newBounds.height = startBounds.height + dy;
        break;
      case 's': // 下
        newBounds.height = startBounds.height + dy;
        break;
      case 'sw': // 左下
        newBounds.x = startBounds.x + dx;
        newBounds.width = startBounds.width - dx;
        newBounds.height = startBounds.height + dy;
        break;
      case 'w': // 左
        newBounds.x = startBounds.x + dx;
        newBounds.width = startBounds.width - dx;
        break;
    }

    // 步骤2&3：等比缩放计算
    const isAltPressed = e.altKey;
    const isCorner = handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';

    if (shouldEnforceBoundsRatio) {
      const safeStartHeight =
        Math.abs(startBounds.height) < 1e-6 ? MIN_NODE_SIZE : startBounds.height;
      const originalRatio = startBounds.width / safeStartHeight;

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

      // 确保等比后的尺寸仍然满足最小尺寸和不翻转 (防止浮点数误差)
      ratioBasedWidth = Math.max(MIN_NODE_SIZE, Math.abs(ratioBasedWidth)) * startSignX;
      ratioBasedHeight = Math.max(MIN_NODE_SIZE, Math.abs(ratioBasedHeight)) * startSignY;

      // 调整大框位置（八点固定原则）
      if (!isAltPressed) {
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

    // 步骤4：Alt中心点缩放（大框中心点）
    if (isAltPressed) {
      const startBoundsCenterX = startBounds.x + startBounds.width / 2;
      const startBoundsCenterY = startBounds.y + startBounds.height / 2;

      // 避免 Alt 模式下重新引入翻转/最小尺寸问题 (因为 dx/dy 已经被修正)
      newBounds.x = startBoundsCenterX - newBounds.width / 2;
      newBounds.y = startBoundsCenterY - newBounds.height / 2;
    }

    // ======================================================
    // 步骤 5：最终边界矫正 (主要处理浮点数误差)
    // 因为 dx/dy 已经修正过，这里只是确认最终边界的有效性
    // ======================================================

    // 1. 强制保持宽度符号 (大框，禁用翻转)
    if (Math.sign(newBounds.width || 1) !== startSignX) {
      newBounds.width = MIN_NODE_SIZE * startSignX;
    }

    // 2. 强制保持高度符号 (大框，禁用翻转)
    if (Math.sign(newBounds.height || 1) !== startSignY) {
      newBounds.height = MIN_NODE_SIZE * startSignY;
    }

    // 3. 最小尺寸限制
    if (Math.abs(newBounds.width) < MIN_NODE_SIZE) {
      newBounds.width = MIN_NODE_SIZE * startSignX;
    }
    if (Math.abs(newBounds.height) < MIN_NODE_SIZE) {
      newBounds.height = MIN_NODE_SIZE * startSignY;
    }
    // ------------------------------------------------------

    // 步骤6：转换为标准正尺寸表示 (处理负值)
    let finalBounds = { ...newBounds };

    if (finalBounds.width < 0) {
      finalBounds.x = newBounds.x + newBounds.width;
      finalBounds.width = -newBounds.width;
    }

    if (finalBounds.height < 0) {
      finalBounds.y = newBounds.y + newBounds.height;
      finalBounds.height = -newBounds.height;
    }

    // 步骤7：遍历节点应用缩放
    // 注意：这里使用 newBounds/startBounds 的带符号尺寸来计算比例，以保证比例的正确性
    const finalScaleX = newBounds.width / startBounds.width;
    const finalScaleY = newBounds.height / startBounds.height;

    nodeIds.forEach((id) => {
      const startState = nodeStartStates[id];
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node || !startState) return;

      const nodeType = node.type;

      // 使用带符号的比例计算原始新尺寸和位置
      let newNodeWidth = startState.width * finalScaleX;
      let newNodeHeight = startState.height * finalScaleY;
      let newNodeX = finalBounds.x + startState.offsetX * newBounds.width;
      let newNodeY = finalBounds.y + startState.offsetY * newBounds.height;

      // 特殊规则（保持符号）
      if (nodeType === NodeType.IMAGE && isCorner) {
        const safeStartWidth = Math.abs(startState.width) < 1e-6 ? MIN_NODE_SIZE : startState.width;
        newNodeHeight = (startState.height / safeStartWidth) * newNodeWidth;
      }

      if (nodeType === NodeType.CIRCLE) {
        const avgSize = (Math.abs(newNodeWidth) + Math.abs(newNodeHeight)) / 2;
        newNodeWidth = avgSize * Math.sign(newNodeWidth || 1);
        newNodeHeight = avgSize * Math.sign(newNodeHeight || 1);
      }

      // 最小尺寸限制 (保持符号，防止子节点尺寸小于最小尺寸)
      newNodeWidth = Math.max(MIN_NODE_SIZE, Math.abs(newNodeWidth)) * Math.sign(newNodeWidth || 1);
      newNodeHeight =
        Math.max(MIN_NODE_SIZE, Math.abs(newNodeHeight)) * Math.sign(newNodeHeight || 1);

      // 转换为标准正尺寸表示
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

      // 更新节点
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

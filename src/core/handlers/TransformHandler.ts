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
   * 更新单节点缩放（适配表格规则）
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

    // 计算鼠标偏移（世界坐标系）
    const dx = (e.clientX - startX) / this.store.viewport.zoom;
    const dy = (e.clientY - startY) / this.store.viewport.zoom;

    // 初始默认值（自由缩放）
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newX = startNodeX;
    let newY = startNodeY;

    // 区分“四角拖拽”/“四边拖拽”
    const isCorner = handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';
    const nodeType = node.type;

    // 步骤1：根据handle计算基础的尺寸/位置（自由缩放）
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

    // 步骤2：根据“图形类型+拖拽类型+Shift键”确定是否等比缩放
    let shouldEnforceRatio = false;
    let isImageOriginalRatio = false; // 图片是否用“原比例”等比
    const isShiftPressed = e.shiftKey;

    // 基础规则：图形类型+拖拽类型的默认等比
    switch (nodeType) {
      case NodeType.IMAGE:
        // 图片：四角拖拽 → 原比例等比缩放
        shouldEnforceRatio = isCorner;
        isImageOriginalRatio = isCorner;
        break;
      case NodeType.RECT:
      case NodeType.TEXT:
      case NodeType.CIRCLE:
        // 矩形/文本/圆形：默认自由缩放
        shouldEnforceRatio = false;
        break;
    }

    // 叠加Shift键规则
    switch (nodeType) {
      case NodeType.RECT:
      case NodeType.TEXT:
        // 矩形/文本：Shift → 当前比例等比缩放
        if (isShiftPressed) shouldEnforceRatio = true;
        break;
      case NodeType.CIRCLE:
        // 圆形：Shift → 强制正圆（等比）
        if (isShiftPressed) shouldEnforceRatio = true;
        break;
      case NodeType.IMAGE:
        // 图片：Shift无效果
        break;
    }

    // 步骤3：执行等比缩放计算
    if (shouldEnforceRatio) {
      // 确定等比基准（图片用原比例，其他用当前初始比例）
      const safeStartHeight = Math.abs(startHeight) < 1e-6 ? MIN_NODE_SIZE : startHeight;
      const baseRatio = startWidth / safeStartHeight;

      let ratioBasedWidth = newWidth;
      let ratioBasedHeight = newHeight;

      const isHorizontal = handle.includes('e') || handle.includes('w');
      const isVertical = handle.includes('n') || handle.includes('s');

      // 计算等比后的尺寸
      if (isHorizontal && isVertical) {
        // 角点缩放：按缩放比例最大的维度对齐
        const widthRatio = newWidth / startWidth;
        const heightRatio = newHeight / safeStartHeight;
        const scaleRatio =
          Math.abs(widthRatio) > Math.abs(heightRatio)
            ? Math.abs(widthRatio) * Math.sign(widthRatio)
            : Math.abs(heightRatio) * Math.sign(heightRatio);
        ratioBasedWidth = startWidth * scaleRatio;
        ratioBasedHeight = startHeight * scaleRatio;
      } else if (isHorizontal) {
        // 水平缩放：按宽度等比调整高度
        ratioBasedHeight = ratioBasedWidth / baseRatio;
      } else if (isVertical) {
        // 垂直缩放：按高度等比调整宽度
        ratioBasedWidth = ratioBasedHeight * baseRatio;
      }

      // 圆形特殊规则：Shift强制正圆（宽高相等）
      if (nodeType === NodeType.CIRCLE) {
        const avgSize = (Math.abs(ratioBasedWidth) + Math.abs(ratioBasedHeight)) / 2;
        ratioBasedWidth = avgSize * Math.sign(ratioBasedWidth || 1);
        ratioBasedHeight = avgSize * Math.sign(ratioBasedHeight || 1);
      }

      // 调整位置（适配等比后的尺寸）
      if (handle === 'nw') {
        newX = startNodeX + startWidth - ratioBasedWidth;
        newY = startNodeY + startHeight - ratioBasedHeight;
      } else if (handle === 'ne') {
        newY = startNodeY + startHeight - ratioBasedHeight;
      } else if (handle === 'sw') {
        newX = startNodeX + startWidth - ratioBasedWidth;
      }

      // 覆盖为等比后的尺寸
      newWidth = ratioBasedWidth;
      newHeight = ratioBasedHeight;
    }

    // 步骤4：处理Alt键的“中心点缩放”
    const isAltPressed = e.altKey;
    if (isAltPressed) {
      // 计算初始中心点
      const startCenterX = startNodeX + startWidth / 2;
      const startCenterY = startNodeY + startHeight / 2;

      // 图片Alt规则：中心点+等比缩放
      if (nodeType === NodeType.IMAGE) {
        const originalRatio =
          startWidth / (Math.abs(startHeight) < 1e-6 ? MIN_NODE_SIZE : startHeight);
        newHeight = newWidth / originalRatio;
      }

      // 重置位置为“中心点对齐”
      newX = startCenterX - newWidth / 2;
      newY = startCenterY - newHeight / 2;
    }

    // 步骤5：最小尺寸限制
    const clampedWidth = Math.max(MIN_NODE_SIZE, Math.abs(newWidth)) * Math.sign(newWidth || 1);
    const clampedHeight = Math.max(MIN_NODE_SIZE, Math.abs(newHeight)) * Math.sign(newHeight || 1);

    // 尺寸 clamp 后调整位置（仅影响拖拽侧）
    if (Math.abs(newWidth) < MIN_NODE_SIZE) {
      switch (handle) {
        case 'nw':
        case 'w':
        case 'sw':
          newX = startNodeX + startWidth - MIN_NODE_SIZE;
          break;
      }
    }
    if (Math.abs(newHeight) < MIN_NODE_SIZE) {
      switch (handle) {
        case 'nw':
        case 'n':
        case 'ne':
          newY = startNodeY + startHeight - MIN_NODE_SIZE;
          break;
      }
    }

    // 步骤6：应用缩放（文本仅调整容器）
    if (node.type === NodeType.TEXT) {
      this.store.updateNode(nodeId, {
        transform: {
          ...node.transform,
          x: newX,
          y: newY,
          width: clampedWidth,
          height: clampedHeight,
        },
      });
      return;
    }

    // 非文本节点：应用缩放
    this.store.updateNode(nodeId, {
      transform: {
        ...node.transform,
        x: newX,
        y: newY,
        width: clampedWidth,
        height: clampedHeight,
      },
    });

    // 组合节点：同步缩放所有子节点
    if (node.type === NodeType.GROUP && childStartStates) {
      const scaleX = clampedWidth / startWidth;
      const scaleY = clampedHeight / startHeight;

      (node as GroupState).children.forEach((childId) => {
        const child = this.store.nodes[childId];
        const childStart = childStartStates[childId];
        if (!child || !childStart) return;

        // childStart.x/y 已经是相对于组合的坐标，直接缩放即可
        const newOffsetX = childStart.x * scaleX;
        const newOffsetY = childStart.y * scaleY;

        // 缩放子节点尺寸
        const newChildWidth = Math.max(MIN_NODE_SIZE, childStart.width * scaleX);
        const newChildHeight = Math.max(MIN_NODE_SIZE, childStart.height * scaleY);

        // 更新子节点（保持相对坐标）
        this.store.updateNode(childId, {
          transform: {
            ...child.transform,
            x: newOffsetX,
            y: newOffsetY,
            width: newChildWidth,
            height: newChildHeight,
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
   * 更新多选缩放（适配表格规则）
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

    // 计算鼠标偏移（世界坐标系）
    const dx = (e.clientX - startMouseX) / this.store.viewport.zoom;
    const dy = (e.clientY - startMouseY) / this.store.viewport.zoom;

    // 步骤1：计算大框的基础尺寸/位置（自由缩放）
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

    // 步骤2：根据“Shift键+图形类型”确定等比规则
    const isShiftPressed = e.shiftKey;
    const isAltPressed = e.altKey;
    const isCorner = handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';

    // 大框等比规则（仅影响非图片节点，图片单独处理）
    let shouldEnforceBoundsRatio = false;
    if (isShiftPressed) {
      // 多选时Shift：非图片节点等比，图片忽略
      shouldEnforceBoundsRatio = nodeIds.some((id) => {
        const node = this.store.nodes[id];
        return node?.type !== NodeType.IMAGE;
      });
    }

    // 步骤3：大框等比缩放计算
    if (shouldEnforceBoundsRatio) {
      const safeStartHeight =
        Math.abs(startBounds.height) < 1e-6 ? MIN_NODE_SIZE : startBounds.height;
      const originalRatio = startBounds.width / safeStartHeight;

      let ratioBasedWidth = newBounds.width;
      let ratioBasedHeight = newBounds.height;

      const isHorizontal = handle.includes('e') || handle.includes('w');
      const isVertical = handle.includes('n') || handle.includes('s');

      if (isHorizontal && isVertical) {
        const widthRatio = newBounds.width / startBounds.width;
        const heightRatio = newBounds.height / safeStartHeight;
        const scaleRatio =
          Math.abs(widthRatio) > Math.abs(heightRatio)
            ? Math.abs(widthRatio) * Math.sign(widthRatio)
            : Math.abs(heightRatio) * Math.sign(heightRatio);
        ratioBasedWidth = startBounds.width * scaleRatio;
        ratioBasedHeight = startBounds.height * scaleRatio;
      } else if (isHorizontal) {
        ratioBasedHeight = ratioBasedWidth / originalRatio;
      } else if (isVertical) {
        ratioBasedWidth = ratioBasedHeight * originalRatio;
      }

      // 调整大框位置
      if (handle === 'nw') {
        newBounds.x = startBounds.x + startBounds.width - ratioBasedWidth;
        newBounds.y = startBounds.y + startBounds.height - ratioBasedHeight;
      } else if (handle === 'ne') {
        newBounds.y = startBounds.y + startBounds.height - ratioBasedHeight;
      } else if (handle === 'sw') {
        newBounds.x = startBounds.x + startBounds.width - ratioBasedWidth;
      }

      newBounds.width = ratioBasedWidth;
      newBounds.height = ratioBasedHeight;
    }

    // 步骤4：Alt中心点缩放（大框中心点）
    if (isAltPressed) {
      const startBoundsCenterX = startBounds.x + startBounds.width / 2;
      const startBoundsCenterY = startBounds.y + startBounds.height / 2;
      newBounds.x = startBoundsCenterX - newBounds.width / 2;
      newBounds.y = startBoundsCenterY - newBounds.height / 2;
    }

    // 步骤5：最小尺寸限制
    newBounds.width = Math.max(MIN_NODE_SIZE, newBounds.width);
    newBounds.height = Math.max(MIN_NODE_SIZE, newBounds.height);

    // 步骤6：遍历节点应用缩放（适配各图形规则）
    nodeIds.forEach((id) => {
      const startState = nodeStartStates[id];
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node || !startState) return;

      const nodeType = node.type;
      const finalScaleX = newBounds.width / startBounds.width;
      const finalScaleY = newBounds.height / startBounds.height;
      let newNodeWidth = startState.width * finalScaleX;
      let newNodeHeight = startState.height * finalScaleY;
      let newNodeX = newBounds.x + startState.offsetX * newBounds.width;
      let newNodeY = newBounds.y + startState.offsetY * newBounds.height;

      // 单独处理图片规则
      if (nodeType === NodeType.IMAGE) {
        // 图片：四角拖拽=原比例等比，Shift无效果，Alt=中心点等比
        if (isCorner) {
          const safeHeight = Math.abs(startState.height) < 1e-6 ? MIN_NODE_SIZE : startState.height;
          const originalImgRatio = startState.width / safeHeight;
          newNodeHeight = newNodeWidth / originalImgRatio;
        }
        if (isAltPressed) {
          const startNodeCenterX = startState.x + startState.width / 2;
          const startNodeCenterY = startState.y + startState.height / 2;
          newNodeX = startNodeCenterX - newNodeWidth / 2;
          newNodeY = startNodeCenterY - newNodeHeight / 2;
        }
      }

      // 圆形规则：强制正圆
      if (nodeType === NodeType.CIRCLE) {
        const avgSize = (Math.abs(newNodeWidth) + Math.abs(newNodeHeight)) / 2;
        newNodeWidth = avgSize * Math.sign(newNodeWidth || 1);
        newNodeHeight = avgSize * Math.sign(newNodeHeight || 1);
      }

      // 最小尺寸限制
      newNodeWidth = Math.max(MIN_NODE_SIZE, newNodeWidth);
      newNodeHeight = Math.max(MIN_NODE_SIZE, newNodeHeight);

      // 更新节点
      this.store.updateNode(id, {
        transform: {
          ...node.transform,
          x: newNodeX,
          y: newNodeY,
          width: newNodeWidth,
          height: newNodeHeight,
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

/**
 * @file TransformHandler.ts
 *
 * 职责 (Responsibilities):
 *   - 负责处理画布中节点的变换操作，包括单节点和多节点的拖拽、缩放、旋转等。
 *   - 管理节点变换过程中的状态，确保变换操作的流畅性和正确性。
 *   - 实现多节点缩放时的坐标变换、比例保持、最小尺寸限制及防止节点翻转。
 *
 * 特点 (Features):
 *   - 支持单节点和多节点的拖拽与缩放，自动适配不同的变换场景。
 *   - 多节点缩放时，采用相对中心点的坐标变换算法，保证各节点在缩放过程中的对齐和比例一致。
 *   - 内置最小宽高限制，防止节点被缩放到不可见或反向（翻转）状态。
 *   - 支持节点旋转，变换过程中使用旋转矩阵进行坐标转换，确保变换的准确性。
 *   - 变换逻辑与画布状态解耦，便于维护和扩展。
 *
 * 状态管理 (State Management):
 *   - 内部维护拖拽状态（InternalDragState）、单节点缩放状态（InternalResizeState）、多节点缩放状态（InternalMultiResizeState）。
 *   - 记录变换起始点、节点初始位置、尺寸、旋转角度、中心点等信息，用于计算变换后的节点属性。
 *   - 多节点缩放时，记录每个节点相对于整体边界框的偏移和比例，便于统一缩放和对齐。
 *
 * 包含方法列表 (Method List):
 *   - startDrag(nodeId: string, ...): 开始节点拖拽
 *   - onDragMove(event: MouseEvent): 拖拽过程处理
 *   - endDrag(): 结束拖拽
 *   - startResize(nodeId: string, handle: ResizeHandle, ...): 开始节点缩放
 *   - onResizeMove(event: MouseEvent): 缩放过程处理
 *   - endResize(): 结束缩放
 *   - startMultiResize(nodeIds: string[], handle: ResizeHandle, ...): 开始多节点缩放
 *   - onMultiResizeMove(event: MouseEvent): 多节点缩放过程处理
 *   - endMultiResize(): 结束多节点缩放
 *   - 其他辅助方法：坐标变换、旋转矩阵计算、最小尺寸判断等
 *
 * 复杂变换逻辑说明 (Complex Transformation Logic):
 *   - 坐标旋转矩阵：节点旋转时，使用二维旋转矩阵将节点的顶点坐标从本地坐标系转换到全局坐标系，反之亦然。
 *     公式：x' = cos(θ) * (x - cx) - sin(θ) * (y - cy) + cx
 *           y' = sin(θ) * (x - cx) + cos(θ) * (y - cy) + cy
 *     其中 (cx, cy) 为旋转中心，θ 为旋转角度。
 *   - 多节点缩放算法：以多选边界框的中心为基准，计算每个节点相对于中心的偏移和缩放比例，缩放时保持节点间的相对位置和比例不变。
 *   - 防翻转与最小尺寸：在缩放过程中，实时判断节点尺寸，防止宽高小于最小值或出现负值（翻转）。
 *
 * 维护者可参考 ToolManager.ts、SelectionHandler.ts、GroupService.ts 的文档风格，便于理解和扩展本文件的变换逻辑。
 */

import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';
import type { BaseNodeState } from '@/types/state';
import { NodeType } from '@/types/state';
import type { ResizeHandle } from '@/types/editor';
import { eventToWorld } from '@/core/utils/geometry';
import { GroupService } from '@/core/services/GroupService';

/** 拖拽类型 */
type DragType = 'node' | 'area';

/** 最小节点尺寸限制 */
const MIN_SIZE = 10;

/** 拖拽状态 */
interface InternalDragState {
  isDragging: boolean;
  type: DragType | null;
  nodeId: string;
  startMouseWorld: { x: number; y: number }; // 【修复】存储世界坐标
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
  startMouseWorld: { x: number; y: number }; // 【修复】存储世界坐标

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
  startMouseWorld: { x: number; y: number }; // 【修复】存储世界坐标
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
  private selectionStore: ReturnType<typeof useSelectionStore>;
  private stageEl: HTMLElement | null; // 【修复】添加 stageEl 依赖

  /** 拖拽状态 */
  private dragState: InternalDragState = {
    isDragging: false,
    type: null,
    nodeId: '',
    startMouseWorld: { x: 0, y: 0 },
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
    startMouseWorld: { x: 0, y: 0 },
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
    startMouseWorld: { x: 0, y: 0 },
    nodeStartStates: {},
    startCenterX: 0,
    startCenterY: 0,
    startRotation: 0,
  };

  constructor(
    store: ReturnType<typeof useCanvasStore>,
    stageEl: HTMLElement | null = null,
    selectionStore?: ReturnType<typeof useSelectionStore>
  ) {
    this.store = store;
    this.selectionStore = selectionStore || useSelectionStore();
    this.stageEl = stageEl; // 【修复】保存 stageEl
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

    const activeIds = Array.from(this.selectionStore.activeElementIds);
    const isMultiDrag = activeIds.length > 1;

    const startTransformMap: Record<string, { x: number; y: number }> = {};
    activeIds.forEach((id) => {
      const n = this.store.nodes[id];
      if (n) {
        startTransformMap[id] = { x: n.transform.x, y: n.transform.y };
      }
    });

    // 【修复】使用 eventToWorld 记录起始世界坐标
    const startWorldPos = eventToWorld(e, this.stageEl, this.store.viewport);

    this.dragState = {
      isDragging: true,
      type: 'node',
      nodeId,
      startMouseWorld: { x: startWorldPos.x, y: startWorldPos.y },
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

    // 【修复】使用 eventToWorld 计算位移
    const { startMouseWorld, startTransformMap } = this.dragState;
    const currentWorldPos = eventToWorld(e, this.stageEl, this.store.viewport);
    const dx = currentWorldPos.x - startMouseWorld.x;
    const dy = currentWorldPos.y - startMouseWorld.y;

    Object.entries(startTransformMap).forEach(([id, startPos]) => {
      const node = this.store.nodes[id];
      if (!node || node.isLocked) return;

      // 如果存在父级旋转，需要将世界坐标系下的位移转换到父级局部坐标系
      let localDx = dx;
      let localDy = dy;

      if (node.parentId) {
        let parentRotation = 0;
        let parentId: string | null = node.parentId;
        while (parentId) {
          const parentNode = this.store.nodes[parentId];
          if (!parentNode) break;
          parentRotation += parentNode.transform.rotation || 0;
          parentId = parentNode.parentId ?? null;
        }

        if (parentRotation !== 0) {
          const rad = (-parentRotation * Math.PI) / 180; // 反向旋转到局部坐标
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rotatedX = dx * cos - dy * sin;
          const rotatedY = dx * sin + dy * cos;
          localDx = rotatedX;
          localDy = rotatedY;
        }
      }

      this.store.updateNode(id, {
        transform: {
          ...node.transform,
          x: startPos.x + localDx,
          y: startPos.y + localDy,
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

    // 【修复】使用 eventToWorld 记录起始世界坐标
    const startWorldPos = eventToWorld(e, this.stageEl, this.store.viewport);

    // 记录初始状态
    this.resizeState = {
      isResizing: true,
      handle,
      nodeId,
      startMouseWorld: { x: startWorldPos.x, y: startWorldPos.y },
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
      startMouseWorld,
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

    // 标记：是否为角点缩放（双轴）/ 四边缩放（单轴）
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle);
    const isEdge = ['n', 's', 'e', 'w'].includes(handle);

    // 【修复】使用 eventToWorld 获取当前世界坐标
    const currentWorldPos = eventToWorld(e, this.stageEl, this.store.viewport);

    // --- 1. 坐标转换：将鼠标位移转换到未旋转坐标系 ---
    // 将鼠标点反向旋转到未旋转坐标系（以节点初始中心为旋转中心）
    const startUnrotated = this.unrotatePoint(
      startMouseWorld,
      { x: startCenterX, y: startCenterY },
      startRotation
    );
    const currentUnrotated = this.unrotatePoint(
      { x: currentWorldPos.x, y: currentWorldPos.y },
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

    // --- 3. 位移计算：确定 fixed/movable 点的**基础**位置（增加 Clamp 逻辑禁止翻转） ---
    // 逻辑说明：如果正在拖动右边(movableX)，则它不能小于 左边(fixedX) + MIN_SIZE。
    // 如果正在拖动左边(fixedX)，则它不能大于 右边(movableX) - MIN_SIZE。
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

      // 计算等比目标尺寸（增加最小尺寸保护）
      let targetWidth = Math.max(startWidth * Math.abs(scale), MIN_SIZE);
      let targetHeight = Math.max(startHeight * Math.abs(scale), MIN_SIZE);

      // 确保符合比例（以宽为准或以高为准，这里重新对齐比例）
      if (Math.abs(targetWidth / targetHeight - startRatio) > 1e-6) {
        // 简单逻辑：取较大的一边作为基准，保证另一边也大于 MIN_SIZE
        // 但由于 startWidth/Height 已经保证 > MIN_SIZE (假设)，乘积通常没问题
        // 这里再次校准
        if (targetWidth / startRatio < MIN_SIZE) {
          targetWidth = MIN_SIZE * startRatio;
          targetHeight = MIN_SIZE;
        } else {
          targetHeight = targetWidth / startRatio;
        }
      }

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
        if (handle.includes('e')) deltaW = unrotatedDx;
        if (handle.includes('w')) deltaW = -unrotatedDx;
        if (handle.includes('s')) deltaH = unrotatedDy;
        if (handle.includes('n')) deltaH = -unrotatedDy;

        // 计算新尺寸并应用最小限制
        const newW = Math.max(startWidth + deltaW * 2, MIN_SIZE);
        const newH = Math.max(startHeight + deltaH * 2, MIN_SIZE);

        // 2. 重新计算 fixed/movable，使其关于 startCenter 对称
        fixedX = centerX - newW / 2;
        movableX = centerX + newW / 2;
        fixedY = centerY - newH / 2;
        movableY = centerY + newH / 2;
      } else if (isEdge) {
        // 边中心缩放：仅单轴变化，该轴对称，另一轴保持不变
        switch (handle) {
          case 'e':
          case 'w': {
            // 仅 X 轴对称
            const deltaW = handle === 'e' ? unrotatedDx : -unrotatedDx;
            const newW = Math.max(startWidth + deltaW * 2, MIN_SIZE);
            fixedX = centerX - newW / 2;
            movableX = centerX + newW / 2;
            // Y 轴保持不变（使用初始坐标）
            fixedY = startNodeY;
            movableY = startNodeY + startHeight;
            break;
          }
          case 'n':
          case 's': {
            // 仅 Y 轴对称
            const deltaH = handle === 's' ? unrotatedDy : -unrotatedDy;
            const newH = Math.max(startHeight + deltaH * 2, MIN_SIZE);
            fixedY = centerY - newH / 2;
            movableY = centerY + newH / 2;
            // X 轴保持不变（使用初始坐标）
            fixedX = startNodeX;
            movableX = startNodeX + startWidth;
            break;
          }
        }
      }
    }

    // --- 6. 直接计算最终尺寸（移除最小尺寸限制 -> 已在上面步骤中集成限制） ---
    const newWidth = Math.abs(movableX - fixedX);
    const newHeight = Math.abs(movableY - fixedY);

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
      // 判断是否为 Group 节点，使用对应的更新方法
      if (node.type === NodeType.GROUP) {
        GroupService.updateGroupTransform(this.store, nodeId, {
          x: finalX,
          y: finalY,
          width: newWidth,
          height: newHeight,
        });
      } else {
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

    // 修正：重新计算可靠的包围盒（避免传入的startBounds异常）
    const calcStartBounds = this.getNodesBounds(validNodeIds);
    // 计算整体边界框的初始中心（对齐单节点缩放逻辑）
    const startCenterX = calcStartBounds.x + calcStartBounds.width / 2;
    const startCenterY = calcStartBounds.y + calcStartBounds.height / 2;
    // 多选边界框默认轴对齐，旋转为0弧度（可根据实际需求调整）
    const startRotation = 0;

    const nodeStartStates: Record<string, NodeStartState> = {};
    validNodeIds.forEach((id) => {
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node) return;

      // 偏移为**像素值**（非比例），避免边界框尺寸为0时的NaN
      const offsetX = node.transform.x - calcStartBounds.x;
      const offsetY = node.transform.y - calcStartBounds.y;

      // 修复2：尺寸比例增加除零保护
      const scaleX = calcStartBounds.width > 0 ? node.transform.width / calcStartBounds.width : 1;
      const scaleY =
        calcStartBounds.height > 0 ? node.transform.height / calcStartBounds.height : 1;

      // 修复3：记录节点相对于整体中心的偏移比例（用于中心缩放对齐）
      const nodeCenterX = node.transform.x + node.transform.width / 2;
      const nodeCenterY = node.transform.y + node.transform.height / 2;
      const centerOffsetX = (nodeCenterX - startCenterX) / (calcStartBounds.width || 1);
      const centerOffsetY = (nodeCenterY - startCenterY) / (calcStartBounds.height || 1);

      nodeStartStates[id] = {
        x: node.transform.x,
        y: node.transform.y,
        width: node.transform.width,
        height: node.transform.height,
        offsetX, // 像素偏移（原比例改为像素）
        offsetY,
        scaleX,
        scaleY,
        centerOffsetX, // 新增：相对中心偏移比例
        centerOffsetY,
      };
    });

    // 【修复】使用 eventToWorld 记录起始世界坐标
    const startWorldPos = eventToWorld(e, this.stageEl, this.store.viewport);

    this.multiResizeState = {
      isMultiResizing: true,
      handle,
      nodeIds: validNodeIds,
      startBounds: { ...calcStartBounds }, // 使用计算的包围盒
      startMouseWorld: { x: startWorldPos.x, y: startWorldPos.y },
      nodeStartStates,
      // 新增：整体边界框的中心和旋转（对齐单节点缩放）
      startCenterX,
      startCenterY,
      startRotation,
    };

    this.store.isInteracting = true;
  }

  /**
   * 更新多选缩放（核心修复：组合快捷键、相对位置、负尺寸处理、禁止翻转）
   */
  updateMultiResize(e: MouseEvent) {
    const {
      isMultiResizing,
      handle,
      nodeIds,
      startBounds,
      startMouseWorld,
      nodeStartStates,
      startCenterX,
      startCenterY,
      startRotation,
    } = this.multiResizeState;

    if (!isMultiResizing || !handle || nodeIds.length === 0) return;

    // ========== 1. 基础参数初始化（修复：精度处理） ==========
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle);
    const isEdge = ['n', 's', 'e', 'w'].includes(handle);
    const hasShift = e.shiftKey;
    const hasAlt = e.altKey;

    // ========== 2. 坐标转换（修复：使用 eventToWorld） ==========
    // 【修复】使用 eventToWorld 获取当前世界坐标
    const currentWorldPos = eventToWorld(e, this.stageEl, this.store.viewport);

    // 反向旋转到未旋转坐标系（多选边界框默认旋转0，此处保留逻辑可扩展）
    const startUnrotated = this.unrotatePoint(
      startMouseWorld,
      { x: startCenterX, y: startCenterY },
      startRotation
    );
    const currentUnrotated = this.unrotatePoint(
      { x: currentWorldPos.x, y: currentWorldPos.y },
      { x: startCenterX, y: startCenterY },
      startRotation
    );

    // 计算未旋转坐标系下的鼠标位移（精度修正）
    const unrotatedDx = Math.round((currentUnrotated.x - startUnrotated.x) * 1000) / 1000;
    const unrotatedDy = Math.round((currentUnrotated.y - startUnrotated.y) * 1000) / 1000;

    // ========== 3. 初始化固定点/可动点（修复：反向缩放逻辑） ==========
    let fixedX = startBounds.x;
    let fixedY = startBounds.y;
    let movableX = startBounds.x + startBounds.width;
    let movableY = startBounds.y + startBounds.height;

    // ========== 4. 按手柄方向更新固定点/可动点（修复：反向拖拽逻辑 + 最小尺寸限制） ==========
    // 关键修复：不再交换 fixed/movable，而是使用 Math.max/min 钳位，防止反向翻转
    switch (handle) {
      case 'e':
        movableX = Math.max(startBounds.x + startBounds.width + unrotatedDx, fixedX + MIN_SIZE);
        break;
      case 'w':
        fixedX = Math.min(startBounds.x + unrotatedDx, movableX - MIN_SIZE);
        break;
      case 's':
        movableY = Math.max(startBounds.y + startBounds.height + unrotatedDy, fixedY + MIN_SIZE);
        break;
      case 'n':
        fixedY = Math.min(startBounds.y + unrotatedDy, movableY - MIN_SIZE);
        break;
      case 'nw':
        fixedX = Math.min(startBounds.x + unrotatedDx, movableX - MIN_SIZE);
        fixedY = Math.min(startBounds.y + unrotatedDy, movableY - MIN_SIZE);
        break;
      case 'ne':
        movableX = Math.max(startBounds.x + startBounds.width + unrotatedDx, fixedX + MIN_SIZE);
        fixedY = Math.min(startBounds.y + unrotatedDy, movableY - MIN_SIZE);
        break;
      case 'se':
        movableX = Math.max(startBounds.x + startBounds.width + unrotatedDx, fixedX + MIN_SIZE);
        movableY = Math.max(startBounds.y + startBounds.height + unrotatedDy, fixedY + MIN_SIZE);
        break;
      case 'sw':
        fixedX = Math.min(startBounds.x + unrotatedDx, movableX - MIN_SIZE);
        movableY = Math.max(startBounds.y + startBounds.height + unrotatedDy, fixedY + MIN_SIZE);
        break;
    }

    // ========== 5. Shift等比缩放（修复：Shift+Alt组合逻辑 + 最小尺寸） ==========
    let targetWidth = Math.abs(movableX - fixedX);
    let targetHeight = Math.abs(movableY - fixedY);

    if (hasShift && isCorner) {
      const startRatio = startBounds.width / Math.max(startBounds.height, 1e-6);
      // 修复：等比缩放基于初始比例，而非当前位移
      if (Math.abs(targetWidth / targetHeight - startRatio) > 1e-3) {
        if (Math.abs(unrotatedDx) > Math.abs(unrotatedDy)) {
          targetHeight = Math.max(targetWidth / startRatio, MIN_SIZE);
          targetWidth = Math.max(targetWidth, MIN_SIZE); // 确保宽也符合
        } else {
          targetWidth = Math.max(targetHeight * startRatio, MIN_SIZE);
          targetHeight = Math.max(targetHeight, MIN_SIZE); // 确保高也符合
        }
      }

      // 重新计算movable点以匹配等比尺寸 (因为不能翻转，方向是固定的)
      switch (handle) {
        case 'nw':
          // 固定点是 movableX, movableY (右下)，修改 fixedX, fixedY
          // 但这里 fixedX/Y 已经是被修改过的，所以要基于 anchor 计算
          // anchor 是 movableX (右), movableY (下)
          fixedX = movableX - targetWidth;
          fixedY = movableY - targetHeight;
          break;
        case 'ne':
          // anchor: fixedX (左), movableY (下) -> 修正 movableX, fixedY
          // 注意：switch里的 case 'ne' 已经确定了 movableX 变, fixedY 变
          // 但因为等比约束，需要互相迁就。
          // 逻辑简化：根据方向应用尺寸
          movableX = fixedX + targetWidth;
          fixedY = movableY - targetHeight;
          break;
        case 'se':
          movableX = fixedX + targetWidth;
          movableY = fixedY + targetHeight;
          break;
        case 'sw':
          fixedX = movableX - targetWidth;
          movableY = fixedY + targetHeight;
          break;
      }
    }

    // ========== 6. Alt中心缩放（修复：组合快捷键兼容 + 最小尺寸） ==========
    if (hasAlt) {
      const centerX = startCenterX;
      const centerY = startCenterY;

      // 当前拖拽形成的尺寸（已含 clamp）
      const currentWidth = Math.abs(movableX - fixedX);
      const currentHeight = Math.abs(movableY - fixedY);

      if (isCorner) {
        // 中心缩放：以初始中心为基准，对称扩展/收缩
        const scaleX = currentWidth / (startBounds.width || 1);
        const scaleY = currentHeight / (startBounds.height || 1);
        const finalScale = hasShift ? Math.max(scaleX, scaleY) : (scaleX + scaleY) / 2;

        targetWidth = Math.max(startBounds.width * finalScale, MIN_SIZE);
        targetHeight = Math.max(startBounds.height * finalScale, MIN_SIZE);

        // 重新计算边界框（基于初始中心）
        fixedX = centerX - targetWidth / 2;
        fixedY = centerY - targetHeight / 2;
        movableX = centerX + targetWidth / 2;
        movableY = centerY + targetHeight / 2;
      } else if (isEdge) {
        // 单边中心缩放
        if (edgeConfig.left || edgeConfig.right) {
          const scaleX = currentWidth / (startBounds.width || 1);
          targetWidth = Math.max(startBounds.width * scaleX, MIN_SIZE);
          fixedX = centerX - targetWidth / 2;
          movableX = centerX + targetWidth / 2;
        } else {
          const scaleY = currentHeight / (startBounds.height || 1);
          targetHeight = Math.max(startBounds.height * scaleY, MIN_SIZE);
          fixedY = centerY - targetHeight / 2;
          movableY = centerY + targetHeight / 2;
        }
      }
    }

    // ========== 7. 计算最终边界框（修复：坐标映射） ==========
    const finalBounds = {
      x: Math.min(fixedX, movableX),
      y: Math.min(fixedY, movableY),
      width: Math.max(targetWidth, Math.abs(movableX - fixedX)),
      height: Math.max(targetHeight, Math.abs(movableY - fixedY)),
    };

    // ========== 8. 同步更新所有节点（核心修复：相对位置计算） ==========
    nodeIds.forEach((id) => {
      const startState = nodeStartStates[id];
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node || !startState) return;

      // 修复1：基于像素偏移计算新位置（而非比例）
      const newNodeX =
        finalBounds.x + startState.offsetX * (finalBounds.width / (startBounds.width || 1));
      const newNodeY =
        finalBounds.y + startState.offsetY * (finalBounds.height / (startBounds.height || 1));

      // 修复2：尺寸按比例缩放（增加除零保护）
      const newNodeWidth = startState.scaleX * finalBounds.width;
      const newNodeHeight = startState.scaleY * finalBounds.height;

      // 修复3：中心缩放时的位置修正
      if (hasAlt) {
        const newCenterX = finalBounds.x + finalBounds.width / 2;
        const newCenterY = finalBounds.y + finalBounds.height / 2;
        // 基于相对中心偏移修正节点位置
        const nodeCenterX = newCenterX + startState.centerOffsetX * finalBounds.width;
        const nodeCenterY = newCenterY + startState.centerOffsetY * finalBounds.height;

        // 从中心反算左上角坐标
        const centerAdjustedX = nodeCenterX - newNodeWidth / 2;
        const centerAdjustedY = nodeCenterY - newNodeHeight / 2;

        // 更新节点（防抖）
        const isSame =
          Math.abs(centerAdjustedX - node.transform.x) < 1e-3 &&
          Math.abs(centerAdjustedY - node.transform.y) < 1e-3 &&
          Math.abs(newNodeWidth - node.transform.width) < 1e-3 &&
          Math.abs(newNodeHeight - node.transform.height) < 1e-3;

        if (!isSame) {
          if (node.type === NodeType.GROUP) {
            GroupService.updateGroupTransform(this.store, id, {
              x: centerAdjustedX,
              y: centerAdjustedY,
              width: Math.abs(newNodeWidth),
              height: Math.abs(newNodeHeight),
            });
          } else {
            this.store.updateNode(id, {
              transform: {
                ...node.transform,
                x: centerAdjustedX,
                y: centerAdjustedY,
                width: Math.abs(newNodeWidth),
                height: Math.abs(newNodeHeight),
              },
            });
          }
        }
      } else {
        // 普通缩放：直接使用像素偏移
        const isSame =
          Math.abs(newNodeX - node.transform.x) < 1e-3 &&
          Math.abs(newNodeY - node.transform.y) < 1e-3 &&
          Math.abs(newNodeWidth - node.transform.width) < 1e-3 &&
          Math.abs(newNodeHeight - node.transform.height) < 1e-3;

        if (!isSame) {
          if (node.type === NodeType.GROUP) {
            GroupService.updateGroupTransform(this.store, id, {
              x: newNodeX,
              y: newNodeY,
              width: Math.abs(newNodeWidth),
              height: Math.abs(newNodeHeight),
            });
          } else {
            this.store.updateNode(id, {
              transform: {
                ...node.transform,
                x: newNodeX,
                y: newNodeY,
                width: Math.abs(newNodeWidth),
                height: Math.abs(newNodeHeight),
              },
            });
          }
        }
      }
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

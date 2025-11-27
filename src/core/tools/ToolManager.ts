import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type BaseNodeState, type ShapeState, type TextState } from '@/types/state';
import type { InternalDragState, InternalResizeState } from '@/types/editor';
import type { ResizeHandle } from '@/types/editor';
import { v4 as uuidv4 } from 'uuid';
import type { ViewportState } from '@/types/state';
import { clientToWorld } from '@/core/utils/geometry';

/**
 * 逻辑层：工具管理器
 * 职责：接收来自交互层（Vue组件）的原始事件，处理鼠标点击、拖拽、工具切换逻辑。
 */
export class ToolManager {
  private store: ReturnType<typeof useCanvasStore>;
  private isPanDragging = false;
  private lastPos = { x: 0, y: 0 };
  private stageEl: HTMLElement | null; // 画布根元素

  /** 临时拖动状态 */
  private dragState: InternalDragState = {
    isDragging: false,
    type: null,
    nodeId: '',
    startMouseX: 0,
    startMouseY: 0,
    startTransform: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
    },
  };

  /** 缩放状态（修正：移到类属性区，与dragState同级） */
  private resizeState: InternalResizeState = {
    isResizing: false,
    handle: null,
    nodeId: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startNodeX: 0,
    startNodeY: 0,
  };

  // 框选相关状态
  private isBoxSelecting = false;
  private boxSelectStart = { x: 0, y: 0 };
  private boxSelectEnd = { x: 0, y: 0 };

  // 修正：仅保留一个构造函数（带stageEl参数）
  constructor(stageEl: HTMLElement | null) {
    this.store = useCanvasStore();
    this.stageEl = stageEl; // 保存画布根元素引用
  }

  /** 暴露框选状态给Vue组件 */
  getBoxSelectState() {
    return {
      isBoxSelecting: this.isBoxSelecting,
      boxSelectStart: { ...this.boxSelectStart },
      boxSelectEnd: { ...this.boxSelectEnd },
    };
  }

  /** 处理画布滚轮事件 (缩放) */
  handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.max(0.1, Math.min(5, this.store.viewport.zoom + delta));
    this.store.viewport.zoom = newZoom;
  }

  /** 处理画布鼠标按下事件 (中键平移 / 左键框选) */
  handleMouseDown(e: MouseEvent) {
    if (this.dragState.isDragging) return;

    this.lastPos.x = e.clientX;
    this.lastPos.y = e.clientY;

    if (e.button === 1) { // 中键平移
      this.isPanDragging = true;
      this.store.setActive([]);
    } else if (e.button === 0) { // 左键框选
      this.isBoxSelecting = true;
      this.boxSelectStart = { x: e.clientX, y: e.clientY };
      this.boxSelectEnd = { x: e.clientX, y: e.clientY };
    }
  }

  /** 处理全局鼠标移动事件 */
  handleMouseMove(e: MouseEvent) {
    if (this.dragState.isDragging) {
      this.handleNodeMove(e);
      return;
    }

    if (this.resizeState.isResizing) {
      this.handleResizeMove(e);
      return;
    }

    // 其次处理画布平移
    if (this.isPanDragging) {
      const dx = e.clientX - this.lastPos.x;
      const dy = e.clientY - this.lastPos.y;
      this.store.viewport.offsetX += dx;
      this.store.viewport.offsetY += dy;
      this.lastPos.x = e.clientX;
      this.lastPos.y = e.clientY;
      return;
    }

    if (this.isBoxSelecting) {
      this.boxSelectEnd = { x: e.clientX, y: e.clientY };
    }
  }

  /** 处理全局鼠标松开事件 */
  handleMouseUp() {
    this.isPanDragging = false;
    this.handleNodeUp();

    if (this.isBoxSelecting) {
      this.finishBoxSelect();
      this.isBoxSelecting = false;
    }

    // 重置节点拖拽状态
    this.dragState.isDragging = false;
    this.dragState.type = null;
    this.dragState.nodeId = '';

    // 重置缩放状态
    this.resizeState.isResizing = false;
    this.resizeState.handle = null;
    this.resizeState.nodeId = null;

    // 统一解除交互锁
    this.store.isInteracting = false;
  }

  /** 结束框选，计算并选中区域内的节点 */
  private finishBoxSelect() {
    const stageRect = this.stageEl ? this.stageEl.getBoundingClientRect() : { left: 0, top: 0 };
    
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

    const boxArea = (maxScreenX - minScreenX) * (maxScreenY - minScreenY);
    if (boxArea < 4) {
      this.store.setActive([]);
      return;
    }

    const viewport = this.store.viewport as ViewportState;
    const worldMin = clientToWorld(viewport, minScreenX, minScreenY);
    const worldMax = clientToWorld(viewport, maxScreenX, maxScreenY);

    const selectedIds: string[] = [];
    Object.entries(this.store.nodes).forEach(([id, node]) => {
      const baseNode = node as BaseNodeState;
      if (baseNode.isLocked) return;

      const nodeMinX = baseNode.transform.x;
      const nodeMaxX = baseNode.transform.x + baseNode.transform.width;
      const nodeMinY = baseNode.transform.y;
      const nodeMaxY = baseNode.transform.y + baseNode.transform.height;

      if (
        nodeMinX < worldMax.x &&
        nodeMaxX > worldMin.x &&
        nodeMinY < worldMax.y &&
        nodeMaxY > worldMin.y
      ) {
        selectedIds.push(id);
      }
    });

    this.store.setActive(selectedIds);
  }

  /** 处理节点鼠标按下事件 */
  handleNodeDown(e: MouseEvent, id: string) {
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      this.store.toggleSelection(id);
      return;
    } else {
      this.store.setActive([id]);
    }

    const node = this.store.nodes[id] as BaseNodeState;
    if (!node || node.isLocked) return;

    this.store.isInteracting = true;

    this.dragState = {
      isDragging: true,
      type: 'move',
      nodeId: id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTransform: { ...node.transform },
    };
  }

  /** 节点鼠标移动事件 */
  handleNodeMove(e: MouseEvent) {
    if (!this.dragState.isDragging || !this.dragState.nodeId) return;

    if ((e.buttons & 1) === 0) {
      this.handleNodeUp();
      return;
    }

    const viewport = this.store.viewport as ViewportState;
    const node = this.store.nodes[this.dragState.nodeId] as BaseNodeState;
    if (!node) return;

    const currentWorldPos = clientToWorld(viewport, e.clientX, e.clientY);
    const startWorldPos = clientToWorld(
      viewport,
      this.dragState.startMouseX,
      this.dragState.startMouseY
    );

    const deltaX = currentWorldPos.x - startWorldPos.x;
    const deltaY = currentWorldPos.y - startWorldPos.y;

    const newX = this.dragState.startTransform.x + deltaX;
    const newY = this.dragState.startTransform.y + deltaY;

    this.store.updateNode(this.dragState.nodeId, {
      transform: { ...node.transform, x: newX, y: newY },
    });
  }

  /** 节点鼠标松开事件 */
  handleNodeUp() {
    // 修正：移除重复的 dragState 重置（仅保留整体重置即可）
    this.dragState = {
      isDragging: false,
      type: null,
      nodeId: '',
      startMouseX: 0,
      startMouseY: 0,
      startTransform: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
    };
    // 解除交互锁
    this.store.isInteracting = false;
  }

  /** 创建矩形 */
  createRect() {
    const id = uuidv4();
    const x = Number((Math.random() * 800).toFixed(2));
    const y = Number((Math.random() * 600).toFixed(2));

    const newRect: ShapeState = {
      id,
      type: NodeType.RECT,
      name: 'Rectangle',
      transform: { x, y, width: 100, height: 100, rotation: 0 },
      style: {
        backgroundColor: '#ffccc7',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#ff4d4f',
        opacity: 1,
        zIndex: 1,
      },
      props: { cornerRadius: 0 },
      parentId: null,
      isLocked: false,
      isVisible: true,
      shapeType: 'rect',
    };

    this.store.addNode(newRect);
    this.store.setActive([id]);
    console.log('矩形创建完成');
  }

  /** 创建圆形 */
  createCircle() {
    const id = uuidv4();
    const x = Math.random() * 800;
    const y = Math.random() * 600;

    const newCircle: ShapeState = {
      id,
      type: NodeType.CIRCLE,
      name: 'Circle',
      transform: { x, y, width: 100, height: 100, rotation: 0 },
      style: {
        backgroundColor: '#ADD8E6',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#87CEEB',
        opacity: 1,
        zIndex: 1,
      },
      props: { cornerRadius: 0 },
      parentId: null,
      isLocked: false,
      isVisible: true,
      shapeType: 'circle',
    };

    this.store.addNode(newCircle);
    this.store.setActive([id]);
    console.log('圆形创建完成');
  }

  /** 创建文本 */
  createText() {
    const id = uuidv4();
    const x = Math.random() * 800;
    const y = Math.random() * 600;

    const newText: TextState = {
      id,
      type: NodeType.TEXT,
      name: 'Text',
      transform: { x, y, width: 100, height: 100, rotation: 0 },
      style: {
        backgroundColor: '#fff0',
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: '#fff0',
        opacity: 1,
        zIndex: 1,
      },
      props: {
        content: '这里采用了vue绑定，修改这里，内容会响应式改变。但编辑功能暂时没实现，mvp版本中先写死。',
        fontFamily: 'Segoe UI',
        fontSize: 16,
        fontWeight: 400,
        fontStyle: 'normal',
        color: '#000',
        lineHeight: 1.6,
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
    };

    this.store.addNode(newText);
    this.store.setActive([id]);
    console.log('文本创建完成');
  }

  /** 删除选中元素 */
  deleteSelected() {
    this.store.activeElementIds.forEach((id) => {
      this.store.deleteNode(id);
    });
  }

  /** 处理缩放控制点鼠标按下事件 */
  handleResizeHandleDown(e: MouseEvent, nodeId: string, handle: ResizeHandle) {
    e.stopPropagation();

    const node = this.store.nodes[nodeId];
    if (!node || node.isLocked) return;

    this.store.isInteracting = true;

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
    };
  }

  /** 处理缩放过程中的鼠标移动 */
  private handleResizeMove(e: MouseEvent) {
    const { handle, nodeId, startX, startY, startWidth, startHeight, startNodeX, startNodeY } =
      this.resizeState;

    if (!handle || !nodeId) return;

    if ((e.buttons & 1) === 0) {
      this.resizeState.isResizing = false;
      this.resizeState.handle = null;
      this.resizeState.nodeId = null;
      this.store.isInteracting = false;
      return;
    }

    const node = this.store.nodes[nodeId];
    if (!node) return;

    const dx = (e.clientX - startX) / this.store.viewport.zoom;
    const dy = (e.clientY - startY) / this.store.viewport.zoom;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newX = startNodeX;
    let newY = startNodeY;

    switch (node.type) {
      case NodeType.CIRCLE:
        this.resizeCircle(
          handle,
          dx,
          dy,
          startWidth,
          startHeight,
          startNodeX,
          startNodeY,
          (result) => {
            newWidth = result.width;
            newHeight = result.height;
            newX = result.x;
            newY = result.y;
          }
        );
        break;
      case NodeType.RECT:
        this.resizeRect(
          handle,
          dx,
          dy,
          startWidth,
          startHeight,
          startNodeX,
          startNodeY,
          (result) => {
            newWidth = result.width;
            newHeight = result.height;
            newX = result.x;
            newY = result.y;
          }
        );
        break;
      case NodeType.IMAGE:
        this.resizeRect(
          handle,
          dx,
          dy,
          startWidth,
          startHeight,
          startNodeX,
          startNodeY,
          (result) => {
            newWidth = result.width;
            newHeight = result.height;
            newX = result.x;
            newY = result.y;
          }
        );
        break;
      case NodeType.TEXT:
        this.resizeText(
          handle,
          dx,
          dy,
          startWidth,
          startHeight,
          startNodeX,
          startNodeY,
          (result) => {
            newWidth = result.width;
            newHeight = result.height;
            newX = result.x;
            newY = result.y;
          }
        );
        break;
      case NodeType.GROUP:
        this.resizeRect(
          handle,
          dx,
          dy,
          startWidth,
          startHeight,
          startNodeX,
          startNodeY,
          (result) => {
            newWidth = result.width;
            newHeight = result.height;
            newX = result.x;
            newY = result.y;
          }
        );
        break;
      default:
        this.resizeRect(
          handle,
          dx,
          dy,
          startWidth,
          startHeight,
          startNodeX,
          startNodeY,
          (result) => {
            newWidth = result.width;
            newHeight = result.height;
            newX = result.x;
            newY = result.y;
          }
        );
        break;
    }

    const minSize = 20;
    if (newWidth < minSize) {
      newWidth = minSize;
      if (handle.includes('w')) {
        newX = startNodeX + startWidth - minSize;
      }
    }
    if (newHeight < minSize) {
      newHeight = minSize;
      if (handle.includes('n')) {
        newY = startNodeY + startHeight - minSize;
      }
    }

    this.store.updateNode(nodeId, {
      transform: {
        ...node.transform,
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY,
      },
    });
  }

  /** 圆形缩放计算 */
  private resizeCircle(
    handle: ResizeHandle,
    dx: number,
    dy: number,
    startWidth: number,
    startHeight: number,
    startNodeX: number,
    startNodeY: number,
    callback: (result: { width: number; height: number; x: number; y: number }) => void
  ) {
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newX = startNodeX;
    let newY = startNodeY;

    const isCorner = handle.length === 2;

    if (isCorner) {
      let delta = 0;
      switch (handle) {
        case 'nw':
          delta = -(dx + dy) / 2;
          break;
        case 'ne':
          delta = (dx - dy) / 2;
          break;
        case 'se':
          delta = (dx + dy) / 2;
          break;
        case 'sw':
          delta = (-dx + dy) / 2;
          break;
      }

      newWidth = startWidth + delta * 2;
      newHeight = startHeight + delta * 2 * (startHeight / startWidth);

      if (handle.includes('w')) {
        newX = startNodeX - delta;
      }
      if (handle.includes('n')) {
        newY = startNodeY - delta;
      }
    } else {
      switch (handle) {
        case 'n':
          newHeight = startHeight - dy * 2;
          newY = startNodeY + dy;
          break;
        case 'e':
          newWidth = startWidth + dx * 2;
          break;
        case 's':
          newHeight = startHeight + dy * 2;
          break;
        case 'w':
          newWidth = startWidth - dx * 2;
          newX = startNodeX + dx;
          break;
      }
    }

    callback({
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY,
    });
  }

  /** 矩形缩放计算 */
  private resizeRect(
    handle: ResizeHandle,
    dx: number,
    dy: number,
    startWidth: number,
    startHeight: number,
    startNodeX: number,
    startNodeY: number,
    callback: (result: { width: number; height: number; x: number; y: number }) => void
  ) {
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newX = startNodeX;
    let newY = startNodeY;

    switch (handle) {
      case 'nw':
        newWidth = startWidth - dx;
        newHeight = startHeight - dy;
        newX = startNodeX + dx;
        newY = startNodeY + dy;
        break;
      case 'n':
        newHeight = startHeight - dy;
        newY = startNodeY + dy;
        break;
      case 'ne':
        newWidth = startWidth + dx;
        newHeight = startHeight - dy;
        newY = startNodeY + dy;
        break;
      case 'e':
        newWidth = startWidth + dx;
        break;
      case 'se':
        newWidth = startWidth + dx;
        newHeight = startHeight + dy;
        break;
      case 's':
        newHeight = startHeight + dy;
        break;
      case 'sw':
        newWidth = startWidth - dx;
        newHeight = startHeight + dy;
        newX = startNodeX + dx;
        break;
      case 'w':
        newWidth = startWidth - dx;
        newX = startNodeX + dx;
        break;
    }

    callback({
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY,
    });
  }

  /** 文本缩放计算 */
  private resizeText(
    handle: ResizeHandle,
    dx: number,
    dy: number,
    startWidth: number,
    startHeight: number,
    startNodeX: number,
    startNodeY: number,
    callback: (result: { width: number; height: number; x: number; y: number }) => void
  ) {
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newX = startNodeX;
    let newY = startNodeY;

    switch (handle) {
      case 'nw':
        newWidth = startWidth - dx;
        newHeight = startHeight - dy;
        newX = startNodeX + dx;
        newY = startNodeY + dy;
        break;
      case 'n':
        newHeight = startHeight - dy;
        newY = startNodeY + dy;
        break;
      case 'ne':
        newWidth = startWidth + dx;
        newHeight = startHeight - dy;
        newY = startNodeY + dy;
        break;
      case 'e':
        newWidth = startWidth + dx;
        break;
      case 'se':
        newWidth = startWidth + dx;
        newHeight = startHeight + dy;
        break;
      case 's':
        newHeight = startHeight + dy;
        break;
      case 'sw':
        newWidth = startWidth - dx;
        newHeight = startHeight + dy;
        newX = startNodeX + dx;
        break;
      case 'w':
        newWidth = startWidth - dx;
        newX = startNodeX + dx;
        break;
    }

    const minSize = 20;
    if (newWidth < minSize) {
      newWidth = minSize;
      if (handle.includes('w')) {
        newX = startNodeX + startWidth - minSize;
      }
    }
    if (newHeight < minSize) {
      newHeight = minSize;
      if (handle.includes('n')) {
        newY = startNodeY + startHeight - minSize;
      }
    }

    callback({
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY,
    });
  }
}

// 若需导出类型，补充如下（示例）：
// export type { ResizeHandle, InternalResizeState, InternalDragState };
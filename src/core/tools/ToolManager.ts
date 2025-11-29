import type { InternalResizeState, ResizeHandle } from '@/types/editor';
import { clientToWorld, isNodeInRect } from '@/core/utils/geometry';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import type { InternalDragState } from '@/types/editor';
import type { ViewportState, TransformState } from '@/types/state';
import {
  NodeType,
  type BaseNodeState,
  type ImageState,
  type ShapeState,
  type TextState,
} from '@/types/state';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_RECT_STYLE,
  DEFAULT_RECT_PROPS,
  DEFAULT_CIRCLE_STYLE,
  DEFAULT_CIRCLE_PROPS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TEXT_PROPS,
  DEFAULT_IMAGE_STYLE,
  DEFAULT_IMAGE_URL,
  DEFAULT_IMAGE_FILTERS,
  DEFAULT_NODE_SIZE,
  MIN_NODE_SIZE,
} from '@/config/defaults';

/**
 * 逻辑层：工具管理器
 * 职责：接收来自交互层（Vue组件）的原始事件，处理鼠标点击、拖拽、缩放逻辑。
 */
export class ToolManager {
  private store: ReturnType<typeof useCanvasStore>;
  private ui: ReturnType<typeof useUIStore>;
  private isPanDragging = false;
  private lastPos = { x: 0, y: 0 };
  private stageEl: HTMLElement | null; // 画布根元素

  /** 临时拖动状态 */
  private dragState: InternalDragState & {
    startTransformMap: Record<string, TransformState>;
  } = {
    isDragging: false,
    type: null,
    nodeId: '',
    startMouseX: 0,
    startMouseY: 0,
    startTransform: { x: 0, y: 0, width: 0, height: 0, rotation: 0 } as TransformState,
    startTransformMap: {},
  };

  /** 缩放状态 */
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

  // 新增：多选缩放状态
  private multiResizeState: {
    isMultiResizing: boolean;
    handle: ResizeHandle | null;
    nodeIds: string[];
    startBounds: { x: number; y: number; width: number; height: number };
    startMouseX: number;
    startMouseY: number;
    nodeStartStates: Record<string, {
      x: number;
      y: number;
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
      scaleX: number;
      scaleY: number;
    }>;
  } = {
    isMultiResizing: false,
    handle: null,
    nodeIds: [],
    startBounds: { x: 0, y: 0, width: 0, height: 0 },
    startMouseX: 0,
    startMouseY: 0,
    nodeStartStates: {},
  };

  constructor(stageEl: HTMLElement | null) {
    this.store = useCanvasStore();
    this.ui = useUIStore();
    this.stageEl = stageEl;
  }

  /** 暴露框选状态给Vue组件 */
  getBoxSelectState() {
    return {
      isDragging: this.dragState.isDragging,
      isBoxSelecting: this.isBoxSelecting,
      boxSelectStart: { ...this.boxSelectStart },
      boxSelectEnd: { ...this.boxSelectEnd },
    };
  }

  /** 处理画布滚轮事件（缩放） */
  handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.max(0.1, Math.min(5, this.store.viewport.zoom + delta));
    this.store.viewport.zoom = newZoom;
  }

  /** 处理画布鼠标按下事件（平移开始 / 取消选中） */
  handleMouseDown(e: MouseEvent) {
    if (this.dragState.isDragging) return;

    this.lastPos.x = e.clientX;
    this.lastPos.y = e.clientY;

    if (e.button === 1) {
      this.isPanDragging = true;
      this.store.setActive([]);
    } else if (e.button === 0) {
      this.isBoxSelecting = true;
      this.boxSelectStart = { x: e.clientX, y: e.clientY };
      this.boxSelectEnd = { x: e.clientX, y: e.clientY };
    }
  }

  /** 处理全局鼠标移动事件 (平移中 / 缩放中 / 多选缩放) */
  handleMouseMove(e: MouseEvent) {
    // 最高优先级：多选缩放
    if (this.multiResizeState.isMultiResizing) {
      this.handleMultiResizeMove(e);
      return;
    }

    // 其次：单选缩放
    if (this.resizeState.isResizing) {
      this.handleResizeMove(e);
      return;
    }

    // 然后：节点拖拽
    if (this.dragState.isDragging) {
      this.handleNodeMove(e);
      return;
    }

    // 最后：画布平移/框选
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
    // 重置多选缩放状态
    this.multiResizeState.isMultiResizing = false;
    this.multiResizeState.handle = null;
    this.multiResizeState.nodeIds = [];

    // 重置画布平移状态
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
    this.dragState.startTransformMap = {};

    // 重置单选缩放状态
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

      if (isNodeInRect(worldMax.x, worldMax.y, worldMin.x, worldMin.y, baseNode)) {
        selectedIds.push(id);
      }
    });

    this.store.setActive(selectedIds);
  }

  /** 处理节点鼠标按下事件（选中/开始拖拽） */
  handleNodeDown(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (this.resizeState.isResizing) return;

    // 多选逻辑
    if (e.ctrlKey || e.shiftKey) {
      this.store.toggleSelection(id);
    } else {
      if (!this.store.activeElementIds.has(id)) {
        this.store.setActive([id]);
      }
    }

    const node = this.store.nodes[id] as BaseNodeState;
    if (!node || node.isLocked) return;

    this.store.isInteracting = true;
    this.ui.setActivePanel('node');
    this.ui.setPanelExpanded(true);

    // 初始化多选拖拽状态
    const activeIds = Array.from(this.store.activeElementIds).filter((activeId) => {
      const activeNode = this.store.nodes[activeId] as BaseNodeState;
      return activeNode && !activeNode.isLocked;
    });

    const startTransformMap: Record<string, typeof node.transform> = {};
    activeIds.forEach((activeId) => {
      const activeNode = this.store.nodes[activeId] as BaseNodeState;
      startTransformMap[activeId] = { ...activeNode.transform };
    });

    this.dragState = {
      isDragging: true,
      type: 'move',
      nodeId: id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTransform: { ...node.transform },
      startTransformMap,
    };
  }

  /** 节点鼠标移动事件（处理拖拽位移计算） */
  handleNodeMove(e: MouseEvent) {
    if (!this.dragState.isDragging || !this.dragState.nodeId) return;
    if ((e.buttons & 1) === 0) {
      this.handleNodeUp();
      return;
    }

    const viewport = this.store.viewport as ViewportState;
    const baseNode = this.store.nodes[this.dragState.nodeId] as BaseNodeState;
    if (!baseNode) return;

    const currentWorldPos = clientToWorld(viewport, e.clientX, e.clientY);
    const startWorldPos = clientToWorld(
      viewport,
      this.dragState.startMouseX,
      this.dragState.startMouseY
    );

    const deltaX = currentWorldPos.x - startWorldPos.x;
    const deltaY = currentWorldPos.y - startWorldPos.y;

    // 多选拖拽：遍历所有选中节点同步偏移
    Object.entries(this.dragState.startTransformMap).forEach(([nodeId, startTransform]) => {
      const node = this.store.nodes[nodeId] as BaseNodeState;
      if (!node || node.isLocked) return;

      const newX = startTransform.x + deltaX;
      const newY = startTransform.y + deltaY;

      this.store.updateNode(nodeId, {
        transform: { ...node.transform, x: newX, y: newY },
      });
    });
  }

  /** 节点鼠标松开事件（重置拖拽状态） */
  handleNodeUp() {
    this.dragState = {
      isDragging: false,
      type: null,
      nodeId: '',
      startMouseX: 0,
      startMouseY: 0,
      startTransform: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
      startTransformMap: {},
    };
    this.store.isInteracting = false;
  }

  /** 创建矩形 */
  createRect() {
    const id = uuidv4();
    const x = Math.random() * 800;
    const y = Math.random() * 600;

    const newRect: ShapeState = {
      id,
      type: NodeType.RECT,
      name: 'Rectangle',
      transform: {
        x,
        y,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
      },
      style: { ...DEFAULT_RECT_STYLE },
      props: { ...DEFAULT_RECT_PROPS },
      parentId: null,
      isLocked: false,
      isVisible: true,
      shapeType: 'rect',
    };

    this.store.addNode(newRect);
    this.store.setActive([id]);
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
      transform: {
        x,
        y,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
      },
      style: { ...DEFAULT_CIRCLE_STYLE },
      props: { ...DEFAULT_CIRCLE_PROPS },
      parentId: null,
      isLocked: false,
      isVisible: true,
      shapeType: 'circle',
    };

    this.store.addNode(newCircle);
    this.store.setActive([id]);
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
      transform: {
        x,
        y,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
      },
      style: { ...DEFAULT_TEXT_STYLE },
      props: { ...DEFAULT_TEXT_PROPS },
      parentId: null,
      isLocked: false,
      isVisible: true,
    };

    this.store.addNode(newText);
    this.store.setActive([id]);
  }

  /** 创建图片 */
  createImage() {
    const id = uuidv4();
    const x = Math.random() * 800;
    const y = Math.random() * 600;

    const newImage: ImageState = {
      id,
      type: NodeType.IMAGE,
      name: 'Image',
      transform: {
        x,
        y,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
      },
      style: { ...DEFAULT_IMAGE_STYLE },
      props: {
        imageUrl: DEFAULT_IMAGE_URL,
        filters: { ...DEFAULT_IMAGE_FILTERS },
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
    };

    this.store.addNode(newImage);
    this.store.setActive([id]);
  }

  /** 删除选中元素 */
  deleteSelected() {
    this.store.activeElementIds.forEach((id) => {
      this.store.deleteNode(id);
    });
  }

  /** 处理单选缩放控制点鼠标按下事件 */
  handleResizeHandleDown(e: MouseEvent, nodeId: string, handle: ResizeHandle) {
    e.stopPropagation();
    e.preventDefault();

    const node = this.store.nodes[nodeId];
    if (!node || node.isLocked) return;

    this.store.isInteracting = true;
    this.dragState.isDragging = false;
    this.dragState.type = null;
    this.dragState.nodeId = '';

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

  /** 新增：处理多选缩放控制点按下事件 */
  handleMultiResizeDown(
    e: MouseEvent,
    handle: ResizeHandle,
    startBounds: { x: number; y: number; width: number; height: number },
    nodeIds: string[]
  ) {
    e.stopPropagation();
    e.preventDefault();

    // 互斥：重置拖拽/单选缩放状态
    this.dragState.isDragging = false;
    this.dragState.type = null;
    this.dragState.nodeId = '';
    this.dragState.startTransformMap = {};
    this.resizeState.isResizing = false;

    // 过滤锁定节点
    const validNodeIds = nodeIds.filter(id => {
      const node = this.store.nodes[id];
      return node && !node.isLocked;
    });
    if (validNodeIds.length === 0) return;

    // 初始化每个节点的初始状态
    const nodeStartStates: Record<string, any> = {};
    validNodeIds.forEach(id => {
      const node = this.store.nodes[id] as BaseNodeState;
      // 计算节点相对于大框的偏移比例和尺寸比例
      const offsetX = (node.transform.x - startBounds.x) / startBounds.width;
      const offsetY = (node.transform.y - startBounds.y) / startBounds.height;
      const scaleX = node.transform.width / startBounds.width;
      const scaleY = node.transform.height / startBounds.height;

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

  /** 单选缩放过程中的鼠标移动计算 */
  private handleResizeMove(e: MouseEvent) {
    const { handle, nodeId, startX, startY, startWidth, startHeight, startNodeX, startNodeY } =
      this.resizeState;

    if (!handle || !nodeId || (e.buttons & 1) === 0) {
      this.resizeState.isResizing = false;
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

    // 根据节点类型选择缩放策略
    switch (node.type) {
      case NodeType.CIRCLE:
        this.resizeCircle(handle, dx, dy, startWidth, startHeight, startNodeX, startNodeY, (res) => {
          newWidth = res.width;
          newHeight = res.height;
          newX = res.x;
          newY = res.y;
        });
        break;
      case NodeType.RECT:
        this.resizeRect(handle, dx, dy, startWidth, startHeight, startNodeX, startNodeY, (res) => {
          newWidth = res.width;
          newHeight = res.height;
          newX = res.x;
          newY = res.y;
        });
        break;
      case NodeType.IMAGE:
        this.resizeImage(handle, dx, dy, startWidth, startHeight, startNodeX, startNodeY, (res) => {
          newWidth = res.width;
          newHeight = res.height;
          newX = res.x;
          newY = res.y;
        });
        break;
      case NodeType.TEXT:
        this.resizeText(handle, dx, dy, startWidth, startHeight, startNodeX, startNodeY, (res) => {
          newWidth = res.width;
          newHeight = res.height;
          newX = res.x;
          newY = res.y;
        });
        break;
      default:
        this.resizeRect(handle, dx, dy, startWidth, startHeight, startNodeX, startNodeY, (res) => {
          newWidth = res.width;
          newHeight = res.height;
          newX = res.x;
          newY = res.y;
        });
        break;
    }

    // 限制最小尺寸
    newWidth = Math.max(MIN_NODE_SIZE, newWidth);
    newHeight = Math.max(MIN_NODE_SIZE, newHeight);
    if (newWidth < MIN_NODE_SIZE && handle.includes('w')) newX = startNodeX + startWidth - MIN_NODE_SIZE;
    if (newHeight < MIN_NODE_SIZE && handle.includes('n')) newY = startNodeY + startHeight - MIN_NODE_SIZE;

    // 更新节点
    this.store.updateNode(nodeId, {
      transform: { ...node.transform, width: newWidth, height: newHeight, x: newX, y: newY },
    });
  }

  /** 新增：多选缩放过程中的鼠标移动计算 */
  private handleMultiResizeMove(e: MouseEvent) {
    const {
      isMultiResizing,
      handle,
      startBounds,
      startMouseX,
      startMouseY,
      nodeIds,
      nodeStartStates,
    } = this.multiResizeState;

    if (!isMultiResizing || !handle || nodeIds.length === 0 || (e.buttons & 1) === 0) {
      this.multiResizeState.isMultiResizing = false;
      this.store.isInteracting = false;
      return;
    }

    // 计算鼠标偏移（世界坐标系）
    const dx = (e.clientX - startMouseX) / this.store.viewport.zoom;
    const dy = (e.clientY - startMouseY) / this.store.viewport.zoom;

    // 计算缩放后的大框尺寸和位置
    let newBounds = { ...startBounds };
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

    // 限制最小尺寸
    newBounds.width = Math.max(MIN_NODE_SIZE, newBounds.width);
    newBounds.height = Math.max(MIN_NODE_SIZE, newBounds.height);

    // 遍历所有节点同步更新
    nodeIds.forEach(id => {
      const startState = nodeStartStates[id];
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node) return;
      if( !startState) return;
      // 按比例计算新尺寸和位置
      const newWidth = startState.scaleX * newBounds.width;
      const newHeight = startState.scaleY * newBounds.height;
      const newX = newBounds.x + startState.offsetX * newBounds.width;
      const newY = newBounds.y + startState.offsetY * newBounds.height;

      // 更新节点
      this.store.updateNode(id, {
        transform: { ...node.transform, x: newX, y: newY, width: newWidth, height: newHeight },
      });
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
    const ratio = startWidth / startHeight;
    const isCorner = handle.length === 2;

    if (isCorner) {
      // 角点：等比缩放
      newWidth = handle.includes('e') ? startWidth + dx : startWidth - dx;
      newHeight = newWidth / ratio;

      if (handle === 'sw') newX = startNodeX + startWidth - newWidth;
      if (handle === 'ne') newY = startNodeY + startHeight - newHeight;
      if (handle === 'nw') {
        newX = startNodeX + startWidth - newWidth;
        newY = startNodeY + startHeight - newHeight;
      }
    } else {
      // 边点：自由缩放（椭圆）
      switch (handle) {
        case 'n':
          newHeight = startHeight - dy;
          newY = startNodeY + dy;
          break;
        case 'e':
          newWidth = startWidth + dx;
          break;
        case 's':
          newHeight = startHeight + dy;
          break;
        case 'w':
          newWidth = startWidth - dx;
          newX = startNodeX + dx;
          break;
      }
    }

    callback({ width: newWidth, height: newHeight, x: newX, y: newY });
  }

  /** 图片缩放计算 */
  private resizeImage(
    handle: ResizeHandle,
    dx: number,
    dy: number,
    startWidth: number,
    startHeight: number,
    startNodeX: number,
    startNodeY: number,
    callback: (result: { width: number; height: number; x: number; y: number }) => void
  ) {
    this.resizeRect(handle, dx, dy, startWidth, startHeight, startNodeX, startNodeY, callback);
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

    callback({ width: newWidth, height: newHeight, x: newX, y: newY });
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

    newWidth = Math.max(MIN_NODE_SIZE, newWidth);
    newHeight = Math.max(MIN_NODE_SIZE, newHeight);
    if (newWidth < MIN_NODE_SIZE && handle.includes('w')) newX = startNodeX + startWidth - MIN_NODE_SIZE;
    if (newHeight < MIN_NODE_SIZE && handle.includes('n')) newY = startNodeY + startHeight - MIN_NODE_SIZE;

    callback({ width: newWidth, height: newHeight, x: newX, y: newY });
  }
}

import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type ShapeState } from '@/types/state';
import { v4 as uuidv4 } from 'uuid';

/**
 * 缩放控制点类型
 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * 缩放状态
 */
interface ResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  nodeId: string | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startNodeX: number;
  startNodeY: number;
}

/**
 * 逻辑层：工具管理器
 * 职责：接收来自交互层（Vue组件）的原始事件，处理鼠标点击、拖拽、工具切换逻辑。
 */
export class ToolManager {
  private store: ReturnType<typeof useCanvasStore>;
  private isDragging = false;
  private lastPos = { x: 0, y: 0 };
  private resizeState: ResizeState = {
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

  constructor() {
    this.store = useCanvasStore();
  }

  /**
   * 处理画布滚轮事件 (缩放)
   */
  handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.max(0.1, Math.min(5, this.store.viewport.zoom + delta));

    // TODO: 以鼠标为中心缩放
    this.store.viewport.zoom = newZoom;
  }

  /**
   * 处理画布鼠标按下事件 (平移开始 / 取消选中)
   */
  handleMouseDown(e: MouseEvent) {
    // 记录起始位置
    this.lastPos.x = e.clientX;
    this.lastPos.y = e.clientY;

    // 点击空白处，取消所有选中
    this.store.setActive([]);

    // 标记开始拖拽 (平移画布)
    // 注意：这里可以添加判断，如果是特定工具才允许平移
    this.isDragging = true;
  }

  /**
   * 处理全局鼠标移动事件 (平移中 / 缩放中)
   */
  handleMouseMove(e: MouseEvent) {
    // 优先处理缩放
    if (this.resizeState.isResizing) {
      this.handleResizeMove(e);
      return;
    }

    if (!this.isDragging) return;

    const dx = e.clientX - this.lastPos.x;
    const dy = e.clientY - this.lastPos.y;

    this.store.viewport.offsetX += dx;
    this.store.viewport.offsetY += dy;

    this.lastPos.x = e.clientX;
    this.lastPos.y = e.clientY;
  }

  /**
   * 处理全局鼠标松开事件 (平移结束 / 缩放结束)
   */
  handleMouseUp() {
    this.isDragging = false;
    this.resizeState.isResizing = false;
    this.resizeState.handle = null;
    this.resizeState.nodeId = null;
  }

  /**
   * 处理节点鼠标按下事件 (选中)
   */
  handleNodeDown(e: MouseEvent, id: string) {
    // 阻止事件冒泡，避免触发画布的 handleMouseDown (导致取消选中)
    // 注意：在 Vue 中可以使用 @mousedown.stop，如果移到这里，需要手动调用
    // 但为了保持"Vue仅转发"，建议在Vue层就 .stop，或者在这里调用 e.stopPropagation()
    e.stopPropagation();

    // 简单的选中逻辑
    // TODO: 支持多选 (Shift/Ctrl)
    this.store.setActive([id]);
  }

  /**
   * 业务逻辑：创建矩形
   */
  createRect() {
    const id = uuidv4();
    // 随机位置
    const x = Math.random() * 800;
    const y = Math.random() * 600;

    const newRect: ShapeState = {
      id,
      type: NodeType.RECT,
      name: 'Rectangle',
      transform: {
        x,
        y,
        width: 100,
        height: 100,
        rotation: 0,
      },
      style: {
        backgroundColor: '#ffccc7',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#ff4d4f',
        opacity: 1,
        zIndex: 1,
      },
      props: {
        cornerRadius: 0,
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
      shapeType: 'rect',
    };

    this.store.addNode(newRect);
    this.store.setActive([id]);
  }

  /**
   * 业务逻辑：删除选中元素
   */
  deleteSelected() {
    this.store.activeElementIds.forEach((id) => {
      this.store.deleteNode(id);
    });
  }

  /**
   * 处理缩放控制点鼠标按下事件
   */
  handleResizeHandleDown(e: MouseEvent, nodeId: string, handle: ResizeHandle) {
    e.stopPropagation();

    const node = this.store.nodes[nodeId];
    if (!node || node.isLocked) return;

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

  /**
   * 处理缩放过程中的鼠标移动
   */
  private handleResizeMove(e: MouseEvent) {
    const { handle, nodeId, startX, startY, startWidth, startHeight, startNodeX, startNodeY } =
      this.resizeState;

    if (!handle || !nodeId) return;

    const node = this.store.nodes[nodeId];
    if (!node) return;

    // 计算鼠标移动的距离（考虑缩放）
    const dx = (e.clientX - startX) / this.store.viewport.zoom;
    const dy = (e.clientY - startY) / this.store.viewport.zoom;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newX = startNodeX;
    let newY = startNodeY;

    // 根据不同的控制点计算新的尺寸和位置
    switch (handle) {
      case 'nw': // 左上
        newWidth = startWidth - dx;
        newHeight = startHeight - dy;
        newX = startNodeX + dx;
        newY = startNodeY + dy;
        break;
      case 'n': // 上
        newHeight = startHeight - dy;
        newY = startNodeY + dy;
        break;
      case 'ne': // 右上
        newWidth = startWidth + dx;
        newHeight = startHeight - dy;
        newY = startNodeY + dy;
        break;
      case 'e': // 右
        newWidth = startWidth + dx;
        break;
      case 'se': // 右下
        newWidth = startWidth + dx;
        newHeight = startHeight + dy;
        break;
      case 's': // 下
        newHeight = startHeight + dy;
        break;
      case 'sw': // 左下
        newWidth = startWidth - dx;
        newHeight = startHeight + dy;
        newX = startNodeX + dx;
        break;
      case 'w': // 左
        newWidth = startWidth - dx;
        newX = startNodeX + dx;
        break;
    }

    // 限制最小尺寸
    const minSize = 20;
    if (newWidth < minSize) {
      newWidth = minSize;
      // 如果是从左侧或左上、左下拖动，需要调整位置
      if (handle.includes('w')) {
        newX = startNodeX + startWidth - minSize;
      }
    }
    if (newHeight < minSize) {
      newHeight = minSize;
      // 如果是从上侧或左上、右上拖动，需要调整位置
      if (handle.includes('n')) {
        newY = startNodeY + startHeight - minSize;
      }
    }

    // 更新节点的变换状态
    node.transform.width = newWidth;
    node.transform.height = newHeight;
    node.transform.x = newX;
    node.transform.y = newY;

    // 触发版本更新
    this.store.version++;
  }
}

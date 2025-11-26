import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type BaseNodeState,type ShapeState } from '@/types/state';
import type { InternalDragState } from '@/types/editor';
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


/**
 *临时拖动状态
 */
  private dragState: InternalDragState = {
  isDragging: false, // 是否正在拖拽节点
  type: null,        // 拖拽类型：移动/缩放/旋转
  nodeId: '',        // 被拖拽的节点ID
  startMouseX: 0,    // 拖拽起始鼠标屏幕X
  startMouseY: 0,    // 拖拽起始鼠标屏幕Y
  startTransform: {  // 节点起始位置/尺寸（深拷贝，避免引用同步）
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0
  }
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
    // 互斥逻辑：如果正在拖拽节点，不触发画布平移
    if (this.dragState.isDragging) return;

    // 记录起始位置
    this.lastPos.x = e.clientX;
    this.lastPos.y = e.clientY;

    // 点击空白处，取消所有选中
    this.store.setActive([]);

    // 标记开始拖拽 (平移画布)
    this.isPanDragging = true;
  }


  /**
   * 处理全局鼠标移动事件 (平移中)
   */
  handleMouseMove(e: MouseEvent) {
    // 优先处理节点拖拽
    if (this.dragState.isDragging) {
      this.handleNodeMove(e); // 调用节点拖拽计算逻辑
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
    }
  }

  /**
   * 处理全局鼠标松开事件 (平移结束)
   */
  handleMouseUp() {
    // 重置画布平移状态
    this.isPanDragging = false;
    // 重置节点拖拽状态
    this.handleNodeUp();
  }





  /**
   * 处理节点鼠标按下事件 (选中)
   */
  handleNodeDown(e: MouseEvent, id: string) {

    // 1.阻止事件冒泡，避免触发画布的 handleMouseDown (导致取消选中)
    // 注意：在 Vue 中可以使用 @mousedown.stop，如果移到这里，需要手动调用
    // 但为了保持"Vue仅转发"，建议在Vue层就 .stop，或者在这里调用 e.stopPropagation()
   e.stopPropagation();
  // 2. 基础选中逻辑（TODO: 后续扩展Shift/Ctrl多选）
   // TODO: 支持多选 (Shift/Ctrl)
  this.store.setActive([id]);

  // 3. 获取节点数据，校验有效性
  const node = this.store.nodes[id] as BaseNodeState;
  if (!node || node.isLocked) return;

  // 4. 标记交互中，防止昂贵操作（如自动保存）
  this.store.isInteracting = true;

  // 5. 初始化拖拽状态（深拷贝节点初始transform，避免引用同步）
  this.dragState = {
    isDragging: true,
    type: 'move',
    nodeId: id,
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    startTransform: { ...node.transform }
  };
  }


/**
 * 节点鼠标移动事件（处理拖拽位移计算）
 */
handleNodeMove(e: MouseEvent) {
  // 1. 非拖拽状态，直接返回
  if (!this.dragState.isDragging || !this.dragState.nodeId) return;



  // 如果没有按住鼠标，强制结束拖拽
  if ((e.buttons & 1) === 0) {
    this.handleNodeUp();
    return;
  }

  // 2. 获取视口状态（画布缩放/平移/网格配置）
  const viewport = this.store.viewport as ViewportState;
  const node = this.store.nodes[this.dragState.nodeId] as BaseNodeState;
  if (!node) return;

  // 3. 屏幕坐标 → 画布世界坐标（抵消画布缩放/平移）
  const currentWorldPos = clientToWorld(viewport, e.clientX, e.clientY);
  const startWorldPos = clientToWorld(viewport, this.dragState.startMouseX, this.dragState.startMouseY);

  // 4. 计算鼠标偏移量（世界坐标下，避免缩放影响）
  const deltaX = currentWorldPos.x - startWorldPos.x;
  const deltaY = currentWorldPos.y - startWorldPos.y;

  // 5. 计算节点新位置（初始位置 + 偏移）
  let newX = this.dragState.startTransform.x + deltaX;
  let newY = this.dragState.startTransform.y + deltaY;

  // TODO: Implement grid snapping logic here if viewport.isSnapToGrid is true.
  // Example:
  // if (viewport.isSnapToGrid) {
  //   const snapped = snapToGrid(viewport, newX, newY);
  //   newX = snapped.x;
  //   newY = snapped.y;
  // }

  // 7. 细粒度更新节点位置（触发响应式刷新）
  this.store.updateNode(this.dragState.nodeId, {
    transform: { ...node.transform, x: newX, y: newY }
  });
}

/**
 * 节点鼠标松开事件（重置拖拽状态）
 */
handleNodeUp() {
  // 1. 重置拖拽状态
  this.dragState = {
    isDragging: false,
    type: null,
    nodeId: '',
    startMouseX: 0,
    startMouseY: 0,
    startTransform: { x: 0, y: 0, width: 0, height: 0, rotation: 0 }
  };

  // 2. 解除交互锁
  this.store.isInteracting = false;

  // 3. 可选：触发节点拖拽结束的钩子（如保存、日志）
  // this.emit('nodeDragEnd', e, this.dragState.nodeId);
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
    console.log('矩形创建完成');
  }
  /**
   * 业务逻辑：创建圆形
   */
  createCircle() {
    const id = uuidv4();
    // 随机位置
    const x = Math.random() * 800;
    const y = Math.random() * 600;

    const newCircle: ShapeState = {
      id,
      type: NodeType.CIRCLE,
      name: 'Circle',
      transform: {
        x,
        y,
        width: 100,
        height: 100,
        rotation: 0,
      },
      style: {
        backgroundColor: '#ADD8E6',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#87CEEB',
        opacity: 1,
        zIndex: 1,
      },
      props: {
        // cornerRadius is rectangle-specific; set to 0 for circles for interface compliance
        cornerRadius: 0,
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
      shapeType: 'circle',
    };

    this.store.addNode(newCircle);
    this.store.setActive([id]);
    console.log('圆形创建完成');
  }

  /**
   * 业务逻辑：删除选中元素
   */
  deleteSelected() {
    this.store.activeElementIds.forEach((id) => {
      this.store.deleteNode(id);
    });
  }
}
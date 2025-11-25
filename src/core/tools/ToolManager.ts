import { useCanvasStore } from '@/store/canvasStore';
import { NodeType, type ShapeState,type TextState } from '@/types/state';
import { v4 as uuidv4 } from 'uuid';

/**
 * 逻辑层：工具管理器
 * 职责：接收来自交互层（Vue组件）的原始事件，处理鼠标点击、拖拽、工具切换逻辑。
 */
export class ToolManager {
  private store: ReturnType<typeof useCanvasStore>;
  private isDragging = false;
  private lastPos = { x: 0, y: 0 };

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
   * 处理全局鼠标移动事件 (平移中)
   */
  handleMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;

    const dx = e.clientX - this.lastPos.x;
    const dy = e.clientY - this.lastPos.y;

    this.store.viewport.offsetX += dx;
    this.store.viewport.offsetY += dy;

    this.lastPos.x = e.clientX;
    this.lastPos.y = e.clientY;
  }

  /**
   * 处理全局鼠标松开事件 (平移结束)
   */
  handleMouseUp() {
    this.isDragging = false;
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
   * 业务逻辑：创建文本
   */
  createText() {

    const id = uuidv4();
    // 随机位置
    const x = Math.random() * 800;
    const y = Math.random() * 600;

    const newText: TextState = {
      id,
      type: NodeType.TEXT,
      name: 'Text',
      transform: {
        x,
        y,
        width: 100,
        height: 100,
        rotation: 0,
      },
      style: {
        backgroundColor: '#fff0',
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: '#fff0', //边框透明
        opacity: 1,
        zIndex: 1,
      },
      props: {
        content: "这里采用了vue绑定,内容会响应式改变.但编辑功能暂时没实现,mvp版本中先写死",
        fontFamily: 'Segoe UI',
        fontSize: 16,
        fontWeight: 400, // B (加粗)
        fontStyle: 'normal' , // I (斜体)
        color: '#0000',
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
    };

    this.store.addNode(newText);
    this.store.setActive([id]);
    console.log('文本创建完成');
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

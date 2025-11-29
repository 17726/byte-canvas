import type {
  InternalResizeState,
  ResizeHandle,
  InternalMultiResizeState,
  NodeStartState,
} from '@/types/editor';
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
 * 职责：接收来自交互层（Vue组件）的原始事件，处理鼠标点击、拖拽、工具切换逻辑。
 */
/**
 * 工具管理器（ToolManager）
 * 说明：负责将 UI 层（鼠标事件/键盘事件）转发为对 `store` 的状态更新。
 * 主要职责：
 * - 处理画布平移、缩放
 * - 处理节点的选中/拖拽/缩放/删除/创建
 * - 在交互时控制 `store.isInteracting` 避免额外的昂贵操作
 */
export class ToolManager {
  private store: ReturnType<typeof useCanvasStore>;
  private ui: ReturnType<typeof useUIStore>;
  private isPanDragging = false;
  private lastPos = { x: 0, y: 0 };
  private stageEl: HTMLElement | null; // 画布根元素

  /**
   *临时拖动状态
   */
  private dragState: InternalDragState & {
    // 改为TransformState类型（与节点的transform类型一致）
    startTransformMap: Record<string, TransformState>;
    // 新增：是否为多选区域拖拽（点击空白区域拖拽选中节点）
    isMultiAreaDrag: boolean;
  } = {
    isDragging: false,
    type: null,
    nodeId: '',
    startMouseX: 0,
    startMouseY: 0,
    // 同时将startTransform的类型明确为TransformState
    startTransform: { x: 0, y: 0, width: 0, height: 0, rotation: 0 } as TransformState,
    startTransformMap: {}, // 初始值为空对象，类型匹配
    isMultiAreaDrag: false,
  };

  /** 单选缩放状态（修正：移到类属性区，与dragState同级） */
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

  // 多选缩放状态
  private multiResizeState: InternalMultiResizeState = {
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
    this.stageEl = stageEl; // 保存画布根元素引用
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

  /**
   * 新增：计算选中节点的包围盒
   * @returns 包围盒信息 | null（无选中节点）
   */
  private getSelectedNodesBounds(): { x: number; y: number; width: number; height: number } | null {
    const activeIds = Array.from(this.store.activeElementIds);
    if (activeIds.length === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    activeIds.forEach((id) => {
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node) return;
      const { x, y, width, height } = node.transform;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * 新增：判断点击位置是否在选中区域内（但不在任何具体节点上）
   * @param e 鼠标事件
   * @returns 是否为选中区域空白处点击
   */
  private isClickInSelectedArea(e: MouseEvent): boolean {
    const bounds = this.getSelectedNodesBounds();
    if (!bounds) return false;

    // 获取画布偏移
    const stageRect = this.stageEl?.getBoundingClientRect() || { left: 0, top: 0 };
    // 转换为世界坐标
    const worldPos = clientToWorld(
      this.store.viewport as ViewportState,
      e.clientX - stageRect.left,
      e.clientY - stageRect.top
    );

    // 1. 判断是否在选中区域包围盒内
    if (
      !(
        worldPos.x >= bounds.x &&
        worldPos.x <= bounds.x + bounds.width &&
        worldPos.y >= bounds.y &&
        worldPos.y <= bounds.y + bounds.height
      )
    ) {
      return false;
    }

    // 2. 判断是否不在任何选中节点上
    const activeIds = Array.from(this.store.activeElementIds);
    for (const id of activeIds) {
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node) continue;
      const { x, y, width, height } = node.transform;
      if (
        worldPos.x >= x &&
        worldPos.x <= x + width &&
        worldPos.y >= y &&
        worldPos.y <= y + height
      ) {
        // 点击在具体节点上，走原有节点拖拽逻辑
        return false;
      }
    }

    return true;
  }

  /**
   * 处理画布滚轮事件（缩放）
   * - e.preventDefault() 阻止页面滚动
   * - 这里以窗口中心为基准进行缩放，可改为以鼠标为缩放中心（更符合用户期望）
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
   * 处理画布鼠标按下事件（平移开始 / 取消选中 / 多选区域拖拽启动）
   * - 点击空白区，会取消所有选中并将画布置为拖拽(pan)状态
   * - 新增：如果有选中节点且点击在选中区域空白处，启动多选区域拖拽
   */
  handleMouseDown(e: MouseEvent) {
    // 互斥逻辑：如果正在拖拽节点，不触发画布平移
    if (this.dragState.isDragging) return;

    // 记录起始位置
    this.lastPos.x = e.clientX;
    this.lastPos.y = e.clientY;

    if (e.button === 1) {
      // 中键平移：取消所有选中
      this.isPanDragging = true;
      this.store.setActive([]);
    } else if (e.button === 0) {
      // 新增：判断是否点击在选中区域空白处 → 启动多选区域拖拽
      const hasActiveNodes = this.store.activeElementIds.size > 0;
      const isClickInArea = this.isClickInSelectedArea(e);

      if (hasActiveNodes && isClickInArea) {
        // 启动多选区域拖拽
        this.store.isInteracting = true;

        // 初始化拖拽状态
        const activeIds = Array.from(this.store.activeElementIds).filter((id) => {
          const node = this.store.nodes[id] as BaseNodeState;
          return node && !node.isLocked;
        });
        if (activeIds.length === 0) return;
        const startTransformMap: Record<string, TransformState> = {};
        activeIds.forEach((id) => {
          const node = this.store.nodes[id] as BaseNodeState;
          startTransformMap[id] = { ...node.transform };
        });

        this.dragState = {
          isDragging: true,
          type: 'move',
          nodeId: '', // 无基准节点
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startTransform: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
          startTransformMap,
          isMultiAreaDrag: true,
        };
        return; // 阻止后续框选逻辑
      }

      // 原有框选逻辑
      this.isBoxSelecting = true;
      this.boxSelectStart = { x: e.clientX, y: e.clientY };
      this.boxSelectEnd = { x: e.clientX, y: e.clientY };
    }
  }

  /**
   * 处理全局鼠标移动事件 (平移中 / 缩放中 / 多选区域拖拽)
   */
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

    // 然后：节点拖拽（包含多选区域拖拽）
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

  /**
   * 处理全局鼠标松开事件 (平移结束 / 缩放结束)
   */
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

    // 重置节点拖拽状态（包含新增的多选区域拖拽状态）
    this.dragState = {
      isDragging: false,
      type: null,
      nodeId: '',
      startMouseX: 0,
      startMouseY: 0,
      startTransform: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
      startTransformMap: {}, // 新增：重置多节点初始状态映射
      isMultiAreaDrag: false,
    };

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
      // 框选面积过小 = 点击空白处：取消所有选中
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

  /**
   * 处理节点鼠标按下事件（选中/开始拖拽）
   * - 单击已选中节点：保留多选状态
   * - 单击未选中节点：设置单选
   * - Ctrl/Shift + 单击：多选切换
   * - 选中后将右侧属性面板激活到 Node 模式（store.activePanel = 'node'）
   */
  handleNodeDown(e: MouseEvent, id: string) {
    // 1.阻止事件冒泡，避免触发画布的 handleMouseDown (导致取消选中)
    e.stopPropagation();
    // 如果正在缩放，不处理节点拖拽
    if (this.resizeState.isResizing) return;

    // 2. 多选逻辑核心修改：框选后点击已选中节点不取消多选
    if (e.ctrlKey || e.shiftKey) {
      // Ctrl/Shift + 点击：切换选中状态（多选模式）
      this.store.toggleSelection(id);
    } else {
      // 无快捷键时：
      // - 点击已选中的节点 → 保留现有多选
      // - 点击未选中的节点 → 重置为单选
      if (this.store.activeElementIds.has(id)) {
        // 点击已选中的节点，不修改选中状态（保留多选）
      } else {
        // 点击未选中的节点，重置为单选
        this.store.setActive([id]);
      }
    }

    // 3. 获取节点数据，校验有效性
    const node = this.store.nodes[id] as BaseNodeState;
    if (!node || node.isLocked) return;

    // 4. 标记交互中，防止昂贵操作（如自动保存）
    this.store.isInteracting = true;
    // 展示右侧属性面板并切换为节点模式
    this.ui.setActivePanel('node');
    this.ui.setPanelExpanded(true);

    // 5. 初始化拖拽状态（适配多选拖拽）
    const activeIds = Array.from(this.store.activeElementIds).filter((activeId) => {
      // 过滤锁定节点，避免拖拽锁定节点
      const activeNode = this.store.nodes[activeId] as BaseNodeState;
      return activeNode && !activeNode.isLocked;
    });

    // 初始化多节点初始变换状态映射
    const startTransformMap: Record<string, typeof node.transform> = {};
    activeIds.forEach((activeId) => {
      const activeNode = this.store.nodes[activeId] as BaseNodeState;
      startTransformMap[activeId] = { ...activeNode.transform };
    });

    // 5. 初始化拖拽状态（深拷贝节点初始transform，避免引用同步）
    this.dragState = {
      isDragging: true,
      type: 'move',
      nodeId: id, // 基准节点（鼠标点击的节点）
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTransform: { ...node.transform }, // 基准节点初始状态
      startTransformMap, // 新增：所有选中节点的初始状态
      isMultiAreaDrag: false, // 非区域拖拽
    };
  }

  /**
   * 节点鼠标移动事件（处理拖拽位移计算）
   * 新增：支持多选节点同步拖拽 + 多选区域空白处拖拽
   */
  handleNodeMove(e: MouseEvent) {
    // 1. 非拖拽状态，直接返回
    if (!this.dragState.isDragging) return;
    // 如果没有按住鼠标，强制结束拖拽
    if ((e.buttons & 1) === 0) {
      this.handleNodeUp();
      return;
    }

    const viewport = this.store.viewport as ViewportState;
    const stageRect = this.stageEl?.getBoundingClientRect() || { left: 0, top: 0 };
    const currentWorldPos = clientToWorld(
      viewport,
      e.clientX - stageRect.left,
      e.clientY - stageRect.top
    );
    const startWorldPos = clientToWorld(
      viewport,
      this.dragState.startMouseX - stageRect.left,
      this.dragState.startMouseY - stageRect.top
    );

    // 4. 计算鼠标偏移量（世界坐标下，避免缩放影响）
    const deltaX = currentWorldPos.x - startWorldPos.x;
    const deltaY = currentWorldPos.y - startWorldPos.y;

    // 5. 多选拖拽：遍历所有选中节点，同步应用偏移量
    Object.entries(this.dragState.startTransformMap).forEach(([nodeId, startTransform]) => {
      const node = this.store.nodes[nodeId] as BaseNodeState;
      if (!node || node.isLocked) return;

      // 计算节点新位置（初始位置 + 偏移）
      const newX = startTransform.x + deltaX;
      const newY = startTransform.y + deltaY;

      // TODO: Implement grid snapping逻辑（如果 viewport.isSnapToGrid 为 true）
      // 该逻辑应该在世界坐标系中进行（已转换为 world 坐标），以保证缩放/平移下 snapping 的一致性
      // Example:
      // if (viewport.isSnapToGrid) {
      //   const snapped = snapToGrid(viewport, newX, newY);
      //   newX = snapped.x;
      //   newY = snapped.y;
      // }

      // 7. 细粒度更新节点位置（触发响应式刷新）
      this.store.updateNode(nodeId, {
        transform: { ...node.transform, x: newX, y: newY },
      });
    });
  }

  /**
   * 节点鼠标松开事件（重置拖拽状态）
   */
  handleNodeUp() {
    // 修正：移除重复的 dragState 重置（仅保留整体重置即可）
    this.dragState = {
      isDragging: false,
      type: null,
      nodeId: '',
      startMouseX: 0,
      startMouseY: 0,
      startTransform: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
      startTransformMap: {}, // 新增：重置多节点初始状态映射
      isMultiAreaDrag: false,
    };
    // 解除交互锁
    this.store.isInteracting = false;
  }

  /**
   * 业务逻辑：创建矩形
   */
  /** 创建矩形 */
  createRect() {
    const id = uuidv4();
    // 随机位置
    // NOTE：不应该在这里限制精度，应该在UI层处理 --- IGNORE ---
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
    console.log('矩形创建完成');
  }

  /**
   * 业务逻辑：创建圆形
   */
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
    console.log('文本创建完成');
  }

  /**
   * 业务逻辑：创建图片
   */
  async createImageWithUrl(imageUrl = DEFAULT_IMAGE_URL) {
    const id = uuidv4();

    try {
      // 获取图片原始尺寸
      const dimensions = await this.getImageDimensions(imageUrl);

      // 尺寸限制
      const MAX_SIZE = 400;
      const MIN_SIZE = 50;

      let { width, height } = dimensions;

      // 如果图片太大，等比例缩放
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      // 确保不小于最小尺寸
      if (width < MIN_SIZE || height < MIN_SIZE) {
        const ratio = Math.max(MIN_SIZE / width, MIN_SIZE / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      const newImage: ImageState = {
        id,
        type: NodeType.IMAGE,
        name: 'Image',
        transform: {
          x: Math.random() * 800,
          y: Math.random() * 600,
          width: width,
          height: height,
          rotation: 0,
        },
        style: { ...DEFAULT_IMAGE_STYLE },
        props: {
          imageUrl: imageUrl,
          filters: { ...DEFAULT_IMAGE_FILTERS },
        },
        parentId: null,
        isLocked: false,
        isVisible: true,
      };

      this.store.addNode(newImage);
      this.store.setActive([id]);
      console.log('图片创建完成，尺寸:', width, 'x', height);

    } catch (error) {
      console.warn('获取图片尺寸失败，使用默认尺寸:', error);
      // 降级方案：使用默认尺寸
      this.createImageWithDefaultSize(id, imageUrl);
    }
  }

  // 获取图片尺寸的辅助方法
  private getImageDimensions(url: string): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };

      img.onerror = () => {
        reject(new Error(`图片加载失败: ${url}`));
      };

      // 设置超时
      const timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error(`图片加载超时: ${url}`));
      }, 5000);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };

      img.src = url;
    });
  }

  // 降级方法：使用默认尺寸
  private createImageWithDefaultSize(id: string, imageUrl: string) {
    const newImage: ImageState = {
      id,
      type: NodeType.IMAGE,
      name: 'Image',
      transform: {
        x: Math.random() * 800,
        y: Math.random() * 600,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
      },
      style: { ...DEFAULT_IMAGE_STYLE },
      props: {
        imageUrl: imageUrl,
        filters: { ...DEFAULT_IMAGE_FILTERS },
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
    };

    this.store.addNode(newImage);
    this.store.setActive([id]);
    console.log('使用默认尺寸创建图片');
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
    e.preventDefault(); // 阻止默认行为

    const node = this.store.nodes[nodeId];
    if (!node || node.isLocked) return;

    // 标记交互中
    this.store.isInteracting = true;

    // 重置拖拽状态，确保不会与缩放冲突
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

  /**
   * 处理选中多个节点时，调整大小控制点上的鼠标按下事件。
   *
   * 初始化多节点调整大小的状态，包括
   * 计算每个节点相对于选中区域边界的相对位置和缩放比例。锁定的节点
   * 会被排除在调整大小的操作之外。
   *
   * @param {MouseEvent} e - 按下调整大小控制点时触发的鼠标事件。
   * @param {ResizeHandle} handle - 表示调整方向的控制点（例如：'nw'、'se'）。
   * @param {{ x: number; y: number; width: number; height: number }} startBounds - 被选中节点在调整开始时的边界矩形。
   * @param {string[]} nodeIds - 包含在多选区域中的节点ID列表。
   */
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
    const validNodeIds = nodeIds.filter((id) => {
      const node = this.store.nodes[id];
      return node && !node.isLocked;
    });
    if (validNodeIds.length === 0) return;

    // 初始化每个节点的初始状态（替换any为显式类型）
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
   * 处理缩放过程中的鼠标移动
   */
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
        // 圆形：等比缩放，保持宽高相等
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
        // 矩形：独立缩放宽高
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
        // 图片：自由缩放（允许畸变）
        this.resizeImage(
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
        // 文本：只改变容器大小，不缩放字体
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
        // 组合：等比缩放所有子元素
        // TODO: 实现组合缩放逻辑
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
        // 默认使用矩形缩放逻辑
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

    // 限制最小尺寸
    const minSize = MIN_NODE_SIZE;

    // 圆形和矩形都使用独立的宽高限制（因为圆形现在可以拉伸成椭圆）
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

    // 使用 updateNode 方法更新节点的变换状态
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

  /**
   * 处理多选缩放过程中的鼠标移动计算
   *
   * 根据拖动的控制点和鼠标移动，计算新的选中区域边界矩形。
   * 确定宽度和高度的缩放因子，然后对每个选中的节点应用等比缩放，
   * 更新它们相对于新边界的位置和大小。
   *
   * 缩放操作会保持每个节点在选中矩形内的相对位置和大小。
   * 计算过程考虑了当前的缩放级别、初始鼠标位置和选区的初始边界。
   *
   * @param {MouseEvent} e - 包含当前光标位置的鼠标事件。
   *   使用 e.clientX 和 e.clientY 来确定相对于初始鼠标位置的移动增量。
   *   移动量会使用当前视口的缩放比例转换为世界坐标。
   *
   * 算法：
   *   1. 计算世界坐标系下的鼠标移动增量 (dx, dy)。
   *   2. 根据拖动的控制点，调整选区边界。
   *   3. 计算宽度和高度的缩放因子。
   *   4. 对于每个选中的节点，根据选区边界的变化，按比例计算其新的位置和大小。
   *   5. 更新每个节点的变换属性以反映新的位置和大小。
   *
   * 边界情况：
   *   - 如果释放鼠标按钮或没有选中节点，操作将被取消。
   *   - 可能会在其他地方强制执行最小节点尺寸限制。
   */
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

    // 限制最小尺寸
    const clampedWidth = Math.max(MIN_NODE_SIZE, newBounds.width);
    const clampedHeight = Math.max(MIN_NODE_SIZE, newBounds.height);
    // 如果发生了clamp，且handle影响位置，则调整x/y
    if (clampedWidth !== newBounds.width) {
      switch (handle) {
        case 'nw':
        case 'w':
        case 'sw':
          newBounds.x = startBounds.x + startBounds.width - MIN_NODE_SIZE;
          break;
      }
    }
    if (clampedHeight !== newBounds.height) {
      switch (handle) {
        case 'nw':
        case 'n':
        case 'ne':
          newBounds.y = startBounds.y + startBounds.height - MIN_NODE_SIZE;
          break;
      }
    }
    newBounds.width = clampedWidth;
    newBounds.height = clampedHeight;
    // 遍历所有节点同步更新
    nodeIds.forEach((id) => {
      const startState = nodeStartStates[id];
      const node = this.store.nodes[id] as BaseNodeState;
      if (!node) return;
      if (!startState) return;
      // 按比例计算新尺寸和位置
      const newWidth = Math.max(MIN_NODE_SIZE, startState.scaleX * newBounds.width);
      const newHeight = Math.max(MIN_NODE_SIZE, startState.scaleY * newBounds.height);
      const newX = newBounds.x + startState.offsetX * newBounds.width;
      const newY = newBounds.y + startState.offsetY * newBounds.height;

      // 更新节点
      this.store.updateNode(id, {
        transform: { ...node.transform, x: newX, y: newY, width: newWidth, height: newHeight },
      });
    });
  }

  /**
   * 圆形缩放计算
   * - 四个角（nw, ne, se, sw）：等比缩放，保持圆形，锚点为对角
   * - 四条边（n, e, s, w）：独立缩放宽高，可拉伸成椭圆，锚点为对边
   */
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

    // 宽高比
    const ratio = startWidth / startHeight;

    // 判断是否为角点（等比缩放）
    const isCorner = handle.length === 2;

    if (isCorner) {
      // 角点：等比缩放，保持宽高比
      // 以宽度变化为主导 (也可以取 max(dx, dy))

      // 1. 计算基于宽度的预期新宽度
      if (handle.includes('e')) {
        newWidth = startWidth + dx;
      } else {
        newWidth = startWidth - dx;
      }

      // 2. 根据比例计算高度
      newHeight = newWidth / ratio;

      // 3. 根据锚点调整位置
      if (handle === 'se') {
        // 锚点在左上 (startNodeX, startNodeY) -> 不变
      } else if (handle === 'sw') {
        // 锚点在右上 (startNodeX + startWidth, startNodeY)
        newX = startNodeX + startWidth - newWidth;
      } else if (handle === 'ne') {
        // 锚点在左下 (startNodeX, startNodeY + startHeight)
        newY = startNodeY + startHeight - newHeight;
      } else if (handle === 'nw') {
        // 锚点在右下 (startNodeX + startWidth, startNodeY + startHeight)
        newX = startNodeX + startWidth - newWidth;
        newY = startNodeY + startHeight - newHeight;
      }
    } else {
      // 边点：独立缩放宽高，可拉伸成椭圆 (与矩形逻辑一致)
      switch (handle) {
        case 'n': // 上：只改变高度，锚点在下
          newHeight = startHeight - dy;
          newY = startNodeY + dy;
          break;
        case 'e': // 右：只改变宽度，锚点在左
          newWidth = startWidth + dx;
          break;
        case 's': // 下：只改变高度，锚点在上
          newHeight = startHeight + dy;
          break;
        case 'w': // 左：只改变宽度，锚点在右
          newWidth = startWidth - dx;
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

  /**
   * 图片缩放计算
   * - 角点和边点均允许宽高独立缩放（自由缩放，允许畸变）
   */
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
    // 图片现在默认使用自由缩放（允许畸变），逻辑与矩形一致
    this.resizeRect(handle, dx, dy, startWidth, startHeight, startNodeX, startNodeY, callback);
  }

  /**
   * 矩形缩放计算（独立缩放宽高）
   */
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

    callback({
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY,
    });
  }

  /**
   * 文本缩放计算（只改变容器大小，不改变字号）
   * 与矩形缩放逻辑相同，但不会影响文本的 fontSize
   */
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

    // 文本容器的缩放逻辑与矩形相同
    // 区别在于：文本的字体大小（fontSize）不会随容器缩放而改变
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

    // 限制最小尺寸（与其他缩放方法一致）
    const minSize = MIN_NODE_SIZE;

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

// 导出类型以便在组件中使用在此基础上实现ctr/shift按住可实现多选拖拽功能

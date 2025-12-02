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
  type GroupState,
  type NodeState,
} from '@/types/state';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_RECT_STYLE,
  DEFAULT_RECT_PROPS,
  DEFAULT_CIRCLE_STYLE,
  DEFAULT_CIRCLE_PROPS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TEXT_PROPS,
  DEFAULT_TEXT_SIZE,
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

  // 改为从外部获取空格键状态（不再内部维护）
  private getIsSpacePressed: () => boolean;
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

  // 构造函数新增：接收空格键状态获取函数
  constructor(stageEl: HTMLElement | null, getIsSpacePressed: () => boolean) {
    this.store = useCanvasStore();
    this.ui = useUIStore();
    this.stageEl = stageEl; // 保存画布根元素引用
    this.getIsSpacePressed = getIsSpacePressed; // 接收外部状态
  }

  /**
   * 销毁方法（仅保留非键盘相关逻辑）
   */
  destroy() {
    // 移除原键盘事件监听代码（已迁移到组件）
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

  // ==================== 画布事件处理 ====================

  /**
   * 处理画布滚轮事件（缩放）
   * - e.preventDefault() 阻止页面滚动
   * - 这里以窗口中心为基准进行缩放，可改为以鼠标为缩放中心（更符合用户期望）
   */
  handleWheel(e: WheelEvent) {
    e.preventDefault();
    // 新增：触摸板双指平移逻辑（无Ctrl键时触发）
    if (!(e.ctrlKey || e.shiftKey) && (e.deltaX !== 0 || e.deltaY !== 0)) {
      // 平移偏移量适配画布缩放比例，保证平移速度一致
      const dx = -e.deltaX / this.store.viewport.zoom;
      const dy = -e.deltaY / this.store.viewport.zoom;
      this.store.viewport.offsetX += dx;
      this.store.viewport.offsetY += dy;
      return; // 平移时跳过缩放逻辑
    }

    // 原有缩放逻辑（完全保留，注释不变）
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.max(0.1, Math.min(5, this.store.viewport.zoom + delta));

    // TODO: 以鼠标为中心缩放
    this.store.viewport.zoom = newZoom;
  }
  /**
   * 处理画布鼠标按下事件（平移开始 / 取消选中 / 多选区域拖拽启动）
   * - 【核心修改】按下空格+左键：无论点击位置，强制进入平移模式
   * - 点击空白区，会取消所有选中并将画布置为拖拽(pan)状态
   * - 新增：如果有选中节点且点击在选中区域空白处，启动多选区域拖拽
   * - 新增：如果在组合编辑模式下点击空白区域，退出编辑模式
   */
  handleMouseDown(e: MouseEvent) {
    // 核心修改1：只要按下空格+左键，直接进入平移模式（最高优先级）
    if (this.getIsSpacePressed() && e.button === 0) {
      this.isPanDragging = true;
      this.lastPos.x = e.clientX;
      this.lastPos.y = e.clientY;
      // 空格平移时保留选中状态（不取消选中）
      return;
    }

    // 互斥逻辑：如果正在拖拽节点，不触发画布平移
    if (this.dragState.isDragging) return;

    // 记录起始位置
    this.lastPos.x = e.clientX;
    this.lastPos.y = e.clientY;

    // 中键直接平移（原有逻辑）
    if (e.button === 1) {
      this.isPanDragging = true;
      this.store.setActive([]); // 中键平移取消选中
      // 退出组合编辑模式
      if (this.store.editingGroupId) {
        this.exitGroupEdit();
      }
      return;
    }

    // 仅当未按空格时，才执行原有框选/多选区域拖拽逻辑
    if (e.button === 0 && !this.getIsSpacePressed()) {
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

      // 点击空白区域时，如果在组合编辑模式下，退出编辑模式
      if (this.store.editingGroupId) {
        this.exitGroupEdit();
      }

      // 原有框选逻辑（仅未按空格时执行）
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

    // 仅未按空格时更新框选状态
    if (this.isBoxSelecting && !this.getIsSpacePressed()) {
      this.boxSelectEnd = { x: e.clientX, y: e.clientY };
    }
  }

  /**
   * 处理全局鼠标松开事件 (平移结束 / 缩放结束)
   */
  handleMouseUp() {
    // 在重置状态之前，检查是否需要扩展组合边界
    // 只有在有实际拖拽或缩放操作时才检查
    const hadDragOrResize =
      this.dragState.isDragging ||
      this.resizeState.isResizing ||
      this.multiResizeState.isMultiResizing;

    // 重置多选缩放状态
    this.multiResizeState.isMultiResizing = false;
    this.multiResizeState.handle = null;
    this.multiResizeState.nodeIds = [];

    // 重置画布平移状态
    this.isPanDragging = false;
    this.handleNodeUp();

    // 仅未按空格时处理框选结束
    if (this.isBoxSelecting && !this.getIsSpacePressed()) {
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

    // 如果在组合编辑模式下有拖拽或缩放操作，检查并扩展组合边界
    if (hadDragOrResize && this.store.editingGroupId) {
      this.expandGroupToFitChildren();
    }

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
    const editingGroupId = this.store.editingGroupId;

    Object.entries(this.store.nodes).forEach(([id, node]) => {
      const baseNode = node as BaseNodeState;
      if (baseNode.isLocked) return;

      // 只选择当前层级的节点：
      // - 正常模式：只选择顶层节点 (parentId === null)
      // - 编辑模式：只选择当前编辑组合的直接子节点
      if (editingGroupId) {
        // 编辑模式：只选择编辑组合的子节点
        if (baseNode.parentId !== editingGroupId) return;
      } else {
        // 正常模式：只选择顶层节点
        if (baseNode.parentId !== null) return;
      }

      // 使用绝对坐标进行碰撞检测
      const absTransform = this.store.getAbsoluteTransform(id);
      if (!absTransform) return;

      // 创建一个使用绝对坐标的虚拟节点进行检测
      const nodeForHitTest = {
        ...baseNode,
        transform: absTransform,
      };

      if (isNodeInRect(worldMax.x, worldMax.y, worldMin.x, worldMin.y, nodeForHitTest)) {
        selectedIds.push(id);
      }
    });

    this.store.setActive(selectedIds);
  }

  // ==================== 节点事件处理 ====================

  /**
   * 处理节点鼠标按下事件（选中/开始拖拽）
   * 【核心修改】按下空格时，不阻止冒泡、不处理节点交互，直接触发画布平移
   */
  handleNodeDown(e: MouseEvent, id: string) {
    // 核心修改2：按下空格时，不阻止事件冒泡，让画布的handleMouseDown接管（触发平移）
    if (this.getIsSpacePressed()) {
      return; // 不处理任何节点逻辑，直接冒泡到画布
    }

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
   * 处理节点双击事件（用于进入组合编辑模式）
   * @param e 鼠标事件
   * @param id 节点ID
   */
  handleNodeDoubleClick(e: MouseEvent, id: string) {
    e.stopPropagation();

    const node = this.store.nodes[id];
    if (!node) return;

    // 如果双击的是组合节点，进入编辑模式
    if (node.type === NodeType.GROUP) {
      this.enterGroupEdit(id);
    }
    this.store.isInteracting = false;
  }

  // ==================== 组合/解组合功能 ====================

  /**
   * 将选中的元素组合成一个组
   * 支持嵌套组合：可以将已有的组合元素与其他元素一起组合
   * @returns 新创建的组合ID，失败返回null
   */
  groupSelected(): string | null {
    const selectedIds = Array.from(this.store.activeElementIds);
    if (selectedIds.length < 2) {
      console.log('[Group] 需要至少选中2个元素才能组合');
      return null;
    }

    // 过滤掉不存在的节点
    const validIds = selectedIds.filter((id) => this.store.nodes[id]);
    if (validIds.length < 2) {
      console.log('[Group] 有效元素不足2个');
      return null;
    }

    // 计算组合的边界框（使用绝对坐标）
    const bounds = this.store.getSelectionBounds(validIds);

    // 创建新的组合节点
    const groupId = uuidv4();
    const groupNode: GroupState = {
      id: groupId,
      type: NodeType.GROUP,
      name: 'Group',
      transform: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rotation: 0,
      },
      style: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderStyle: 'none',
        borderColor: 'transparent',
        opacity: 1,
        zIndex: 0,
      },
      parentId: null,
      isLocked: false,
      isVisible: true,
      children: validIds,
    };

    // 检查是否在组合编辑模式下
    const editingGroupId = this.store.editingGroupId;
    const isInEditMode = !!editingGroupId;

    // 如果在编辑模式下，新组合应该继承父组合
    if (isInEditMode) {
      groupNode.parentId = editingGroupId;
    }

    // 更新子节点的parentId，并将坐标转换为相对于新组合的坐标
    validIds.forEach((id) => {
      const node = this.store.nodes[id];
      if (node) {
        // 获取节点的绝对坐标
        const absTransform = this.store.getAbsoluteTransform(id);
        const absX = absTransform ? absTransform.x : node.transform.x;
        const absY = absTransform ? absTransform.y : node.transform.y;

        // 使用 updateNode 确保响应式更新
        this.store.updateNode(id, {
          parentId: groupId,
          transform: {
            ...node.transform,
            x: absX - bounds.x,
            y: absY - bounds.y,
          },
        });
      }
    });

    // 添加组合节点到nodes
    this.store.nodes[groupId] = groupNode;

    if (isInEditMode) {
      // 在编辑模式下：更新父组合的children数组
      const parentGroup = this.store.nodes[editingGroupId] as GroupState;
      if (parentGroup && parentGroup.type === NodeType.GROUP) {
        // 从父组合的children中移除被组合的节点，添加新组合
        const newChildren = parentGroup.children.filter((id) => !validIds.includes(id));
        newChildren.push(groupId);
        parentGroup.children = newChildren;
      }
    } else {
      // 正常模式：更新nodeOrder
      const orderSet = new Set(validIds);
      const insertIndex = Math.min(
        ...validIds.map((id) => this.store.nodeOrder.indexOf(id)).filter((i) => i >= 0)
      );
      this.store.nodeOrder = this.store.nodeOrder.filter((id) => !orderSet.has(id));
      this.store.nodeOrder.splice(insertIndex, 0, groupId);
    }

    // 选中新创建的组合
    this.store.setActive([groupId]);

    this.store.version++;
    console.log(
      `[Group] 创建组合 ${groupId}，包含 ${validIds.length} 个元素，编辑模式: ${isInEditMode}`
    );
    return groupId;
  }

  /**
   * 解组合选中的组合节点
   * 只解开最外层的组合，保留内部嵌套的组合结构
   * @returns 解组合后的子节点ID列表
   */
  ungroupSelected(): string[] {
    const selectedIds = Array.from(this.store.activeElementIds);
    const ungroupedIds: string[] = [];

    selectedIds.forEach((id) => {
      const node = this.store.nodes[id];
      if (!node || node.type !== NodeType.GROUP) return;

      const groupNode = node as GroupState;
      const children = [...groupNode.children]; // 复制一份，避免修改原数组时出问题
      const isNested = groupNode.parentId !== null;

      // 恢复子节点的parentId和坐标
      children.forEach((childId) => {
        const child = this.store.nodes[childId];
        if (child) {
          // 使用 updateNode 确保响应式更新
          this.store.updateNode(childId, {
            parentId: groupNode.parentId,
            transform: {
              ...child.transform,
              // 将相对坐标转换：加上组合的偏移
              x: child.transform.x + groupNode.transform.x,
              y: child.transform.y + groupNode.transform.y,
            },
          });
          ungroupedIds.push(childId);
        }
      });

      if (isNested && groupNode.parentId) {
        // 如果组合是嵌套的，更新父组合的children数组
        const parentGroup = this.store.nodes[groupNode.parentId] as GroupState;
        if (parentGroup && parentGroup.type === NodeType.GROUP) {
          // 从父组合的children中移除当前组合，添加其子节点
          const newChildren = parentGroup.children.filter((cid) => cid !== id);
          newChildren.push(...children);
          parentGroup.children = newChildren;
        }
      } else {
        // 顶层组合：更新nodeOrder
        const groupIndex = this.store.nodeOrder.indexOf(id);
        if (groupIndex >= 0) {
          this.store.nodeOrder.splice(groupIndex, 1, ...children);
        }
      }

      // 删除组合节点
      delete this.store.nodes[id];

      // 无论是否嵌套，都确保从 nodeOrder 中移除该组合 ID，防止悬空引用
      const indexInOrder = this.store.nodeOrder.indexOf(id);
      if (indexInOrder >= 0) {
        this.store.nodeOrder.splice(indexInOrder, 1);
      }
    });

    if (ungroupedIds.length > 0) {
      // 选中解组合后的所有子节点
      this.store.setActive(ungroupedIds);
      this.store.version++;
      console.log(`[Ungroup] 解组合完成，释放 ${ungroupedIds.length} 个元素`);
    }

    return ungroupedIds;
  }

  /**
   * 进入组合编辑模式
   * @param groupId 要编辑的组合ID
   */
  enterGroupEdit(groupId: string): boolean {
    const node = this.store.nodes[groupId];
    if (!node || node.type !== NodeType.GROUP) {
      console.warn('[Group] 无法进入编辑模式：节点不存在或不是组合');
      return false;
    }

    this.store.editingGroupId = groupId;
    this.store.setActive([]); // 清空选中状态
    console.log(`[Group] 进入组合编辑模式: ${groupId}`);
    return true;
  }

  /**
   * 退出组合编辑模式
   */
  exitGroupEdit() {
    if (this.store.editingGroupId) {
      console.log(`[Group] 退出组合编辑模式: ${this.store.editingGroupId}`);
      // 选中当前编辑的组合
      this.store.setActive([this.store.editingGroupId]);
      this.store.editingGroupId = null;
    }
  }

  /**
   * 调整组合边界以精确适应所有子元素
   * 支持扩展和收缩边界，考虑子元素旋转
   */
  expandGroupToFitChildren() {
    const editingGroupId = this.store.editingGroupId;
    if (!editingGroupId) return;

    const groupNode = this.store.nodes[editingGroupId] as GroupState;
    if (!groupNode || groupNode.type !== NodeType.GROUP) return;

    const children = groupNode.children
      .map((id) => this.store.nodes[id])
      .filter((node): node is NodeState => Boolean(node));

    if (children.length === 0) return;

    // 计算所有子元素的边界（考虑旋转）
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
      const { x, y, width, height, rotation } = child.transform;

      if (rotation === 0) {
        // 无旋转：直接使用矩形边界
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
      } else {
        // 有旋转：计算旋转后四角的位置
        const cx = x + width / 2;
        const cy = y + height / 2;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const corners = [
          { x: x, y: y },
          { x: x + width, y: y },
          { x: x + width, y: y + height },
          { x: x, y: y + height },
        ];

        corners.forEach((corner) => {
          const dx = corner.x - cx;
          const dy = corner.y - cy;
          const rx = cx + dx * cos - dy * sin;
          const ry = cy + dx * sin + dy * cos;
          minX = Math.min(minX, rx);
          maxX = Math.max(maxX, rx);
          minY = Math.min(minY, ry);
          maxY = Math.max(maxY, ry);
        });
      }
    });

    // 计算新的组合边界
    const newBoundsWidth = maxX - minX;
    const newBoundsHeight = maxY - minY;
    const newGroupX = groupNode.transform.x + minX;
    const newGroupY = groupNode.transform.y + minY;

    // 检查是否需要调整（边界有变化）
    const eps = 0.01; // 浮点数容差
    const needsAdjust =
      Math.abs(minX) > eps ||
      Math.abs(minY) > eps ||
      Math.abs(newBoundsWidth - groupNode.transform.width) > eps ||
      Math.abs(newBoundsHeight - groupNode.transform.height) > eps;

    if (!needsAdjust) return;

    // 调整所有子元素的相对坐标（相对于新的组合原点）
    const offsetX = -minX;
    const offsetY = -minY;

    children.forEach((child) => {
      this.store.updateNode(child.id, {
        transform: {
          ...child.transform,
          x: child.transform.x + offsetX,
          y: child.transform.y + offsetY,
        },
      });
    });

    // 更新组合的位置和尺寸
    this.store.updateNode(editingGroupId, {
      transform: {
        ...groupNode.transform,
        x: newGroupX,
        y: newGroupY,
        width: newBoundsWidth,
        height: newBoundsHeight,
      },
    });

    console.log(`[Group] 调整组合边界: ${editingGroupId}`);
  }

  /**
   * 检查选中的元素是否可以组合
   */
  canGroup(): boolean {
    const ids = Array.from(this.store.activeElementIds);
    if (ids.length < 2) return false;
    return ids.every((id) => this.store.nodes[id]);
  }

  /**
   * 检查选中的元素是否可以解组合
   */
  canUngroup(): boolean {
    const ids = Array.from(this.store.activeElementIds);
    return ids.some((id) => {
      const node = this.store.nodes[id];
      return node && node.type === NodeType.GROUP;
    });
  }

  /**
   * 同步更新组合的属性到所有子节点
   * @param groupId 组合ID
   * @param stylePatch 样式更新
   */
  updateGroupStyle(groupId: string, stylePatch: Partial<GroupState['style']>) {
    const group = this.store.nodes[groupId] as GroupState;
    if (!group || group.type !== NodeType.GROUP) return;

    // 更新组合自身的样式
    group.style = { ...group.style, ...stylePatch };

    // 如果更新了opacity，同步到所有子节点
    if ('opacity' in stylePatch && stylePatch.opacity !== undefined) {
      const opacityValue = stylePatch.opacity;
      group.children.forEach((childId) => {
        const child = this.store.nodes[childId];
        if (child) {
          child.style = { ...child.style, opacity: opacityValue };
        }
      });
    }

    this.store.version++;
  }

  // ==================== 单选缩放处理 ====================

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

    // 如果是组合节点，递归存储所有后代节点的初始状态（包括嵌套组合的子节点）
    let childStartStates:
      | Record<string, { x: number; y: number; width: number; height: number }>
      | undefined;
    if (node.type === NodeType.GROUP) {
      childStartStates = {};

      // 递归收集所有后代节点的初始状态（每个节点存储相对于其父节点的坐标）
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
   * 处理选中多个节点时，调整大小控制点上的鼠标按下事件。
   * 【核心修改】按下空格时，禁用多选缩放操作
   */
  handleMultiResizeDown(
    e: MouseEvent,
    handle: ResizeHandle,
    startBounds: { x: number; y: number; width: number; height: number },
    nodeIds: string[]
  ) {
    // 核心修改4：按下空格时，不处理多选缩放逻辑
    if (this.getIsSpacePressed()) {
      return;
    }

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
   * 节点鼠标移动事件（处理拖拽位移计算）
   * 新增：支持多选节点同步拖拽 + 多选区域空白处拖拽
   */
  handleNodeMove(e: MouseEvent) {
    // 核心修改5：按下空格时，禁用节点拖拽（优先平移）
    if (this.getIsSpacePressed()) {
      this.handleNodeUp(); // 终止拖拽
      return;
    }

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
   * 处理缩放过程中的鼠标移动
   */
  private handleResizeMove(e: MouseEvent) {
    // 核心修改6：按下空格时，终止缩放并返回
    if (this.getIsSpacePressed()) {
      this.resizeState.isResizing = false;
      this.store.isInteracting = false;
      return;
    }

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
        // 圆形：等比缩放，保持圆形，锚点为与当前缩放手柄相对的对角（即以对角点为固定点进行缩放）
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
        // 组合：等比缩放组合和所有子元素
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

        // 计算缩放因子
        const scaleX = newWidth / startWidth;
        const scaleY = newHeight / startHeight;

        // 缩放所有后代节点（包括嵌套组合的子节点）
        const { childStartStates } = this.resizeState;
        if (childStartStates) {
          // 遍历所有后代节点，不只是直接子节点
          Object.entries(childStartStates).forEach(([childId, childStart]) => {
            const child = this.store.nodes[childId];
            if (!child) return;

            // 按比例缩放子节点的位置和尺寸
            const childNewX = childStart.x * scaleX;
            const childNewY = childStart.y * scaleY;
            const childNewWidth = Math.max(MIN_NODE_SIZE, childStart.width * scaleX);
            const childNewHeight = Math.max(MIN_NODE_SIZE, childStart.height * scaleY);

            this.store.updateNode(childId, {
              transform: {
                ...child.transform,
                x: childNewX,
                y: childNewY,
                width: childNewWidth,
                height: childNewHeight,
              },
            });
          });
        }
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

    // ========== 新增：Shift键等比缩放处理 ==========
    if (e.shiftKey || e.ctrlKey) {
      // 安全计算原始比例，防止除以零
      const safeStartHeight = Math.abs(startHeight) < 1e-6 ? MIN_NODE_SIZE : startHeight;
      const originalRatio = startWidth / safeStartHeight;

      // 计算基于宽度/高度的等比值，优先以主要变化轴为准
      let ratioBasedWidth = newWidth;
      let ratioBasedHeight = newHeight;

      // 判断主要缩放轴（根据handle）
      const isHorizontal = handle.includes('e') || handle.includes('w');
      const isVertical = handle.includes('n') || handle.includes('s');

      if (isHorizontal && isVertical) {
        // 角点缩放：取宽高变化的绝对值最大者作为基准，并保留符号（统一策略）
        const widthRatio = newWidth / startWidth;
        const heightRatio = newHeight / safeStartHeight;
        const dominantRatio =
          Math.abs(widthRatio) > Math.abs(heightRatio) ? widthRatio : heightRatio;
        ratioBasedWidth = startWidth * dominantRatio;
        ratioBasedHeight = startHeight * dominantRatio;
      } else if (isHorizontal) {
        // 水平缩放：按宽度变化等比调整高度
        ratioBasedHeight = newWidth / originalRatio;
      } else if (isVertical) {
        // 垂直缩放：按高度变化等比调整宽度
        ratioBasedWidth = newHeight * originalRatio;
      }

      // 应用等比尺寸
      newWidth = ratioBasedWidth;
      newHeight = ratioBasedHeight;

      // 调整位置以保持缩放中心
      if (handle === 'nw') {
        newX = startNodeX + startWidth - newWidth;
        newY = startNodeY + startHeight - newHeight;
      } else if (handle === 'ne') {
        newY = startNodeY + startHeight - newHeight;
      } else if (handle === 'sw') {
        newX = startNodeX + startWidth - newWidth;
      } else if (handle === 'se') {
        // 东南角：锚点是西北角(startNodeX, startNodeY)，无需调整位置
        newX = startNodeX;
        newY = startNodeY;
      } else if (handle === 'n') {
        // 上边缘：锚点是底边中点 -> 保持底边位置，水平居中
        newY = startNodeY + startHeight - newHeight;
        newX = startNodeX + (startWidth - newWidth) / 2;
      } else if (handle === 's') {
        // 下边缘：锚点是顶边中点 -> 保持顶边位置，水平居中
        newX = startNodeX + (startWidth - newWidth) / 2;
      } else if (handle === 'e') {
        // 右边缘：锚点是左边中点 -> 保持左边位置，垂直居中
        newY = startNodeY + (startHeight - newHeight) / 2;
      } else if (handle === 'w') {
        // 左边缘：锚点是右边中点 -> 保持右边位置，垂直居中
        newX = startNodeX + startWidth - newWidth;
        newY = startNodeY + (startHeight - newHeight) / 2;
      }
    }
    // ========== End Shift键等比缩放处理 ==========

    // 限制最小尺寸
    const minSize = MIN_NODE_SIZE;

    // 圆形和矩形都使用独立的宽高限制（因为圆形现在可以拉伸成椭圆）
    if (newWidth < minSize) {
      newWidth = minSize;
      if (handle.includes('w')) {
        newX = startNodeX + startWidth - minSize;
      }
      // 等比调整高度
      if (e.shiftKey || e.ctrlKey) {
        // 安全计算，防止除以零
        const safeStartHeight = Math.abs(startHeight) < 1e-6 ? MIN_NODE_SIZE : startHeight;
        newHeight = newWidth / (startWidth / safeStartHeight);
      }
    }
    if (newHeight < minSize) {
      newHeight = minSize;
      if (handle.includes('n')) {
        newY = startNodeY + startHeight - minSize;
      }
      // 等比调整宽度
      if (e.shiftKey || e.ctrlKey) {
        // 安全计算，防止除以零
        const safeStartHeight = Math.abs(startHeight) < 1e-6 ? MIN_NODE_SIZE : startHeight;
        newWidth = newHeight * (startWidth / safeStartHeight);
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
   */
  private handleMultiResizeMove(e: MouseEvent) {
    // 核心修改7：按下空格时，终止多选缩放并返回
    if (this.getIsSpacePressed()) {
      this.multiResizeState.isMultiResizing = false;
      this.store.isInteracting = false;
      return;
    }

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

    // ========== 新增：Shift键等比缩放处理 ==========
    if (e.shiftKey || e.ctrlKey) {
      // 安全计算原始比例，防止除以零
      const safeStartHeight =
        Math.abs(startBounds.height) < 1e-6 ? MIN_NODE_SIZE : startBounds.height;
      const originalRatio = startBounds.width / safeStartHeight;

      // 计算等比后的宽高
      let ratioBasedWidth = newBounds.width;
      let ratioBasedHeight = newBounds.height;

      // 判断主要缩放轴
      const isHorizontal = handle.includes('e') || handle.includes('w');
      const isVertical = handle.includes('n') || handle.includes('s');

      if (isHorizontal && isVertical) {
        // 角点缩放：保持原始比例
        const widthRatio = newBounds.width / startBounds.width;
        const heightRatio = newBounds.height / safeStartHeight;
        // Use the dominant axis (the one with the larger absolute ratio) and preserve its sign
        let scaleRatio: number;
        if (Math.abs(widthRatio) > Math.abs(heightRatio)) {
          scaleRatio = Math.abs(widthRatio) * Math.sign(widthRatio);
        } else {
          scaleRatio = Math.abs(heightRatio) * Math.sign(heightRatio);
        }
        ratioBasedWidth = startBounds.width * scaleRatio;
        ratioBasedHeight = startBounds.height * scaleRatio;
      } else if (isHorizontal) {
        // 水平缩放：按宽度等比调整高度
        ratioBasedHeight = ratioBasedWidth / originalRatio;
      } else if (isVertical) {
        // 垂直缩放：按高度等比调整宽度
        ratioBasedWidth = ratioBasedHeight * originalRatio;
      }

      // 调整位置以保持缩放中心
      if (handle === 'nw') {
        newBounds.x = startBounds.x + startBounds.width - ratioBasedWidth;
        newBounds.y = startBounds.y + startBounds.height - ratioBasedHeight;
      } else if (handle === 'ne') {
        newBounds.y = startBounds.y + startBounds.height - ratioBasedHeight;
      } else if (handle === 'sw') {
        newBounds.x = startBounds.x + startBounds.width - ratioBasedWidth;
      } else if (handle === 'se') {
        // 东南角：锚点是西北角，无需调整位置
        newBounds.x = startBounds.x;
        newBounds.y = startBounds.y;
      } else if (handle === 'n') {
        // 上边缘：锚点是底边中点
        newBounds.y = startBounds.y + startBounds.height - ratioBasedHeight;
        newBounds.x = startBounds.x + (startBounds.width - ratioBasedWidth) / 2;
      } else if (handle === 's') {
        // 下边缘：锚点是顶边中点
        newBounds.x = startBounds.x + (startBounds.width - ratioBasedWidth) / 2;
      } else if (handle === 'e') {
        // 右边缘：锚点是左边中点
        newBounds.y = startBounds.y + (startBounds.height - ratioBasedHeight) / 2;
      } else if (handle === 'w') {
        // 左边缘：锚点是右边中点
        newBounds.x = startBounds.x + startBounds.width - ratioBasedWidth;
        newBounds.y = startBounds.y + (startBounds.height - ratioBasedHeight) / 2;
      }

      // 应用等比尺寸
      newBounds.width = ratioBasedWidth;
      newBounds.height = ratioBasedHeight;
    }
    // ========== End Shift键等比缩放处理 ==========

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
      const scaleX = newBounds.width / startBounds.width;
      const scaleY = newBounds.height / startBounds.height;

      // ========== 新增：Shift键等比缩放处理 ==========
      let finalScaleX = scaleX;
      let finalScaleY = scaleY;
      if (e.shiftKey || e.ctrlKey) {
        // 等比缩放时使用统一的缩放比例
        const uniformScale = Math.max(Math.abs(scaleX), Math.abs(scaleY)); // 使用主轴缩放比例保证等比
        finalScaleX = uniformScale;
        finalScaleY = uniformScale;
      }
      // ========== End Shift键等比缩放处理 ==========

      const newWidth = Math.max(MIN_NODE_SIZE, startState.width * finalScaleX);
      const newHeight = Math.max(MIN_NODE_SIZE, startState.height * finalScaleY);
      const newX = newBounds.x + startState.offsetX * newBounds.width;
      const newY = newBounds.y + startState.offsetY * newBounds.height;

      // 更新节点
      this.store.updateNode(id, {
        transform: { ...node.transform, x: newX, y: newY, width: newWidth, height: newHeight },
      });
    });
  }

  // ==================== 节点创建功能 ====================

  /**
   * 创建矩形节点
   */
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
        width: DEFAULT_TEXT_SIZE.width,
        height: DEFAULT_TEXT_SIZE.height,
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
  private getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
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
          height: img.naturalHeight,
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

  // ==================== 缩放计算辅助方法 ====================

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

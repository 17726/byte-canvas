import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { NodeType, type BaseNodeState, type GroupState, type ViewportState } from '@/types/state';
import { clientToWorld } from '@/core/utils/geometry';
import { ViewportHandler } from './handlers/ViewportHandler';
import { TransformHandler, type ResizeHandle } from './handlers/TransformHandler';
import { SelectionHandler } from './handlers/SelectionHandler';
import { GroupService } from './services/GroupService';

/**
 * 逻辑层：工具管理器
 * 职责：接收来自交互层（Vue组件）的原始事件，处理鼠标点击、拖拽、工具切换逻辑。
 */
/**
 * 工具管理器（ToolManager）
 * 说明：负责将 UI 层（鼠标事件/键盘事件）转发为对 `store` 的状态更新。
 * 主要职责：
 * - 协调 ViewportHandler（视口操作）和 TransformHandler（节点变换）
 * - 处理框选操作
 * - 处理节点组合/解组操作
 * - 在交互时控制 `store.isInteracting` 避免额外的昂贵操作
 */
export class ToolManager {
  private store: ReturnType<typeof useCanvasStore>;
  private ui: ReturnType<typeof useUIStore>;
  private stageEl: HTMLElement | null; // 画布根元素

  // 专用处理器
  private viewportHandler: ViewportHandler;
  private transformHandler: TransformHandler;
  private selectionHandler: SelectionHandler;

  // 改为从外部获取空格键状态（不再内部维护）
  private getIsSpacePressed: () => boolean;

  // 构造函数新增：接收空格键状态获取函数
  constructor(stageEl: HTMLElement | null, getIsSpacePressed: () => boolean) {
    this.store = useCanvasStore();
    this.ui = useUIStore();
    this.stageEl = stageEl; // 保存画布根元素引用
    this.getIsSpacePressed = getIsSpacePressed; // 接收外部状态

    // 初始化处理器
    this.viewportHandler = new ViewportHandler(this.store);
    this.transformHandler = new TransformHandler(this.store);
    this.selectionHandler = new SelectionHandler(this.store, stageEl);
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
      isDragging: this.transformHandler.isDragging,
      ...this.selectionHandler.getBoxSelectState(),
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
    // 委托给 ViewportHandler
    this.viewportHandler.onWheel(e);
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
      this.viewportHandler.startPan(e);
      // 空格平移时保留选中状态（不取消选中）
      return;
    }

    // 互斥逻辑：如果正在拖拽节点，不触发画布平移
    if (this.transformHandler.isDragging) return;

    // 中键直接平移（原有逻辑）
    if (e.button === 1) {
      this.viewportHandler.startPan(e);
      this.store.setActive([]); // 中键平移取消选中
      // 退出组合编辑模式
      if (this.store.editingGroupId) {
        this.exitGroupEdit();
      }
      return;
    }

    // 仅当未按空格时，才执行原有框选/多选区域拖拽逻辑
    if (e.button === 0 && !this.getIsSpacePressed()) {
      // TODO: 多选区域空白处拖拽功能（需要单独实现）
      // 暂时禁用此功能，等待后续完善

      // 点击空白区域时，如果在组合编辑模式下，退出编辑模式
      if (this.store.editingGroupId) {
        GroupService.exitGroupEdit(this.store);
      }

      // 原有框选逻辑（仅未按空格时执行）
      this.selectionHandler.startBoxSelect(e);
    }
  }

  /**
   * 处理全局鼠标移动事件 (平移中 / 缩放中 / 多选区域拖拽)
   */
  handleMouseMove(e: MouseEvent) {
    // 最高优先级：多选缩放
    if (this.transformHandler.isMultiResizing) {
      this.transformHandler.updateMultiResize(e);
      return;
    }

    // 其次：单选缩放
    if (this.transformHandler.isResizing) {
      this.transformHandler.updateResize(e);
      return;
    }

    // 然后：节点拖拽（包含多选区域拖拽）
    if (this.transformHandler.isDragging) {
      this.transformHandler.updateDrag(e);
      return;
    }

    // 最后：画布平移/框选
    if (this.viewportHandler.isPanning) {
      this.viewportHandler.updatePan(e);
      return;
    }

    // 仅未按空格时更新框选状态
    if (!this.getIsSpacePressed()) {
      this.selectionHandler.updateBoxSelect(e);
    }
  }

  /**
   * 处理全局鼠标松开事件 (平移结束 / 缩放结束)
   */
  handleMouseUp() {
    // 在重置状态之前，检查是否需要扩展组合边界
    const hadDragOrResize = this.transformHandler.isTransforming;

    // 重置画布平移状态
    this.viewportHandler.endPan();

    // 重置所有变换状态
    this.transformHandler.reset();

    // 仅未按空格时处理框选结束
    if (!this.getIsSpacePressed()) {
      this.selectionHandler.finishBoxSelect();
    }

    // 如果在组合编辑模式下有拖拽或缩放操作，检查并扩展组合边界
    if (hadDragOrResize && this.store.editingGroupId) {
      GroupService.expandGroupToFitChildren(this.store);
    }
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
    if (this.transformHandler.isResizing) return;

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

    // 4. 展示右侧属性面板并切换为节点模式
    this.ui.setActivePanel('node');
    this.ui.setPanelExpanded(true);

    // 5. 委托给 TransformHandler 处理拖拽
    this.transformHandler.startNodeDrag(e, id, this.getIsSpacePressed());
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
      GroupService.enterGroupEdit(this.store, id);
    }
    this.store.isInteracting = false;
  }

  // ==================== 组合/解组合功能（委托给 GroupService）====================

  groupSelected(): string | null {
    return GroupService.groupSelected(this.store);
  }

  ungroupSelected(): string[] {
    return GroupService.ungroupSelected(this.store);
  }

  enterGroupEdit(groupId: string): boolean {
    return GroupService.enterGroupEdit(this.store, groupId);
  }

  exitGroupEdit() {
    GroupService.exitGroupEdit(this.store);
  }

  expandGroupToFitChildren() {
    GroupService.expandGroupToFitChildren(this.store);
  }

  canGroup(): boolean {
    return GroupService.canGroup(this.store);
  }

  canUngroup(): boolean {
    return GroupService.canUngroup(this.store);
  }

  updateGroupStyle(groupId: string, stylePatch: Partial<GroupState['style']>) {
    GroupService.updateGroupStyle(this.store, groupId, stylePatch);
  }

  // ==================== 单选缩放处理 ====================

  /**
   * 处理缩放控制点鼠标按下事件
   */
  handleResizeHandleDown(e: MouseEvent, nodeId: string, handle: ResizeHandle) {
    e.stopPropagation();
    e.preventDefault(); // 阻止默认行为

    // 委托给 TransformHandler
    this.transformHandler.startResize(e, nodeId, handle);
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
    e.stopPropagation();
    e.preventDefault();

    // 委托给 TransformHandler
    this.transformHandler.startMultiResize(
      e,
      handle,
      startBounds,
      nodeIds,
      this.getIsSpacePressed()
    );
  }

  // ==================== 节点拖拽/缩放方法（已迁移到 TransformHandler） ====================
  // handleNodeMove(), handleNodeUp(), handleResizeMove(), handleMultiResizeMove()
  // 已完全迁移到 src/core/tools/handlers/TransformHandler.ts

  // ==================== 节点创建功能 ====================
  // 已迁移至 UI 组件层（CanvasToolbar.vue / ImageMenu.vue）
  // UI 组件直接使用 NodeFactory.create*() + store.addNode() + store.setActive()

  // ==================== 缩放计算辅助方法 ====================
  // 已迁移至 @/core/utils/geometry.ts
}

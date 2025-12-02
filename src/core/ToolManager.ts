/**
 * @file ToolManager.ts
 * @description 工具管理器 - 纯粹的画布事件分发器（Pure Event Dispatcher）
 *
 * 核心职责：
 * 1. 接收来自 Vue 组件的原始 DOM 事件（鼠标/键盘/滚轮）
 * 2. 根据事件类型和当前上下文将事件路由到对应的 Handler
 * 3. 管理全局交互状态（isInteracting）以优化渲染性能
 * 4. 协调多个 Handler 之间的优先级和互斥关系
 *
 * 架构特点：
 * - **纯事件路由器**：<300 行，零业务逻辑，零状态存储
 * - **严格分层/调用链**：存在两条主要调用路径：
 *   1. UI 层（Vue） → ToolManager（路由） → Handlers（交互逻辑） （有状态/交互）
 *   2. UI 层（Vue） → Services（业务逻辑，无状态） （直接调用，不通过 ToolManager）
 * - **单一职责**：仅负责"事件分发"，所有具体逻辑委托给专用模块
 * - **无状态设计**：所有状态由 Store 和各 Handler 管理，ToolManager 不持有业务数据
 *
 * Handler 协调关系：
 * - ViewportHandler：视口平移、缩放（滚轮、中键拖拽、空格+左键）
 * - TransformHandler：节点拖拽、单选/多选缩放
 * - SelectionHandler：框选、点选、选区边界计算
 * - GroupService：组合/解组合业务逻辑（直接由 UI 调用，不经过 ToolManager）
 *
 * 包含方法列表：
 *
 * 生命周期：
 * - constructor(store, stageEl): 初始化管理器及所有 Handlers
 * - destroy(): 清理事件监听器和资源
 *
 * 状态查询：
 * - getBoxSelectState(): 获取框选状态（供 SelectionOverlay 组件使用）
 * - getIsSpacePressed(): 获取空格键状态（私有）
 *
 * 画布事件（Stage Events）：
 * - handleWheel(e): 滚轮事件 → 路由到 ViewportHandler（缩放/平移）
 * - handleMouseDown(e): 画布鼠标按下 → 根据按键决定平移/框选/退出编辑
 * - handleMouseMove(e): 鼠标移动 → 按优先级更新多选缩放 > 单选缩放 > 拖拽 > 平移 > 框选
 * - handleMouseUp(e): 鼠标松开 → 结束所有交互操作
 *
 * 节点事件（Node Events）：
 * - handleNodeDown(e, nodeId): 节点鼠标按下 → 选中逻辑 + 拖拽准备
 * - handleNodeDoubleClick(e, nodeId): 节点双击 → 进入组合编辑模式（调用 GroupService）
 *
 * 缩放控制点事件（Resize Handle Events）：
 * - handleResizeHandleDown(e, direction): 单选缩放控制点按下 → TransformHandler
 * - handleMultiResizeHandleDown(e, direction): 多选缩放控制点按下 → TransformHandler
 *
 * @example
 * // Vue 组件中使用
 * const toolManager = new ToolManager(store, stageRef.value)
 * toolManager.handleMouseDown(e)  // 事件自动路由到正确的 Handler
 *
 * // 组合操作直接调用 Service（不经过 ToolManager）
 * GroupService.groupSelected(store)
 */

import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { NodeType, type BaseNodeState } from '@/types/state';
import { ViewportHandler } from './handlers/ViewportHandler';
import { TransformHandler, type ResizeHandle } from './handlers/TransformHandler';
import { SelectionHandler } from './handlers/SelectionHandler';
import { GroupService } from './services/GroupService';

/**
 * 工具管理器类
 *
 * 负责协调画布上的所有交互行为，是事件处理的中央枢纽。
 * 将具体的业务逻辑委托给专用的处理器和服务。
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

  /**
   * 构造工具管理器
   *
   * @param stageEl - 画布根 DOM 元素，用于计算坐标转换
   * @param getIsSpacePressed - 获取空格键状态的函数，用于判断是否启用平移模式
   */
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
   * 销毁管理器，清理资源
   *
   * 注意：键盘事件监听已迁移到 Vue 组件，此方法保留用于未来扩展
   */
  destroy() {
    // 移除原键盘事件监听代码（已迁移到组件）
  }

  /**
   * 获取框选状态
   *
   * 用于 Vue 组件渲染框选矩形的可视化反馈
   *
   * @returns 包含 isDragging、isBoxSelecting、boxSelectStart、boxSelectEnd 的状态对象
   */
  getBoxSelectState() {
    return {
      isDragging: this.transformHandler.isDragging,
      ...this.selectionHandler.getBoxSelectState(),
    };
  }

  // ==================== 画布事件处理 ====================

  /**
   * 处理画布滚轮事件
   *
   * 委托给 ViewportHandler 处理缩放和触摸板平移
   *
   * @param e - 滚轮事件
   */
  handleWheel(e: WheelEvent) {
    // 委托给 ViewportHandler
    this.viewportHandler.onWheel(e);
  }
  /**
   * 处理画布鼠标按下事件
   *
   * 根据按键组合和点击位置决定行为：
   * - 空格+左键：启动画布平移
   * - 中键：启动画布平移并取消选中
   * - 左键空白处：启动框选或退出组合编辑模式
   *
   * @param e - 鼠标事件
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
        GroupService.exitGroupEdit(this.store);
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
   * 处理全局鼠标移动事件
   *
   * 根据当前交互状态更新对应操作：
   * - 多选缩放 > 单选缩放 > 节点拖拽 > 画布平移 > 框选
   *
   * @param e - 鼠标事件
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
   * 处理全局鼠标松开事件
   *
   * 结束所有交互状态，并在组合编辑模式下自动调整边界
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
   * 处理节点鼠标按下事件
   *
   * 处理节点的选中逼辑（单选/Ctrl+多选）并准备拖拽
   *
   * @param e - 鼠标事件
   * @param id - 节点 ID
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
   * 处理节点双击事件
   *
   * 双击组合节点进入编辑模式
   *
   * @param e - 鼠标事件
   * @param id - 节点 ID
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

  // ==================== 单选缩放处理 ====================

  /**
   * 处理单个节点缩放控制点按下事件
   *
   * 委托给 TransformHandler.startResize
   *
   * @param e - 鼠标事件
   * @param nodeId - 节点 ID
   * @param handle - 缩放控制点位置（n/ne/e/se/s/sw/w/nw）
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
  // ==================== 组合/解组合功能（已迁移至 GroupService）====================

  // ==================== 节点拖拽/缩放方法（已迁移到 TransformHandler） ====================
  // handleNodeMove(), handleNodeUp(), handleResizeMove(), handleMultiResizeMove()
  // 已完全迁移到 src/core/tools/handlers/TransformHandler.ts

  // ==================== 节点创建功能 ====================
  // 已迁移至 UI 组件层（CanvasToolbar.vue / ImageMenu.vue）
  // UI 组件直接使用 NodeFactory.create*() + store.addNode() + store.setActive()

  // ==================== 缩放计算辅助方法 ====================
  // 已迁移至 @/core/utils/geometry.ts
}

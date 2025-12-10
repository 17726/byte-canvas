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
import { useSelectionStore } from '@/store/selectionStore';
import { useUIStore } from '@/store/uiStore';
import type { ResizeHandle } from '@/types/editor';
import { NodeType, type BaseNodeState } from '@/types/state';
import { CreationHandler } from './handlers/CreationHandler';
import { RotationHandler } from './handlers/RotationHandler';
import { SelectionHandler } from './handlers/SelectionHandler';
import { TextSelectionHandler } from './handlers/TextSelectionHandler';
import { TransformHandler } from './handlers/TransformHandler';
import { ViewportHandler } from './handlers/ViewportHandler';
import { GroupService } from './services/GroupService';
import { TextService } from './services/TextService';

/**
 * 工具管理器类
 *
 * 负责协调画布上的所有交互行为，是事件处理的中央枢纽。
 * 将具体的业务逻辑委托给专用的处理器和服务。
 */
export class ToolManager {
  private store: ReturnType<typeof useCanvasStore>;
  private selectionStore: ReturnType<typeof useSelectionStore>;
  private ui: ReturnType<typeof useUIStore>;
  private stageEl: HTMLElement | null; // 画布根元素

  // 专用处理器
  private viewportHandler: ViewportHandler;
  private transformHandler: TransformHandler;
  private selectionHandler: SelectionHandler;
  private textSelectionHandler: TextSelectionHandler;
  private rotationHandler: RotationHandler;
  // 公开创建处理器，供 Vue 组件访问（用于 Esc 键处理）
  public creationHandler!: import('./handlers/CreationHandler').CreationHandler;

  // 改为从外部获取空格键状态（不再内部维护）
  private getIsSpacePressed: () => boolean;

  // 交互锁定标记（抵御外部干扰）
  private isCanvasInteracting = false;

  /**
   * 构造工具管理器
   * @param stageEl - 画布根 DOM 元素
   * @param getIsSpacePressed - 获取空格键状态的函数
   */
  constructor(stageEl: HTMLElement | null, getIsSpacePressed: () => boolean) {
    this.store = useCanvasStore();
    this.selectionStore = useSelectionStore();
    this.ui = useUIStore();
    this.stageEl = stageEl;
    this.getIsSpacePressed = getIsSpacePressed;

    // 初始化处理器 - 确保所有需要坐标转换的 Handler 都接收 stageEl
    this.viewportHandler = new ViewportHandler(this.store);
    this.transformHandler = new TransformHandler(this.store, stageEl); // 【修复】注入 stageEl
    this.selectionHandler = new SelectionHandler(this.store, stageEl);
    this.textSelectionHandler = new TextSelectionHandler(
      this.store,
      this.transformHandler,
      this.viewportHandler
    );
    this.rotationHandler = new RotationHandler(stageEl); // 【修复】传入 stageEl

    // 【修复】同步实例化创建处理器（解决竞态条件）
    this.creationHandler = new CreationHandler(this.store, stageEl);
  }

  /**
   * 销毁管理器，清理资源
   *
   * 注意：键盘事件监听已迁移到 Vue 组件，此方法保留用于未来扩展
   */
  destroy() {
    this.isCanvasInteracting = false; // 重置锁定状态
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
      isRotating: this.rotationHandler.isRotating,
      ...this.selectionHandler.getBoxSelectState(),
    };
  }

  // 核心工具方法 - 强制事件防护（三重阻止+事件源校验）
  private forceProtectEvent(e: MouseEvent | WheelEvent): boolean {
    // 1. 校验画布元素存在性
    if (!this.stageEl) return false;

    // 2. 校验事件源：必须是画布内元素（过滤外部悬浮窗等干扰）
    const isTargetInCanvas = this.stageEl.contains(e.target as Node);
    if (!isTargetInCanvas) return false;

    // 3. 三重阻止：彻底屏蔽外部拦截
    e.stopImmediatePropagation(); // 阻止当前元素其他监听器（关键抵御外部注入）
    e.stopPropagation(); // 阻止冒泡到父元素
    //e.preventDefault(); // 阻止浏览器默认行为+外部软件默认响应

    // 4. 标记交互状态
    this.isCanvasInteracting = true;
    return true;
  }

  // 结束交互 - 重置锁定标记
  private endCanvasInteraction() {
    this.isCanvasInteracting = false;
  }

  // ==================== 画布事件处理（整合防护）====================
  /**
   * 处理画布滚轮事件
   *
   * 委托给 ViewportHandler 处理缩放和触摸板平移
   *
   * @param e - 滚轮事件
   */
  handleWheel(e: WheelEvent) {
    // 强制防护：过滤外部干扰的滚轮事件
    if (!this.forceProtectEvent(e)) return;

    this.viewportHandler.onWheel(e);
    this.endCanvasInteraction(); // 滚轮事件无需长期锁定
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
    // 强制防护：不通过则直接忽略
    if (!this.forceProtectEvent(e)) return;

    // 【修复】空格+左键平移（绝对最高优先级，即使创建模式也可以平移）
    if (this.getIsSpacePressed() && e.button === 0) {
      this.viewportHandler.startPan(e);
      this.store.isInteracting = true; // 标记交互中，触发光标变为 grabbing
      return;
    }

    // 创建模式拦截（次高优先级）
    if (this.creationHandler && this.creationHandler.isCreating()) {
      this.creationHandler.handleMouseDown(e);
      return;
    }

    // 互斥逻辑：如果正在拖拽/旋转/缩放，不触发画布平移
    if (
      this.transformHandler.isDragging ||
      this.transformHandler.isResizing ||
      this.rotationHandler.isRotating
    )
      return;

    // 原有业务逻辑：中键平移
    if (e.button === 1) {
      this.viewportHandler.startPan(e);
      this.store.isInteracting = true; // 标记交互中
      this.selectionStore.clearSelection();
      if (this.selectionStore.editingGroupId) {
        GroupService.exitGroupEdit();
      }
      // 文本处理器：结束编辑态
      this.textSelectionHandler.exitEditing();
      return;
    }

    // 原有业务逻辑：左键框选/多选拖拽
    if (e.button === 0 && !this.getIsSpacePressed()) {
      const hasActiveNodes = this.selectionStore.activeElementIds.size > 0;
      const isClickInArea = this.selectionHandler.isClickInSelectedArea(e);

      if (hasActiveNodes && isClickInArea) {
        const activeIds = Array.from(this.selectionStore.activeElementIds).filter((id) => {
          const node = this.store.nodes[id];
          return node && !node.isLocked;
        });
        if (activeIds.length === 0) {
          this.endCanvasInteraction();
          return;
        }

        const firstNodeId = activeIds[0];
        if (firstNodeId) {
          this.transformHandler.startNodeDrag(e, firstNodeId, false);
        }
        return;
      }

      // 原有业务逻辑：退出组合编辑
      if (this.selectionStore.editingGroupId) {
        GroupService.exitGroupEdit();
      }

      // 文本处理器：点击空白处结束编辑态
      if (this.textSelectionHandler.isEditing) {
        console.log('结束编辑态');
        this.textSelectionHandler.exitEditing();
      }

      // 启动框选（仅未按空格时）
      // 原有业务逻辑：启动框选
      this.selectionHandler.startBoxSelect(e);
    }
  }

  /**
   * 处理全局鼠标移动事件
   *
   * 根据当前交互状态更新对应操作：
   * - 多选缩放 > 单选缩放 > 文本选区 > 节点拖拽 > 画布平移 > 框选
   *
   * @param e - 鼠标事件
   */
  handleMouseMove(e: MouseEvent) {
    // 防护逻辑：正在交互时强制防护，非交互时校验事件源
    if (this.isCanvasInteracting) {
      this.forceProtectEvent(e);
    } else {
      if (!this.stageEl?.contains(e.target as Node)) return;
    }

    // 创建模式拦截（最高优先级）
    if (this.creationHandler && this.creationHandler.isCreating()) {
      this.creationHandler.handleMouseMove(e);
      return;
    }

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

    // 再次：文本处理器：编辑态下更新选区
    if (this.textSelectionHandler.isEditing) {
      this.textSelectionHandler.handleMouseMove(e);
      return;
    }

    // 新增：旋转操作（优先级高于拖拽）
    if (this.rotationHandler.isRotating) {
      this.rotationHandler.updateRotate(e);
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
    // 创建模式拦截
    if (this.creationHandler && this.creationHandler.isCreating()) {
      this.creationHandler.handleMouseUp();
      return;
    }

    // 防护逻辑：用mock事件强制防护，避免外部up事件干扰
    const mockEvent = new MouseEvent('mouseup');
    this.forceProtectEvent(mockEvent);
    // 在重置状态之前，检查是否需要扩展组合边界（包含旋转状态）
    const hadDragOrResize = this.transformHandler.isTransforming || this.rotationHandler.isRotating;

    // 重置画布平移状态
    this.viewportHandler.endPan();
    this.store.isInteracting = false; // 重置交互状态

    // 重置旋转状态
    this.rotationHandler.endRotate();

    // 重置所有变换状态
    this.transformHandler.reset();

    // 仅未按空格时处理框选结束
    if (!this.getIsSpacePressed()) {
      this.selectionHandler.finishBoxSelect();
    }

    // 文本处理器：编辑态下同步选区到全局
    if (this.textSelectionHandler.isEditing) {
      // 获取当前激活的文本节点ID
      const activeTextNodeId = Array.from(this.selectionStore.activeElementIds).find((id) => {
        const node = this.store.nodes[id];
        return node?.type === NodeType.TEXT;
      });
      if (activeTextNodeId) {
        this.textSelectionHandler.handleSelectionChange(activeTextNodeId);
      }
    }

    // 如果在组合编辑模式下有拖拽/缩放/旋转操作，检查并扩展组合边界
    if (hadDragOrResize && this.selectionStore.editingGroupId) {
      GroupService.expandGroupToFitChildren(this.store);
    }
  }

  // ==================== 节点事件处理（整合防护）====================
  /**
   * 处理节点鼠标按下事件
   *
   * 处理节点的选中逼辑（单选/Ctrl+多选）并准备拖拽
   *
   * @param e - 鼠标事件
   * @param id - 节点 ID
   */
  handleNodeDown(e: MouseEvent, id: string) {
    // 强制防护：过滤外部干扰
    if (!this.forceProtectEvent(e)) return;

    // 原有业务逻辑：空格时触发画布平移
    if (this.getIsSpacePressed()) {
      this.endCanvasInteraction();
      return;
    }

    // 原有业务逻辑：缩放中不处理拖拽
    if (this.transformHandler.isResizing) {
      this.endCanvasInteraction();
      return;
    }

    // 原有业务逻辑：阻止冒泡（避免画布事件取消选中）
    e.stopPropagation();

    // 原有业务逻辑：多选逻辑
    if (e.ctrlKey || e.shiftKey) {
      this.selectionStore.toggleSelection(id);
    } else {
      if (!this.selectionStore.activeElementIds.has(id)) {
        this.selectionStore.setActive([id]);
      }
    }

    // 原有业务逻辑：节点有效性校验
    const node = this.store.nodes[id] as BaseNodeState;
    if (!node || node.isLocked) {
      this.endCanvasInteraction();
      return;
    }

    // 文本节点专属逻辑：
    if (node.type === NodeType.TEXT) {
      this.textSelectionHandler.handleMouseDown(e);
      //编辑态下阻止继续向后执行拖拽逻辑
      if (this.textSelectionHandler.isEditing) return;
    }

    // 4. 展示右侧属性面板并切换为节点模式
    this.ui.setActivePanel('node');
    this.ui.setPanelExpanded(true);

    // 原有业务逻辑：启动拖拽
    this.transformHandler.startNodeDrag(e, id, this.getIsSpacePressed());
  }

  handleNodeDoubleClick(e: MouseEvent, id: string) {
    // 强制防护：过滤外部双击事件
    if (!this.forceProtectEvent(e)) return;

    // 原有业务逻辑：阻止冒泡
    e.stopPropagation();

    // 原有业务逻辑：节点有效性校验
    const node = this.store.nodes[id];
    if (!node) {
      this.endCanvasInteraction();
      return;
    }

    // 原有业务逻辑：进入组合编辑
    if (node.type === NodeType.GROUP) {
      GroupService.enterGroupEdit(this.store, id);
      return;
    }

    // 文本节点：进入编辑态
    if (node.type === NodeType.TEXT) {
      if (!this.textSelectionHandler.canEnterEditingDirectly(id)) {
        const parentId = node.parentId;
        if (parentId) {
          console.log('进入组合编辑');
          GroupService.enterGroupEdit(this.store, parentId);
          return;
        }
      }
      console.log('toolmanager中进入编辑态的节点id:', id);
      this.textSelectionHandler.enterEditing(e, id);
    }

    this.store.isInteracting = false;
    this.endCanvasInteraction();
  }

  // ==================== 缩放控制点事件处理（整合防护）====================
  handleResizeHandleDown(e: MouseEvent, nodeId: string, handle: ResizeHandle) {
    // 强制防护：三重阻止+事件源校验
    if (!this.forceProtectEvent(e)) return;
    // 原有业务逻辑：额外加固阻止
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    const node = this.store.nodes[nodeId] as BaseNodeState;

    // 新增：节点有效性校验
    if (!node || node.isLocked) {
      this.endCanvasInteraction();
      return;
    }

    // 文本节点：缩放时结束编辑态
    if (node?.type === NodeType.TEXT) {
      this.textSelectionHandler.exitEditing();
      this.store.updateGlobalTextSelection(null);
    }

    // 委托给 TransformHandler
    // 原有业务逻辑：启动单选缩放
    this.transformHandler.startResize(e, nodeId, handle);
  }

  handleMultiResizeDown(
    e: MouseEvent,
    handle: ResizeHandle,
    startBounds: { x: number; y: number; width: number; height: number },
    nodeIds: string[]
  ) {
    // 强制防护：三重阻止+事件源校验
    if (!this.forceProtectEvent(e)) return;

    // 原有业务逻辑：额外加固阻止
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    // 委托给 TransformHandler
    // 新增：过滤锁定节点
    const validNodeIds = nodeIds.filter((id) => {
      const node = this.store.nodes[id];
      return node && !node.isLocked;
    });
    if (validNodeIds.length === 0) {
      this.endCanvasInteraction();
      return;
    }

    // 文本节点：缩放时结束编辑态
    const hasTextNode = nodeIds.some((id) => {
      const node = this.store.nodes[id];
      return node?.type === NodeType.TEXT;
    });
    if (hasTextNode) {
      this.textSelectionHandler.exitEditing();
      this.store.updateGlobalTextSelection(null);
    }

    // 原有业务逻辑：启动多选缩放
    this.transformHandler.startMultiResize(
      e,
      handle,
      startBounds,
      validNodeIds,
      this.getIsSpacePressed()
    );
  }
  // ==================== 文本节点专属辅助方法 ====================
  /**
   * 初始化文本编辑器（供文本组件调用，复用现有逻辑）
   * @param editor - 文本编辑器 DOM 引用
   */
  initTextEditor(id: string, editor: HTMLElement | undefined) {
    if (!editor) return;
    // init 方法内部已经处理了全局监听器的注册
    this.textSelectionHandler.init(id, editor);
  }

  /**
   * 移除文本编辑器（组件卸载时调用）
   * @param id - 要移除的节点ID
   */
  removeTextEditor(id: string) {
    this.textSelectionHandler.removeEditor(id);
  }

  /**
   * 处理文本节点输入事件（供文本组件调用）
   * @param e - 输入事件
   * @param id - 文本节点 ID
   */
  handleTextInput(e: Event, id: string) {
    if (this.transformHandler.isTransforming) return;

    // 仅需校验节点是否存在（无需传递给 TextService，TextService 内部会二次校验）
    const node = this.store.nodes[id];
    if (!node || node.type !== NodeType.TEXT) return;

    // 保存当前光标位置
    const savedCursorPos = this.textSelectionHandler.saveFullSelection(id);

    // 调用 TextService 时，传递 id 而非 node
    TextService.handleContentChange(
      e,
      id, // 传递节点 ID
      this.store, // Pinia 实例
      () => this.textSelectionHandler.saveFullSelection(id),
      (pos) => this.textSelectionHandler.restoreFullSelection(pos, id)
    );

    this.textSelectionHandler.handleHeightAdaptation(id);

    this.textSelectionHandler.restoreFullSelection(savedCursorPos, id);
  }

  /**
   * 处理文本节点选区变化（供文本组件调用，内部转发给 TextSelectionHandler）
   * @param id - 文本节点 ID
   */
  handleTextSelectionChange(id: string) {
    if (this.transformHandler.isTransforming) return;
    const node = this.store.nodes[id];
    if (!node || node.type !== NodeType.TEXT) return;
    this.textSelectionHandler.handleSelectionChange(id);
    console.log('触发handleTextSelectionChange');
  }

  /**
   * 处理文本节点失焦事件（供文本组件调用）
   * @param id - 文本节点 ID
   */
  handleTextBlur(id: string) {
    const node = this.store.nodes[id];
    if (!node || node.type !== NodeType.TEXT) return;

    this.textSelectionHandler.handleBlur(id);
  }

  // handleEnterKey(e: KeyboardEvent) {
  //   if (this.transformHandler.isTransforming) return;
  //   const id = Array.from(this.store.activeElementIds)[0];
  //   if (!id) return;
  //   console.log('触发handleEnterKey');
  //   this.textSelectionHandler.handleEnterKey(id, e);
  // }

  /**
   * 处理文本节点点击事件（供文本组件调用）
   * @param e - 鼠标事件
   * @param id - 文本节点 ID
   */
  handleTextClick(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (this.getIsSpacePressed()) return;

    const node = this.store.nodes[id];
    if (!node || node.type !== NodeType.TEXT) return;

    if (!this.textSelectionHandler.canEnterEditingDirectly(id)) {
      const parentId = node.parentId;
      if (parentId) {
        // 选中父节点
        this.selectionStore.setActive([parentId]);
        return;
      }
    }

    this.textSelectionHandler.handleTextBoxClick(e, id);
    //console.log('单击文本节点');

    if (!this.selectionStore.activeElementIds.has(id)) {
      this.selectionStore.setActive([id]);
    }
  }

  //处理文本样式
  handleToggleBold(id: string) {
    this.textSelectionHandler.updateGlobalStyles(id, this.store, 'fontWeight', 'bold', true);
    this.textSelectionHandler.updatePartialInlineStyle(
      id,
      this.store,
      'fontWeight',
      'bold', // 样式值（支持 'bold' 或 700）
      true // toggle：有则移除，无则添加
    );
    //console.log('真的设置粗体完毕');
  }

  handleToggleItalic(id: string) {
    this.textSelectionHandler.updateGlobalStyles(id, this.store, 'fontStyle', 'italic', true);
    this.textSelectionHandler.updatePartialInlineStyle(
      id,
      this.store,
      'fontStyle', // 对应 InlineStyleProps 中的 fontStyle
      'italic', // 目标样式值（切换为斜体）
      true // toggle 模式：有则移除，无则添加
    );
  }

  handleToggleUnderline(id: string) {
    this.textSelectionHandler.updateGlobalStyles(
      id,
      this.store,
      'textDecoration',
      'underline',
      true
    );
    this.textSelectionHandler.updatePartialInlineStyle(
      id,
      this.store,
      'textDecoration', // 对应 InlineStyleProps 中的 textDecoration
      'underline', // 目标样式值（切换为删除线）
      true // toggle 模式：有则移除，无则添加
    );
  }

  handleToggleStrikethrough(id: string) {
    this.textSelectionHandler.updateGlobalStyles(
      id,
      this.store,
      'textDecoration',
      'line-through',
      true
    );
    this.textSelectionHandler.updatePartialInlineStyle(
      id,
      this.store,
      'textDecoration',
      'line-through',
      true
    );
  }

  handleColorChange(id: string, newColor: string) {
    this.textSelectionHandler.updateGlobalStyles(id, this.store, 'color', newColor, false);
    this.textSelectionHandler.updatePartialInlineStyle(id, this.store, 'color', newColor, false);
  }

  handleFontFamilyChange(id: string, newFontFamily: string) {
    this.textSelectionHandler.updateGlobalStyles(
      id,
      this.store,
      'fontFamily',
      newFontFamily,
      false
    );
    this.textSelectionHandler.updatePartialInlineStyle(
      id,
      this.store,
      'fontFamily',
      newFontFamily,
      false
    );
  }

  //这里没用了
  // handleFontSizeChange(id: string, newFontSize: number) {
  //   this.textSelectionHandler.updateGlobalStyles(id, this.store, { fontSize: newFontSize });
  // }
  /**
   * 处理文本节点鼠标抬起（供文本组件调用，内部转发给 TextSelectionHandler）
   * @param e - 鼠标事件
   * @param id - 文本节点 ID
   */
  handleTextMouseUp(e: MouseEvent, id: string) {
    if (this.transformHandler.isTransforming) return;
    const node = this.store.nodes[id];
    if (!node || node.type !== NodeType.TEXT) return;
    this.textSelectionHandler.handleMouseUpAndSelection(e, id);
    console.log('触发handleTextMouseUp');
  }

  getTextEditingState(): boolean {
    return this.textSelectionHandler.isEditing;
  }

  getCurrentSelection() {
    return this.textSelectionHandler.currentSelection;
  }

  // ==================== 旋转控制点事件（新增）====================
  /**
   * 处理旋转控制点按下事件
   * @param e 鼠标事件
   */
  handleRotateHandleDown(e: MouseEvent): void {
    if (!this.forceProtectEvent(e)) return;
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();
    this.rotationHandler.startRotate(e);
  }

  // ==================== 右键菜单事件处理 =====================
  /**
   * 处理画布右键菜单事件
   * @param e - 鼠标事件
   */
  handleContextMenu(e: MouseEvent) {
    // 防护逻辑：过滤外部干扰
    if (!this.stageEl?.contains(e.target as Node)) return;

    // 显示右键菜单
    this.showContextMenu(e.clientX, e.clientY);
  }

  /**
   * 处理节点右键菜单事件
   * @param e - 鼠标事件
   */
  handleNodeContextMenu(e: MouseEvent) {
    // 防护逻辑：过滤外部干扰
    if (!this.stageEl?.contains(e.target as Node)) return;

    // 显示右键菜单
    this.showContextMenu(e.clientX, e.clientY);
  }

  /**
   * 显示右键菜单
   * @param x - 菜单位置 X 坐标
   * @param y - 菜单位置 Y 坐标
   */
  private showContextMenu(x: number, y: number) {
    // 创建自定义事件，将右键菜单信息发送到应用
    const contextMenuEvent = new CustomEvent('showContextMenu', {
      detail: {
        x,
        y,
        hasSelection: this.selectionStore.activeElementIds.size > 0,
      },
      bubbles: true,
      cancelable: true,
    });

    // 触发事件
    document.dispatchEvent(contextMenuEvent);
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

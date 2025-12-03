import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { NodeType, type BaseNodeState } from '@/types/state';
import type { ResizeHandle } from '@/types/editor';
import { ViewportHandler } from './handlers/ViewportHandler';
import { TransformHandler } from './handlers/TransformHandler';
import { SelectionHandler } from './handlers/SelectionHandler';
import { GroupService } from './services/GroupService';

/**
 * 工具管理器类（整合强制事件锁定）
 * 核心：保留所有原有业务逻辑，添加事件防护层，确保画布交互优先级最高
 */
export class ToolManager {
  private store: ReturnType<typeof useCanvasStore>;
  private ui: ReturnType<typeof useUIStore>;
  private stageEl: HTMLElement | null; // 画布根元素

  // 专用处理器
  private viewportHandler: ViewportHandler;
  private transformHandler: TransformHandler;
  private selectionHandler: SelectionHandler;

  // 外部状态获取
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
    this.ui = useUIStore();
    this.stageEl = stageEl;
    this.getIsSpacePressed = getIsSpacePressed;

    // 初始化处理器
    this.viewportHandler = new ViewportHandler(this.store);
    this.transformHandler = new TransformHandler(this.store);
    this.selectionHandler = new SelectionHandler(this.store, stageEl);
  }

  /**
   * 销毁管理器，清理资源
   */
  destroy() {
    this.isCanvasInteracting = false; // 重置锁定状态
  }

  /**
   * 获取框选状态
   */
  getBoxSelectState() {
    return {
      isDragging: this.transformHandler.isDragging,
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
    e.preventDefault(); // 阻止浏览器默认行为+外部软件默认响应

    // 4. 标记交互状态
    this.isCanvasInteracting = true;
    return true;
  }

  // 结束交互 - 重置锁定标记
  private endCanvasInteraction() {
    this.isCanvasInteracting = false;
  }

  // ==================== 画布事件处理（整合防护）====================
  handleWheel(e: WheelEvent) {
    // 强制防护：过滤外部干扰的滚轮事件
    if (!this.forceProtectEvent(e)) return;

    this.viewportHandler.onWheel(e);
    this.endCanvasInteraction(); // 滚轮事件无需长期锁定
  }

  handleMouseDown(e: MouseEvent) {
    // 强制防护：不通过则直接忽略
    if (!this.forceProtectEvent(e)) return;

    // 原有业务逻辑：空格+左键平移（最高优先级）
    if (this.getIsSpacePressed() && e.button === 0) {
      this.viewportHandler.startPan(e);
      return;
    }

    // 原有业务逻辑：拖拽中不触发平移
    if (this.transformHandler.isDragging) return;

    // 原有业务逻辑：中键平移
    if (e.button === 1) {
      this.viewportHandler.startPan(e);
      this.store.setActive([]);
      if (this.store.editingGroupId) {
        GroupService.exitGroupEdit(this.store);
      }
      return;
    }

    // 原有业务逻辑：左键框选/多选拖拽
    if (e.button === 0 && !this.getIsSpacePressed()) {
      const hasActiveNodes = this.store.activeElementIds.size > 0;
      const isClickInArea = this.selectionHandler.isClickInSelectedArea(e);

      if (hasActiveNodes && isClickInArea) {
        const activeIds = Array.from(this.store.activeElementIds).filter((id) => {
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
      if (this.store.editingGroupId) {
        GroupService.exitGroupEdit(this.store);
      }

      // 原有业务逻辑：启动框选
      this.selectionHandler.startBoxSelect(e);
    }
  }

  handleMouseMove(e: MouseEvent) {
    // 防护逻辑：正在交互时强制防护，非交互时校验事件源
    if (this.isCanvasInteracting) {
      this.forceProtectEvent(e);
    } else {
      if (!this.stageEl?.contains(e.target as Node)) return;
    }

    // 原有业务逻辑：优先级排序 - 多选缩放 > 单选缩放 > 拖拽 > 平移 > 框选
    if (this.transformHandler.isMultiResizing) {
      this.transformHandler.updateMultiResize(e);
      return;
    }

    if (this.transformHandler.isResizing) {
      this.transformHandler.updateResize(e);
      return;
    }

    if (this.transformHandler.isDragging) {
      this.transformHandler.updateDrag(e);
      return;
    }

    if (this.viewportHandler.isPanning) {
      this.viewportHandler.updatePan(e);
      return;
    }

    if (!this.getIsSpacePressed()) {
      this.selectionHandler.updateBoxSelect(e);
    }
  }

  handleMouseUp() {
    // 防护逻辑：用mock事件强制防护，避免外部up事件干扰
    const mockEvent = new MouseEvent('mouseup');
    this.forceProtectEvent(mockEvent);

    // 原有业务逻辑：扩展组合边界检查
    const hadDragOrResize = this.transformHandler.isTransforming;

    // 原有业务逻辑：重置状态
    this.viewportHandler.endPan();
    this.transformHandler.reset();

    if (!this.getIsSpacePressed()) {
      this.selectionHandler.finishBoxSelect();
    }

    if (hadDragOrResize && this.store.editingGroupId) {
      GroupService.expandGroupToFitChildren(this.store);
    }

    // 结束交互锁定
    this.endCanvasInteraction();
  }

  // ==================== 节点事件处理（整合防护）====================
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
      this.store.toggleSelection(id);
    } else {
      if (!this.store.activeElementIds.has(id)) {
        this.store.setActive([id]);
      }
    }

    // 原有业务逻辑：节点有效性校验
    const node = this.store.nodes[id] as BaseNodeState;
    if (!node || node.isLocked) {
      this.endCanvasInteraction();
      return;
    }

    // 原有业务逻辑：显示属性面板
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

    // 新增：节点有效性校验
    const node = this.store.nodes[nodeId] as BaseNodeState;
    if (!node || node.isLocked) {
      this.endCanvasInteraction();
      return;
    }

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

    // 新增：过滤锁定节点
    const validNodeIds = nodeIds.filter((id) => {
      const node = this.store.nodes[id];
      return node && !node.isLocked;
    });
    if (validNodeIds.length === 0) {
      this.endCanvasInteraction();
      return;
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
}

/**
 * @file CreationHandler.ts
 * @description 创建交互处理器 - 处理类似 Figma 的拖拽创建体验
 *
 * 职责：
 * 1. 管理创建模式的激活/退出（setTool/reset）
 * 2. 处理鼠标悬浮预览（Ghost Node）
 * 3. 处理拖拽创建（按下->拖拽->抬起）
 * 4. 处理点击创建（按下->直接抬起，使用默认尺寸）
 * 5. 支持 Shift 锁定比例、Alt 从中心缩放
 *
 * 特点：
 * - 纯交互逻辑：不涉及渲染，仅操作 Store 数据
 * - 状态隔离：不影响其他 Handler 的状态
 * - 坐标转换：使用 geometry.ts 的 eventToWorld 确保视口变换下的精确定位
 */

import type { useCanvasStore } from '@/store/canvasStore';
import type { CanvasToolType } from '@/types/editor';
import { useSelectionStore } from '@/store/selectionStore';
import { NodeFactory } from '../services/NodeFactory';
import { eventToWorld } from '../utils/geometry';
import type { NodeState } from '@/types/state';
import { NodeType } from '@/types/state';

/**
 * 创建交互处理器 - 使用统一坐标转换系统
 *
 * 实现类似 Figma 的交互式绘制功能：
 * - 点击工具后进入创建模式
 * - 鼠标移动时显示半透明预览（Ghost Node）
 * - 点击或拖拽完成创建
 * - 支持图片工具（尺寸锁定，不受拖拽影响）
 *
 * 坐标系统：
 * - 使用 eventToWorld 将鼠标事件直接转换为世界坐标
 * - 确保左上角精确对齐鼠标位置（修复 Header 高度偏移问题）
 */
export class CreationHandler {
  private store: ReturnType<typeof useCanvasStore>;
  private selectionStore = useSelectionStore();
  private stageEl: HTMLElement | null;

  // 拖拽状态
  private isDragging = false;
  private startPoint: { x: number; y: number } | null = null;
  private lastMouseEvent: MouseEvent | null = null; // 存储最后的鼠标事件
  private isShiftPressed = false;
  private isAltPressed = false;
  // 当前创建的节点类型
  private currentNodeType: NodeType | null = null;
  // 是否已经显示过预览（防止闪烁）
  private hasShownPreview = false;

  constructor(store: ReturnType<typeof useCanvasStore>, stageEl: HTMLElement | null) {
    this.store = store;
    this.stageEl = stageEl;
  }

  /**
   * 激活创建工具，生成预览节点
   * @param type 工具类型（rect/circle/text/image）
   */
  async setTool(type: CanvasToolType) {
    if (type === 'select') {
      this.reset();
      return;
    }

    // 生成半透明预览节点（初始位置在原点，后续由 handleMouseMove 更新）
    let previewNode: NodeState | null = null;

    switch (type) {
      case 'rect':
        previewNode = NodeFactory.createRect(0, 0);
        this.currentNodeType = NodeType.RECT;
        break;
      case 'circle':
        previewNode = NodeFactory.createCircle(0, 0);
        this.currentNodeType = NodeType.CIRCLE;
        break;
      case 'text':
        previewNode = NodeFactory.createText(0, 0);
        this.currentNodeType = NodeType.TEXT;
        break;
      case 'image':
        // 从 store 获取图片URL
        const imageUrl = this.store.creationToolOptions.imageUrl;
        if (!imageUrl) {
          console.error('创建图片工具失败：缺少 imageUrl');
          this.reset();
          return;
        }
        try {
          previewNode = await NodeFactory.createImage(imageUrl, 0, 0);
          this.currentNodeType = NodeType.IMAGE;
        } catch (error) {
          console.error('创建图片预览节点失败:', error);
          this.reset();
          return;
        }
        break;
    }

    if (previewNode) {
      // 设置半透明样式（不修改原始 style，避免污染默认值）
      previewNode.style = {
        ...previewNode.style,
        opacity: 0.5,
      };
      // 【修复闪烁】初始隐藏预览节点，等待首次 handleMouseMove 再显示
      previewNode.isVisible = false;
      this.hasShownPreview = false;
      this.store.setPreviewNode(previewNode);
    }
  }

  /**
   * 鼠标移动处理
   * - 悬浮阶段：更新预览节点位置（鼠标位置 = 左上角）
   * - 拖拽阶段：计算并更新预览节点的尺寸和位置
   * - 图片特殊处理：始终保持原始尺寸，只更新位置
   *
   * 坐标转换：使用 eventToWorld 确保精确对齐，消除 Header 偏移问题
   */
  handleMouseMove(e: MouseEvent) {
    const previewNode = this.store.previewNode;
    if (!previewNode) return;

    // 【修复闪烁】首次移动时才显示预览节点
    if (!this.hasShownPreview) {
      previewNode.isVisible = true;
      this.hasShownPreview = true;
    }

    // 存储最后的鼠标事件
    this.lastMouseEvent = e;

    // 更新修饰键状态
    this.isShiftPressed = e.shiftKey;
    this.isAltPressed = e.altKey;

    // 【关键修复】使用 eventToWorld 直接转换，消除 DOM 偏移问题
    const worldPos = eventToWorld(e, this.stageEl, this.store.viewport);

    // 图片节点：只更新位置，不参与拖拽缩放
    if (this.currentNodeType === NodeType.IMAGE) {
      previewNode.transform.x = worldPos.x;
      previewNode.transform.y = worldPos.y;
      this.store.setPreviewNode(previewNode);
      return;
    }

    if (!this.isDragging) {
      // 悬浮阶段：预览节点跟随鼠标（左上角对齐鼠标，无需偏移）
      previewNode.transform.x = worldPos.x;
      previewNode.transform.y = worldPos.y;
      this.store.setPreviewNode(previewNode);
    } else {
      // 拖拽阶段：计算拖拽矩形
      if (!this.startPoint) return;

      const absWidth = Math.abs(worldPos.x - this.startPoint.x);
      const absHeight = Math.abs(worldPos.y - this.startPoint.y);

      let width: number;
      let height: number;
      let x: number;
      let y: number;

      // 四种组合模式
      if (this.isShiftPressed && this.isAltPressed) {
        // Shift + Alt: 正方形 + 中心扩展
        const size = Math.max(absWidth, absHeight);
        width = size;
        height = size;
        x = this.startPoint.x - size / 2;
        y = this.startPoint.y - size / 2;
      } else if (this.isShiftPressed) {
        // Shift: 正方形 + 角点
        const size = Math.max(absWidth, absHeight);
        width = size;
        height = size;
        x = worldPos.x < this.startPoint.x ? this.startPoint.x - size : this.startPoint.x;
        y = worldPos.y < this.startPoint.y ? this.startPoint.y - size : this.startPoint.y;
      } else if (this.isAltPressed) {
        // Alt: 自由比例 + 中心扩展
        width = absWidth;
        height = absHeight;
        x = this.startPoint.x - width / 2;
        y = this.startPoint.y - height / 2;
      } else {
        // 默认: 自由比例 + 角点
        width = absWidth;
        height = absHeight;
        x = Math.min(this.startPoint.x, worldPos.x);
        y = Math.min(this.startPoint.y, worldPos.y);
      }

      // 更新预览节点
      previewNode.transform.x = x;
      previewNode.transform.y = y;
      previewNode.transform.width = Math.max(1, width);
      previewNode.transform.height = Math.max(1, height);
      this.store.setPreviewNode(previewNode);
    }
  }

  /**
   * 鼠标按下处理
   * 记录起始点，开始拖拽
   *
   * 坐标转换：使用 eventToWorld 确保起始点精确
   */
  handleMouseDown(e: MouseEvent) {
    if (!this.store.previewNode) return;

    // 只响应左键
    if (e.button !== 0) return;

    // 【修复】使用 eventToWorld 替代手动计算
    const worldPos = eventToWorld(e, this.stageEl, this.store.viewport);
    this.startPoint = { x: worldPos.x, y: worldPos.y };
    this.isDragging = true;

    // 【修复】同步交互状态，触发 CanvasStage 渲染预览框
    this.store.isInteracting = true;

    e.stopPropagation();
    e.preventDefault();
  }

  /**
   * 鼠标抬起处理
   * - 判断是点击还是拖拽
   * - 提交节点到画布
   * - 重置工具为选择模式
   * - 图片特殊处理：忽略拖拽，始终使用原始尺寸
   *
   * 坐标转换：使用 eventToWorld 确保最终位置精确
   */
  async handleMouseUp(e?: MouseEvent) {
    if (!this.store.previewNode || !this.startPoint) return;

    // 如果没有传入事件，使用最后记录的鼠标位置
    const event = e || this.lastMouseEvent;
    if (!event) return;

    // 【修复】使用 eventToWorld 替代手动计算
    const worldPos = eventToWorld(event, this.stageEl, this.store.viewport);

    // 计算移动距离
    const deltaX = Math.abs(worldPos.x - this.startPoint.x);
    const deltaY = Math.abs(worldPos.y - this.startPoint.y);

    // 阈值：小于 3px 视为点击，否则视为拖拽
    const isClick = deltaX < 3 && deltaY < 3;

    let finalNode: NodeState;

    // 点击创建：重新生成纯净的默认节点
    if (isClick) {
      switch (this.currentNodeType) {
        case NodeType.RECT:
          finalNode = NodeFactory.createRect(this.startPoint.x, this.startPoint.y);
          break;
        case NodeType.CIRCLE:
          finalNode = NodeFactory.createCircle(this.startPoint.x, this.startPoint.y);
          break;
        case NodeType.TEXT:
          finalNode = NodeFactory.createText(this.startPoint.x, this.startPoint.y);
          break;
        case NodeType.IMAGE:
          finalNode = await NodeFactory.createImage(
            this.store.creationToolOptions.imageUrl!,
            this.startPoint.x,
            this.startPoint.y
          );
          break;
        default:
          return;
      }
    } else {
      // 拖拽创建：使用预览节点的尺寸和位置
      //【补丁】文本节点要重新生成纯净节点
      if (this.currentNodeType === NodeType.TEXT) {
        const n = NodeFactory.createText(
          this.store.previewNode.transform.x,
          this.store.previewNode.transform.y
        );
        n.transform.width = Math.max(
          1,
          this.store.previewNode.transform.width || n.transform.width
        );
        n.transform.height = Math.max(
          1,
          this.store.previewNode.transform.height || n.transform.height
        );
        finalNode = n;
      } else finalNode = { ...this.store.previewNode };
    }

    // 恢复正常透明度
    finalNode.style = {
      ...finalNode.style,
      opacity: 1,
    };

    // 提交到画布
    this.store.addNode(finalNode);
    this.selectionStore.setActive([finalNode.id]);

    // 【修复】重置交互状态
    this.store.isInteracting = false;

    // 重置工具为选择模式
    this.reset();

    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  /**
   * 重置创建模式
   * 清空预览节点，切回选择工具
   */
  reset() {
    this.store.setPreviewNode(null);
    this.store.setCreationTool('select');
    this.isDragging = false;
    this.startPoint = null;
    this.currentNodeType = null;
    this.hasShownPreview = false;
    // 【修复】重置交互状态
    this.store.isInteracting = false;
  }

  /**
   * 获取当前是否处于创建模式
   */
  isCreating(): boolean {
    return this.store.creationTool !== 'select';
  }
}

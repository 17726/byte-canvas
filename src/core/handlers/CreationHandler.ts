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
 * - 坐标转换：使用 geometry.ts 的 clientToWorld 确保视口变换下的精确定位
 */

import type { useCanvasStore } from '@/store/canvasStore';
import type { CanvasToolType } from '@/types/editor';
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
        if (imageUrl) {
          try {
            previewNode = await NodeFactory.createImage(imageUrl, 0, 0);
            this.currentNodeType = NodeType.IMAGE;
          } catch (error) {
            console.error('创建图片预览节点失败:', error);
            this.reset();
            return;
          }
        } else {
          console.error('图片URL未提供');
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
      this.store.setPreviewNode({ ...previewNode });
      return;
    }

    if (!this.isDragging) {
      // 悬浮阶段：预览节点跟随鼠标（左上角对齐鼠标，无需偏移）
      previewNode.transform.x = worldPos.x;
      previewNode.transform.y = worldPos.y;
      // 触发响应式更新
      this.store.setPreviewNode({ ...previewNode });
    } else {
      // 拖拽阶段：计算拖拽矩形
      if (!this.startPoint) return;

      let width = Math.abs(worldPos.x - this.startPoint.x);
      let height = Math.abs(worldPos.y - this.startPoint.y);

      // Shift: 锁定为正方形/圆形
      if (this.isShiftPressed) {
        const maxSize = Math.max(width, height);
        width = maxSize;
        height = maxSize;
      }

      // 计算实际位置（处理负向拖拽）
      let x = Math.min(this.startPoint.x, worldPos.x);
      let y = Math.min(this.startPoint.y, worldPos.y);

      // Alt: 从中心缩放
      if (this.isAltPressed) {
        x = this.startPoint.x - width / 2;
        y = this.startPoint.y - height / 2;
      }

      // 更新预览节点
      previewNode.transform.x = x;
      previewNode.transform.y = y;
      previewNode.transform.width = Math.max(1, width); // 最小1px
      previewNode.transform.height = Math.max(1, height);

      // 触发响应式更新
      this.store.setPreviewNode({ ...previewNode });
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
  handleMouseUp(e?: MouseEvent) {
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

    // 准备最终节点（深拷贝预览节点）
    const finalNode = { ...this.store.previewNode };

    // 图片节点：无论点击还是拖拽，都使用原始尺寸和起始点位置
    if (this.currentNodeType === NodeType.IMAGE) {
      finalNode.transform.x = this.startPoint.x;
      finalNode.transform.y = this.startPoint.y;
      // 保持原始宽高（NodeFactory.createImage 已设置）
    } else if (isClick) {
      // 非图片节点：点击创建保留 NodeFactory 默认尺寸，仅更新位置
      finalNode.transform.x = this.startPoint.x;
      finalNode.transform.y = this.startPoint.y;
      // 保持 NodeFactory 初始化的默认宽高（文本160x40，矩形/圆形100x100）
    }
    // 非图片节点的拖拽情况：使用预览节点的尺寸和位置（已在 handleMouseMove 中计算）

    // 恢复正常透明度
    finalNode.style = {
      ...finalNode.style,
      opacity: 1,
    };

    // 提交到画布
    this.store.addNode(finalNode);
    this.store.setActive([finalNode.id]);

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

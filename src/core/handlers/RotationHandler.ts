// src/core/handlers/RotationHandler.ts
import { useCanvasStore } from '@/store/canvasStore';
import type { BaseNodeState } from '@/types/state';

/** 旋转相关状态 */
interface RotationState {
  isRotating: boolean; // 是否正在旋转
  startAngle: number; // 拖拽开始时，鼠标相对于节点中心的初始角度（弧度）
  nodeInitialRotations: Record<string, number>; // 每个节点的初始旋转角度（key: nodeId, value: 初始角度）
}

/**
 * 旋转处理器
 * 职责：实现「单个节点绕自身中心旋转」「多选节点各自绕自身中心旋转」
 */
export class RotationHandler {
  private store = useCanvasStore();
  private rotationState: RotationState = {
    isRotating: false,
    startAngle: 0,
    nodeInitialRotations: {},
  };

  /** 获取当前旋转状态（供ToolManager判断优先级） */
  get isRotating() {
    return this.rotationState.isRotating;
  }

  /**
   * 开始旋转（拖拽旋转控制点时触发）
   * @param e 鼠标事件
   */
  startRotate(e: MouseEvent): void {
    const selectedNodeIds = Array.from(this.store.activeElementIds);
    if (selectedNodeIds.length === 0) return;

    // 记录每个选中节点的初始旋转角度（确保多节点独立旋转）
    const nodeInitialRotations: Record<string, number> = {};
    selectedNodeIds.forEach((nodeId) => {
      const node = this.store.nodes[nodeId] as BaseNodeState;
      if (node && !node.isLocked) {
        nodeInitialRotations[nodeId] = node.transform.rotation;
      }
    });

    // 计算初始鼠标相对于「第一个选中节点中心」的角度（作为角度计算基准）
    const firstNodeId = selectedNodeIds[0];
    if (!firstNodeId) return;
    const firstNode = this.store.nodes[firstNodeId] as BaseNodeState;
    if (!firstNode) return; // 新增：空值校验，避免后续错误
    const firstNodeAbsTransform =
      this.store.getAbsoluteTransform(firstNodeId) || firstNode.transform;
    const nodeCenter = {
      x: firstNodeAbsTransform.x + firstNodeAbsTransform.width / 2,
      y: firstNodeAbsTransform.y + firstNodeAbsTransform.height / 2,
    };

    // 转换鼠标坐标为「画布内相对坐标」（抵消视口缩放/平移影响）
    const viewport = this.store.viewport;
    const mouseX = (e.clientX - viewport.offsetX) / viewport.zoom;
    const mouseY = (e.clientY - viewport.offsetY) / viewport.zoom;

    // 计算初始角度（弧度）
    const startAngle = Math.atan2(mouseY - nodeCenter.y, mouseX - nodeCenter.x);

    // 更新旋转状态
    this.rotationState = {
      isRotating: true,
      startAngle,
      nodeInitialRotations,
    };

    this.store.isInteracting = true;
  }

  /**
   * 更新旋转（拖拽过程中实时触发）
   * @param e 鼠标事件
   */
  updateRotate(e: MouseEvent): void {
    const { isRotating, startAngle, nodeInitialRotations } = this.rotationState;
    if (!isRotating || Object.keys(nodeInitialRotations).length === 0) return;

    // 取第一个选中节点的中心作为角度计算基准（所有节点共享同一角度变化量）
    const firstNodeId = Object.keys(nodeInitialRotations)[0];
    if (!firstNodeId) return;
    const firstNode = this.store.nodes[firstNodeId] as BaseNodeState;
    const firstNodeAbsTransform =
      this.store.getAbsoluteTransform(firstNodeId) || firstNode.transform;
    const nodeCenter = {
      x: firstNodeAbsTransform.x + firstNodeAbsTransform.width / 2,
      y: firstNodeAbsTransform.y + firstNodeAbsTransform.height / 2,
    };

    // 转换鼠标坐标为「画布内相对坐标」
    const viewport = this.store.viewport;
    const mouseX = (e.clientX - viewport.offsetX) / viewport.zoom;
    const mouseY = (e.clientY - viewport.offsetY) / viewport.zoom;

    // 计算当前鼠标相对于节点中心的角度（弧度）
    const currentAngle = Math.atan2(mouseY - nodeCenter.y, mouseX - nodeCenter.x);

    // 计算角度变化量（弧度转角度，保留1位小数）
    const angleDelta = Math.round((((currentAngle - startAngle) * 180) / Math.PI) * 10) / 10;

    // 遍历所有节点，更新旋转角度（每个节点基于自身初始角度 + 统一的角度变化量）
    Object.entries(nodeInitialRotations).forEach(([nodeId, initialRotation]) => {
      const node = this.store.nodes[nodeId] as BaseNodeState;
      if (!node || node.isLocked) return;

      // 计算新角度（取模360，避免数值溢出）
      let newRotation = initialRotation + angleDelta;
      newRotation = newRotation % 360;
      newRotation = newRotation < 0 ? newRotation + 360 : newRotation;

      // 更新节点旋转角度
      this.store.updateNode(nodeId, {
        transform: {
          ...node.transform,
          rotation: newRotation,
        },
      });
    });
  }

  /** 结束旋转（鼠标松开时触发） */
  endRotate(): void {
    this.rotationState.isRotating = false;
    this.store.isInteracting = false;
  }

  /** 重置旋转状态（异常情况兜底） */
  reset(): void {
    this.rotationState = {
      isRotating: false,
      startAngle: 0,
      nodeInitialRotations: {},
    };
  }
}

// src/core/handlers/RotationHandler.ts
import { useCanvasStore } from '@/store/canvasStore';
import { useSelectionStore } from '@/store/selectionStore';
import type { BaseNodeState } from '@/types/state';
import { eventToWorld, computeAbsoluteTransform } from '../utils/geometry';

/** 旋转相关状态 */
interface RotationState {
  isRotating: boolean; // 是否正在旋转
  startAngle: number; // 拖拽开始时，鼠标相对于节点中心的初始角度（弧度）
  nodeInitialRotations: Record<string, number>; // 每个节点的初始旋转角度（key: nodeId, value: 初始角度）
}

/**
 * 旋转处理器 - 使用统一坐标转换系统
 *
 * 职责：
 * - 实现「单个节点绕自身中心旋转」
 * - 实现「多选节点各自绕自身中心旋转」
 *
 * 坐标系统：
 * - 使用 eventToWorld 获取鼠标的世界坐标
 * - 使用节点中心的世界坐标计算角度
 * - 确保旋转计算更加严谨（消除屏幕坐标带来的几何偏差）
 */
export class RotationHandler {
  private store = useCanvasStore();
  private selectionStore = useSelectionStore();
  private stageEl: HTMLElement | null;

  private rotationState: RotationState = {
    isRotating: false,
    startAngle: 0,
    nodeInitialRotations: {},
  };

  constructor(stageEl: HTMLElement | null) {
    this.stageEl = stageEl;
  }

  /** 获取当前旋转状态（供ToolManager判断优先级） */
  get isRotating() {
    return this.rotationState.isRotating;
  }

  /**
   * 开始旋转（拖拽旋转控制点时触发）
   * @param e 鼠标事件
   */
  startRotate(e: MouseEvent): void {
    const selectedNodeIds = Array.from(this.selectionStore.activeElementIds);
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
      computeAbsoluteTransform(firstNodeId, this.store.nodes) || firstNode.transform;
    // 计算节点中心的世界坐标
    const nodeCenter = {
      x: firstNodeAbsTransform.x + firstNodeAbsTransform.width / 2,
      y: firstNodeAbsTransform.y + firstNodeAbsTransform.height / 2,
    };

    // 【修复】使用 eventToWorld 获取鼠标的世界坐标（更严谨）
    const mouseWorld = eventToWorld(e, this.stageEl, this.store.viewport);

    // 计算初始角度（弧度）- 鼠标世界坐标 vs 节点中心世界坐标
    const startAngle = Math.atan2(mouseWorld.y - nodeCenter.y, mouseWorld.x - nodeCenter.x);

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
      computeAbsoluteTransform(firstNodeId, this.store.nodes) || firstNode.transform;
    // 计算节点中心的世界坐标
    const nodeCenter = {
      x: firstNodeAbsTransform.x + firstNodeAbsTransform.width / 2,
      y: firstNodeAbsTransform.y + firstNodeAbsTransform.height / 2,
    };

    // 【修复】使用 eventToWorld 获取鼠标的世界坐标
    const mouseWorld = eventToWorld(e, this.stageEl, this.store.viewport);

    // 计算当前鼠标相对于节点中心的角度（弧度）- 世界坐标计算更精确
    const currentAngle = Math.atan2(mouseWorld.y - nodeCenter.y, mouseWorld.x - nodeCenter.x);

    // 计算角度变化量（弧度转角度，保留1位小数）
    const angleDelta = Math.round((((currentAngle - startAngle) * 180) / Math.PI) * 10) / 10;

    // 遍历所有节点，更新旋转角度（每个节点基于自身初始角度 + 统一的角度变化量）
    Object.entries(nodeInitialRotations).forEach(([nodeId, initialRotation]) => {
      const node = this.store.nodes[nodeId] as BaseNodeState;
      if (!node || node.isLocked) return;

      // 计算新角度
      let newRotation = initialRotation + angleDelta;

      // 核心修改：将角度归一化到 -180 ~ +180° 范围
      newRotation = newRotation % 360; // 先取模360，得到 -360~360 范围
      if (newRotation > 180) {
        newRotation -= 360; // 大于180时，减360（如 270° → -90°）
      } else if (newRotation < -180) {
        newRotation += 360; // 小于-180时，加360（如 -270° → 90°）
      }

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

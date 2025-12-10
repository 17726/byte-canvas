/**
 * @file geometry.ts
 * @description 几何计算与坐标转换工具库 - 三大坐标系统的统一抽象层
 *
 * ====================================
 * 三大坐标系统概念 (Three Coordinate Systems)
 * ====================================
 *
 * 1. **Screen 坐标系 (浏览器视口坐标)**
 *    - 来源：MouseEvent.clientX / clientY
 *    - 特点：相对于浏览器窗口左上角，包含页面所有 UI 元素（Header、Sidebar 等）
 *    - 用途：原始鼠标事件、DOM 元素定位
 *
 * 2. **Container 坐标系 (画布容器相对坐标)**
 *    - 来源：Screen 坐标 - el.getBoundingClientRect()
 *    - 特点：相对于 CanvasStage 根元素左上角，剔除了外部布局影响
 *    - 用途：框选框渲染、DOM 层叠效果
 *
 * 3. **World 坐标系 (逻辑世界坐标)**
 *    - 来源：Container 坐标 / viewport.zoom - viewport.offset
 *    - 特点：画布内部逻辑坐标，不受缩放(zoom)和平移(pan)影响
 *    - 用途：节点位置计算、碰撞检测、几何变换
 *
 * ====================================
 * 核心转换函数 (Core Transformation Functions)
 * ====================================
 *
 * 本文件提供四个核心纯函数，强制所有 Handler 使用统一的坐标转换逻辑：
 *
 * - eventToContainer: Screen -> Container（处理 DOM 偏移）
 * - containerToWorld: Container -> World（处理 Zoom/Pan）
 * - eventToWorld: Screen -> World（组合转换，推荐优先使用）
 * - worldToClient: World -> Container/Screen（逆向转换，支持可选 DOM 偏移）
 *
 * ====================================
 * 其他几何计算函数
 * ====================================
 *
 * - calculateBounds: 计算一组节点的包围盒 (AABB)
 * - isNodeInRect: 判断节点是否在矩形区域内 (碰撞检测)
 * - calculateRectResize: 计算矩形缩放后的位置和尺寸
 * - calculateCircleResize: 计算圆形缩放后的位置和尺寸
 * - calculateTextResize: 计算文本缩放后的位置和尺寸
 *
 * ====================================
 * 开发规范 (Development Guidelines)
 * ====================================
 *
 * ⚠️ **重要提示**：所有涉及鼠标位置计算的 Handler，必须遵循以下规范：
 *
 * 1. **禁止手动计算 getBoundingClientRect()**
 *    ❌ 错误示例：
 *    ```ts
 *    const rect = stageEl.getBoundingClientRect();
 *    const x = e.clientX - rect.left;
 *    ```
 *    ✅ 正确示例：
 *    ```ts
 *    const pos = eventToContainer(e, stageEl);
 *    ```
 *
 * 2. **优先使用 eventToWorld 一步到位转换**
 *    ❌ 错误示例：
 *    ```ts
 *    const rect = stageEl.getBoundingClientRect();
 *    const containerX = e.clientX - rect.left;
 *    const worldX = (containerX - viewport.offsetX) / viewport.zoom;
 *    ```
 *    ✅ 正确示例：
 *    ```ts
 *    const worldPos = eventToWorld(e, stageEl, viewport);
 *    ```
 *
 * 3. **仅在需要容器坐标时才拆分步骤**
 *    - 框选框渲染：需要 Container 坐标（因为框选框是 DOM 元素）
 *    - 节点位置计算：需要 World 坐标（因为节点的 x/y 是逻辑坐标）
 *
 * 4. **所有涉及 DOM 元素的地方必须做非空检查**
 *    ```ts
 *    if (!stageEl) return { x: 0, y: 0 }; // 兜底处理
 *    ```
 */

import type { BaseNodeState, NodeState, TransformState, ViewportState } from '@/types/state';
import type { ResizeHandle } from '@/types/editor';
import { MIN_NODE_SIZE } from '@/config/defaults';

/**
 * 边界框类型定义
 */
export interface BoundsRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type NodeTransform = TransformState;
export type Bounds = BoundsRect;

/**
 * 计算节点的绝对变换（包含父级旋转），返回世界坐标系下的变换数据
 */
export function computeAbsoluteTransform(
  nodeId: string,
  nodes: Record<string, NodeState>
): NodeTransform | null {
  const node = nodes[nodeId];
  if (!node) return null;

  // 收集祖先链，从子到父
  const parentChain: NodeState[] = [];
  let current: NodeState | undefined = node;
  while (current?.parentId) {
    const parentNode: NodeState | undefined = nodes[current.parentId];
    if (!parentNode) break;
    parentChain.push(parentNode);
    current = parentNode;
  }

  // 子节点的局部信息
  const width = node.transform.width;
  const height = node.transform.height;
  let x = node.transform.x;
  let y = node.transform.y;
  let rotation = node.transform.rotation || 0;

  // 从内到外应用父级旋转和平移（旋转围绕父元素中心）
  for (const parent of parentChain) {
    const parentRot = parent.transform.rotation || 0;
    const parentX = parent.transform.x;
    const parentY = parent.transform.y;
    const parentW = parent.transform.width;
    const parentH = parent.transform.height;
    const parentCX = parentW / 2;
    const parentCY = parentH / 2;

    if (parentRot === 0) {
      x += parentX;
      y += parentY;
    } else {
      // 子元素中心相对父元素中心
      const childCenterLocalX = x + width / 2;
      const childCenterLocalY = y + height / 2;
      const relX = childCenterLocalX - parentCX;
      const relY = childCenterLocalY - parentCY;

      const rad = (parentRot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const rotatedX = relX * cos - relY * sin;
      const rotatedY = relX * sin + relY * cos;

      const childCenterWorldX = parentX + parentCX + rotatedX;
      const childCenterWorldY = parentY + parentCY + rotatedY;

      x = childCenterWorldX - width / 2;
      y = childCenterWorldY - height / 2;
    }

    rotation += parentRot;
  }

  // 规范化角度到 0-360
  rotation = ((rotation % 360) + 360) % 360;

  return {
    x,
    y,
    width,
    height,
    rotation,
  };
}

/**
 * 计算一组节点在世界坐标系下的包围盒（考虑层级旋转）
 */
export function computeSelectionBounds(
  nodeIds: string[],
  nodes: Record<string, NodeState>
): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodeIds.forEach((id) => {
    const abs = computeAbsoluteTransform(id, nodes);
    if (!abs) return;

    const { x, y, width, height, rotation } = abs;
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
  });

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 计算一组节点的边界框（考虑旋转）
 * @param nodes 节点映射表
 * @param nodeIds 节点ID列表
 * @returns 边界框信息
 */
export function calculateBounds(
  nodes: Record<string, BaseNodeState>,
  nodeIds: string[]
): BoundsRect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  nodeIds.forEach((id) => {
    const node = nodes[id];
    if (!node) return;
    const { x, y, width, height, rotation } = node.transform;

    // 计算旋转后的边界框
    if (rotation === 0) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    } else {
      // 计算旋转后四角的位置
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

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ====================================
// 核心坐标转换函数 (Core Transformation Functions)
// ====================================

/**
 * 【核心函数 1】将鼠标事件坐标转换为容器相对坐标
 *
 * 坐标系转换：Screen -> Container
 *
 * 转换链路：
 * ```
 * MouseEvent.clientX/Y (浏览器窗口坐标)
 *   ↓ 减去 el.getBoundingClientRect()
 * Container X/Y (相对于 CanvasStage 左上角)
 * ```
 *
 * 用途：
 * - 框选框渲染（需要相对于 CanvasStage 的位置）
 * - 需要容器相对坐标的场景
 * - 作为 eventToWorld 的第一步
 *
 * @param e - 鼠标事件
 * @param el - DOM 容器元素（通常是 CanvasStage 根元素）
 * @returns 相对于容器左上角的坐标 { x, y }（单位：像素）
 *
 * @example
 * ```ts
 * // 框选框起点计算
 * const startPos = eventToContainer(e, stageEl);
 * boxSelectStart.value = startPos;
 * ```
 */
export function eventToContainer(e: MouseEvent, el: HTMLElement | null): { x: number; y: number } {
  // 非空检查：如果容器不存在，返回屏幕坐标作为兜底
  if (!el) {
    console.warn('[geometry] eventToContainer: el is null, fallback to clientX/Y');
    return { x: e.clientX, y: e.clientY };
  }

  const rect = el.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

/**
 * 【核心函数 2】将容器坐标转换为逻辑世界坐标
 *
 * 坐标系转换：Container -> World
 *
 * 处理：
 * - 视口缩放（viewport.zoom）
 * - 视口平移（viewport.offsetX / offsetY）
 *
 * @param viewport - 当前视口状态
 * @param containerX - 容器坐标 X（相对于 CanvasStage 左上角）
 * @param containerY - 容器坐标 Y
 * @returns 世界坐标 { x, y }（画布逻辑坐标）
 *
 * @example
 * ```ts
 * const containerPos = eventToContainer(e, stageEl);
 * const worldPos = containerToWorld(viewport, containerPos.x, containerPos.y);
 * node.transform.x = worldPos.x; // 设置节点位置
 * ```
 */
export function containerToWorld(
  viewport: ViewportState,
  containerX: number,
  containerY: number
): { x: number; y: number } {
  return {
    x: (containerX - viewport.offsetX) / viewport.zoom,
    y: (containerY - viewport.offsetY) / viewport.zoom,
  };
}

/**
 * 【核心函数 3】将鼠标事件直接转换为逻辑世界坐标（推荐使用）
 *
 * 坐标系转换：Screen -> Container -> World（组合转换）
 *
 * 这是最常用的转换函数，适用于所有需要计算节点位置的场景。
 *
 * 内部流程：
 * 1. 计算相对于容器的坐标（处理 DOM 偏移）
 * 2. 转换为世界坐标（处理 Zoom/Pan）
 *
 * @param e - 鼠标事件
 * @param el - DOM 容器元素
 * @param viewport - 当前视口状态
 * @returns 世界坐标 { x, y }（画布逻辑坐标）
 *
 * @example
 * ```ts
 * // 创建模式：鼠标位置作为图形左上角
 * const worldPos = eventToWorld(e, stageEl, viewport);
 * previewNode.transform.x = worldPos.x;
 * previewNode.transform.y = worldPos.y;
 *
 * // 旋转计算：鼠标相对于节点中心的角度
 * const worldPos = eventToWorld(e, stageEl, viewport);
 * const angle = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
 * ```
 */
export function eventToWorld(
  e: MouseEvent,
  el: HTMLElement | null,
  viewport: ViewportState
): { x: number; y: number } {
  const containerPos = eventToContainer(e, el);
  return containerToWorld(viewport, containerPos.x, containerPos.y);
}

/**
 * 【核心函数 4】将逻辑世界坐标转换为容器/屏幕坐标（逆向转换）
 *
 * 坐标系转换：World -> Container/Screen
 *
 * 用途：
 * - 将节点的逻辑位置转换为屏幕位置（用于渲染悬浮工具栏等）
 * - 计算世界坐标对应的屏幕像素位置
 *
 * @param viewport - 当前视口状态
 * @param worldX - 世界坐标 X
 * @param worldY - 世界坐标 Y
 * @param el - 可选：DOM 容器元素。如果提供，返回绝对屏幕坐标；否则返回容器相对坐标
 * @returns 容器坐标或屏幕坐标 { x, y }
 *
 * @example
 * ```ts
 * // 返回容器相对坐标（用于 CSS 定位）
 * const containerPos = worldToClient(viewport, node.x, node.y);
 * toolbarStyle.left = containerPos.x + 'px';
 *
 * // 返回绝对屏幕坐标
 * const screenPos = worldToClient(viewport, node.x, node.y, stageEl);
 * ```
 */
export function worldToClient(
  viewport: ViewportState,
  worldX: number,
  worldY: number,
  el?: HTMLElement | null
): { x: number; y: number } {
  // 先转换为容器坐标
  const containerX = worldX * viewport.zoom + viewport.offsetX;
  const containerY = worldY * viewport.zoom + viewport.offsetY;

  // 如果提供了容器元素，转换为绝对屏幕坐标
  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      x: containerX + rect.left,
      y: containerY + rect.top,
    };
  }

  // 否则返回容器相对坐标
  return { x: containerX, y: containerY };
}

/**
 * @deprecated 使用 eventToWorld 替代
 * 保留此函数仅为向后兼容，新代码请使用 eventToWorld
 */
export function clientToWorld(
  viewport: ViewportState,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  console.warn('[geometry] clientToWorld is deprecated, use eventToWorld instead');
  return containerToWorld(viewport, clientX, clientY);
}

// 判断矩形框内是否包含某元素
// TODO: 目前仅基于 AABB (Axis-Aligned Bounding Box) 进行判断，未考虑节点的旋转 (rotation) 属性。
// 后续需要引入 SAT (Separating Axis Theorem) 或将矩形点逆旋转后判断，以支持旋转后的精确框选。
/**
 * 判断节点是否在给定的矩形区域内 (碰撞检测)
 * @param maxRectWorldX 矩形区域最大 X (世界坐标)
 * @param maxRectWorldY 矩形区域最大 Y (世界坐标)
 * @param minRectWorldX 矩形区域最小 X (世界坐标)
 * @param minRectWorldY 矩形区域最小 Y (世界坐标)
 * @param baseNode 待检测的节点
 * @returns 是否相交
 */

/**
 * 判断旋转后的节点是否与目标矩形相交（基于周长采样）
 * @param maxRectWorldX 目标矩形世界坐标系最大X
 * @param maxRectWorldY 目标矩形世界坐标系最大Y
 * @param minRectWorldX 目标矩形世界坐标系最小X
 * @param minRectWorldY 目标矩形世界坐标系最小Y
 * @param baseNode 待判断的节点（支持旋转）
 * @param sampleDensity 采样密度（默认36个点，值越大越精准但性能略降，建议18-72）
 * @returns 是否相交
 */

/**
 * 精确 SAT 相交检测（接触不计为相交）
 * 支持：矩形（旋转）、圆、椭圆（旋转）
 */

/**
 * SAT算法：轴对齐选框 与 任意旋转矩形/任意旋转椭圆 的碰撞检测
 * 支持双方任意旋转角度，只要有相交（哪怕边缘接触）就返回true
 * @param maxRectWorldX 选框世界坐标最大X
 * @param maxRectWorldY 选框世界坐标最大Y
 * @param minRectWorldX 选框世界坐标最小X
 * @param minRectWorldY 选框世界坐标最小Y
 * @param baseNode 待判断节点（任意旋转的rect/image/text/group 或 任意旋转的circle/椭圆）
 * @returns 是否碰撞（相交/边缘接触）
 */

export function isNodeHitRectSAT(
  maxRectWorldX: number,
  maxRectWorldY: number,
  minRectWorldX: number,
  minRectWorldY: number,
  baseNode: BaseNodeState
): boolean {
  const { transform } = baseNode;
  const epsilon = 1e-9;

  // 1. 基础数据准备
  const rad = (transform.rotation * Math.PI) / 180;
  const rx = transform.width / 2;
  const ry = transform.height / 2;
  const centerB = { x: transform.x + rx, y: transform.y + ry };

  // AABB（选框）的四个世界坐标顶点
  const rectA = [
    { x: minRectWorldX, y: minRectWorldY },
    { x: maxRectWorldX, y: minRectWorldY },
    { x: maxRectWorldX, y: maxRectWorldY },
    { x: minRectWorldX, y: maxRectWorldY },
  ];

  const isEllipse = baseNode.type === 'circle';

  // ========================================================================
  // 分支 1：椭圆/圆形处理 (使用逆变换 + 单位圆检测)
  // ========================================================================
  if (isEllipse) {
    // 核心思路：将选框(RectA)变换到椭圆的"局部归一化空间"。
    // 在这个空间里，椭圆变成了圆心(0,0)、半径为1的单位圆。
    // 我们只需判断变换后的四边形是否与单位圆相交。

    const cos = Math.cos(-rad); // 逆旋转
    const sin = Math.sin(-rad);
    const safeRx = Math.abs(rx) < epsilon ? epsilon : rx;
    const safeRy = Math.abs(ry) < epsilon ? epsilon : ry;

    // 1. 变换顶点
    const localPoints = rectA.map((p) => {
      // 平移：相对于椭圆中心
      const tx = p.x - centerB.x;
      const ty = p.y - centerB.y;

      // 旋转：抵消椭圆的旋转
      const rotatedX = tx * cos - ty * sin;
      const rotatedY = tx * sin + ty * cos;

      // 缩放：归一化 (除以半轴长)
      return { x: rotatedX / safeRx, y: rotatedY / safeRy };
    });

    // 2. 检测 "变形后的四边形" vs "单位圆(0,0, r=1)"

    // 情况 A: 圆心 (0,0) 在四边形内部？(使用射线法/Winding Number)
    // 简单的交叉数算法
    let inside = false;
    for (let i = 0, j = localPoints.length - 1; i < localPoints.length; j = i++) {
      const pi = localPoints[i];
      const pj = localPoints[j];
      if (!pi || !pj) continue;
      const intersect =
        pi.y > 0 !== pj.y > 0 && 0 < ((pj.x - pi.x) * (0 - pi.y)) / (pj.y - pi.y) + pi.x;
      if (intersect) inside = !inside;
    }
    if (inside) return true;

    // 情况 B: 四边形的任意边是否穿过或接触单位圆？
    // 即：线段到原点的最短距离是否 <= 1
    for (let i = 0, j = localPoints.length - 1; i < localPoints.length; j = i++) {
      const p1 = localPoints[i];
      const p2 = localPoints[j];
      if (!p1 || !p2) continue;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      // 线段长度平方
      const len2 = dx * dx + dy * dy;

      // 如果点重合(len2=0)，直接算点到原点距离
      if (len2 < epsilon) {
        if (p1.x * p1.x + p1.y * p1.y <= 1 + epsilon) return true;
        continue;
      }

      // 计算投影参数 t，寻找线段上离原点最近的点 Q
      // 向量公式: t = - (P1 . (P2-P1)) / |P2-P1|^2
      let t = -(p1.x * dx + p1.y * dy) / len2;

      // 限制 t 在 [0, 1] 之间，确保点 Q 在线段上
      t = Math.max(0, Math.min(1, t));

      const closestX = p1.x + t * dx;
      const closestY = p1.y + t * dy;

      // 距离平方 <= 1 (半径平方)
      if (closestX * closestX + closestY * closestY <= 1 + epsilon) {
        return true;
      }
    }

    return false;
  }

  // ========================================================================
  // 分支 2：多边形处理 (使用 SAT 分离轴定理)
  // ========================================================================
  else {
    // 仅支持以下类型，其他类型直接返回 false
    // ✅ 增加对 group 的支持：组合在几何上可以视为一个矩形包围盒
    const isPolygon =
      baseNode.type === 'rect' ||
      baseNode.type === 'image' ||
      baseNode.type === 'text' ||
      baseNode.type === 'group';

    if (!isPolygon) return false;

    const axes: { x: number; y: number }[] = [];

    // 轴1-2：选框 (RectA) 的轴 (0° 和 90°)
    axes.push({ x: 1, y: 0 });
    axes.push({ x: 0, y: 1 });

    // 轴3-4：旋转矩形 (Node) 的轴
    const cosRad = Math.cos(rad);
    const sinRad = Math.sin(rad);
    axes.push({ x: cosRad, y: sinRad });
    axes.push({ x: -sinRad, y: cosRad });

    // 辅助函数：投影
    const projectPoints = (points: { x: number; y: number }[], axis: { x: number; y: number }) => {
      let min = Number.MAX_VALUE;
      let max = -Number.MAX_VALUE;
      for (const p of points) {
        const proj = p.x * axis.x + p.y * axis.y;
        if (proj < min) min = proj;
        if (proj > max) max = proj;
      }
      return { min, max };
    };

    // 辅助函数：计算旋转矩形的世界坐标顶点
    const getRotatedRectWorld = () => {
      // 本地坐标系下的4个角 (相对于中心)
      const local = [
        { x: -rx, y: -ry },
        { x: rx, y: -ry },
        { x: rx, y: ry },
        { x: -rx, y: ry },
      ];
      return local.map((p) => ({
        x: centerB.x + (p.x * cosRad - p.y * sinRad),
        y: centerB.y + (p.x * sinRad + p.y * cosRad),
      }));
    };

    const rectBWorld = getRotatedRectWorld();

    // 遍历所有轴
    for (const axis of axes) {
      const projA = projectPoints(rectA, axis);
      const projB = projectPoints(rectBWorld, axis);

      // 判断投影重叠
      // 使用 epsilon 宽松处理接触情况
      const isSeparated = projA.max < projB.min - epsilon || projB.max < projA.min - epsilon;

      if (isSeparated) {
        return false; // 只要有一个轴分离，就不相交
      }
    }

    return true; // 所有轴都重叠
  }
}

export interface ResizeResult {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * 矩形缩放计算（独立缩放宽高）
 * @param handle 缩放手柄位置 ('nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w')
 * @param dx 鼠标 X 轴位移
 * @param dy 鼠标 Y 轴位移
 * @param startWidth 初始宽度
 * @param startHeight 初始高度
 * @param startNodeX 初始 X 坐标
 * @param startNodeY 初始 Y 坐标
 * @returns 缩放后的尺寸和位置 {width, height, x, y}
 */
export function calculateRectResize(
  handle: ResizeHandle,
  dx: number,
  dy: number,
  startWidth: number,
  startHeight: number,
  startNodeX: number,
  startNodeY: number
): ResizeResult {
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

  return {
    width: newWidth,
    height: newHeight,
    x: newX,
    y: newY,
  };
}

/**
 * 圆形缩放计算
 * @description 角点 (nw, ne, sw, se) 进行等比缩放，边点 (n, s, w, e) 进行自由缩放（可变为椭圆）
 * @param handle 缩放手柄位置
 * @param dx 鼠标 X 轴位移
 * @param dy 鼠标 Y 轴位移
 * @param startWidth 初始宽度
 * @param startHeight 初始高度
 * @param startNodeX 初始 X 坐标
 * @param startNodeY 初始 Y 坐标
 * @returns 缩放后的尺寸和位置 {width, height, x, y}
 */
export function calculateCircleResize(
  handle: ResizeHandle,
  dx: number,
  dy: number,
  startWidth: number,
  startHeight: number,
  startNodeX: number,
  startNodeY: number
): ResizeResult {
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

  return {
    width: newWidth,
    height: newHeight,
    x: newX,
    y: newY,
  };
}

/**
 * 文本缩放计算（只改变容器大小，不改变字号）
 * @description 文本节点的缩放逻辑目前与矩形一致，仅改变包围盒大小
 * @param handle 缩放手柄位置
 * @param dx 鼠标 X 轴位移
 * @param dy 鼠标 Y 轴位移
 * @param startWidth 初始宽度
 * @param startHeight 初始高度
 * @param startNodeX 初始 X 坐标
 * @param startNodeY 初始 Y 坐标
 * @returns 缩放后的尺寸和位置 {width, height, x, y}
 */
export function calculateTextResize(
  handle: ResizeHandle,
  dx: number,
  dy: number,
  startWidth: number,
  startHeight: number,
  startNodeX: number,
  startNodeY: number
): ResizeResult {
  let newWidth = startWidth;
  let newHeight = startHeight;
  let newX = startNodeX;
  let newY = startNodeY;

  // 文本容器的缩放逻辑与矩形相同
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

  // 限制最小尺寸
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

  return {
    width: newWidth,
    height: newHeight,
    x: newX,
    y: newY,
  };
}

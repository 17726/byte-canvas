/**
 * @file geometry.ts
 * @description 几何计算工具库
 *
 * 本文件存放所有与几何计算相关的纯函数 (Pure Functions)。
 *
 * 特点：
 * 1. 无状态 (Stateless)：不依赖外部 Store 或类实例，输入确定则输出确定。
 * 2. 纯计算 (Pure Calculation)：仅进行数学运算，不涉及 DOM 操作或副作用。
 * 3. 通用性 (Generic)：可被 ToolManager、Renderers 或其他 Service 复用。
 *
 * 包含函数列表：
 * - calculateBounds: 计算一组节点的包围盒 (AABB)
 * - clientToWorld: 屏幕坐标转世界坐标
 * - worldToClient: 世界坐标转屏幕坐标
 * - isNodeInRect: 判断节点是否在矩形区域内 (碰撞检测)
 * - calculateRectResize: 计算矩形缩放后的位置和尺寸
 * - calculateCircleResize: 计算圆形缩放后的位置和尺寸
 * - calculateTextResize: 计算文本缩放后的位置和尺寸
 */

import type { BaseNodeState, ViewportState, NodeType } from '@/types/state';
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

// 屏幕坐标 → 画布世界坐标（考虑视口偏移和缩放）
/**
 * 将屏幕坐标转换为画布世界坐标
 * @param viewport 当前视口状态 (包含缩放和偏移)
 * @param clientX 鼠标事件的 clientX
 * @param clientY 鼠标事件的 clientY
 * @returns 转换后的世界坐标 {x, y}
 */
export function clientToWorld(
  viewport: ViewportState,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  return {
    x: (clientX - viewport.offsetX) / viewport.zoom, //clientX是相对于浏览器窗口的坐标，需要减去视口的偏移量，再除以缩放比例
    y: (clientY - viewport.offsetY) / viewport.zoom,
  };
}

// 画布世界坐标 → 屏幕坐标
/**
 * 将画布世界坐标转换为屏幕坐标
 * @param viewport 当前视口状态
 * @param worldX 世界坐标 X
 * @param worldY 世界坐标 Y
 * @returns 转换后的屏幕坐标 {x, y}
 */
export function worldToClient(
  viewport: ViewportState,
  worldX: number,
  worldY: number
): { x: number; y: number } {
  return {
    x: worldX * viewport.zoom + viewport.offsetX,
    y: worldY * viewport.zoom + viewport.offsetY,
  };
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

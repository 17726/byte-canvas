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

import type { BaseNodeState, ViewportState } from '@/types/state';
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
export function isNodeInRect(
  maxRectWorldX: number,
  maxRectWorldY: number,
  minRectWorldX: number,
  minRectWorldY: number,
  baseNode: BaseNodeState
) {
  // 1. 计算节点包围盒（基础：无旋转场景）
  const nodeX = baseNode.transform.x;
  const nodeY = baseNode.transform.y;
  const nodeW = baseNode.transform.width;
  const nodeH = baseNode.transform.height;
  const nodeMinX = nodeX;
  const nodeMaxX = nodeX + nodeW;
  const nodeMinY = nodeY;
  const nodeMaxY = nodeY + nodeH;

  // 2. 基础矩形交集判断（快速排斥：无交集直接返回false）
  const isOverlap =
    nodeMinX <= maxRectWorldX &&
    nodeMaxX >= minRectWorldX &&
    nodeMinY <= maxRectWorldY &&
    nodeMaxY >= minRectWorldY;

  if (!isOverlap) return false;

  // 3. 按节点类型细化判断
  switch (baseNode.type) {
    case 'rect':
    case 'image':
    case 'text':
    case 'group':
      // 矩形类节点（包括组合）：包围盒交集即判定为命中
      return true;

    case 'circle':
      // 区分正圆（圆）和非正圆（椭圆）处理
      if (baseNode.transform.width === baseNode.transform.height) {
        // 正圆：圆心+半径判断
        const cx = nodeX + nodeW / 2; // 圆心X
        const cy = nodeY + nodeH / 2; // 圆心Y
        const r = nodeW / 2; // 正圆半径（宽高相等，直接取一半）

        // 找到矩形上离圆心最近的点
        const closestX = Math.max(minRectWorldX, Math.min(cx, maxRectWorldX));
        const closestY = Math.max(minRectWorldY, Math.min(cy, maxRectWorldY));

        // 计算圆心到最近点的距离平方（避免开方提升性能）
        const dx = cx - closestX;
        const dy = cy - closestY;
        const distanceSq = dx * dx + dy * dy;

        // 距离≤半径平方 → 圆与矩形交集
        return distanceSq <= r * r;
      } else {
        // 椭圆：基于椭圆标准方程的精准判断
        const cx = nodeX + nodeW / 2; // 椭圆中心X
        const cy = nodeY + nodeH / 2; // 椭圆中心Y
        const rx = nodeW / 2; // 椭圆水平半轴（长/短轴）
        const ry = nodeH / 2; // 椭圆垂直半轴（长/短轴）

        // 步骤1：判断矩形内是否有点在椭圆内（取矩形关键点校验）
        // 矩形的四个顶点
        const rectPoints = [
          { x: minRectWorldX, y: minRectWorldY }, // 左上
          { x: maxRectWorldX, y: minRectWorldY }, // 右上
          { x: maxRectWorldX, y: maxRectWorldY }, // 右下
          { x: minRectWorldX, y: maxRectWorldY }, // 左下
          { x: (minRectWorldX + maxRectWorldX) / 2, y: minRectWorldY }, // 上中
          { x: (minRectWorldX + maxRectWorldX) / 2, y: maxRectWorldY }, // 下中
          { x: minRectWorldX, y: (minRectWorldY + maxRectWorldY) / 2 }, // 左中
          { x: maxRectWorldX, y: (minRectWorldY + maxRectWorldY) / 2 }, // 右中
        ];

        // 检查矩形关键点是否在椭圆内（满足椭圆方程则相交）
        const hasPointInEllipse = rectPoints.some((point) => {
          const dx = (point.x - cx) / rx;
          const dy = (point.y - cy) / ry;
          return dx * dx + dy * dy <= 1.001; // 加微小容差，避免浮点精度问题
        });
        if (hasPointInEllipse) return true;

        // 步骤2：判断椭圆边界是否与矩形边相交（补充校验，避免漏判）
        // 椭圆上下左右四个顶点是否在矩形内
        const ellipsePoints = [
          { x: cx, y: cy - ry }, // 上顶点
          { x: cx, y: cy + ry }, // 下顶点
          { x: cx - rx, y: cy }, // 左顶点
          { x: cx + rx, y: cy }, // 右顶点
        ];
        const hasEllipsePointInRect = ellipsePoints.some((point) => {
          return (
            point.x >= minRectWorldX &&
            point.x <= maxRectWorldX &&
            point.y >= minRectWorldY &&
            point.y <= maxRectWorldY
          );
        });
        if (hasEllipsePointInRect) return true;

        // 步骤3：采样椭圆边界点，检查是否有点落在矩形内（补充更全面的交集判定）
        const ellipseSampleCount = 36; // 每10度采样一个点
        for (let i = 0; i < ellipseSampleCount; i++) {
          const theta = (2 * Math.PI * i) / ellipseSampleCount;
          const ex = cx + rx * Math.cos(theta);
          const ey = cy + ry * Math.sin(theta);
          if (
            ex >= minRectWorldX &&
            ex <= maxRectWorldX &&
            ey >= minRectWorldY &&
            ey <= maxRectWorldY
          ) {
            return true;
          }
        }

        // 步骤4：最后检查椭圆中心是否在矩形内（兜底）
        return (
          cx >= minRectWorldX && cx <= maxRectWorldX && cy >= minRectWorldY && cy <= maxRectWorldY
        );
      }

    default:
      // 未定义类型默认返回false
      return false;
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

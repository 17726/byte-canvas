// utils 来存放纯函数（Pure Functions），例如：
// 坐标转换：鼠标点击的屏幕坐标 (Screen X,Y) 转换成 画布内部坐标 (World X,Y)（需要减去偏移量、除以缩放比例）。
// 碰撞检测：判断鼠标点击的点是否在某个旋转后的矩形内部 (Hit Test)。
// 辅助计算：生成 UUID、深拷贝数据、计算两点距离等。
import type { BaseNodeState, ViewportState } from '@/types/state';

/**
 * 边界框类型
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

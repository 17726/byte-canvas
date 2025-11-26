// utils 来存放纯函数（Pure Functions），例如：
// 坐标转换：鼠标点击的屏幕坐标 (Screen X,Y) 转换成 画布内部坐标 (World X,Y)（需要减去偏移量、除以缩放比例）。
// 碰撞检测：判断鼠标点击的点是否在某个旋转后的矩形内部 (Hit Test)。
// 辅助计算：生成 UUID、深拷贝数据、计算两点距离等。
// utils 来存放纯函数（Pure Functions），例如：
// 坐标转换：鼠标点击的屏幕坐标 (Screen X,Y) 转换成 画布内部坐标 (World X,Y)（需要减去偏移量、除以缩放比例）。
// 碰撞检测：判断鼠标点击的点是否在某个旋转后的矩形内部 (Hit Test)。
// 辅助计算：生成 UUID、深拷贝数据、计算两点距离等。
import type { ViewportState } from '@/types/state';

// 屏幕坐标 → 画布世界坐标（考虑视口偏移和缩放）
export function clientToWorld(
  viewport: ViewportState,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  return {
    x: (clientX - viewport.offsetX) / viewport.zoom,//clientX是相对于浏览器窗口的坐标，需要减去视口的偏移量，再除以缩放比例
    y: (clientY - viewport.offsetY) / viewport.zoom
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
    y: worldY * viewport.zoom + viewport.offsetY
  };
}
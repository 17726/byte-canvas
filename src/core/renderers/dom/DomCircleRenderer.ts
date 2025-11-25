import type { CSSProperties } from 'vue';
import type { INodeRenderer } from '..';
import type { BaseNodeState, ShapeState } from '@/types/state';

/**
 * 【策略模式 - 具体策略】
 * 圆形 DOM 渲染器
 * * 职责：
 * 1. 专门处理圆形/椭圆的 DOM 渲染
 * 2. 确保圆形特性（border-radius: 50%）的正确应用
 * 3. 处理圆形特有的属性如半径、椭圆比例等
 */
export class DomCircleRenderer implements INodeRenderer<CSSProperties> {
  /**
   * 执行圆形渲染逻辑
   * @param node 基础节点数据
   */
  render(node: BaseNodeState): CSSProperties {
    // 类型断言，确保我们处理的是 ShapeState
    const shape = node as ShapeState;
    const { transform, style } = shape;

    // 2. 样式映射
    return {
      // --- 布局属性 ---
      position: 'absolute',
      // 应用位置偏移确保圆形居中
      left: `${transform.x}px`,
      top: `${transform.y}px`,
      width: `${transform.width}px`,
      height: `${transform.height}px`,
      // 处理旋转
      transform: `rotate(${transform.rotation}deg)`,

      // --- 圆形特有属性 ---
      // 强制设置为圆形
      borderRadius: '50%',

      // --- 外观属性 ---
      backgroundColor: style.backgroundColor,
      borderWidth: `${style.borderWidth}px`,
      borderStyle: style.borderStyle,
      borderColor: style.borderColor,
      opacity: style.opacity,
      zIndex: style.zIndex,

      // --- 交互属性 ---
      display: node.isVisible ? 'block' : 'none',
    };
  }
}
import type { CSSProperties } from 'vue';
import type { INodeRenderer } from '..';
import type { BaseNodeState, TextState } from '@/types/state';

/**
 * 【策略模式 - 具体策略】
 * 矩形/圆形 DOM 渲染器
 * * 职责：
 * 1. 充当“翻译官”：将 Store 中的几何数据 (x, y, color) 翻译成 Vue 能用的 CSS 样式。
 * 2. 实现数据解耦：Vue 组件不需要知道数据怎么变样式，只管应用这个样式。
 */
export class DomTextRenderer implements INodeRenderer<CSSProperties> {
  /**
   * 执行渲染逻辑
   * @param node 基础节点数据
   */
  render(node: BaseNodeState): CSSProperties {
    // 1. 类型断言 (Type Assertion)
    // 我们确信传入给 RectRenderer 的一定是 ShapeState，所以强制告诉 TS "相信我"
    // 这样我们才能访问 props.cornerRadius 等特有属性
    const shape = node as TextState;
    const { transform, style,props } = shape;
    // 2. 样式映射 (Mapping)
    return {
      // --- 布局属性 ---
      position: 'absolute',
      // 将逻辑坐标映射为 CSS 像素值
      left: `${transform.x}px`,
      top: `${transform.y}px`,
      width: `${transform.width}px`,
      height: `${transform.height}px`,
      // 处理旋转，注意单位是 deg
      transform: `rotate(${transform.rotation}deg)`,

      // --- 外观属性 ---
      backgroundColor: style.backgroundColor,
      borderWidth: `${style.borderWidth}px`,
      borderStyle: style.borderStyle,
      borderColor: style.borderColor,
      opacity: style.opacity,
      zIndex: style.zIndex,

      // 文本相关CSS变量
      '--text-content':props.content, //css不能设置文本内容只能设置样式 这里没用 后面开发编辑功能再改
      '--font-family':props.fontFamily,
      '--text-size': props.fontSize,
      '--font-weight':props.fontWeight,
      '--font-style':props.fontStyle,
      '--text-color': props.color || '#0000',
      '--line-height': 1.6,
      '--text-scale': 1

      // --- 交互属性 ---
      // 这里的 display 控制显隐
      // display: node.isVisible ? 'block' : 'none',
    };
  }
}

import type { NodeState, ImageState } from '@/types/state';
import type { CSSProperties } from 'vue';
import type { INodeRenderer } from '..';

/**
 * 【策略模式 - 具体策略】
 * 图片 DOM 渲染器
 * * 职责：
 * 1. 将 Store 中的图片数据和几何数据翻译成 Vue 能用的 CSS 样式
 * 2. 处理图片的基础布局和外观样式，滤镜效果由组件内部处理
 */
export class DomImageRenderer implements INodeRenderer<CSSProperties> {
  /**
   * 执行渲染逻辑
   * @param node 基础节点数据
   */
  render(node: NodeState): CSSProperties {
    // NOTE: 类型断言：确信传入给 ImageRenderer 的一定是 ImageState
    const image = node as ImageState;
    const { transform, style } = image;

    // 样式映射
    return {
      // --- 布局属性 ---
      position: 'absolute',
      // NOTE: 将逻辑坐标映射为 CSS 像素值
      left: `${transform.x}px`,
      top: `${transform.y}px`,
      width: `${transform.width}px`,
      height: `${transform.height}px`,
      // NOTE: 处理旋转，注意单位是 deg
      transform: `rotate(${transform.rotation}deg)`,

      // --- 外观属性 ---
      backgroundColor: style.backgroundColor,
      borderWidth: `${style.borderWidth}px`,
      borderStyle: style.borderStyle,
      borderColor: style.borderColor,
      opacity: style.opacity,
      zIndex: style.zIndex,

      // --- 图片容器特有属性 ---
      // NOTE: 确保图片内容不会溢出容器
      overflow: 'hidden',
      // NOTE: 使用 flex 布局确保图片居中 同时兼顾显隐控制
      display: node.isVisible ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
    };
  }
}

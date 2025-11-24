import type { CSSProperties } from 'vue';
import type { INodeRenderer } from '../index';
import type { BaseNodeState } from '@/types/state';

/**
 * 矩形 DOM 渲染器
 * 职责：将节点状态转换为 CSS 样式
 */
export class DomRectRenderer implements INodeRenderer<CSSProperties> {
  render(node: BaseNodeState): CSSProperties {
    const { transform, style } = node;
    return {
      position: 'absolute',
      left: `${transform.x}px`,
      top: `${transform.y}px`,
      width: `${transform.width}px`,
      height: `${transform.height}px`,
      transform: `rotate(${transform.rotation}deg)`,
      backgroundColor: style.backgroundColor,
      borderWidth: `${style.borderWidth}px`,
      borderStyle: style.borderStyle,
      borderColor: style.borderColor,
      opacity: style.opacity,
      zIndex: style.zIndex,
      display: node.isVisible ? 'block' : 'none',
    };
  }
}

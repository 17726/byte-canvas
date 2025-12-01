import type { INodeRenderer } from '..';
import type { TextState } from '@/types/state';

/**
 * 【策略模式 - 具体策略】
 * 文本 DOM 渲染器
 * * 职责：
 * 1. 充当“翻译官”：将 Store 中的几何数据 (x, y, color) 翻译成 Vue 能用的 CSS 样式。
 * 2. 实现数据解耦：Vue 组件不需要知道数据怎么变样式，只管应用这个样式。
 */
export class DomTextRenderer implements INodeRenderer<string> {
  /**
   * 执行渲染逻辑
   * @param node 基础节点数据
   */
  render(node: TextState): string {
    const { content, inlineStyles = [], ...globalStyles } = node.props;
    if (!content) return '';

    // 基础HTML（无样式）
    let html = content;

    // 应用部分文本样式（按范围包裹span）
    inlineStyles.forEach(({ start, end, styles }) => {
      if (start >= end || start >= content.length) return;

      // 截取样式范围内的文本
      const styledText = content.slice(start, end);
      // 生成样式字符串
      const styleStr = Object.entries(styles).map(([key, value]) => {
        switch (key) {
          case 'fontWeight': return `font-weight: ${value}`;
          case 'fontStyle': return `font-style: ${value}`;
          case 'fontFamily': return `font-family: ${value}`;
          case 'fontSize': return `font-size: ${value}px`;
          case 'color': return `color: ${value}`;
          case 'underline': return `text-decoration: ${value ? 'underline' : 'none'}`;
          case 'strikethrough': return `text-decoration: ${value ? 'line-through' : 'none'}`;
          default: return '';
        }
      }).filter(Boolean).join('; ');

      // 替换范围内文本为带样式的span
      html = html.slice(0, start) +
             `<span style="${styleStr}">${styledText}</span>` +
             html.slice(end);
    });

    // 应用全局样式（包裹整个内容）
    const globalStyleStr = Object.entries(globalStyles).map(([key, value]) => {
      switch (key) {
        case 'fontWeight': return `font-weight: ${value}`;
        case 'fontStyle': return `font-style: ${value}`;
        case 'fontFamily': return `font-family: ${value}`;
        case 'fontSize': return `font-size: ${value}px`;
        case 'color': return `color: ${value}`;
        case 'underline': return `text-decoration: ${value ? 'underline' : 'none'}`;
        case 'strikethrough': return `text-decoration: ${value ? 'line-through' : 'none'}`;
        default: return '';
      }
    }).filter(Boolean).join('; ');

    return `<div style="${globalStyleStr}">${html}</div>`;
  }
}

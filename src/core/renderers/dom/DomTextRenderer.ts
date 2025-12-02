import type { INodeRenderer } from '..';
import type { TextState } from '@/types/state';

export class DomTextRenderer implements INodeRenderer<string> {
  render(node: TextState): string {
    const { content, inlineStyles = [], ...globalStyles } = node.props;
    if (!content) return '<span>&nbsp;</span>'; // 空内容返回占位

    if (inlineStyles.length === 0) {
      // 处理全局颜色（如果有）
      const globalStyleStr = this.convertStylesToCss(globalStyles);
      return globalStyleStr
        ? `<span style="${globalStyleStr}">${this.escapeHtml(content)}</span>`
        : this.escapeHtml(content);
    }

    const groupedStyles = this.groupStylesByRange(inlineStyles);
    const splitPoints = new Set<number>([0, content.length]);
    groupedStyles.forEach(style => {
      splitPoints.add(style.start!);
      splitPoints.add(style.end!);
    });
    const sortedSplitPoints = Array.from(splitPoints).sort((a, b) => a - b);

    let html = '';
    for (let i = 0; i < sortedSplitPoints.length - 1; i++) {
      const start = sortedSplitPoints[i];
      const end = sortedSplitPoints[i + 1];
      if (start! >= end!) continue;

      const textFragment = this.escapeHtml(content.slice(start, end));
      const matchedStyles = groupedStyles.filter(style => {
        return style.start! <= start! && style.end! >= end!;
      });

      if (matchedStyles.length > 0) {
        const combinedStyle = matchedStyles.reduce((acc, cur) => {
          return { ...acc, ...cur.combinedStyles };
        }, {});

        // 转换样式（包含颜色的显式处理）
        const styleStr = this.convertStylesToCss(combinedStyle);

        html += `<span style="${styleStr}">${textFragment}</span>`;
      } else {
        html += textFragment;
      }
    }

    return html;
  }

  // 核心修改：显式处理颜色属性，添加合法性校验
  private convertStylesToCss(styles: Record<string, unknown>): string {
    const cssEntries: string[] = [];
    const textDecorations: string[] = [];

    Object.entries(styles).forEach(([key, value]) => {
      // 跳过无效值（undefined/null/false/空字符串）
      if (value === undefined || value === null || value === false || value === '') return;

      switch (key) {
        // 显式处理颜色属性（确保不被遗漏）
        case 'color':
          // 颜色值合法性校验（支持 #xxx、#xxxxxx、rgb、rgba）
          const colorRegex = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-1](\.\d+)?\s*\))$/;
          if (colorRegex.test(value as string) || value === 'transparent') {
            cssEntries.push(`color:${value}`);
          } else {
            console.warn(`无效的颜色值：${value}，已忽略`);
          }
          break;
        // 下划线处理
        case 'underline':
          if (value) textDecorations.push('underline');
          break;
        // 删除线处理
        case 'strikethrough':
          if (value) textDecorations.push('line-through');
          break;
        // 其他样式（保持驼峰转连字符）
        default:
          const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
          cssEntries.push(`${cssKey}:${value}`);
          break;
      }
    });

    // 合并 text-decoration
    if (textDecorations.length > 0) {
      cssEntries.push(`text-decoration:${textDecorations.join(' ')}`);
    }

    // 避免空 style 属性
    return cssEntries.join('; ') || 'visibility: inherit';
  }

  // 原有方法保持不变
  groupStylesByRange = (styles: Array<{
    start: number;
    end: number;
    styles: Record<string, unknown>;
  }>) => {
    const rangeMap = new Map<string, Record<string, unknown>>();
    styles.forEach(style => {
      const key = `${style.start}-${style.end}`;
      // 合并样式时，后添加的颜色会覆盖先添加的（符合 CSS 优先级）
      rangeMap.set(key, { ...rangeMap.get(key), ...style.styles });
    });
    return Array.from(rangeMap.entries()).map(([key, combinedStyles]) => {
      const [start, end] = key.split('-').map(Number);
      return { start, end, combinedStyles };
    });
  };

  escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
}
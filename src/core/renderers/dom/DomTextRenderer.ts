import type { INodeRenderer } from '..';
import type { TextState } from '@/types/state';

export class DomTextRenderer implements INodeRenderer<string> {
  render(node: TextState): string {
    const { content, inlineStyles = [], ...globalStyles } = node.props;

    // 空内容返回占位（保持原有逻辑）
    if (!content) return '<span>&nbsp;</span>';

    // 核心：先按\n拆分整个内容为片段数组（空字符串对应连续的\n）
    const newlineFragments = content.split('\n');
    let finalHtml = '';

    // 无行内样式：按\n拆分后，每个文本段单独包span，\n转为span外的<br>
    if (inlineStyles.length === 0) {
      const globalStyleStr = this.convertStylesToCss(globalStyles);
      const spanTemplate = (text: string) =>
        globalStyleStr ? `<span style="${globalStyleStr}">${text}</span>` : `<span>${text}</span>`; // 无样式也包span，保持结构统一

      newlineFragments.forEach((fragment, index) => {
        // 处理文本片段（转义HTML）
        const escapedFragment = fragment ? this.escapeHtml(fragment) : '';

        // 非空片段：包span
        if (escapedFragment) {
          finalHtml += spanTemplate(escapedFragment);
        }

        // 不是最后一个片段：添加span外的<br>（对应\n）
        if (index < newlineFragments.length - 1) {
          finalHtml += '<br>';
        }
      });

      return finalHtml;
    }

    // 有行内样式：先按\n拆分，再对每个文本段应用行内样式，\n转为span外的<br>
    // 1. 预处理行内样式：分组+获取拆分点
    const groupedStyles = this.groupStylesByRange(inlineStyles);
    const splitPoints = new Set<number>([0, content.length]);
    groupedStyles.forEach((style) => {
      splitPoints.add(style.start!);
      splitPoints.add(style.end!);
    });
    const sortedSplitPoints = Array.from(splitPoints).sort((a, b) => a - b);

    // 2. 遍历按\n拆分的片段，逐个处理
    let contentCursor = 0; // 记录当前处理到content的位置
    newlineFragments.forEach((newlineFragment, fragIndex) => {
      const fragLength = newlineFragment.length;
      const fragEnd = contentCursor + fragLength;

      // 处理当前\n分隔的文本段（可能包含行内样式拆分点）
      if (fragLength > 0) {
        let segmentHtml = '';
        // 遍历行内样式拆分点，处理当前文本段内的样式
        for (let i = 0; i < sortedSplitPoints.length - 1; i++) {
          const start = sortedSplitPoints[i];
          const end = sortedSplitPoints[i + 1];
          if (start! >= end!) continue;

          const overlapStart = Math.max(start!, contentCursor);
          const overlapEnd = Math.min(end!, fragEnd);
          if (overlapStart >= overlapEnd) continue;

          // 提取当前子片段的文本
          const textSubFragment = content.slice(overlapStart, overlapEnd);
          const escapedSubFragment = this.escapeHtml(textSubFragment);

          // 匹配当前子片段的样式（全局+行内）
          const matchedStyles = groupedStyles.filter((style) => {
            return style.start! <= overlapStart && style.end! >= overlapEnd;
          });
          const baseStyle = { ...globalStyles };
          const finalStyleObj = matchedStyles.reduce((acc, cur) => {
            return { ...acc, ...cur.combinedStyles };
          }, baseStyle);
          const finalStyleStr = this.convertStylesToCss(finalStyleObj);

          // 拼接带样式的span
          segmentHtml += `<span style="${finalStyleStr}">${escapedSubFragment}</span>`;
        }
        finalHtml += segmentHtml;
      }

      // 3. 不是最后一个\n片段：添加span外的<br>
      if (fragIndex < newlineFragments.length - 1) {
        finalHtml += '<br>';
      }

      // 更新游标到下一个\n片段的起始位置
      contentCursor = fragEnd + 1; // +1 跳过当前的\n
    });

    return finalHtml;
  }

  // 保留原有convertStylesToCss（仅补充注释，逻辑不变）
  private convertStylesToCss(styles: Record<string, unknown>): string {
    const cssEntries: string[] = [];
    const textDecorations: string[] = [];

    Object.entries(styles).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false || value === '') return;

      switch (key) {
        case 'color':
          cssEntries.push(`color:${value}`);
          break;
        case 'fontSize':
          cssEntries.push(`font-size:${value}px`);
          break;
        case 'textDecoration':
          if (value) textDecorations.push(value as string);
          break;
        default:
          const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
          cssEntries.push(`${cssKey}:${value}`);
          break;
      }
    });

    if (textDecorations.length > 0) {
      cssEntries.push(`text-decoration:${textDecorations.join(' ')}`);
    }

    return cssEntries.join('; ') || 'visibility: inherit';
  }

  // 保留原有groupStylesByRange（逻辑不变）
  groupStylesByRange = (
    styles: Array<{
      start: number;
      end: number;
      styles: Record<string, unknown>;
    }>
  ) => {
    const rangeMap = new Map<string, Record<string, unknown>>();
    styles.forEach((style) => {
      const key = `${style.start}-${style.end}`;
      const existingStyles = rangeMap.get(key) || {};
      const mergedStyles = { ...existingStyles };

      Object.entries(style.styles).forEach(([prop, value]) => {
        if (prop === 'textDecoration' && value) {
          const existingValue = existingStyles.textDecoration as string | undefined;
          const existingValues = existingValue ? existingValue.split(/\s+/) : [];
          const currentValues = (value as string).split(/\s+/);
          const combinedValues = Array.from(new Set([...existingValues, ...currentValues]));
          mergedStyles.textDecoration = combinedValues.join(' ');
        } else {
          mergedStyles[prop] = value;
        }
      });

      rangeMap.set(key, mergedStyles);
    });

    return Array.from(rangeMap.entries()).map(([key, combinedStyles]) => {
      const [start, end] = key.split('-').map(Number);
      return { start, end, combinedStyles };
    });
  };

  // 保留原有escapeHtml（逻辑不变）
  escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
}

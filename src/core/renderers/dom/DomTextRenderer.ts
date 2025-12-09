import type { INodeRenderer } from '..';
import type { TextState } from '@/types/state';

export class DomTextRenderer implements INodeRenderer<string> {
  render(node: TextState): string {
    const { content, inlineStyles = [], ...globalStyles } = node.props;
    if (!content) return '<span>&nbsp;</span>'; // 空内容返回占位

    // 无行内样式：直接处理全局样式（原有逻辑，已包含CSS转换）
    if (inlineStyles.length === 0) {
      // 全局样式 → CSS 转换（关键步骤）
      const globalStyleStr = this.convertStylesToCss(globalStyles);

      // 处理换行符，将 \n 转换为 <br>
      const escapedContent = this.escapeHtml(content).replace(/\n/g, '<br>');

      return globalStyleStr
        ? `<span style="${globalStyleStr}">${escapedContent}</span>`
        : escapedContent;
    }

    // 有行内样式：先分组行内样式
    const groupedStyles = this.groupStylesByRange(inlineStyles);
    const splitPoints = new Set<number>([0, content.length]);
    groupedStyles.forEach((style) => {
      splitPoints.add(style.start!);
      splitPoints.add(style.end!);
    });
    const sortedSplitPoints = Array.from(splitPoints).sort((a, b) => a - b);

    let html = '';
    for (let i = 0; i < sortedSplitPoints.length - 1; i++) {
      const start = sortedSplitPoints[i];
      const end = sortedSplitPoints[i + 1];
      if (start! >= end!) continue;

      // 获取当前片段的文本内容
      const textFragment = content.slice(start, end);

      // 检查是否包含换行符
      if (textFragment === '\n') {
        html += '<br>'; // 将换行符渲染为 <br>
        continue;
      }

      // 转义 HTML 内容
      const escapedFragment = this.escapeHtml(textFragment);

      // 获取匹配的行内样式
      const matchedStyles = groupedStyles.filter((style) => {
        return style.start! <= start! && style.end! >= end!;
      });

      // 步骤1：以全局样式为基础（JS对象）
      const baseStyle = { ...globalStyles };

      // 步骤2：合并行内样式（行内覆盖全局）
      const finalStyleObj = matchedStyles.reduce((acc, cur) => {
        return { ...acc, ...cur.combinedStyles };
      }, baseStyle);

      // 步骤3：核心！将「全局+行内」的合并样式对象 → 转换为CSS字符串
      const finalStyleStr = this.convertStylesToCss(finalStyleObj);

      // 步骤4：拼接带CSS样式的span
      html += `<span style="${finalStyleStr}">${escapedFragment}</span>`;
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
          cssEntries.push(`color:${value}`);
          break;
        //显式处理字号
        case 'fontSize':
          cssEntries.push(`font-size:${value}px`);
          break;
        // 下划线、删除线处理
        case 'textDecoration':
          if (value) textDecorations.push(value as string);
          //console.log('!!!!!!!!push了 textDecorations=', textDecorations);
          break;
        // 其他样式（保持驼峰转连字符）
        default:
          const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
          cssEntries.push(`${cssKey}:${value}`);
          //console.log('push了', cssKey, ':', value);
          break;
      }
    });

    // 合并 text-decoration
    if (textDecorations.length > 0) {
      // console.log(`text-decoration:${textDecorations.join(' ')}`);
      cssEntries.push(`text-decoration:${textDecorations.join(' ')}`);
    }

    // 避免空 style 属性
    return cssEntries.join('; ') || 'visibility: inherit';
  }

  // 重点修复：合并同一范围的textDecoration多值，而非覆盖
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
      // 新：合并样式（特殊处理textDecoration）
      const mergedStyles = { ...existingStyles };

      // 遍历当前样式的每一个属性
      Object.entries(style.styles).forEach(([prop, value]) => {
        if (prop === 'textDecoration' && value) {
          // 1. 处理textDecoration：合并多值（去重）
          const existingValue = existingStyles.textDecoration as string | undefined;
          // 拆分已有值和当前值为数组，去重后合并
          const existingValues = existingValue ? existingValue.split(/\s+/) : [];
          const currentValues = (value as string).split(/\s+/);
          // 合并并去重（避免重复值，如多次添加underline）
          const combinedValues = Array.from(new Set([...existingValues, ...currentValues]));
          mergedStyles.textDecoration = combinedValues.join(' ');
        } else {
          // 2. 其他样式：保持覆盖逻辑（后添加的优先级更高）
          mergedStyles[prop] = value;
        }
      });

      // 更新map：存入合并后的样式
      rangeMap.set(key, mergedStyles);
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

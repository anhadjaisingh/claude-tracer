import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ToolRendererConfig } from '../tool-renderer';

function extractFilePath(input: unknown): string {
  if (input && typeof input === 'object' && 'file_path' in input) {
    return String((input as Record<string, unknown>).file_path);
  }
  return JSON.stringify(input).slice(0, 100);
}

function extractContent(input: unknown): string {
  if (input && typeof input === 'object' && 'content' in input) {
    return String((input as Record<string, unknown>).content);
  }
  return '';
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

export const writeRenderer: ToolRendererConfig = {
  icon: '\u270F\uFE0F',

  headerSummary(input: unknown): string {
    const filePath = extractFilePath(input);
    const content = extractContent(input);
    const lineCount = countLines(content);
    return `${filePath} (${String(lineCount)} lines)`;
  },

  preview(input: unknown): ReactNode {
    const filePath = extractFilePath(input);
    const content = extractContent(input);
    const lineCount = countLines(content);
    const previewLines = content.split('\n').slice(0, 3).join('\n');
    return createElement(
      'div',
      { className: 'text-xs' },
      createElement(
        'div',
        { className: 'opacity-80 font-mono mb-1' },
        `${filePath} `,
        createElement('span', { className: 'opacity-60' }, `(${String(lineCount)} lines)`),
      ),
      createElement('pre', { className: 'whitespace-pre-wrap opacity-60 text-xs' }, previewLines),
    );
  },

  fullContent(input: unknown, output: unknown): ReactNode {
    const filePath = extractFilePath(input);
    const content = extractContent(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return createElement(
      'div',
      null,
      createElement('div', { className: 'mb-2 font-mono text-xs opacity-80' }, filePath),
      createElement(
        'div',
        { className: 'mb-2' },
        createElement('div', { className: 'opacity-60 mb-1' }, 'Content:'),
        createElement(
          'pre',
          { className: 'whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto text-xs' },
          content,
        ),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'opacity-60 mb-1' }, 'Result:'),
        createElement(
          'pre',
          { className: 'whitespace-pre-wrap overflow-x-auto text-xs' },
          outputStr,
        ),
      ),
    );
  },
};

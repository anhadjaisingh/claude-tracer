import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ToolRendererConfig } from '../tool-renderer';

function truncateJson(value: unknown, maxLength: number): string {
  const str = JSON.stringify(value);
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + '...';
}

export const genericRenderer: ToolRendererConfig = {
  icon: '*',

  headerSummary(input: unknown): string {
    return truncateJson(input, 80);
  },

  preview(input: unknown): ReactNode {
    const preview = truncateJson(input, 200);
    return createElement('pre', { className: 'whitespace-pre-wrap text-xs opacity-80' }, preview);
  },

  fullContent(input: unknown, output: unknown): ReactNode {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return createElement(
      'div',
      null,
      createElement(
        'div',
        { className: 'mb-2' },
        createElement('div', { className: 'opacity-60 mb-1' }, 'Input:'),
        createElement(
          'pre',
          { className: 'whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto text-xs' },
          inputStr,
        ),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'opacity-60 mb-1' }, 'Output:'),
        createElement(
          'pre',
          { className: 'whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto text-xs' },
          outputStr,
        ),
      ),
    );
  },
};

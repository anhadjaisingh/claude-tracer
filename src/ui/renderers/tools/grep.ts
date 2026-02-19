import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ToolRendererConfig } from '../tool-renderer';

function extractPattern(input: unknown): string {
  if (input && typeof input === 'object' && 'pattern' in input) {
    return String((input as Record<string, unknown>).pattern);
  }
  return JSON.stringify(input).slice(0, 100);
}

function extractPath(input: unknown): string {
  if (input && typeof input === 'object' && 'path' in input) {
    return String((input as Record<string, unknown>).path);
  }
  return '';
}

function extractGlob(input: unknown): string {
  if (input && typeof input === 'object' && 'glob' in input) {
    return String((input as Record<string, unknown>).glob);
  }
  return '';
}

function extractResultCount(output: unknown): number {
  if (typeof output === 'string') {
    return output.split('\n').filter((line) => line.trim().length > 0).length;
  }
  return 0;
}

export const grepRenderer: ToolRendererConfig = {
  icon: '\u{1F50E}',

  headerSummary(input: unknown, output: unknown): string {
    const pattern = extractPattern(input);
    const searchPath = extractPath(input);
    const count = extractResultCount(output);
    const pathSuffix = searchPath ? ` in ${searchPath}` : '';
    return `/${pattern}/${pathSuffix} (${String(count)} results)`;
  },

  preview(input: unknown, output: unknown): ReactNode {
    const pattern = extractPattern(input);
    const searchPath = extractPath(input);
    const glob = extractGlob(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    const previewLines = outputStr.split('\n').slice(0, 3).join('\n');
    return createElement(
      'div',
      { className: 'text-xs' },
      createElement(
        'div',
        { className: 'opacity-80 font-mono mb-1' },
        `/${pattern}/`,
        searchPath ? createElement('span', { className: 'opacity-60 ml-2' }, searchPath) : null,
        glob ? createElement('span', { className: 'opacity-60 ml-2' }, `[${glob}]`) : null,
      ),
      createElement('pre', { className: 'whitespace-pre-wrap opacity-60 text-xs' }, previewLines),
    );
  },

  fullContent(input: unknown, output: unknown): ReactNode {
    const pattern = extractPattern(input);
    const searchPath = extractPath(input);
    const glob = extractGlob(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return createElement(
      'div',
      null,
      createElement(
        'div',
        { className: 'mb-2 font-mono text-xs' },
        createElement('span', { className: 'opacity-80' }, `Pattern: /${pattern}/`),
        searchPath
          ? createElement('span', { className: 'opacity-60 ml-2' }, `in ${searchPath}`)
          : null,
        glob ? createElement('span', { className: 'opacity-60 ml-2' }, `[${glob}]`) : null,
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'opacity-60 mb-1' }, 'Results:'),
        createElement(
          'pre',
          { className: 'whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto text-xs' },
          outputStr,
        ),
      ),
    );
  },
};

import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ToolRendererConfig } from '../tool-renderer';

function extractFilePath(input: unknown): string {
  if (input && typeof input === 'object' && 'file_path' in input) {
    return String((input as Record<string, unknown>).file_path);
  }
  return JSON.stringify(input).slice(0, 100);
}

function extractOldString(input: unknown): string {
  if (input && typeof input === 'object' && 'old_string' in input) {
    return String((input as Record<string, unknown>).old_string);
  }
  return '';
}

function extractNewString(input: unknown): string {
  if (input && typeof input === 'object' && 'new_string' in input) {
    return String((input as Record<string, unknown>).new_string);
  }
  return '';
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export const editRenderer: ToolRendererConfig = {
  icon: '\u{1F527}',

  headerSummary(input: unknown): string {
    const filePath = extractFilePath(input);
    const oldStr = extractOldString(input);
    const newStr = extractNewString(input);
    const oldSnippet = truncate(oldStr.split('\n')[0] ?? '', 30);
    const newSnippet = truncate(newStr.split('\n')[0] ?? '', 30);
    return `${filePath} "${oldSnippet}" -> "${newSnippet}"`;
  },

  preview(input: unknown): ReactNode {
    const filePath = extractFilePath(input);
    const oldStr = extractOldString(input);
    const newStr = extractNewString(input);
    return createElement(
      'div',
      { className: 'text-xs' },
      createElement('div', { className: 'opacity-80 font-mono mb-1' }, filePath),
      createElement(
        'div',
        { className: 'flex gap-2' },
        createElement(
          'span',
          { className: 'text-red-400 line-through opacity-70' },
          truncate(oldStr, 60),
        ),
        createElement('span', { className: 'opacity-40' }, '\u2192'),
        createElement('span', { className: 'text-green-400 opacity-70' }, truncate(newStr, 60)),
      ),
    );
  },

  fullContent(input: unknown, output: unknown): ReactNode {
    const filePath = extractFilePath(input);
    const oldStr = extractOldString(input);
    const newStr = extractNewString(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return createElement(
      'div',
      null,
      createElement('div', { className: 'mb-2 font-mono text-xs opacity-80' }, filePath),
      createElement(
        'div',
        { className: 'mb-2' },
        createElement('div', { className: 'opacity-60 mb-1 text-red-400' }, 'Old:'),
        createElement(
          'pre',
          {
            className:
              'whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto text-xs bg-red-900/20 p-2 rounded',
          },
          oldStr,
        ),
      ),
      createElement(
        'div',
        { className: 'mb-2' },
        createElement('div', { className: 'opacity-60 mb-1 text-green-400' }, 'New:'),
        createElement(
          'pre',
          {
            className:
              'whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto text-xs bg-green-900/20 p-2 rounded',
          },
          newStr,
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

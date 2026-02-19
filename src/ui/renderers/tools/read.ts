import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ToolRendererConfig } from '../tool-renderer';

function extractFilePath(input: unknown): string {
  if (input && typeof input === 'object' && 'file_path' in input) {
    return String((input as Record<string, unknown>).file_path);
  }
  return JSON.stringify(input).slice(0, 100);
}

function extractLineInfo(input: unknown): string {
  if (input && typeof input === 'object') {
    const rec = input as Record<string, unknown>;
    const parts: string[] = [];
    if ('offset' in rec) {
      parts.push(`offset: ${String(rec.offset)}`);
    }
    if ('limit' in rec) {
      parts.push(`limit: ${String(rec.limit)}`);
    }
    return parts.join(', ');
  }
  return '';
}

export const readRenderer: ToolRendererConfig = {
  icon: '\u{1F4C4}',

  headerSummary(input: unknown): string {
    const filePath = extractFilePath(input);
    const lineInfo = extractLineInfo(input);
    return lineInfo ? `${filePath} (${lineInfo})` : filePath;
  },

  preview(input: unknown, output: unknown): ReactNode {
    const filePath = extractFilePath(input);
    const lineInfo = extractLineInfo(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    const previewLines = outputStr.split('\n').slice(0, 3).join('\n');
    return createElement(
      'div',
      { className: 'text-xs' },
      createElement(
        'div',
        { className: 'opacity-80 font-mono mb-1' },
        filePath,
        lineInfo ? createElement('span', { className: 'opacity-60 ml-2' }, `(${lineInfo})`) : null,
      ),
      createElement('pre', { className: 'whitespace-pre-wrap opacity-60 text-xs' }, previewLines),
    );
  },

  fullContent(input: unknown, output: unknown): ReactNode {
    const filePath = extractFilePath(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return createElement(
      'div',
      null,
      createElement('div', { className: 'mb-2 font-mono text-xs opacity-80' }, filePath),
      createElement(
        'div',
        null,
        createElement('div', { className: 'opacity-60 mb-1' }, 'Contents:'),
        createElement(
          'pre',
          { className: 'whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto text-xs' },
          outputStr,
        ),
      ),
    );
  },
};

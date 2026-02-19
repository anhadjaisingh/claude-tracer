import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ToolRendererConfig } from '../tool-renderer';

function extractCommand(input: unknown): string {
  if (input && typeof input === 'object' && 'command' in input) {
    return String((input as Record<string, unknown>).command);
  }
  return JSON.stringify(input).slice(0, 100);
}

function extractDescription(input: unknown): string {
  if (input && typeof input === 'object' && 'description' in input) {
    return String((input as Record<string, unknown>).description);
  }
  return '';
}

function firstLine(text: string): string {
  const line = text.split('\n')[0] ?? '';
  return line.length > 100 ? line.slice(0, 100) + '...' : line;
}

export const bashRenderer: ToolRendererConfig = {
  icon: '$',

  headerSummary(input: unknown): string {
    const cmd = extractCommand(input);
    return firstLine(cmd);
  },

  preview(input: unknown): ReactNode {
    const cmd = extractCommand(input);
    const desc = extractDescription(input);
    const lines = cmd.split('\n').slice(0, 3).join('\n');
    return createElement(
      'div',
      { className: 'text-xs' },
      desc ? createElement('div', { className: 'opacity-60 mb-1 italic' }, desc) : null,
      createElement('pre', { className: 'whitespace-pre-wrap opacity-80 font-mono' }, lines),
    );
  },

  fullContent(input: unknown, output: unknown): ReactNode {
    const cmd = extractCommand(input);
    const desc = extractDescription(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return createElement(
      'div',
      null,
      desc ? createElement('div', { className: 'opacity-60 mb-2 italic text-xs' }, desc) : null,
      createElement(
        'div',
        { className: 'mb-2' },
        createElement('div', { className: 'opacity-60 mb-1' }, 'Command:'),
        createElement(
          'pre',
          { className: 'whitespace-pre-wrap overflow-x-auto text-xs font-mono' },
          cmd,
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

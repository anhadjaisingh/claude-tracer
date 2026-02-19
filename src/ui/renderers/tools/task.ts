import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ToolRendererConfig } from '../tool-renderer';

function extractDescription(input: unknown): string {
  if (input && typeof input === 'object' && 'description' in input) {
    return String((input as Record<string, unknown>).description);
  }
  return '';
}

function extractSubagentType(input: unknown): string {
  if (input && typeof input === 'object' && 'subagent_type' in input) {
    return String((input as Record<string, unknown>).subagent_type);
  }
  return '';
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export const taskRenderer: ToolRendererConfig = {
  icon: '\u{1F916}',

  headerSummary(input: unknown): string {
    const desc = extractDescription(input);
    const subagentType = extractSubagentType(input);
    const parts: string[] = [];
    if (subagentType) parts.push(`[${subagentType}]`);
    if (desc) parts.push(truncate(desc, 60));
    return parts.join(' ') || JSON.stringify(input).slice(0, 80);
  },

  preview(input: unknown): ReactNode {
    const desc = extractDescription(input);
    const subagentType = extractSubagentType(input);
    return createElement(
      'div',
      { className: 'text-xs' },
      subagentType
        ? createElement(
            'span',
            { className: 'px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 mr-2' },
            subagentType,
          )
        : null,
      createElement('span', { className: 'opacity-80' }, truncate(desc, 120)),
    );
  },

  fullContent(input: unknown, output: unknown): ReactNode {
    const desc = extractDescription(input);
    const subagentType = extractSubagentType(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return createElement(
      'div',
      null,
      subagentType
        ? createElement(
            'div',
            { className: 'mb-2' },
            createElement(
              'span',
              { className: 'px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 text-xs' },
              subagentType,
            ),
          )
        : null,
      createElement(
        'div',
        { className: 'mb-2' },
        createElement('div', { className: 'opacity-60 mb-1' }, 'Description:'),
        createElement('div', { className: 'text-xs whitespace-pre-wrap' }, desc),
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

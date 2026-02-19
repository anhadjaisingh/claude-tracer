import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ToolRendererConfig } from '../tool-renderer';

interface TodoItem {
  subject?: string;
  status?: string;
}

function extractTodos(input: unknown): TodoItem[] {
  if (input && typeof input === 'object' && 'todos' in input) {
    const todos = (input as Record<string, unknown>).todos;
    if (Array.isArray(todos)) {
      return todos.map((item: unknown) => {
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          return {
            subject: 'subject' in rec ? String(rec.subject) : undefined,
            status: 'status' in rec ? String(rec.status) : undefined,
          };
        }
        return {};
      });
    }
  }
  return [];
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export const todoWriteRenderer: ToolRendererConfig = {
  icon: '\u{1F4CB}',

  headerSummary(input: unknown): string {
    const todos = extractTodos(input);
    if (todos.length === 0) {
      return JSON.stringify(input).slice(0, 80);
    }
    const subjects = todos
      .map((t) => t.subject ?? '(untitled)')
      .slice(0, 3)
      .join(', ');
    const suffix = todos.length > 3 ? ` +${String(todos.length - 3)} more` : '';
    return truncate(`${subjects}${suffix}`, 80);
  },

  preview(input: unknown): ReactNode {
    const todos = extractTodos(input);
    if (todos.length === 0) {
      return createElement(
        'pre',
        { className: 'whitespace-pre-wrap text-xs opacity-80' },
        JSON.stringify(input, null, 2).slice(0, 200),
      );
    }
    const items = todos
      .slice(0, 3)
      .map((todo, i) =>
        createElement(
          'div',
          { key: String(i), className: 'flex items-center gap-2 text-xs' },
          createElement(
            'span',
            { className: 'opacity-40' },
            todo.status === 'completed' ? '\u2713' : '\u25CB',
          ),
          createElement(
            'span',
            { className: 'opacity-80' },
            truncate(todo.subject ?? '(untitled)', 60),
          ),
        ),
      );
    return createElement(
      'div',
      null,
      ...items,
      todos.length > 3
        ? createElement(
            'div',
            { className: 'text-xs opacity-40 mt-1' },
            `+${String(todos.length - 3)} more items`,
          )
        : null,
    );
  },

  fullContent(input: unknown, output: unknown): ReactNode {
    const todos = extractTodos(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);

    const todoElements = todos.map((todo, i) =>
      createElement(
        'div',
        { key: String(i), className: 'flex items-center gap-2 text-xs py-0.5' },
        createElement(
          'span',
          {
            className: todo.status === 'completed' ? 'text-green-400' : 'opacity-40',
          },
          todo.status === 'completed' ? '\u2713' : '\u25CB',
        ),
        createElement('span', null, todo.subject ?? '(untitled)'),
        todo.status
          ? createElement('span', { className: 'opacity-40 text-xs ml-auto' }, todo.status)
          : null,
      ),
    );

    return createElement(
      'div',
      null,
      createElement(
        'div',
        { className: 'mb-2' },
        createElement('div', { className: 'opacity-60 mb-1' }, 'Tasks:'),
        ...todoElements,
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

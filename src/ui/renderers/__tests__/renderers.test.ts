import { describe, it, expect } from 'vitest';
import { bashRenderer } from '../tools/bash';
import { readRenderer } from '../tools/read';
import { writeRenderer } from '../tools/write';
import { editRenderer } from '../tools/edit';
import { globRenderer } from '../tools/glob';
import { grepRenderer } from '../tools/grep';
import { taskRenderer } from '../tools/task';
import { todoWriteRenderer } from '../tools/todo-write';
import { genericRenderer } from '../tools/generic';

describe('Generic renderer', () => {
  it('shows truncated JSON as header summary', () => {
    const summary = genericRenderer.headerSummary({ foo: 'bar' }, null);
    expect(summary).toContain('foo');
    expect(summary).toContain('bar');
  });

  it('handles string input gracefully', () => {
    const summary = genericRenderer.headerSummary('hello', null);
    expect(summary).toContain('hello');
  });

  it('returns ReactNode from preview', () => {
    const node = genericRenderer.preview({ test: true }, null);
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = genericRenderer.fullContent({ test: true }, 'output');
    expect(node).not.toBeNull();
  });
});

describe('Bash renderer', () => {
  it('extracts command for header summary', () => {
    const summary = bashRenderer.headerSummary({ command: 'ls -la /tmp' }, null);
    expect(summary).toBe('ls -la /tmp');
  });

  it('shows only first line of multi-line command', () => {
    const summary = bashRenderer.headerSummary({ command: 'echo hello\necho world' }, null);
    expect(summary).toBe('echo hello');
  });

  it('falls back to JSON for unexpected input', () => {
    const summary = bashRenderer.headerSummary('raw string', null);
    expect(summary).toContain('raw string');
  });

  it('returns ReactNode from preview', () => {
    const node = bashRenderer.preview({ command: 'ls' }, null);
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = bashRenderer.fullContent({ command: 'ls' }, 'file1\nfile2');
    expect(node).not.toBeNull();
  });
});

describe('Read renderer', () => {
  it('extracts file path for header summary', () => {
    const summary = readRenderer.headerSummary({ file_path: '/src/index.ts' }, null);
    expect(summary).toBe('/src/index.ts');
  });

  it('includes line info when available', () => {
    const summary = readRenderer.headerSummary(
      { file_path: '/src/index.ts', offset: 10, limit: 20 },
      null,
    );
    expect(summary).toContain('offset: 10');
    expect(summary).toContain('limit: 20');
  });

  it('returns ReactNode from preview', () => {
    const node = readRenderer.preview({ file_path: '/test.ts' }, 'content');
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = readRenderer.fullContent({ file_path: '/test.ts' }, 'full content');
    expect(node).not.toBeNull();
  });
});

describe('Write renderer', () => {
  it('shows file path and line count', () => {
    const summary = writeRenderer.headerSummary(
      { file_path: '/out.ts', content: 'line1\nline2\nline3' },
      null,
    );
    expect(summary).toContain('/out.ts');
    expect(summary).toContain('3 lines');
  });

  it('handles empty content', () => {
    const summary = writeRenderer.headerSummary({ file_path: '/out.ts', content: '' }, null);
    expect(summary).toContain('0 lines');
  });

  it('returns ReactNode from preview', () => {
    const node = writeRenderer.preview({ file_path: '/out.ts', content: 'test' }, null);
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = writeRenderer.fullContent({ file_path: '/out.ts', content: 'test' }, 'success');
    expect(node).not.toBeNull();
  });
});

describe('Edit renderer', () => {
  it('shows file path and old -> new snippet', () => {
    const summary = editRenderer.headerSummary(
      { file_path: '/src/app.ts', old_string: 'foo', new_string: 'bar' },
      null,
    );
    expect(summary).toContain('/src/app.ts');
    expect(summary).toContain('foo');
    expect(summary).toContain('bar');
    expect(summary).toContain('->');
  });

  it('truncates long snippets', () => {
    const longStr = 'a'.repeat(100);
    const summary = editRenderer.headerSummary(
      { file_path: '/src/app.ts', old_string: longStr, new_string: 'bar' },
      null,
    );
    expect(summary).toContain('...');
  });

  it('returns ReactNode from preview', () => {
    const node = editRenderer.preview(
      { file_path: '/src/app.ts', old_string: 'old', new_string: 'new' },
      null,
    );
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = editRenderer.fullContent(
      { file_path: '/src/app.ts', old_string: 'old', new_string: 'new' },
      'success',
    );
    expect(node).not.toBeNull();
  });
});

describe('Glob renderer', () => {
  it('shows pattern in header summary', () => {
    const summary = globRenderer.headerSummary({ pattern: '**/*.ts' }, 'file1.ts\nfile2.ts');
    expect(summary).toContain('**/*.ts');
    expect(summary).toContain('2 matches');
  });

  it('includes path when available', () => {
    const summary = globRenderer.headerSummary({ pattern: '*.ts', path: '/src' }, 'file1.ts');
    expect(summary).toContain('/src');
  });

  it('returns ReactNode from preview', () => {
    const node = globRenderer.preview({ pattern: '*.ts' }, 'file1.ts');
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = globRenderer.fullContent({ pattern: '*.ts' }, 'file1.ts\nfile2.ts');
    expect(node).not.toBeNull();
  });
});

describe('Grep renderer', () => {
  it('shows pattern in header summary', () => {
    const summary = grepRenderer.headerSummary(
      { pattern: 'TODO', path: '/src' },
      'match1\nmatch2\nmatch3',
    );
    expect(summary).toContain('/TODO/');
    expect(summary).toContain('/src');
    expect(summary).toContain('3 results');
  });

  it('returns ReactNode from preview', () => {
    const node = grepRenderer.preview({ pattern: 'TODO', path: '/src', glob: '*.ts' }, 'match');
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = grepRenderer.fullContent({ pattern: 'TODO' }, 'match1\nmatch2');
    expect(node).not.toBeNull();
  });
});

describe('Task renderer', () => {
  it('shows description and subagent type', () => {
    const summary = taskRenderer.headerSummary(
      { description: 'Analyze codebase', subagent_type: 'researcher' },
      null,
    );
    expect(summary).toContain('Analyze codebase');
    expect(summary).toContain('[researcher]');
  });

  it('handles missing subagent type', () => {
    const summary = taskRenderer.headerSummary({ description: 'Simple task' }, null);
    expect(summary).toBe('Simple task');
  });

  it('returns ReactNode from preview', () => {
    const node = taskRenderer.preview({ description: 'Test', subagent_type: 'worker' }, null);
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = taskRenderer.fullContent({ description: 'Test', subagent_type: 'worker' }, 'done');
    expect(node).not.toBeNull();
  });
});

describe('TodoWrite renderer', () => {
  it('shows task subjects', () => {
    const summary = todoWriteRenderer.headerSummary(
      {
        todos: [
          { subject: 'Fix bug', status: 'pending' },
          { subject: 'Add tests', status: 'completed' },
        ],
      },
      null,
    );
    expect(summary).toContain('Fix bug');
    expect(summary).toContain('Add tests');
  });

  it('shows +N more for many todos', () => {
    const summary = todoWriteRenderer.headerSummary(
      {
        todos: [
          { subject: 'Task 1' },
          { subject: 'Task 2' },
          { subject: 'Task 3' },
          { subject: 'Task 4' },
          { subject: 'Task 5' },
        ],
      },
      null,
    );
    expect(summary).toContain('+2 more');
  });

  it('falls back to JSON for non-array todos', () => {
    const summary = todoWriteRenderer.headerSummary({ something: 'else' }, null);
    expect(summary).toContain('something');
  });

  it('returns ReactNode from preview', () => {
    const node = todoWriteRenderer.preview(
      { todos: [{ subject: 'Test', status: 'pending' }] },
      null,
    );
    expect(node).not.toBeNull();
  });

  it('returns ReactNode from fullContent', () => {
    const node = todoWriteRenderer.fullContent(
      { todos: [{ subject: 'Test', status: 'completed' }] },
      'success',
    );
    expect(node).not.toBeNull();
  });
});

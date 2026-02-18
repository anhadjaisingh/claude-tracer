import { describe, it, expect } from 'vitest';
import { ClaudeCodeParser } from '../claude-code';

describe('ClaudeCodeParser', () => {
  const parser = new ClaudeCodeParser();

  it('canParse returns true for Claude Code JSONL', () => {
    const content = '{"type":"user","message":{"role":"user","content":"Hello"}}';
    expect(parser.canParse(content)).toBe(true);
  });

  it('parses user message', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'Hello Claude' },
      timestamp: '2026-02-18T10:00:00Z',
    });

    const block = parser.parseLine(line);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('user');
    expect((block as any).content).toBe('Hello Claude');
  });

  it('parses assistant message', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }],
      },
      timestamp: '2026-02-18T10:00:01Z',
    });

    const block = parser.parseLine(line);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('agent');
    expect((block as any).content).toBe('Hi there!');
  });

  it('parses tool use', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Read',
            input: { file_path: '/test.txt' },
          },
        ],
      },
      timestamp: '2026-02-18T10:00:02Z',
    });

    const block = parser.parseLine(line);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('agent');
  });

  it('parses tool result', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: 'file contents here',
          },
        ],
      },
      timestamp: '2026-02-18T10:00:03Z',
    });

    const block = parser.parseLine(line);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('tool');
    expect((block as any).toolName).toBeDefined();
  });

  it('parses complete session', () => {
    const content = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Hello' },
        timestamp: '2026-02-18T10:00:00Z',
      }),
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] },
        timestamp: '2026-02-18T10:00:01Z',
      }),
    ].join('\n');

    const session = parser.parse(content);
    expect(session.blocks.length).toBe(2);
    expect(session.blocks[0].type).toBe('user');
    expect(session.blocks[1].type).toBe('agent');
  });
});

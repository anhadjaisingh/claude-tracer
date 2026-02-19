import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeCodeParser } from '../claude-code';
import type { UserBlock, AgentBlock, ToolBlock, TeamMessageBlock } from '@/types';

describe('ClaudeCodeParser', () => {
  let parser: ClaudeCodeParser;

  beforeEach(() => {
    parser = new ClaudeCodeParser();
  });

  it('canParse returns true for Claude Code JSONL', () => {
    const content = '{"type":"user","message":{"role":"user","content":"Hello"}}';
    expect(parser.canParse(content)).toBe(true);
  });

  it('canParse returns true for entries without message (e.g. file-history-snapshot)', () => {
    const content = '{"type":"file-history-snapshot","timestamp":"2026-02-18T10:00:00Z"}';
    expect(parser.canParse(content)).toBe(true);
  });

  it('canParse skips empty lines to find first valid line', () => {
    const content = '\n\n{"type":"user","message":{"role":"user","content":"Hello"}}\n';
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
    expect(block?.type).toBe('user');
    expect((block as UserBlock).content).toBe('Hello Claude');
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
    expect(block?.type).toBe('agent');
    expect((block as AgentBlock).content).toBe('Hi there!');
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
    expect(block?.type).toBe('agent');
  });

  it('parses tool result', () => {
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
    parser.parseLine(line);

    const resultLine = JSON.stringify({
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

    const block = parser.parseLine(resultLine);
    expect(block).not.toBeNull();
    expect(block?.type).toBe('tool');
    expect((block as ToolBlock).toolName).toBeDefined();
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

  describe('requestId merging', () => {
    it('merges multiple assistant entries with same requestId into one AgentBlock', () => {
      const requestId = 'req_011CYFTY5W9N56dJxVKsRPrb';

      const entry1 = JSON.stringify({
        requestId,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Let me first explore...' }],
          usage: { input_tokens: 100, output_tokens: 1 },
        },
        timestamp: '2026-02-18T10:00:01Z',
      });

      const entry2 = JSON.stringify({
        requestId,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_011A',
              name: 'Glob',
              input: { pattern: '**/*' },
            },
          ],
          usage: { input_tokens: 0, output_tokens: 20 },
        },
        timestamp: '2026-02-18T10:00:02Z',
      });

      const entry3 = JSON.stringify({
        requestId,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_01Nr',
              name: 'Bash',
              input: { command: 'git log' },
            },
          ],
          usage: { input_tokens: 0, output_tokens: 15 },
        },
        timestamp: '2026-02-18T10:00:03Z',
      });

      const content = [entry1, entry2, entry3].join('\n');
      const session = parser.parse(content);

      // Should produce exactly 1 AgentBlock
      const agentBlocks = session.blocks.filter((b) => b.type === 'agent');
      expect(agentBlocks.length).toBe(1);

      const agent = agentBlocks[0];
      expect(agent.content).toBe('Let me first explore...');
      expect(agent.toolCalls).toContain('toolu_011A');
      expect(agent.toolCalls).toContain('toolu_01Nr');
      expect(agent.toolCalls.length).toBe(2);
    });

    it('merges thinking content from multiple entries', () => {
      const requestId = 'req_thinking_test';

      const entry1 = JSON.stringify({
        requestId,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'thinking', thinking: 'Let me think about this...' }],
          usage: { input_tokens: 50, output_tokens: 10 },
        },
      });

      const entry2 = JSON.stringify({
        requestId,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Here is my answer.' }],
          usage: { input_tokens: 0, output_tokens: 5 },
        },
      });

      const session = parser.parse([entry1, entry2].join('\n'));
      const agentBlocks = session.blocks.filter((b) => b.type === 'agent');
      expect(agentBlocks.length).toBe(1);

      const agent = agentBlocks[0];
      expect(agent.thinking).toBe('Let me think about this...');
      expect(agent.content).toBe('Here is my answer.');
    });

    it('creates separate blocks for different requestIds', () => {
      const entry1 = JSON.stringify({
        requestId: 'req_001',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'First response' }],
        },
      });

      const entry2 = JSON.stringify({
        requestId: 'req_002',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Second response' }],
        },
      });

      const session = parser.parse([entry1, entry2].join('\n'));
      const agentBlocks = session.blocks.filter((b) => b.type === 'agent');
      expect(agentBlocks.length).toBe(2);
    });

    it('assistant entries without requestId each create their own block', () => {
      const entry1 = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'First' }],
        },
      });

      const entry2 = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Second' }],
        },
      });

      const session = parser.parse([entry1, entry2].join('\n'));
      const agentBlocks = session.blocks.filter((b) => b.type === 'agent');
      expect(agentBlocks.length).toBe(2);
    });
  });

  describe('token extraction from message.usage', () => {
    it('extracts tokens from message.usage', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello' }],
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      });

      const block = parser.parseLine(line);
      expect(block).not.toBeNull();
      expect(block?.tokensIn).toBe(100);
      expect(block?.tokensOut).toBe(50);
    });

    it('accumulates tokens across merged entries', () => {
      const requestId = 'req_token_test';

      const entry1 = JSON.stringify({
        requestId,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Part 1' }],
          usage: { input_tokens: 100, output_tokens: 20 },
        },
      });

      const entry2 = JSON.stringify({
        requestId,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: ' Part 2' }],
          usage: { input_tokens: 0, output_tokens: 30 },
        },
      });

      const session = parser.parse([entry1, entry2].join('\n'));
      const agent = session.blocks.find((b) => b.type === 'agent');
      expect(agent).toBeDefined();
      expect(agent?.tokensIn).toBe(100);
      expect(agent?.tokensOut).toBe(50);
    });
  });

  describe('isMeta handling', () => {
    it('sets isMeta on user blocks with isMeta: true', () => {
      const line = JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Base directory for this skill...' }],
        },
        isMeta: true,
        uuid: '45d8-test',
      });

      const block = parser.parseLine(line);
      expect(block).not.toBeNull();
      expect(block?.type).toBe('user');
      expect((block as UserBlock).isMeta).toBe(true);
      expect((block as UserBlock).metaLabel).toBeDefined();
    });

    it('does not set isMeta on regular user blocks', () => {
      const line = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Hello Claude' },
      });

      const block = parser.parseLine(line);
      expect(block).not.toBeNull();
      expect((block as UserBlock).isMeta).toBeUndefined();
    });

    it('sets metaLabel from content text (truncated to 40 chars)', () => {
      const longText =
        'This is a very long meta content that should be truncated to forty characters';
      const line = JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: longText,
        },
        isMeta: true,
      });

      const block = parser.parseLine(line) as UserBlock;
      expect(block.metaLabel?.length).toBeLessThanOrEqual(40);
      expect(block.metaLabel).toBe(longText.slice(0, 37) + '...');
    });
  });

  describe('skips non-block entries', () => {
    it('returns null for file-history-snapshot entries', () => {
      const line = JSON.stringify({
        type: 'file-history-snapshot',
        timestamp: '2026-02-18T10:00:00Z',
      });
      expect(parser.parseLine(line)).toBeNull();
    });

    it('returns null for progress entries', () => {
      const line = JSON.stringify({
        type: 'progress',
        message: { role: 'assistant', content: '' },
      });
      expect(parser.parseLine(line)).toBeNull();
    });

    it('returns null for system entries', () => {
      const line = JSON.stringify({
        type: 'system',
        message: { role: 'system', content: 'System init' },
      });
      expect(parser.parseLine(line)).toBeNull();
    });
  });

  describe('SendMessage / team message parsing', () => {
    it('parses a SendMessage tool_use as TeamMessageBlock', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_send_1',
              name: 'SendMessage',
              input: {
                type: 'message',
                recipient: 'team-lead',
                content: 'Task is complete',
                summary: 'Task complete notification',
              },
            },
          ],
        },
        timestamp: '2026-02-18T10:00:05Z',
      });

      const block = parser.parseLine(line);
      expect(block).not.toBeNull();
      expect(block?.type).toBe('team-message');
      const teamBlock = block as TeamMessageBlock;
      expect(teamBlock.sender).toBe('agent');
      expect(teamBlock.recipient).toBe('team-lead');
      expect(teamBlock.content).toBe('Task is complete');
      expect(teamBlock.messageType).toBe('message');
    });

    it('parses a broadcast SendMessage', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_send_2',
              name: 'SendMessage',
              input: {
                type: 'broadcast',
                content: 'Critical issue found',
                summary: 'Critical blocking issue',
              },
            },
          ],
        },
        timestamp: '2026-02-18T10:00:06Z',
      });

      const block = parser.parseLine(line);
      expect(block).not.toBeNull();
      expect(block?.type).toBe('team-message');
      const teamBlock = block as TeamMessageBlock;
      expect(teamBlock.recipient).toBeUndefined();
      expect(teamBlock.messageType).toBe('broadcast');
    });

    it('parses a shutdown_request SendMessage', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_send_3',
              name: 'SendMessage',
              input: {
                type: 'shutdown_request',
                recipient: 'researcher',
                content: 'Task complete, wrapping up',
              },
            },
          ],
        },
        timestamp: '2026-02-18T10:00:07Z',
      });

      const block = parser.parseLine(line);
      expect(block).not.toBeNull();
      expect(block?.type).toBe('team-message');
      const teamBlock = block as TeamMessageBlock;
      expect(teamBlock.messageType).toBe('shutdown_request');
      expect(teamBlock.recipient).toBe('researcher');
    });

    it('falls back to summary when content is absent', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_send_4',
              name: 'SendMessage',
              input: {
                type: 'message',
                recipient: 'tester',
                summary: 'Quick status update',
              },
            },
          ],
        },
        timestamp: '2026-02-18T10:00:08Z',
      });

      const block = parser.parseLine(line);
      expect(block).not.toBeNull();
      const teamBlock = block as TeamMessageBlock;
      expect(teamBlock.content).toBe('Quick status update');
    });

    it('does not treat non-SendMessage tool calls as team messages', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_read_1',
              name: 'Read',
              input: { file_path: '/test.txt' },
            },
          ],
        },
        timestamp: '2026-02-18T10:00:09Z',
      });

      const block = parser.parseLine(line);
      expect(block).not.toBeNull();
      expect(block?.type).toBe('agent');
    });
  });
});

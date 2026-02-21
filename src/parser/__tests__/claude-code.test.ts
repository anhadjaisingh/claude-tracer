import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeCodeParser } from '../claude-code';
import type {
  AnyBlock,
  UserBlock,
  AgentBlock,
  ToolBlock,
  TeamMessageBlock,
  SystemBlock,
  ProgressBlock,
  FileSnapshotBlock,
  QueueOperationBlock,
} from '@/types';

/** Extract the first (or only) block from a parseLine result */
function firstBlock(result: AnyBlock | AnyBlock[] | null): AnyBlock | null {
  if (result === null) return null;
  if (Array.isArray(result)) return result[0] ?? null;
  return result;
}

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

    const block = firstBlock(parser.parseLine(line));
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

    const block = firstBlock(parser.parseLine(line));
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

    const block = firstBlock(parser.parseLine(line));
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

    const block = firstBlock(parser.parseLine(resultLine));
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

      const block = firstBlock(parser.parseLine(line));
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

      const block = firstBlock(parser.parseLine(line));
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

      const block = firstBlock(parser.parseLine(line));
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

      const block = firstBlock(parser.parseLine(line)) as UserBlock;
      expect(block.metaLabel?.length).toBeLessThanOrEqual(40);
      expect(block.metaLabel).toBe(longText.slice(0, 37) + '...');
    });
  });

  describe('system entry parsing', () => {
    it('parses system entry with subtype turn_duration', () => {
      const line = JSON.stringify({
        type: 'system',
        subtype: 'turn_duration',
        durationMs: 31869,
        isMeta: false,
        timestamp: '2026-02-18T10:00:00Z',
        uuid: 'sys-uuid-1',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('system');
      const sysBlock = block as SystemBlock;
      expect(sysBlock.subtype).toBe('turn_duration');
      expect(sysBlock.data.durationMs).toBe(31869);
      expect(sysBlock.uuid).toBe('sys-uuid-1');
    });

    it('parses system entry with subtype compact_boundary', () => {
      const line = JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        timestamp: '2026-02-18T10:05:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('system');
      const sysBlock = block as SystemBlock;
      expect(sysBlock.subtype).toBe('compact_boundary');
    });

    it('parses system entry with subtype stop_hook_summary', () => {
      const line = JSON.stringify({
        type: 'system',
        subtype: 'stop_hook_summary',
        hookCount: 2,
        hookInfos: [{ command: 'terminal-notifier -title "Claude Code" -message "Done"' }],
        hookErrors: [],
        preventedContinuation: false,
        timestamp: '2026-02-18T10:02:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('system');
      const sysBlock = block as SystemBlock;
      expect(sysBlock.subtype).toBe('stop_hook_summary');
      expect(sysBlock.data.hookCount).toBe(2);
    });

    it('handles system entry without subtype', () => {
      const line = JSON.stringify({
        type: 'system',
        timestamp: '2026-02-18T10:00:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('system');
      const sysBlock = block as SystemBlock;
      expect(sysBlock.subtype).toBe('unknown');
    });
  });

  describe('progress entry parsing', () => {
    it('parses bash_progress entry', () => {
      const line = JSON.stringify({
        type: 'progress',
        data: {
          type: 'bash_progress',
          output: '',
          fullOutput: '',
          elapsedTimeSeconds: 2,
          totalLines: 0,
          timeoutMs: 120000,
        },
        toolUseID: 'bash-progress-0',
        parentToolUseID: 'toolu_01BkANrSv5xki5QCvhGJUfvo',
        timestamp: '2026-02-18T10:00:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('progress');
      const progBlock = block as ProgressBlock;
      expect(progBlock.progressType).toBe('bash_progress');
      expect(progBlock.parentToolUseId).toBe('toolu_01BkANrSv5xki5QCvhGJUfvo');
      expect(progBlock.data.elapsedTimeSeconds).toBe(2);
    });

    it('parses agent_progress entry', () => {
      const line = JSON.stringify({
        type: 'progress',
        data: {
          type: 'agent_progress',
          message: {
            type: 'user',
            message: {
              role: 'user',
              content: [{ type: 'text', text: 'Research the trade-offs...' }],
            },
          },
        },
        timestamp: '2026-02-18T10:01:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('progress');
      const progBlock = block as ProgressBlock;
      expect(progBlock.progressType).toBe('agent_progress');
    });

    it('parses hook_progress entry', () => {
      const line = JSON.stringify({
        type: 'progress',
        data: {
          type: 'hook_progress',
          hookEvent: 'SessionStart',
          hookName: 'SessionStart:startup',
          command: '${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh',
        },
        parentToolUseID: '7ca761bc-test',
        toolUseID: '7ca761bc-test',
        timestamp: '2026-02-18T10:00:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('progress');
      const progBlock = block as ProgressBlock;
      expect(progBlock.progressType).toBe('hook_progress');
      expect(progBlock.parentToolUseId).toBe('7ca761bc-test');
    });

    it('handles progress entry without data', () => {
      const line = JSON.stringify({
        type: 'progress',
        timestamp: '2026-02-18T10:00:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('progress');
      const progBlock = block as ProgressBlock;
      expect(progBlock.progressType).toBe('unknown');
    });
  });

  describe('file-history-snapshot entry parsing', () => {
    it('parses file-history-snapshot with tracked files', () => {
      const line = JSON.stringify({
        type: 'file-history-snapshot',
        messageId: '613a3e70-test',
        snapshot: {
          messageId: '613a3e70-test',
          trackedFileBackups: {
            'src/auth.ts': {
              backupFileName: '2f36e7b54885556b@v2',
              version: 2,
              backupTime: '2026-02-18T12:14:30.527Z',
            },
          },
          timestamp: '2026-02-18T12:14:30.526Z',
        },
        timestamp: '2026-02-18T12:14:30.526Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('file-snapshot');
      const fsBlock = block as FileSnapshotBlock;
      expect(fsBlock.messageId).toBe('613a3e70-test');
      expect(fsBlock.trackedFiles['src/auth.ts']).toBeDefined();
      expect(fsBlock.trackedFiles['src/auth.ts'].version).toBe(2);
    });

    it('parses file-history-snapshot with empty tracked files', () => {
      const line = JSON.stringify({
        type: 'file-history-snapshot',
        messageId: 'empty-test',
        snapshot: {
          messageId: 'empty-test',
          trackedFileBackups: {},
          timestamp: '2026-02-18T12:00:00.000Z',
        },
        timestamp: '2026-02-18T12:00:00.000Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('file-snapshot');
      const fsBlock = block as FileSnapshotBlock;
      expect(Object.keys(fsBlock.trackedFiles).length).toBe(0);
    });

    it('handles file-history-snapshot without snapshot field', () => {
      const line = JSON.stringify({
        type: 'file-history-snapshot',
        timestamp: '2026-02-18T10:00:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('file-snapshot');
      const fsBlock = block as FileSnapshotBlock;
      expect(fsBlock.messageId).toBe('');
      expect(Object.keys(fsBlock.trackedFiles).length).toBe(0);
    });
  });

  describe('queue-operation entry parsing', () => {
    it('parses queue-operation enqueue entry', () => {
      const line = JSON.stringify({
        type: 'queue-operation',
        operation: 'enqueue',
        sessionId: 'test-session',
        content: 'Before you transition...',
        timestamp: '2026-02-18T10:00:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('queue-operation');
      const qBlock = block as QueueOperationBlock;
      expect(qBlock.operation).toBe('enqueue');
      expect(qBlock.content).toBe('Before you transition...');
    });

    it('parses queue-operation remove entry', () => {
      const line = JSON.stringify({
        type: 'queue-operation',
        operation: 'remove',
        sessionId: 'test-session',
        timestamp: '2026-02-18T10:00:01Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('queue-operation');
      const qBlock = block as QueueOperationBlock;
      expect(qBlock.operation).toBe('remove');
      expect(qBlock.content).toBeUndefined();
    });
  });

  describe('uuid and sourceParentUuid propagation', () => {
    it('populates uuid and sourceParentUuid on user blocks', () => {
      const line = JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Hello' },
        uuid: 'user-uuid-123',
        parentUuid: 'parent-uuid-456',
        timestamp: '2026-02-18T10:00:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.uuid).toBe('user-uuid-123');
      expect(block?.sourceParentUuid).toBe('parent-uuid-456');
    });

    it('populates uuid on system blocks', () => {
      const line = JSON.stringify({
        type: 'system',
        subtype: 'turn_duration',
        durationMs: 1000,
        uuid: 'sys-uuid-789',
        timestamp: '2026-02-18T10:00:00Z',
      });

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.uuid).toBe('sys-uuid-789');
    });
  });

  describe('complete session with all entry types', () => {
    it('parses a session with mixed entry types', () => {
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
        JSON.stringify({
          type: 'system',
          subtype: 'turn_duration',
          durationMs: 5000,
          timestamp: '2026-02-18T10:00:02Z',
        }),
        JSON.stringify({
          type: 'progress',
          data: { type: 'bash_progress', output: 'running...' },
          timestamp: '2026-02-18T10:00:03Z',
        }),
        JSON.stringify({
          type: 'file-history-snapshot',
          messageId: 'msg-1',
          snapshot: { messageId: 'msg-1', trackedFileBackups: {} },
          timestamp: '2026-02-18T10:00:04Z',
        }),
        JSON.stringify({
          type: 'queue-operation',
          operation: 'enqueue',
          content: 'queued msg',
          timestamp: '2026-02-18T10:00:05Z',
        }),
      ].join('\n');

      const session = parser.parse(content);
      expect(session.blocks.length).toBe(6);
      expect(session.blocks[0].type).toBe('user');
      expect(session.blocks[1].type).toBe('agent');
      expect(session.blocks[2].type).toBe('system');
      expect(session.blocks[3].type).toBe('progress');
      expect(session.blocks[4].type).toBe('file-snapshot');
      expect(session.blocks[5].type).toBe('queue-operation');
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

      const block = firstBlock(parser.parseLine(line));
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

      const block = firstBlock(parser.parseLine(line));
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

      const block = firstBlock(parser.parseLine(line));
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

      const block = firstBlock(parser.parseLine(line));
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

      const block = firstBlock(parser.parseLine(line));
      expect(block).not.toBeNull();
      expect(block?.type).toBe('agent');
    });
  });
});

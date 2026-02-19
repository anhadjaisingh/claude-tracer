import { describe, it, expect } from 'vitest';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock, isTeamMessageBlock } from '../blocks';
import type { UserBlock, AgentBlock, ToolBlock, McpBlock, TeamMessageBlock } from '../blocks';

describe('Block type guards', () => {
  it('identifies UserBlock correctly', () => {
    const block: UserBlock = {
      id: '1',
      timestamp: Date.now(),
      type: 'user',
      content: 'Hello',
    };
    expect(isUserBlock(block)).toBe(true);
    expect(isAgentBlock(block)).toBe(false);
  });

  it('identifies AgentBlock correctly', () => {
    const block: AgentBlock = {
      id: '2',
      timestamp: Date.now(),
      type: 'agent',
      content: 'Hi there',
      toolCalls: [],
    };
    expect(isAgentBlock(block)).toBe(true);
    expect(isUserBlock(block)).toBe(false);
  });

  it('identifies ToolBlock correctly', () => {
    const block: ToolBlock = {
      id: '3',
      timestamp: Date.now(),
      type: 'tool',
      parentId: '2',
      toolName: 'Read',
      input: { file_path: '/test.txt' },
      output: 'file contents',
      status: 'success',
    };
    expect(isToolBlock(block)).toBe(true);
    expect(isMcpBlock(block)).toBe(false);
  });

  it('identifies McpBlock correctly', () => {
    const block: McpBlock = {
      id: '4',
      timestamp: Date.now(),
      type: 'mcp',
      parentId: '2',
      serverName: 'playwright',
      method: 'browser_snapshot',
      input: {},
      output: 'snapshot data',
      status: 'success',
    };
    expect(isMcpBlock(block)).toBe(true);
    expect(isToolBlock(block)).toBe(false);
  });

  it('identifies TeamMessageBlock correctly', () => {
    const block: TeamMessageBlock = {
      id: '5',
      timestamp: Date.now(),
      type: 'team-message',
      sender: 'parser-agent',
      recipient: 'team-lead',
      content: 'Task complete',
      messageType: 'message',
    };
    expect(isTeamMessageBlock(block)).toBe(true);
    expect(isUserBlock(block)).toBe(false);
    expect(isAgentBlock(block)).toBe(false);
    expect(isToolBlock(block)).toBe(false);
    expect(isMcpBlock(block)).toBe(false);
  });

  it('returns false for isTeamMessageBlock on non-team-message blocks', () => {
    const block: UserBlock = {
      id: '1',
      timestamp: Date.now(),
      type: 'user',
      content: 'Hello',
    };
    expect(isTeamMessageBlock(block)).toBe(false);
  });
});

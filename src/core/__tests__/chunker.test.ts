import { describe, it, expect } from 'vitest';
import { Chunker } from '../chunker';
import type { AnyBlock, UserBlock, AgentBlock, ToolBlock } from '@/types';

describe('Chunker', () => {
  const chunker = new Chunker();

  const blocks: AnyBlock[] = [
    {
      id: 'u1',
      timestamp: 1000,
      type: 'user',
      content: 'Start task 1',
    } as UserBlock,
    {
      id: 'a1',
      timestamp: 2000,
      type: 'agent',
      content: 'Working on task 1',
      toolCalls: ['t1'],
    } as AgentBlock,
    {
      id: 't1',
      timestamp: 3000,
      type: 'tool',
      parentId: 'a1',
      toolName: 'Read',
      input: {},
      output: '',
      status: 'success',
    } as ToolBlock,
    {
      id: 'u2',
      timestamp: 4000,
      type: 'user',
      content: 'Now task 2',
    } as UserBlock,
    {
      id: 'a2',
      timestamp: 5000,
      type: 'agent',
      content: 'Working on task 2',
      toolCalls: [],
    } as AgentBlock,
  ];

  it('creates turn-level chunks for each user-agent exchange', () => {
    const chunks = chunker.createChunks(blocks);
    const turns = chunks.filter(c => c.level === 'turn');
    expect(turns.length).toBe(2);
  });

  it('groups tool blocks with their parent agent', () => {
    const chunks = chunker.createChunks(blocks);
    const turn1 = chunks.find(
      c => c.level === 'turn' && c.blockIds.includes('a1'),
    );
    expect(turn1?.blockIds).toContain('t1');
  });

  it('calculates aggregate stats', () => {
    const blocksWithTokens: AnyBlock[] = [
      {
        id: 'u1',
        timestamp: 1000,
        type: 'user',
        content: 'Hello',
        tokensIn: 10,
      } as UserBlock,
      {
        id: 'a1',
        timestamp: 2000,
        type: 'agent',
        content: 'Hi',
        toolCalls: [],
        tokensIn: 100,
        tokensOut: 50,
        wallTimeMs: 1000,
      } as AgentBlock,
    ];
    const chunks = chunker.createChunks(blocksWithTokens);
    const turn = chunks.find(c => c.level === 'turn');
    expect(turn?.totalTokensIn).toBe(110);
    expect(turn?.totalTokensOut).toBe(50);
  });
});

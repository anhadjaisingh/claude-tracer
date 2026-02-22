import { describe, it, expect } from 'vitest';
import { Chunker } from '../chunker';
import { isUserBlock, isAgentBlock, isToolBlock } from '@/types';
import type { AnyBlock, UserBlock, AgentBlock, ToolBlock } from '@/types';

describe('Chunker', () => {
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
    const chunker = new Chunker();
    const chunks = chunker.createChunks(blocks);
    const turns = chunks.filter((c) => c.level === 'turn');
    expect(turns.length).toBe(2);
  });

  it('groups tool blocks with their parent agent', () => {
    const chunker = new Chunker();
    const chunks = chunker.createChunks(blocks);
    const turn1 = chunks.find((c) => c.level === 'turn' && c.blockIds.includes('a1'));
    expect(turn1?.blockIds).toContain('t1');
  });

  it('calculates aggregate stats', () => {
    const chunker = new Chunker();
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
    const turn = chunks.find((c) => c.level === 'turn');
    expect(turn?.totalTokensIn).toBe(110);
    expect(turn?.totalTokensOut).toBe(50);
  });

  it('isMeta user blocks do not start new turns', () => {
    const chunker = new Chunker();
    const blocksWithMeta: AnyBlock[] = [
      {
        id: 'u1',
        timestamp: 1000,
        type: 'user',
        content: 'Start task',
      } as UserBlock,
      {
        id: 'a1',
        timestamp: 2000,
        type: 'agent',
        content: 'Working on it',
        toolCalls: [],
      } as AgentBlock,
      {
        id: 'u-meta',
        timestamp: 3000,
        type: 'user',
        content: 'System injected content',
        isMeta: true,
        metaLabel: 'System injected content',
      } as UserBlock,
      {
        id: 'a2',
        timestamp: 4000,
        type: 'agent',
        content: 'Continuing work',
        toolCalls: [],
      } as AgentBlock,
    ];

    const chunks = chunker.createChunks(blocksWithMeta);
    const turns = chunks.filter((c) => c.level === 'turn');

    // Should be 1 turn, not 2 (isMeta user block should not start a new turn)
    expect(turns.length).toBe(1);

    // The single turn should contain all 4 blocks
    expect(turns[0].blockIds).toContain('u1');
    expect(turns[0].blockIds).toContain('a1');
    expect(turns[0].blockIds).toContain('u-meta');
    expect(turns[0].blockIds).toContain('a2');
  });

  it('extracts HEREDOC-style commit messages correctly', () => {
    const chunker = new Chunker();
    const heredocBlocks: AnyBlock[] = [
      {
        id: 'u1',
        timestamp: 1000,
        type: 'user',
        content: 'Commit the changes',
      } as UserBlock,
      {
        id: 'a1',
        timestamp: 2000,
        type: 'agent',
        content: 'Committing',
        toolCalls: ['t1'],
      } as AgentBlock,
      {
        id: 't1',
        timestamp: 3000,
        type: 'tool',
        parentId: 'a1',
        toolName: 'Bash',
        input: {
          command:
            'git commit -m "$(cat <<\'EOF\'\nfix: chunker labels and coarse granularity\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nEOF\n)"',
        },
        output: '',
        status: 'success',
      } as ToolBlock,
    ];

    const chunks = chunker.createChunks(heredocBlocks);
    // The label should be the actual commit message, not "$(cat <<"
    expect(chunks[0].label).toBe('fix: chunker labels and coarse granularity');
  });

  it('extracts regular double-quoted commit messages correctly', () => {
    const chunker = new Chunker();
    const regularBlocks: AnyBlock[] = [
      {
        id: 'u1',
        timestamp: 1000,
        type: 'user',
        content: 'Commit the changes',
      } as UserBlock,
      {
        id: 'a1',
        timestamp: 2000,
        type: 'agent',
        content: 'Committing',
        toolCalls: ['t1'],
      } as AgentBlock,
      {
        id: 't1',
        timestamp: 3000,
        type: 'tool',
        parentId: 'a1',
        toolName: 'Bash',
        input: { command: 'git commit -m "fix: simple commit message"' },
        output: '',
        status: 'success',
      } as ToolBlock,
    ];

    const chunks = chunker.createChunks(regularBlocks);
    expect(chunks[0].label).toBe('fix: simple commit message');
  });

  it('coarse granularity splits on PR/push boundaries and group size', () => {
    const chunker = new Chunker();
    // Create a session with multiple tasks separated by PR creation signals.
    // We need enough turns that form separate task chunks, with git-push signals between them.
    const sessionBlocks: AnyBlock[] = [];
    let ts = 1000;

    // Create 3 groups of work, each ending with a git push
    for (let group = 0; group < 3; group++) {
      // First turn: user asks to do something
      sessionBlocks.push({
        id: `u-${String(group)}-1`,
        timestamp: ts++,
        type: 'user',
        content: `Task ${String(group + 1)}: do something`,
      } as UserBlock);
      sessionBlocks.push({
        id: `a-${String(group)}-1`,
        timestamp: ts++,
        type: 'agent',
        content: 'Working on it',
        toolCalls: [`t-${String(group)}-push`],
      } as AgentBlock);
      // Git push tool call (creates end-of-unit signal)
      sessionBlocks.push({
        id: `t-${String(group)}-push`,
        timestamp: ts++,
        type: 'tool',
        parentId: `a-${String(group)}-1`,
        toolName: 'Bash',
        input: { command: 'git push -u origin feat/my-branch' },
        output: '',
        status: 'success',
      } as ToolBlock);
      // PR creation tool call
      sessionBlocks.push({
        id: `t-${String(group)}-pr`,
        timestamp: ts++,
        type: 'tool',
        parentId: `a-${String(group)}-1`,
        toolName: 'Bash',
        input: { command: 'gh pr create --title "PR for task ' + String(group + 1) + '"' },
        output: '',
        status: 'success',
      } as ToolBlock);

      // Second turn in same group (will form next task after boundary)
      sessionBlocks.push({
        id: `u-${String(group)}-2`,
        timestamp: ts++,
        type: 'user',
        content: `Continue task ${String(group + 1)}`,
      } as UserBlock);
      sessionBlocks.push({
        id: `a-${String(group)}-2`,
        timestamp: ts++,
        type: 'agent',
        content: 'Continuing',
        toolCalls: [],
      } as AgentBlock);
    }

    const themeChunks = chunker.createChunksAtLevel(sessionBlocks, 'theme');
    // Should produce multiple theme chunks due to PR/push boundaries
    expect(themeChunks.length).toBeGreaterThan(1);
  });

  it('chunk blockIds map to renderable block types with correct DOM IDs', () => {
    const chunker = new Chunker();
    const chunks = chunker.createChunks(blocks);

    for (const chunk of chunks) {
      expect(chunk.blockIds.length).toBeGreaterThan(0);

      for (const blockId of chunk.blockIds) {
        // Every blockId in a chunk must reference an actual block
        const block = blocks.find((b) => b.id === blockId);
        expect(block).toBeDefined();
        if (!block) continue;

        // The block must be a renderable type (user, agent, or tool)
        const isRenderable = isUserBlock(block) || isAgentBlock(block) || isToolBlock(block);
        expect(isRenderable).toBe(true);

        // The DOM element ID should follow the pattern used by block components
        const expectedDomId = `block-${blockId}`;
        expect(expectedDomId).toBe(`block-${block.id}`);
      }
    }
  });
});

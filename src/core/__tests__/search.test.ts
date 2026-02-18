import { describe, it, expect, beforeEach } from 'vitest';
import { BlockSearch } from '../search';
import type { UserBlock, AgentBlock, ToolBlock } from '@/types';

describe('BlockSearch', () => {
  let search: BlockSearch;

  const userBlock: UserBlock = {
    id: 'user-1',
    timestamp: 1000,
    type: 'user',
    content: 'Help me implement authentication',
  };

  const agentBlock: AgentBlock = {
    id: 'agent-1',
    timestamp: 2000,
    type: 'agent',
    content: 'I will help you implement JWT authentication',
    toolCalls: ['tool-1'],
  };

  const toolBlock: ToolBlock = {
    id: 'tool-1',
    timestamp: 3000,
    type: 'tool',
    parentId: 'agent-1',
    toolName: 'Read',
    input: { file_path: 'auth.ts' },
    output: 'file contents',
    status: 'success',
  };

  beforeEach(() => {
    search = new BlockSearch();
    search.index([userBlock, agentBlock, toolBlock]);
  });

  it('finds blocks by content', () => {
    const results = search.search('authentication');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.blockId === 'user-1')).toBe(true);
  });

  it('finds tool blocks by tool name', () => {
    const results = search.search('Read');
    expect(results.some(r => r.blockId === 'tool-1')).toBe(true);
  });

  it('filters by block type', () => {
    const results = search.search('authentication', { types: ['user'] });
    expect(results.every(r => r.blockId.startsWith('user'))).toBe(true);
  });

  it('respects limit option', () => {
    const results = search.search('authentication', { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('can add blocks incrementally', () => {
    const newBlock: UserBlock = {
      id: 'user-2',
      timestamp: 4000,
      type: 'user',
      content: 'Now add tests',
    };
    search.addBlock(newBlock);
    const results = search.search('tests');
    expect(results.some(r => r.blockId === 'user-2')).toBe(true);
  });

  it('can clear the index', () => {
    search.clear();
    const results = search.search('authentication');
    expect(results.length).toBe(0);
  });
});

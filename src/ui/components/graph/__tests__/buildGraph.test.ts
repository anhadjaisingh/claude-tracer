import { describe, it, expect } from 'vitest';
import { buildGraph } from '../buildGraph';
import type { UserBlock, AgentBlock, ToolBlock } from '@/types';

function makeUserBlock(id: string, content: string): UserBlock {
  return { id, type: 'user', timestamp: Date.now(), content };
}

function makeAgentBlock(id: string, content: string, toolCalls: string[] = []): AgentBlock {
  return { id, type: 'agent', timestamp: Date.now(), content, toolCalls };
}

function makeToolBlock(id: string, parentId: string, toolName: string): ToolBlock {
  return {
    id,
    type: 'tool',
    timestamp: Date.now(),
    parentId,
    toolName,
    input: {},
    output: {},
    status: 'success',
  };
}

describe('buildGraph', () => {
  const noop = () => { /* no-op for test */ };

  it('creates nodes with correct types', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const { nodes } = buildGraph(blocks, noop);

    expect(nodes.find((n) => n.id === 'u1')?.type).toBe('user');
    expect(nodes.find((n) => n.id === 'a1')?.type).toBe('agent');
  });

  it('creates edges for agent toolCalls', () => {
    const blocks = [
      makeUserBlock('u1', 'hello'),
      makeAgentBlock('a1', 'reading', ['t1']),
      makeToolBlock('t1', 'a1', 'Read'),
    ];
    const { edges } = buildGraph(blocks, noop);

    const toolEdge = edges.find((e) => e.source === 'a1' && e.target === 't1');
    expect(toolEdge).toBeDefined();
  });

  it('creates sequential flow edges between user and agent', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const { edges } = buildGraph(blocks, noop);

    const flowEdge = edges.find((e) => e.source === 'u1' && e.target === 'a1');
    expect(flowEdge).toBeDefined();
  });

  it('all edges have no custom stroke color or animation', () => {
    const blocks = [
      makeUserBlock('u1', 'hello'),
      makeAgentBlock('a1', 'reading', ['t1']),
      makeToolBlock('t1', 'a1', 'Read'),
    ];
    const { edges } = buildGraph(blocks, noop);

    for (const edge of edges) {
      expect(edge.style).toBeUndefined();
      expect(edge.animated).toBeUndefined();
    }
  });
});

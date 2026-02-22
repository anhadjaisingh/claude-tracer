import { describe, it, expect, vi } from 'vitest';
import { buildGraph } from '../buildGraph';
import type { UserBlock, AgentBlock, Chunk } from '@/types';

function makeUserBlock(id: string, content: string): UserBlock {
  return { id, type: 'user', timestamp: Date.now(), content };
}

function makeAgentBlock(id: string, content: string, toolCalls: string[] = []): AgentBlock {
  return { id, type: 'agent', timestamp: Date.now(), content, toolCalls };
}

function makeChunk(id: string, label: string, blockIds: string[]): Chunk {
  return {
    id,
    level: 'turn',
    label,
    blockIds,
    childChunkIds: [],
    totalTokensIn: 100,
    totalTokensOut: 200,
    totalWallTimeMs: 5000,
    boundarySignals: [],
  };
}

describe('buildGraph with groups', () => {
  const noop = () => {
    /* no-op */
  };

  it('creates group nodes when chunks are provided', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const chunks = [makeChunk('chunk-1', 'Greeting', ['u1', 'a1'])];
    const toggleCollapse = vi.fn();

    const { nodes } = buildGraph(blocks, noop, {
      chunks,
      collapsedGroups: new Set(),
      onToggleCollapse: toggleCollapse,
    });

    const groupNode = nodes.find((n) => n.id === 'chunk-1');
    expect(groupNode).toBeDefined();
    expect(groupNode?.type).toBe('chunkGroup');
  });

  it('assigns parentId to child block nodes', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const chunks = [makeChunk('chunk-1', 'Greeting', ['u1', 'a1'])];
    const toggleCollapse = vi.fn();

    const { nodes } = buildGraph(blocks, noop, {
      chunks,
      collapsedGroups: new Set(),
      onToggleCollapse: toggleCollapse,
    });

    const userNode = nodes.find((n) => n.id === 'u1');
    const agentNode = nodes.find((n) => n.id === 'a1');
    expect(userNode?.parentId).toBe('chunk-1');
    expect(agentNode?.parentId).toBe('chunk-1');
    expect(userNode?.extent).toBe('parent');
  });

  it('hides child nodes when group is collapsed', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const chunks = [makeChunk('chunk-1', 'Greeting', ['u1', 'a1'])];
    const toggleCollapse = vi.fn();

    const { nodes } = buildGraph(blocks, noop, {
      chunks,
      collapsedGroups: new Set(['chunk-1']),
      onToggleCollapse: toggleCollapse,
    });

    const userNode = nodes.find((n) => n.id === 'u1');
    const agentNode = nodes.find((n) => n.id === 'a1');
    expect(userNode?.hidden).toBe(true);
    expect(agentNode?.hidden).toBe(true);
  });

  it('hides edges connected to collapsed blocks', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const chunks = [makeChunk('chunk-1', 'Greeting', ['u1', 'a1'])];
    const toggleCollapse = vi.fn();

    const { edges } = buildGraph(blocks, noop, {
      chunks,
      collapsedGroups: new Set(['chunk-1']),
      onToggleCollapse: toggleCollapse,
    });

    const flowEdge = edges.find((e) => e.source === 'u1' && e.target === 'a1');
    expect(flowEdge?.hidden).toBe(true);
  });

  it('creates sequential edges between group nodes', () => {
    const blocks = [
      makeUserBlock('u1', 'hello'),
      makeAgentBlock('a1', 'hi'),
      makeUserBlock('u2', 'next'),
      makeAgentBlock('a2', 'ok'),
    ];
    const chunks = [
      makeChunk('chunk-1', 'First', ['u1', 'a1']),
      makeChunk('chunk-2', 'Second', ['u2', 'a2']),
    ];
    const toggleCollapse = vi.fn();

    const { edges } = buildGraph(blocks, noop, {
      chunks,
      collapsedGroups: new Set(),
      onToggleCollapse: toggleCollapse,
    });

    const groupEdge = edges.find((e) => e.id === 'group:chunk-1->chunk-2');
    expect(groupEdge).toBeDefined();
    // Group edges no longer have custom style — they inherit default edge options (solid + arrowheads)
    expect(groupEdge?.style).toBeUndefined();
  });

  it('does not create groups when chunks is empty', () => {
    const blocks = [makeUserBlock('u1', 'hello')];

    const { nodes } = buildGraph(blocks, noop, {
      chunks: [],
      collapsedGroups: new Set(),
      onToggleCollapse: vi.fn(),
    });

    const groupNodes = nodes.filter((n) => n.type === 'chunkGroup');
    expect(groupNodes).toHaveLength(0);
    expect(nodes.find((n) => n.id === 'u1')?.parentId).toBeUndefined();
  });

  it('sets group data with label and stats', () => {
    const blocks = [makeUserBlock('u1', 'hello')];
    const chunks = [makeChunk('chunk-1', 'My Label', ['u1'])];
    const toggleCollapse = vi.fn();

    const { nodes } = buildGraph(blocks, noop, {
      chunks,
      collapsedGroups: new Set(),
      onToggleCollapse: toggleCollapse,
    });

    const groupNode = nodes.find((n) => n.id === 'chunk-1');
    expect(groupNode).toBeDefined();
    const data: Record<string, unknown> = groupNode!.data; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(data.label).toBe('My Label');
    expect(data.blockCount).toBe(1);
    expect(data.totalTokensIn).toBe(100);
    expect(data.totalTokensOut).toBe(200);
    expect(data.durationMs).toBe(5000);
  });

  it('works without options (backward compatible)', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const { nodes, edges } = buildGraph(blocks, noop);

    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => n.parentId === undefined)).toBe(true);
    expect(edges.length).toBeGreaterThan(0);
  });
});

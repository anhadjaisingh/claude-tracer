import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { layoutGraph, getColumnIndex } from '../layout';

function makeNode(id: string, type: string, block?: Record<string, unknown>): Node {
  return {
    id,
    type,
    data: { block: block ?? {} },
    position: { x: 0, y: 0 },
  };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

describe('getColumnIndex', () => {
  it('assigns column 0 to tool nodes', () => {
    expect(getColumnIndex('tool')).toBe(0);
  });

  it('assigns column 1 to team-message nodes', () => {
    expect(getColumnIndex('team-message')).toBe(1);
  });

  it('assigns column 2 to agent nodes', () => {
    expect(getColumnIndex('agent')).toBe(2);
  });

  it('assigns column 3 to meta nodes', () => {
    expect(getColumnIndex('meta')).toBe(3);
  });

  it('assigns column 4 to user nodes', () => {
    expect(getColumnIndex('user')).toBe(4);
  });

  it('defaults to column 4 for undefined type', () => {
    expect(getColumnIndex(undefined)).toBe(4);
  });

  it('defaults to column 4 for unknown type', () => {
    expect(getColumnIndex('unknown')).toBe(4);
  });
});

describe('layoutGraph', () => {
  it('returns positioned nodes with valid coordinates', () => {
    const nodes = [makeNode('u1', 'user'), makeNode('a1', 'agent'), makeNode('t1', 'tool')];
    const edges = [makeEdge('u1', 'a1'), makeEdge('a1', 't1')];

    const result = layoutGraph(nodes, edges);

    for (const node of result.nodes) {
      expect(node.position.x).not.toBeNaN();
      expect(node.position.y).not.toBeNaN();
    }
  });

  it('places user nodes in the rightmost column (largest X)', () => {
    const nodes = [makeNode('u1', 'user'), makeNode('a1', 'agent')];
    const edges = [makeEdge('u1', 'a1')];

    const result = layoutGraph(nodes, edges);

    const userNode = result.nodes.find((n) => n.id === 'u1');
    const agentNode = result.nodes.find((n) => n.id === 'a1');
    if (!userNode || !agentNode) {
      throw new Error('Expected user and agent nodes to exist');
    }
    expect(userNode.position.x).toBeGreaterThan(agentNode.position.x);
  });

  it('places agent nodes to the right of tool nodes', () => {
    const nodes = [makeNode('u1', 'user'), makeNode('a1', 'agent'), makeNode('t1', 'tool')];
    const edges = [makeEdge('u1', 'a1'), makeEdge('a1', 't1')];

    const result = layoutGraph(nodes, edges);

    const agentNode = result.nodes.find((n) => n.id === 'a1');
    const toolNode = result.nodes.find((n) => n.id === 't1');
    if (!agentNode || !toolNode) {
      throw new Error('Expected agent and tool nodes to exist');
    }
    expect(agentNode.position.x).toBeGreaterThan(toolNode.position.x);
  });

  it('places tool children at the same Y as their parent agent', () => {
    const nodes = [
      makeNode('u1', 'user'),
      makeNode('a1', 'agent', { toolCalls: ['t1'] }),
      makeNode('t1', 'tool'),
    ];
    const edges = [makeEdge('u1', 'a1'), makeEdge('a1', 't1')];

    const result = layoutGraph(nodes, edges);

    const agentNode = result.nodes.find((n) => n.id === 'a1');
    const toolNode = result.nodes.find((n) => n.id === 't1');
    if (!agentNode || !toolNode) {
      throw new Error('Expected agent and tool nodes to exist');
    }
    expect(agentNode.position.y).toBe(toolNode.position.y);
  });

  it('places sequential blocks with increasing Y values', () => {
    const nodes = [makeNode('u1', 'user'), makeNode('a1', 'agent'), makeNode('u2', 'user')];
    const edges = [makeEdge('u1', 'a1'), makeEdge('a1', 'u2')];

    const result = layoutGraph(nodes, edges);

    const u1 = result.nodes.find((n) => n.id === 'u1');
    const a1 = result.nodes.find((n) => n.id === 'a1');
    const u2 = result.nodes.find((n) => n.id === 'u2');
    if (!u1 || !a1 || !u2) {
      throw new Error('Expected all nodes to exist');
    }
    expect(a1.position.y).toBeGreaterThan(u1.position.y);
    expect(u2.position.y).toBeGreaterThan(a1.position.y);
  });

  it('preserves edges unchanged', () => {
    const nodes = [makeNode('u1', 'user'), makeNode('a1', 'agent')];
    const edges = [makeEdge('u1', 'a1')];

    const result = layoutGraph(nodes, edges);
    expect(result.edges).toEqual(edges);
  });

  it('handles empty graph', () => {
    const result = layoutGraph([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('stacks multiple tool children vertically', () => {
    const nodes = [
      makeNode('a1', 'agent', { toolCalls: ['t1', 't2'] }),
      makeNode('t1', 'tool'),
      makeNode('t2', 'tool'),
    ];
    const edges = [makeEdge('a1', 't1'), makeEdge('a1', 't2')];

    const result = layoutGraph(nodes, edges);

    const t1 = result.nodes.find((n) => n.id === 't1');
    const t2 = result.nodes.find((n) => n.id === 't2');
    if (!t1 || !t2) {
      throw new Error('Expected tool nodes to exist');
    }
    // Both tools should be in the tool column (x = 0)
    expect(t1.position.x).toBe(0);
    expect(t2.position.x).toBe(0);
    // Second tool should be below first tool
    expect(t2.position.y).toBeGreaterThan(t1.position.y);
  });
});

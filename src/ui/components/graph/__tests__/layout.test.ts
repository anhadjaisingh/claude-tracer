import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { layoutGraph, getPartition } from '../layout';

function makeNode(id: string, type: string): Node {
  return {
    id,
    type,
    data: {},
    position: { x: 0, y: 0 },
  };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

describe('getPartition', () => {
  it('assigns partition 0 to tool nodes', () => {
    expect(getPartition('tool')).toBe(0);
  });

  it('assigns partition 1 to team-message nodes', () => {
    expect(getPartition('team-message')).toBe(1);
  });

  it('assigns partition 2 to agent nodes', () => {
    expect(getPartition('agent')).toBe(2);
  });

  it('assigns partition 3 to meta nodes', () => {
    expect(getPartition('meta')).toBe(3);
  });

  it('assigns partition 4 to user nodes', () => {
    expect(getPartition('user')).toBe(4);
  });
});

describe('layoutGraph', () => {
  it('returns positioned nodes with valid coordinates', async () => {
    const nodes = [
      makeNode('u1', 'user'),
      makeNode('a1', 'agent'),
      makeNode('t1', 'tool'),
    ];
    const edges = [makeEdge('u1', 'a1'), makeEdge('a1', 't1')];

    const result = await layoutGraph(nodes, edges);

    for (const node of result.nodes) {
      expect(node.position.x).not.toBeNaN();
      expect(node.position.y).not.toBeNaN();
    }
  });

  it('places user nodes to the right of agent nodes', async () => {
    const nodes = [
      makeNode('u1', 'user'),
      makeNode('a1', 'agent'),
    ];
    const edges = [makeEdge('u1', 'a1')];

    const result = await layoutGraph(nodes, edges);

    const userNode = result.nodes.find((n) => n.id === 'u1');
    const agentNode = result.nodes.find((n) => n.id === 'a1');
    if (!userNode || !agentNode) {
      throw new Error('Expected user and agent nodes to exist');
    }
    expect(userNode.position.x).toBeGreaterThan(agentNode.position.x);
  });

  it('places agent nodes to the right of tool nodes', async () => {
    const nodes = [
      makeNode('u1', 'user'),
      makeNode('a1', 'agent'),
      makeNode('t1', 'tool'),
    ];
    const edges = [makeEdge('u1', 'a1'), makeEdge('a1', 't1')];

    const result = await layoutGraph(nodes, edges);

    const agentNode = result.nodes.find((n) => n.id === 'a1');
    const toolNode = result.nodes.find((n) => n.id === 't1');
    if (!agentNode || !toolNode) {
      throw new Error('Expected agent and tool nodes to exist');
    }
    expect(agentNode.position.x).toBeGreaterThan(toolNode.position.x);
  });

  it('preserves edges unchanged', async () => {
    const nodes = [makeNode('u1', 'user'), makeNode('a1', 'agent')];
    const edges = [makeEdge('u1', 'a1')];

    const result = await layoutGraph(nodes, edges);
    expect(result.edges).toEqual(edges);
  });

  it('handles empty graph', async () => {
    const result = await layoutGraph([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});

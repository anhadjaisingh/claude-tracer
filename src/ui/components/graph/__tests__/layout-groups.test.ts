import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { layoutGraph } from '../layout';

function makeBlockNode(id: string, type: string, parentId?: string): Node {
  return {
    id,
    type,
    data: { block: {} },
    position: { x: 0, y: 0 },
    ...(parentId ? { parentId, extent: 'parent' as const } : {}),
  };
}

function makeGroupNode(id: string, collapsed: boolean): Node {
  return {
    id,
    type: 'chunkGroup',
    data: {
      label: `Group ${id}`,
      blockCount: 2,
      totalTokens: 100,
      durationMs: 5000,
      collapsed,
      onToggleCollapse: () => {
        /* no-op */
      },
      groupId: id,
      expandedWidth: 0,
      expandedHeight: 0,
    },
    position: { x: 0, y: 0 },
  };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

describe('layoutGraph with groups', () => {
  it('positions expanded group with children inside', () => {
    const nodes = [
      makeGroupNode('g1', false),
      makeBlockNode('u1', 'user', 'g1'),
      makeBlockNode('a1', 'agent', 'g1'),
    ];
    const edges = [makeEdge('u1', 'a1')];

    const result = layoutGraph(nodes, edges);

    const groupNode = result.nodes.find((n) => n.id === 'g1');
    const userNode = result.nodes.find((n) => n.id === 'u1');
    const agentNode = result.nodes.find((n) => n.id === 'a1');

    expect(groupNode).toBeDefined();
    expect(userNode).toBeDefined();
    expect(agentNode).toBeDefined();

    // Group should have positive width/height
    const gStyle = groupNode?.style as Record<string, number> | undefined;
    expect(gStyle?.width).toBeGreaterThan(0);
    expect(gStyle?.height).toBeGreaterThan(0);

    // Children should be positioned relative to group (small positive coords)
    if (userNode) {
      expect(userNode.position.x).toBeGreaterThanOrEqual(0);
      expect(userNode.position.y).toBeGreaterThan(0); // Below header
    }
  });

  it('uses collapsed dimensions for collapsed groups', () => {
    const nodes = [
      makeGroupNode('g1', true),
      { ...makeBlockNode('u1', 'user', 'g1'), hidden: true },
      { ...makeBlockNode('a1', 'agent', 'g1'), hidden: true },
    ];
    const edges: Edge[] = [];

    const result = layoutGraph(nodes, edges);

    const groupNode = result.nodes.find((n) => n.id === 'g1');
    expect(groupNode).toBeDefined();
    const gStyle = groupNode?.style as Record<string, number> | undefined;
    expect(gStyle?.width).toBe(320);
    expect(gStyle?.height).toBe(64);
  });

  it('stacks multiple groups vertically', () => {
    const nodes = [
      makeGroupNode('g1', false),
      makeBlockNode('u1', 'user', 'g1'),
      makeGroupNode('g2', false),
      makeBlockNode('u2', 'user', 'g2'),
    ];
    const edges: Edge[] = [];

    const result = layoutGraph(nodes, edges);

    const g1 = result.nodes.find((n) => n.id === 'g1');
    const g2 = result.nodes.find((n) => n.id === 'g2');

    expect(g1).toBeDefined();
    expect(g2).toBeDefined();
    if (g1 && g2) {
      expect(g2.position.y).toBeGreaterThan(g1.position.y);
    }
  });

  it('falls back to flat layout when no group nodes exist', () => {
    const nodes = [makeBlockNode('u1', 'user'), makeBlockNode('a1', 'agent')];
    const edges = [makeEdge('u1', 'a1')];

    const result = layoutGraph(nodes, edges);

    // User should be rightmost
    const userNode = result.nodes.find((n) => n.id === 'u1');
    const agentNode = result.nodes.find((n) => n.id === 'a1');

    if (userNode && agentNode) {
      expect(userNode.position.x).toBeGreaterThan(agentNode.position.x);
    }
  });

  it('handles tool children within groups', () => {
    const nodes = [
      makeGroupNode('g1', false),
      { ...makeBlockNode('a1', 'agent', 'g1'), data: { block: { toolCalls: ['t1'] } } },
      makeBlockNode('t1', 'tool', 'g1'),
    ];
    const edges = [makeEdge('a1', 't1')];

    const result = layoutGraph(nodes, edges);

    const agentNode = result.nodes.find((n) => n.id === 'a1');
    const toolNode = result.nodes.find((n) => n.id === 't1');

    expect(agentNode).toBeDefined();
    expect(toolNode).toBeDefined();

    // Tool node should be positioned (not left at 0,0 unreferenced)
    if (toolNode) {
      expect(toolNode.position.y).toBeGreaterThan(0); // Below group header
    }
  });
});

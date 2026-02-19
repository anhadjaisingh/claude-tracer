import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 320;
const BASE_NODE_HEIGHT = 80;

function estimateHeight(node: Node): number {
  const data: Record<string, unknown> = node.data;
  const block = data.block as Record<string, unknown> | undefined;
  if (!block) return BASE_NODE_HEIGHT;

  switch (node.type) {
    case 'meta':
      return 40;
    case 'user':
      return BASE_NODE_HEIGHT;
    case 'agent': {
      const toolCalls = block.toolCalls as string[] | undefined;
      const hasThinking = Boolean(block.thinking);
      let height = BASE_NODE_HEIGHT;
      if (toolCalls && toolCalls.length > 0) height += 20;
      if (hasThinking) height += 16;
      return height;
    }
    case 'tool':
      return 90;
    case 'team-message':
      return BASE_NODE_HEIGHT;
    default:
      return BASE_NODE_HEIGHT;
  }
}

export function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

  for (const node of nodes) {
    const height = estimateHeight(node);
    g.setNode(node.id, { width: NODE_WIDTH, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    return {
      ...node,
      position: {
        x: pos.x - pos.width / 2,
        y: pos.y - pos.height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

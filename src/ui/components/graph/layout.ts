import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

const elk = new ELK();

const NODE_WIDTH = 320;
const BASE_NODE_HEIGHT = 80;

const PARTITION_MAP: Record<string, number> = {
  tool: 0,
  'team-message': 1,
  agent: 2,
  meta: 3,
  user: 4,
};

export function getPartition(nodeType: string | undefined): number {
  return PARTITION_MAP[nodeType ?? 'user'] ?? 4;
}

function estimateHeight(node: Node): number {
  const data: Record<string, unknown> = node.data;
  const block = data.block as Record<string, unknown> | undefined;
  if (!block) return BASE_NODE_HEIGHT;

  switch (node.type) {
    case 'meta':
      return 40;
    case 'tool':
      return 90;
    case 'agent': {
      const toolCalls = block.toolCalls as string[] | undefined;
      const hasThinking = Boolean(block.thinking);
      let height = BASE_NODE_HEIGHT;
      if (toolCalls && toolCalls.length > 0) height += 20;
      if (hasThinking) height += 16;
      return height;
    }
    default:
      return BASE_NODE_HEIGHT;
  }
}

export async function layoutGraph(
  nodes: Node[],
  edges: Edge[],
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.partitioning.activate': 'true',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '50',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: estimateHeight(node),
      layoutOptions: {
        'elk.partitioning.partition': String(getPartition(node.type)),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layoutResult = await elk.layout(elkGraph);

  const positionMap = new Map<string, { x: number; y: number }>();
  for (const child of layoutResult.children ?? []) {
    positionMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  const layoutedNodes = nodes.map((node) => {
    const pos = positionMap.get(node.id) ?? { x: 0, y: 0 };
    return {
      ...node,
      position: pos,
    };
  });

  return { nodes: layoutedNodes, edges };
}

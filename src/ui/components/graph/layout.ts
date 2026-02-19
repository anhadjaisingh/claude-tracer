import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 320;
const COLUMN_GAP = 80;
const COLUMN_SPACING = NODE_WIDTH + COLUMN_GAP; // 400px between column starts
const ROW_GAP = 40;

/** Canonical left-to-right ordering of column types. Meta shares the user column. */
const TYPE_ORDER = ['tool', 'team-message', 'agent', 'user'] as const;

/** Column index for a node type (0=tool/leftmost, 3=user/rightmost). Meta shares user column. */
export function getColumnIndex(nodeType: string | undefined): number {
  const map: Record<string, number> = {
    tool: 0,
    'team-message': 1,
    agent: 2,
    meta: 3, // same as user
    user: 3,
  };
  return map[nodeType ?? 'user'] ?? 3;
}

/**
 * Build dynamic column X positions based on which node types are actually
 * present in the graph. This avoids wasting horizontal space on empty columns.
 */
export function buildColumnX(nodes: Node[]): Record<string, number> {
  const presentTypes = new Set(
    nodes.map((n) => {
      // Meta nodes share the user column
      const type = n.type ?? 'user';
      return type === 'meta' ? 'user' : type;
    }),
  );
  const columnX: Record<string, number> = {};
  let colIndex = 0;
  for (const type of TYPE_ORDER) {
    if (presentTypes.has(type)) {
      columnX[type] = colIndex * COLUMN_SPACING;
      colIndex++;
    }
  }
  // Meta nodes use the same X position as user nodes
  columnX.meta = columnX.user;
  return columnX;
}

function estimateHeight(node: Node): number {
  const data: Record<string, unknown> = node.data;
  const block = data.block as Record<string, unknown> | undefined;
  if (!block) return 80;

  switch (node.type) {
    case 'meta':
      return 40;
    case 'tool':
      return 90;
    case 'agent': {
      const toolCalls = block.toolCalls as string[] | undefined;
      const hasThinking = Boolean(block.thinking);
      let height = 80;
      if (toolCalls && toolCalls.length > 0) height += 20;
      if (hasThinking) height += 16;
      return height;
    }
    default:
      return 80;
  }
}

export function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Build dynamic column positions based on present types
  const columnX = buildColumnX(nodes);

  // Build lookup maps
  const nodeMap = new Map<string, Node>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Build parent->children map from edges (agent -> tool relationships)
  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode?.type === 'agent' && targetNode?.type === 'tool') {
      const children = childrenOf.get(edge.source) ?? [];
      children.push(edge.target);
      childrenOf.set(edge.source, children);
    }
  }

  // Track which nodes are tool children (placed with their parent, not independently)
  const toolChildIds = new Set<string>();
  for (const children of childrenOf.values()) {
    for (const childId of children) {
      toolChildIds.add(childId);
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  let globalY = 0;

  for (const node of nodes) {
    // Skip tool children - they are placed when their parent agent is processed
    if (toolChildIds.has(node.id)) continue;

    const nodeType = node.type ?? 'user';
    const x = columnX[nodeType] ?? 0;

    if (node.type === 'agent') {
      const children = childrenOf.get(node.id) ?? [];
      const agentHeight = estimateHeight(node);

      if (children.length === 0) {
        // Simple agent with no tool calls
        positions.set(node.id, { x, y: globalY });
        globalY += agentHeight + ROW_GAP;
      } else {
        // Agent with tool calls: place them side by side at the same Y
        const toolX = columnX.tool ?? 0; // eslint-disable-line @typescript-eslint/no-unnecessary-condition
        let toolY = globalY;
        let totalToolHeight = 0;

        for (const childId of children) {
          const childNode = nodeMap.get(childId);
          if (!childNode) continue;
          const childHeight = estimateHeight(childNode);
          positions.set(childId, { x: toolX, y: toolY });
          toolY += childHeight + ROW_GAP;
          totalToolHeight += childHeight + ROW_GAP;
        }
        // Remove trailing gap
        if (totalToolHeight > 0) totalToolHeight -= ROW_GAP;

        // Agent Y is at the same starting Y
        positions.set(node.id, { x, y: globalY });

        // Advance globalY by the taller of agent or tools stack
        globalY += Math.max(agentHeight, totalToolHeight) + ROW_GAP;
      }
    } else {
      // User, meta, team-message blocks
      positions.set(node.id, { x, y: globalY });
      globalY += estimateHeight(node) + ROW_GAP;
    }
  }

  const layoutedNodes = nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 };
    return { ...node, position: pos };
  });

  return { nodes: layoutedNodes, edges };
}

export { NODE_WIDTH };

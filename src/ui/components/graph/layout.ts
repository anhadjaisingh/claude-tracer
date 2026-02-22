import type { Node, Edge } from '@xyflow/react';
import { COLLAPSED_WIDTH, COLLAPSED_HEIGHT } from './nodes';

const NODE_WIDTH = 320;
const COLUMN_GAP = 80;
const COLUMN_SPACING = NODE_WIDTH + COLUMN_GAP; // 400px between column starts
const ROW_GAP = 40;
const TOOL_SIBLING_GAP = 12; // Tighter gap between parallel tool calls from same agent

/** Padding inside group containers */
const GROUP_PADDING_TOP = 44; // header height + margin
const GROUP_PADDING_BOTTOM = 16;
const GROUP_PADDING_X = 16;

/** Canonical left-to-right ordering of column types. Meta shares the user column. */
const TYPE_ORDER = ['tool', 'team-message', 'agent', 'user'] as const;

/** Column index for a node type (0=tool/leftmost, 3=user/rightmost). Meta shares user column. */
export function getColumnIndex(nodeType: string | undefined): number {
  const map: Record<string, number> = {
    tool: 0,
    subagent: 0, // sub-agent nodes go in the tool column
    progress: 0,
    'file-snapshot': 0,
    'team-message': 1,
    'queue-operation': 1,
    agent: 2,
    meta: 3, // same as user
    user: 3,
    command: 3, // command nodes go in the user column
    system: 3,
  };
  return map[nodeType ?? 'user'] ?? 3;
}

/**
 * Build dynamic column X positions based on which node types are actually
 * present in the graph. This avoids wasting horizontal space on empty columns.
 */
export function buildColumnX(nodes: Node[]): Record<string, number> {
  // Only consider non-group, non-hidden block nodes for column calculation
  const blockNodes = nodes.filter((n) => n.type !== 'chunkGroup' && !n.hidden);
  const presentTypes = new Set(
    blockNodes.map((n) => {
      // Normalize types that share columns
      const type = n.type ?? 'user';
      if (type === 'meta' || type === 'command' || type === 'system') return 'user';
      if (type === 'subagent' || type === 'progress' || type === 'file-snapshot') return 'tool';
      if (type === 'queue-operation') return 'team-message';
      return type;
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
  // Alias columns for types that share positions (only if source exists)
  if ('user' in columnX) {
    columnX.meta = columnX.user;
    columnX.command = columnX.user;
    columnX.system = columnX.user;
  }
  if ('tool' in columnX) {
    columnX.subagent = columnX.tool;
    columnX.progress = columnX.tool;
    columnX['file-snapshot'] = columnX.tool;
  }
  if ('team-message' in columnX) {
    columnX['queue-operation'] = columnX['team-message'];
  }
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
    case 'subagent':
      return 48; // compact one-liner
    case 'compaction':
      return 40; // thin divider
    case 'command':
      return 48; // compact pill
    case 'agent':
      return 80; // trimmed to 2-3 lines
    case 'system':
    case 'progress':
    case 'file-snapshot':
    case 'queue-operation':
      return 40;
    default:
      return 80;
  }
}

/**
 * Compute the bounding box width for a set of column positions.
 * Returns the total width from leftmost column to rightmost column + NODE_WIDTH.
 */
function computeColumnsWidth(columnX: Record<string, number>): number {
  const values = Object.values(columnX);
  if (values.length === 0) return NODE_WIDTH;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min + NODE_WIDTH;
}

export function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const groupNodes = nodes.filter((n) => n.type === 'chunkGroup');
  const blockNodes = nodes.filter((n) => n.type !== 'chunkGroup');

  // If no groups, do flat layout (original behavior)
  if (groupNodes.length === 0) {
    return flatLayout(blockNodes, edges);
  }

  return groupedLayout(groupNodes, blockNodes, edges);
}

/** Original flat layout — no grouping */
function flatLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const columnX = buildColumnX(nodes);

  const nodeMap = new Map<string, Node>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (
      sourceNode?.type === 'agent' &&
      (targetNode?.type === 'tool' || targetNode?.type === 'subagent')
    ) {
      const children = childrenOf.get(edge.source) ?? [];
      children.push(edge.target);
      childrenOf.set(edge.source, children);
    }
  }

  const toolChildIds = new Set<string>();
  for (const children of childrenOf.values()) {
    for (const childId of children) {
      toolChildIds.add(childId);
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  let globalY = 0;

  for (const node of nodes) {
    if (toolChildIds.has(node.id)) continue;

    const nodeType = node.type ?? 'user';
    const x = columnX[nodeType] ?? 0;

    if (node.type === 'agent') {
      const children = childrenOf.get(node.id) ?? [];
      const agentHeight = estimateHeight(node);

      if (children.length === 0) {
        positions.set(node.id, { x, y: globalY });
        globalY += agentHeight + ROW_GAP;
      } else {
        const toolX = columnX.tool ?? 0; // eslint-disable-line @typescript-eslint/no-unnecessary-condition
        let toolY = globalY;
        let totalToolHeight = 0;

        for (const childId of children) {
          const childNode = nodeMap.get(childId);
          if (!childNode) continue;
          const childHeight = estimateHeight(childNode);
          positions.set(childId, { x: toolX, y: toolY });
          toolY += childHeight + TOOL_SIBLING_GAP;
          totalToolHeight += childHeight + TOOL_SIBLING_GAP;
        }
        if (totalToolHeight > 0) totalToolHeight -= TOOL_SIBLING_GAP;

        positions.set(node.id, { x, y: globalY });
        globalY += Math.max(agentHeight, totalToolHeight) + ROW_GAP;
      }
    } else {
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

/** Layout with group containers */
function groupedLayout(
  groupNodes: Node[],
  blockNodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  // Build column positions from visible block nodes
  const visibleBlocks = blockNodes.filter((n) => !n.hidden);
  const columnX = buildColumnX(visibleBlocks.length > 0 ? visibleBlocks : blockNodes);
  const totalColumnsWidth = computeColumnsWidth(columnX) + GROUP_PADDING_X * 2;

  // Build lookup: groupId -> child block nodes (preserving order)
  const groupChildren = new Map<string, Node[]>();
  const ungroupedNodes: Node[] = [];

  for (const node of blockNodes) {
    if (node.parentId) {
      const children = groupChildren.get(node.parentId) ?? [];
      children.push(node);
      groupChildren.set(node.parentId, children);
    } else {
      ungroupedNodes.push(node);
    }
  }

  // Build agent->tool edges lookup
  const nodeMap = new Map<string, Node>();
  for (const node of blockNodes) {
    nodeMap.set(node.id, node);
  }

  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (
      sourceNode?.type === 'agent' &&
      (targetNode?.type === 'tool' || targetNode?.type === 'subagent')
    ) {
      const children = childrenOf.get(edge.source) ?? [];
      children.push(edge.target);
      childrenOf.set(edge.source, children);
    }
  }

  const toolChildIds = new Set<string>();
  for (const children of childrenOf.values()) {
    for (const childId of children) {
      toolChildIds.add(childId);
    }
  }

  // Now lay out each group and its children
  const allNodes: Node[] = [];
  let globalY = 0;

  // Minimum column X offset for relative positioning within groups
  const minColumnX = Math.min(...Object.values(columnX), 0);

  for (const groupNode of groupNodes) {
    const groupData: Record<string, unknown> = groupNode.data;
    const isCollapsed = groupData.collapsed === true;
    const children = groupChildren.get(groupNode.id) ?? [];

    if (isCollapsed) {
      // Collapsed group: single compact node
      allNodes.push({
        ...groupNode,
        position: { x: 0, y: globalY },
        style: {
          width: COLLAPSED_WIDTH,
          height: COLLAPSED_HEIGHT,
        },
      });
      globalY += COLLAPSED_HEIGHT + ROW_GAP;
    } else {
      // Expanded group: compute child layout positions (relative to group)
      const childPositions = new Map<string, { x: number; y: number }>();
      let innerY = GROUP_PADDING_TOP;

      for (const child of children) {
        if (toolChildIds.has(child.id)) continue;
        if (child.hidden) continue;

        const nodeType = child.type ?? 'user';
        const relX = (columnX[nodeType] ?? 0) - minColumnX + GROUP_PADDING_X;

        if (child.type === 'agent') {
          const agentToolChildren = childrenOf.get(child.id) ?? [];
          const agentHeight = estimateHeight(child);

          if (agentToolChildren.length === 0) {
            childPositions.set(child.id, { x: relX, y: innerY });
            innerY += agentHeight + ROW_GAP;
          } else {
            const toolColX: number = columnX.tool ?? 0; // eslint-disable-line @typescript-eslint/no-unnecessary-condition
            const toolRelX = toolColX - minColumnX + GROUP_PADDING_X;
            let toolY = innerY;
            let totalToolHeight = 0;

            for (const toolId of agentToolChildren) {
              const toolNode = nodeMap.get(toolId);
              if (!toolNode) continue;
              const toolHeight = estimateHeight(toolNode);
              childPositions.set(toolId, { x: toolRelX, y: toolY });
              toolY += toolHeight + TOOL_SIBLING_GAP;
              totalToolHeight += toolHeight + TOOL_SIBLING_GAP;
            }
            if (totalToolHeight > 0) totalToolHeight -= TOOL_SIBLING_GAP;

            childPositions.set(child.id, { x: relX, y: innerY });
            innerY += Math.max(agentHeight, totalToolHeight) + ROW_GAP;
          }
        } else {
          childPositions.set(child.id, { x: relX, y: innerY });
          innerY += estimateHeight(child) + ROW_GAP;
        }
      }

      const groupHeight = innerY + GROUP_PADDING_BOTTOM;
      const groupWidth = totalColumnsWidth;

      // Position group node
      allNodes.push({
        ...groupNode,
        position: { x: 0, y: globalY },
        style: {
          width: groupWidth,
          height: groupHeight,
        },
        data: {
          ...groupData,
          expandedWidth: groupWidth,
          expandedHeight: groupHeight,
        },
      });

      // Position child nodes (relative to group)
      for (const child of children) {
        const pos = childPositions.get(child.id) ?? { x: GROUP_PADDING_X, y: GROUP_PADDING_TOP };
        allNodes.push({ ...child, position: pos });
      }

      globalY += groupHeight + ROW_GAP;
    }
  }

  // Position any ungrouped nodes after groups
  for (const node of ungroupedNodes) {
    if (toolChildIds.has(node.id)) continue;
    const nodeType = node.type ?? 'user';
    const x = columnX[nodeType] ?? 0;
    allNodes.push({ ...node, position: { x, y: globalY } });
    globalY += estimateHeight(node) + ROW_GAP;
  }

  return { nodes: allNodes, edges };
}

export { NODE_WIDTH };

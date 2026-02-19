import type { Node, Edge } from '@xyflow/react';
import type { AnyBlock } from '@/types';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock } from '@/types';

function getNodeType(block: AnyBlock): string {
  if (isUserBlock(block)) {
    return block.isMeta ? 'meta' : 'user';
  }
  if (isAgentBlock(block)) return 'agent';
  if (isToolBlock(block)) return 'tool';
  if (isMcpBlock(block)) return 'tool'; // MCP blocks render like tool blocks
  return 'user';
}

function getEdgeStyle(
  sourceType: string,
  targetType: string,
): { strokeDasharray?: string; stroke: string } {
  // Agent -> Tool: dashed line (agent initiated the tool call)
  if (sourceType === 'agent' && targetType === 'tool') {
    return { strokeDasharray: '5 5', stroke: '#f97316' };
  }
  // Tool -> Agent: solid line (result flows back)
  if (sourceType === 'tool' && targetType === 'agent') {
    return { stroke: '#f97316' };
  }
  // User -> Agent: solid accent line
  if ((sourceType === 'user' || sourceType === 'meta') && targetType === 'agent') {
    return { stroke: '#3b82f6' };
  }
  // Agent -> User: solid accent line
  if (sourceType === 'agent' && (targetType === 'user' || targetType === 'meta')) {
    return { stroke: '#3b82f6' };
  }
  // Agent -> TeamMessage: dotted purple
  if (sourceType === 'agent' && targetType === 'team-message') {
    return { strokeDasharray: '2 4', stroke: '#8b5cf6' };
  }
  // Default sequential: light gray
  return { stroke: '#6b7280' };
}

export function buildGraph(
  blocks: AnyBlock[],
  onExpandBlock: (block: AnyBlock) => void,
): { nodes: Node[]; edges: Edge[] } {
  const blockMap = new Map<string, AnyBlock>();
  for (const block of blocks) {
    blockMap.set(block.id, block);
  }

  const nodes: Node[] = blocks.map((block) => ({
    id: block.id,
    type: getNodeType(block),
    data: { block, onExpandBlock },
    position: { x: 0, y: 0 }, // dagre will set this
  }));

  const edges: Edge[] = [];
  const edgeIds = new Set<string>();

  function addEdge(source: string, target: string, sourceType: string, targetType: string): void {
    const edgeId = `${source}->${target}`;
    if (edgeIds.has(edgeId)) return;
    edgeIds.add(edgeId);

    const style = getEdgeStyle(sourceType, targetType);

    edges.push({
      id: edgeId,
      source,
      target,
      style: {
        stroke: style.stroke,
        strokeWidth: 2,
        strokeDasharray: style.strokeDasharray,
      },
      animated: sourceType === 'agent' && targetType === 'tool',
    });
  }

  // 1. Build edges from agent toolCalls (agent -> tool)
  for (const block of blocks) {
    if (isAgentBlock(block)) {
      for (const toolCallId of block.toolCalls) {
        if (blockMap.has(toolCallId)) {
          addEdge(block.id, toolCallId, 'agent', 'tool');
        }
      }
    }
  }

  // 2. Build edges from parentId (tool -> parent agent for result flow)
  for (const block of blocks) {
    if ((isToolBlock(block) || isMcpBlock(block)) && block.parentId) {
      const parent = blockMap.get(block.parentId);
      if (parent) {
        // The agent->tool edge was already added above via toolCalls.
        // We don't add a reverse tool->agent edge to keep the DAG clean.
        // If this tool was not in the parent's toolCalls, add the link.
        const edgeId = `${block.parentId}->${block.id}`;
        if (!edgeIds.has(edgeId)) {
          addEdge(block.parentId, block.id, getNodeType(parent), 'tool');
        }
      }
    }
  }

  // 3. Sequential conversation flow edges
  //    When a user block follows an agent block (or vice versa) in sequence,
  //    create a flow edge — but skip tool blocks (they're linked via parentId).
  const topLevelBlocks = blocks.filter((b) => !isToolBlock(b) && !isMcpBlock(b));
  for (let i = 0; i < topLevelBlocks.length - 1; i++) {
    const current = topLevelBlocks[i];
    const next = topLevelBlocks[i + 1];

    const currentType = getNodeType(current);
    const nextType = getNodeType(next);

    // Connect user->agent or agent->user in conversation flow
    if ((currentType === 'user' || currentType === 'meta') && nextType === 'agent') {
      addEdge(current.id, next.id, currentType, nextType);
    } else if (currentType === 'agent' && (nextType === 'user' || nextType === 'meta')) {
      addEdge(current.id, next.id, currentType, nextType);
    } else if (currentType === 'agent' && nextType === 'agent') {
      // Consecutive agent blocks (e.g., after tool results come back)
      addEdge(current.id, next.id, 'agent', 'agent');
    } else {
      // Any other sequential pair
      addEdge(current.id, next.id, currentType, nextType);
    }
  }

  return { nodes, edges };
}

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
    position: { x: 0, y: 0 }, // layoutGraph will set this
  }));

  const edges: Edge[] = [];
  const edgeIds = new Set<string>();

  function addEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): void {
    const edgeId = `${source}->${target}`;
    if (edgeIds.has(edgeId)) return;
    edgeIds.add(edgeId);

    const edge: Edge = {
      id: edgeId,
      source,
      target,
    };
    if (sourceHandle) edge.sourceHandle = sourceHandle;
    if (targetHandle) edge.targetHandle = targetHandle;

    edges.push(edge);
  }

  // 1. Build edges from agent toolCalls (agent -> tool) using side handles
  for (const block of blocks) {
    if (isAgentBlock(block)) {
      for (const toolCallId of block.toolCalls) {
        if (blockMap.has(toolCallId)) {
          addEdge(block.id, toolCallId, 'tool-out', 'agent-in');
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
          addEdge(block.parentId, block.id, 'tool-out', 'agent-in');
        }
      }
    }
  }

  // 3. Sequential conversation flow edges
  //    When a user block follows an agent block (or vice versa) in sequence,
  //    create a flow edge -- but skip tool blocks (they're linked via parentId).
  const topLevelBlocks = blocks.filter((b) => !isToolBlock(b) && !isMcpBlock(b));
  for (let i = 0; i < topLevelBlocks.length - 1; i++) {
    const current = topLevelBlocks[i];
    const next = topLevelBlocks[i + 1];

    const currentType = getNodeType(current);
    const nextType = getNodeType(next);

    // Connect user->agent or agent->user in conversation flow
    if ((currentType === 'user' || currentType === 'meta') && nextType === 'agent') {
      addEdge(current.id, next.id);
    } else if (currentType === 'agent' && (nextType === 'user' || nextType === 'meta')) {
      addEdge(current.id, next.id);
    } else if (currentType === 'agent' && nextType === 'agent') {
      // Consecutive agent blocks (e.g., after tool results come back)
      addEdge(current.id, next.id);
    } else {
      // Any other sequential pair
      addEdge(current.id, next.id);
    }
  }

  return { nodes, edges };
}

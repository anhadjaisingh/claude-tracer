import type { Node, Edge } from '@xyflow/react';
import type { AnyBlock, Chunk } from '@/types';
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

export interface BuildGraphOptions {
  chunks?: Chunk[];
  collapsedGroups?: ReadonlySet<string>;
  onToggleCollapse?: (groupId: string) => void;
}

export function buildGraph(
  blocks: AnyBlock[],
  onExpandBlock: (block: AnyBlock) => void,
  options: BuildGraphOptions = {},
): { nodes: Node[]; edges: Edge[] } {
  const { chunks, collapsedGroups, onToggleCollapse } = options;

  const blockMap = new Map<string, AnyBlock>();
  for (const block of blocks) {
    blockMap.set(block.id, block);
  }

  // Build block-to-chunk lookup
  const blockToChunk = new Map<string, Chunk>();
  if (chunks) {
    for (const chunk of chunks) {
      for (const blockId of chunk.blockIds) {
        blockToChunk.set(blockId, chunk);
      }
    }
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const edgeIds = new Set<string>();

  // Track which blocks belong to collapsed groups
  const hiddenBlockIds = new Set<string>();
  if (chunks && collapsedGroups) {
    for (const chunk of chunks) {
      if (collapsedGroups.has(chunk.id)) {
        for (const blockId of chunk.blockIds) {
          hiddenBlockIds.add(blockId);
        }
      }
    }
  }

  // Create group nodes (one per chunk)
  if (chunks && chunks.length > 0 && onToggleCollapse) {
    for (const chunk of chunks) {
      const isCollapsed = collapsedGroups?.has(chunk.id) ?? false;
      nodes.push({
        id: chunk.id,
        type: 'chunkGroup',
        data: {
          label: chunk.label,
          blockCount: chunk.blockIds.length,
          totalTokens: chunk.totalTokensIn + chunk.totalTokensOut,
          durationMs: chunk.totalWallTimeMs,
          collapsed: isCollapsed,
          onToggleCollapse,
          groupId: chunk.id,
          expandedWidth: 0, // Will be set by layout
          expandedHeight: 0, // Will be set by layout
        },
        position: { x: 0, y: 0 },
      });
    }
  }

  // Create block nodes
  for (const block of blocks) {
    const chunk = blockToChunk.get(block.id);
    const isHidden = hiddenBlockIds.has(block.id);

    const node: Node = {
      id: block.id,
      type: getNodeType(block),
      data: { block, onExpandBlock },
      position: { x: 0, y: 0 },
      hidden: isHidden,
    };

    // Assign parentId if this block belongs to a chunk and we have group nodes
    if (chunk && chunks && chunks.length > 0 && onToggleCollapse) {
      node.parentId = chunk.id;
      node.extent = 'parent';
    }

    nodes.push(node);
  }

  function addEdge(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string,
  ): void {
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

    // Hide edges connected to hidden blocks
    if (hiddenBlockIds.has(source) || hiddenBlockIds.has(target)) {
      edge.hidden = true;
    }

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
        const edgeId = `${block.parentId}->${block.id}`;
        if (!edgeIds.has(edgeId)) {
          addEdge(block.parentId, block.id, 'tool-out', 'agent-in');
        }
      }
    }
  }

  // 3. Sequential conversation flow edges
  const topLevelBlocks = blocks.filter((b) => !isToolBlock(b) && !isMcpBlock(b));
  for (let i = 0; i < topLevelBlocks.length - 1; i++) {
    const current = topLevelBlocks[i];
    const next = topLevelBlocks[i + 1];

    const currentType = getNodeType(current);
    const nextType = getNodeType(next);

    if ((currentType === 'user' || currentType === 'meta') && nextType === 'agent') {
      addEdge(current.id, next.id);
    } else if (currentType === 'agent' && (nextType === 'user' || nextType === 'meta')) {
      addEdge(current.id, next.id);
    } else if (currentType === 'agent' && nextType === 'agent') {
      addEdge(current.id, next.id);
    } else {
      addEdge(current.id, next.id);
    }
  }

  // 4. Sequential edges between groups (connect last block of one group to first block of next)
  // These edges are visible even when groups are collapsed (connecting the group containers)
  if (chunks && chunks.length > 1) {
    for (let i = 0; i < chunks.length - 1; i++) {
      const current = chunks[i];
      const next = chunks[i + 1];
      // Add an edge between the group nodes themselves
      addGroupEdge(current.id, next.id);
    }
  }

  function addGroupEdge(source: string, target: string): void {
    const edgeId = `group:${source}->${target}`;
    if (edgeIds.has(edgeId)) return;
    edgeIds.add(edgeId);
    edges.push({
      id: edgeId,
      source,
      target,
      style: { strokeDasharray: '5 5', opacity: 0.4 },
    });
  }

  return { nodes, edges };
}

import type { Node, Edge } from '@xyflow/react';
import type { AnyBlock, Chunk } from '@/types';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock, isSystemBlock } from '@/types';

function getNodeType(block: AnyBlock): string | null {
  if (isUserBlock(block)) {
    if (block.isCommand) return 'command';
    return block.isMeta ? 'meta' : 'user';
  }
  if (isAgentBlock(block)) return 'agent';
  if (isToolBlock(block)) {
    if (block.toolName === 'Task') return 'subagent';
    return 'tool';
  }
  if (isMcpBlock(block)) return 'tool';
  if (isSystemBlock(block) && block.subtype === 'compact_boundary') return 'compaction';
  if (isSystemBlock(block)) return null;
  return null;
}

export interface BuildGraphOptions {
  chunks?: Chunk[];
  collapsedGroups?: ReadonlySet<string>;
  onToggleCollapse?: (groupId: string) => void;
}

/**
 * Build command groups: detect UserBlocks with isCommand and find the
 * subsequent isMeta blocks that belong to them. Returns a map of
 * commandBlockId -> list of meta block ids.
 */
function buildCommandGroups(blocks: AnyBlock[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  let currentCommandId: string | null = null;

  for (const block of blocks) {
    if (isUserBlock(block) && block.isCommand) {
      currentCommandId = block.id;
      groups.set(currentCommandId, []);
    } else if (currentCommandId !== null) {
      // Subsequent meta blocks belong to the command
      if (isUserBlock(block) && block.isMeta) {
        groups.get(currentCommandId)?.push(block.id);
      } else {
        // Non-meta block ends the command group
        currentCommandId = null;
      }
    }
  }

  return groups;
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

  // Build command groups
  const commandGroups = buildCommandGroups(blocks);

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

  // Track which meta blocks are hidden due to collapsed commands
  if (collapsedGroups) {
    for (const [commandId, metaIds] of commandGroups) {
      if (collapsedGroups.has(commandId)) {
        for (const metaId of metaIds) {
          hiddenBlockIds.add(metaId);
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
    const nodeType = getNodeType(block);
    if (nodeType === null) continue;

    const nodeData: Record<string, unknown> = { block, onExpandBlock };

    // Add command-specific data
    if (nodeType === 'command' && onToggleCollapse) {
      const metaIds = commandGroups.get(block.id) ?? [];
      nodeData.collapsed = collapsedGroups?.has(block.id) ?? false;
      nodeData.onToggleCollapse = onToggleCollapse;
      nodeData.childCount = metaIds.length;
    }

    const node: Node = {
      id: block.id,
      type: nodeType,
      data: nodeData,
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

    if (
      (currentType === 'user' || currentType === 'meta' || currentType === 'command') &&
      nextType === 'agent'
    ) {
      addEdge(current.id, next.id);
    } else if (
      currentType === 'agent' &&
      (nextType === 'user' || nextType === 'meta' || nextType === 'command')
    ) {
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

/**
 * NAVIGATION ARCHITECTURE -- READ BEFORE MODIFYING
 *
 * Why sidebar-to-graph navigation keeps breaking:
 *
 *   React Flow's viewport API (`setCenter`, `setViewport`, `fitBounds`) is only
 *   available via the `useReactFlow()` hook, which MUST be called inside a
 *   `<ReactFlowProvider>`. The sidebar lives OUTSIDE that provider (it is a
 *   sibling of GraphView in App.tsx), so it cannot call `useReactFlow()` directly.
 *
 *   Previous broken approaches tried:
 *   - `document.getElementById("block-{id}").scrollIntoView()` -- fails because
 *     React Flow nodes are NOT regular DOM elements with scrollable positions.
 *     They live inside a transformed SVG/CSS canvas controlled by React Flow's
 *     internal viewport state.
 *   - Calling `useReactFlow()` from App.tsx -- fails because App is outside the
 *     `<ReactFlowProvider>`.
 *
 * The correct pattern (implemented here):
 *
 *   1. GraphView exposes an `onNavigateReady` prop that receives a
 *      `(blockId: string) => void` callback.
 *   2. GraphViewInner (inside ReactFlowProvider) creates this callback using
 *      `useReactFlow().setCenter()` and the current node positions, then passes
 *      it up via `onNavigateReady`.
 *   3. App.tsx stores this callback in a ref and calls it when the sidebar
 *      requests navigation.
 *
 *   The React Flow API used: `setCenter(x, y, { zoom, duration })` from
 *   `useReactFlow()`. This smoothly pans + zooms to center the given world
 *   coordinates in the viewport.
 *
 * Rules for future developers:
 *   - NEVER replace `setCenter`/`setViewport` with DOM-based scrolling.
 *   - NEVER move `<ReactFlowProvider>` out of GraphView without updating every
 *     consumer of `useReactFlow()`.
 *   - If you add a new navigation entry point (e.g., search result click),
 *     use the same `navigateToBlock` callback -- do NOT create a parallel path.
 *   - The e2e test in `e2e/specs/sidebar.spec.ts` guards this behavior.
 *     If it fails, you have broken navigation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTheme } from '../../themes';
import { buildGraph } from './buildGraph';
import { layoutGraph } from './layout';
import {
  UserNode,
  AgentNode,
  ToolNode,
  MetaNode,
  TeamMessageNode,
  ChunkGroupNode,
  CompactionNode,
  SubAgentNode,
  CommandNode,
  SystemNode,
  ProgressNode,
  FileSnapshotNode,
  QueueOperationNode,
} from './nodes';
import type { AnyBlock, Chunk } from '@/types';

export type NavigateToBlockFn = (blockId: string) => void;

const nodeTypes = {
  user: UserNode,
  agent: AgentNode,
  tool: ToolNode,
  meta: MetaNode,
  'team-message': TeamMessageNode,
  chunkGroup: ChunkGroupNode,
  compaction: CompactionNode,
  subagent: SubAgentNode,
  command: CommandNode,
  system: SystemNode,
  progress: ProgressNode,
  'file-snapshot': FileSnapshotNode,
  'queue-operation': QueueOperationNode,
};

function minimapNodeColor(node: { type?: string }): string {
  switch (node.type) {
    case 'user':
      return '#3b82f6';
    case 'agent':
      return '#f97316';
    case 'tool':
      return '#0f0f0f';
    case 'meta':
      return '#9ca3af';
    case 'team-message':
      return '#8b5cf6';
    case 'chunkGroup':
      return 'rgba(249,115,22,0.3)';
    case 'compaction':
      return '#f59e0b';
    case 'subagent':
      return '#6366f1';
    case 'command':
      return '#3b82f6';
    case 'system':
      return '#6b7280';
    case 'progress':
      return '#14b8a6';
    case 'file-snapshot':
      return '#22c55e';
    case 'queue-operation':
      return '#818cf8';
    default:
      return '#6b7280';
  }
}

interface Props {
  blocks: AnyBlock[];
  chunks?: Chunk[];
  onExpandBlock: (block: AnyBlock) => void;
  onNavigateReady?: (navigateToBlock: NavigateToBlockFn) => void;
  nodesDraggable?: boolean;
  showMinimap?: boolean;
  highlightedBlockId?: string | null;
  onCollapseControlsReady?: (controls: { collapseAll: () => void; expandAll: () => void }) => void;
}

/** Half the default node width, used to compute node center for setCenter(). */
const NODE_CENTER_OFFSET_X = 160;
/** Half the default node height, used to compute node center for setCenter(). */
const NODE_CENTER_OFFSET_Y = 40;

function GraphViewInner({
  blocks,
  chunks,
  onExpandBlock,
  onNavigateReady,
  nodesDraggable = false,
  showMinimap = true,
  highlightedBlockId,
  onCollapseControlsReady,
}: Props) {
  const theme = useTheme();
  const { setCenter } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // Track which groups are collapsed (start all expanded)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const initialViewportSet = useRef(false);
  const nodesRef = useRef<Node[]>([]);

  const chunksRef = useRef<Chunk[]>([]);
  useEffect(() => {
    chunksRef.current = chunks ?? [];
  }, [chunks]);

  // Keep nodesRef in sync so the navigate callback always has current positions
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Expose collapse/expand controls to parent
  useEffect(() => {
    if (!onCollapseControlsReady) return;
    onCollapseControlsReady({
      collapseAll: () => {
        if (!chunks) return;
        setCollapsedGroups(new Set(chunks.map((c) => c.id)));
      },
      expandAll: () => {
        setCollapsedGroups(new Set());
      },
    });
  }, [onCollapseControlsReady, chunks]);

  // Expose the navigateToBlock function to the parent whenever setCenter is available
  useEffect(() => {
    if (!onNavigateReady) return;

    const navigateToBlock: NavigateToBlockFn = (blockId: string) => {
      // First try to find the block node directly
      let targetNode = nodesRef.current.find((n) => n.id === blockId);

      if (!targetNode || targetNode.hidden) {
        const containingChunk = chunksRef.current.find((c) => c.blockIds.includes(blockId));
        if (containingChunk) {
          setCollapsedGroups((prev) => {
            const next = new Set(prev);
            next.delete(containingChunk.id);
            return next;
          });
          const groupNode = nodesRef.current.find((n) => n.id === containingChunk.id);
          if (groupNode) {
            targetNode = groupNode;
          }
        }
      }

      if (!targetNode) return;

      // For child nodes, compute world position (parent position + child relative position)
      let worldX = targetNode.position.x;
      let worldY = targetNode.position.y;

      if (targetNode.parentId) {
        const parentNode = nodesRef.current.find((n) => n.id === targetNode.parentId);
        if (parentNode) {
          worldX += parentNode.position.x;
          worldY += parentNode.position.y;
        }
      }

      void setCenter(worldX + NODE_CENTER_OFFSET_X, worldY + NODE_CENTER_OFFSET_Y, {
        zoom: 1,
        duration: 500,
      });
    };

    onNavigateReady(navigateToBlock);
  }, [onNavigateReady, setCenter, setCollapsedGroups]);

  const handleToggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Stable collapsed groups ref for buildGraph options
  const collapsedGroupsRef = useMemo(() => collapsedGroups, [collapsedGroups]);

  useEffect(() => {
    if (blocks.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const hasChunks = chunks !== undefined && chunks.length > 0;

    const { nodes: rawNodes, edges: rawEdges } = buildGraph(blocks, onExpandBlock, {
      chunks: hasChunks ? chunks : undefined,
      collapsedGroups: collapsedGroupsRef,
      onToggleCollapse: hasChunks ? handleToggleCollapse : undefined,
    });

    const result = layoutGraph(rawNodes, rawEdges);
    setNodes(result.nodes);
    setEdges(result.edges);

    // Set initial viewport centered on the first node
    if (!initialViewportSet.current && result.nodes.length > 0) {
      initialViewportSet.current = true;

      const firstNode = result.nodes[0];
      void setCenter(
        firstNode.position.x + NODE_CENTER_OFFSET_X,
        firstNode.position.y + NODE_CENTER_OFFSET_Y,
        { zoom: 0.85, duration: 0 },
      );
    }
  }, [
    blocks,
    chunks,
    onExpandBlock,
    setNodes,
    setEdges,
    setCenter,
    collapsedGroupsRef,
    handleToggleCollapse,
  ]);

  // Update node className when search result changes for visual highlight
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => ({
        ...node,
        className: node.id === highlightedBlockId ? 'search-highlight' : undefined,
      })),
    );
  }, [highlightedBlockId, setNodes]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Don't open overlay for group nodes
      if (node.type === 'chunkGroup') return;
      const block = (node.data as { block: AnyBlock }).block;
      onExpandBlock(block);
    },
    [onExpandBlock],
  );

  if (blocks.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full opacity-60"
        style={{ color: theme.colors.agentText }}
      >
        No blocks to display. Open a session file to begin.
      </div>
    );
  }

  const showLoadingOverlay = blocks.length > 0 && nodes.length === 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {showLoadingOverlay && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10"
          style={{ backgroundColor: theme.colors.background }}
        >
          <div
            className="tracer-spinner"
            style={{ borderColor: `${theme.colors.accent}33`, borderTopColor: theme.colors.accent }}
          />
          <span
            className="mt-4 text-sm font-mono opacity-80"
            style={{ color: theme.colors.agentText }}
          >
            Computing layout...
          </span>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        nodesDraggable={nodesDraggable}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'default',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: theme.colors.edgeColor,
          },
          style: { stroke: theme.colors.edgeColor, strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={false}
        panOnScroll={true}
      >
        <Controls
          style={{
            backgroundColor: theme.colors.headerBg,
            borderColor: 'rgba(255,255,255,0.2)',
          }}
        />
        {showMinimap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="rgba(0,0,0,0.3)"
            pannable
            zoomable
            style={{
              backgroundColor: theme.colors.headerBg,
            }}
          />
        )}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.1)"
        />
      </ReactFlow>
    </div>
  );
}

export function GraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  );
}

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

import { useCallback, useEffect, useRef } from 'react';
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
} from '@xyflow/react';
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTheme } from '../../themes';
import { buildGraph } from './buildGraph';
import { layoutGraph } from './layout';
import { UserNode, AgentNode, ToolNode, MetaNode, TeamMessageNode } from './nodes';
import type { AnyBlock } from '@/types';

export type NavigateToBlockFn = (blockId: string) => void;

const nodeTypes = {
  user: UserNode,
  agent: AgentNode,
  tool: ToolNode,
  meta: MetaNode,
  'team-message': TeamMessageNode,
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
    default:
      return '#6b7280';
  }
}

interface Props {
  blocks: AnyBlock[];
  onExpandBlock: (block: AnyBlock) => void;
  onNavigateReady?: (navigateToBlock: NavigateToBlockFn) => void;
}

/** Half the default node width, used to compute node center for setCenter(). */
const NODE_CENTER_OFFSET_X = 160;
/** Half the default node height, used to compute node center for setCenter(). */
const NODE_CENTER_OFFSET_Y = 40;

function GraphViewInner({ blocks, onExpandBlock, onNavigateReady }: Props) {
  const theme = useTheme();
  const { setViewport, setCenter } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  const initialViewportSet = useRef(false);
  const nodesRef = useRef<Node[]>([]);

  // Keep nodesRef in sync so the navigate callback always has current positions
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Expose the navigateToBlock function to the parent whenever setCenter is available
  useEffect(() => {
    if (!onNavigateReady) return;

    const navigateToBlock: NavigateToBlockFn = (blockId: string) => {
      const targetNode = nodesRef.current.find((n) => n.id === blockId);
      if (!targetNode) return;

      // setCenter takes world coordinates of the point to center in the viewport
      void setCenter(
        targetNode.position.x + NODE_CENTER_OFFSET_X,
        targetNode.position.y + NODE_CENTER_OFFSET_Y,
        { zoom: 1, duration: 500 },
      );
    };

    onNavigateReady(navigateToBlock);
  }, [onNavigateReady, setCenter]);

  useEffect(() => {
    if (blocks.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: rawNodes, edges: rawEdges } = buildGraph(blocks, onExpandBlock);

    let cancelled = false;
    void layoutGraph(rawNodes, rawEdges).then((result) => {
      if (cancelled) return;
      setNodes(result.nodes);
      setEdges(result.edges);

      // Set initial viewport to show the first node near the top-right
      if (!initialViewportSet.current && result.nodes.length > 0) {
        initialViewportSet.current = true;

        // Find the topmost node (smallest y)
        let topNode = result.nodes[0];
        for (const node of result.nodes) {
          if (node.position.y < topNode.position.y) {
            topNode = node;
          }
        }

        // Position viewport so the top node is visible with some padding
        void setViewport({
          x: -(topNode.position.x - 100),
          y: -(topNode.position.y - 50),
          zoom: 1,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [blocks, onExpandBlock, setNodes, setEdges, setViewport]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
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
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: theme.colors.edgeColor, strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          style={{
            backgroundColor: theme.colors.headerBg,
            borderColor: 'rgba(255,255,255,0.2)',
          }}
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(0,0,0,0.3)"
          style={{
            backgroundColor: theme.colors.headerBg,
          }}
        />
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

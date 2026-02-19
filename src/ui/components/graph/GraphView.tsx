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
}

function GraphViewInner({ blocks, onExpandBlock }: Props) {
  const theme = useTheme();
  const { setViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const initialViewportSet = useRef(false);

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

  return (
    <div style={{ width: '100%', height: '100%' }}>
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

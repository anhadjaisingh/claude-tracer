import { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { NodeMouseHandler } from '@xyflow/react';
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

interface Props {
  blocks: AnyBlock[];
  onExpandBlock: (block: AnyBlock) => void;
}

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

export function GraphView({ blocks, onExpandBlock }: Props) {
  const theme = useTheme();

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    if (blocks.length === 0) {
      return { layoutedNodes: [], layoutedEdges: [] };
    }

    const { nodes: rawNodes, edges: rawEdges } = buildGraph(blocks, onExpandBlock);
    const { nodes: positioned, edges: finalEdges } = layoutGraph(rawNodes, rawEdges);

    return { layoutedNodes: positioned, layoutedEdges: finalEdges };
  }, [blocks, onExpandBlock]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync nodes/edges when blocks change (WebSocket updates)
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

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
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
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

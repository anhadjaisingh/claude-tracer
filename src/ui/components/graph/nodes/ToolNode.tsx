import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import { getToolRenderer } from '../../../renderers';
import type { ToolBlock, McpBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface ToolNodeData {
  block: ToolBlock | McpBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

function getToolName(block: ToolBlock | McpBlock): string {
  if (block.type === 'tool') return block.toolName;
  return `${block.serverName}/${block.method}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return '#166534';
    case 'error':
      return '#991b1b';
    case 'pending':
      return '#854d0e';
    default:
      return '#6b7280';
  }
}

export function ToolNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as ToolNodeData;

  const toolName = getToolName(block);
  const renderer = getToolRenderer(toolName);
  const statusColor = getStatusColor(block.status);

  const headerText = renderer.headerSummary(block.input, block.output);
  // Truncate header for the compact node view
  const headerTruncated = headerText.length > 60 ? headerText.slice(0, 60) + '...' : headerText;

  return (
    <div
      id={`block-${block.id}`}
      className="rounded cursor-pointer transition-shadow hover:shadow-lg font-mono"
      style={{
        width: 300,
        padding: '10px 14px',
        backgroundColor: theme.colors.toolBg,
        color: theme.colors.toolText,
        border: `2px solid ${theme.colors.accent}60`,
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle
        type="target"
        position={Position.Right}
        id="agent-in"
        style={{ opacity: 0, width: 0, height: 0 }}
      />

      <div className="flex items-center gap-2 mb-1">
        <span className="shrink-0 text-xs">{renderer.icon}</span>
        <span
          className="px-2 py-0.5 rounded text-xs font-bold"
          style={{ backgroundColor: statusColor, color: '#ffffff' }}
        >
          {toolName}
        </span>
        <span className="text-xs opacity-50">{block.status}</span>
      </div>

      {headerTruncated && (
        <div className="text-xs opacity-70 truncate" title={headerText}>
          {headerTruncated}
        </div>
      )}

      <div className="mt-1">{renderer.preview(block.input, block.output)}</div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

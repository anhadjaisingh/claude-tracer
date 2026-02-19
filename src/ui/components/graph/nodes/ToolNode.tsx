import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
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

function getInputSummary(input: unknown): string {
  if (typeof input === 'string') {
    return input.length > 60 ? input.slice(0, 60) + '...' : input;
  }
  const str = JSON.stringify(input);
  return str.length > 60 ? str.slice(0, 60) + '...' : str;
}

export function ToolNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as ToolNodeData;

  const toolName = getToolName(block);
  const inputSummary = getInputSummary(block.input);
  const statusColor = block.status === 'success' ? '#166534' : '#991b1b';

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
      <Handle type="target" position={Position.Top} style={{ background: theme.colors.accent }} />

      <div className="flex items-center gap-2 mb-1">
        <span
          className="px-2 py-0.5 rounded text-xs"
          style={{ backgroundColor: statusColor, color: '#ffffff' }}
        >
          {toolName}
        </span>
        <span className="text-xs opacity-50">{block.status}</span>
      </div>

      <div className="text-xs opacity-70 truncate">{inputSummary}</div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: theme.colors.accent }}
      />
    </div>
  );
}

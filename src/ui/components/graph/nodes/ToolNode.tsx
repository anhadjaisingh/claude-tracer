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

function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return JSON.stringify(value);
}

function getToolSummary(block: ToolBlock | McpBlock): { label: string; detail: string } {
  const input = block.input as Record<string, unknown> | undefined;
  if (!input) return { label: getToolName(block), detail: '' };

  const name = getToolName(block);
  switch (name) {
    case 'Read':
      return { label: name, detail: safeString(input.file_path) };
    case 'Write':
      return { label: name, detail: safeString(input.file_path) };
    case 'Edit':
      return { label: name, detail: safeString(input.file_path) };
    case 'Bash':
      return { label: name, detail: safeString(input.command).slice(0, 80) };
    case 'Grep':
      return { label: name, detail: `pattern: ${safeString(input.pattern)}` };
    case 'Glob':
      return { label: name, detail: `pattern: ${safeString(input.pattern)}` };
    default:
      return { label: name, detail: getInputSummary(input) };
  }
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

  const { label, detail } = getToolSummary(block);
  const statusColor = getStatusColor(block.status);

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
      <Handle
        type="target"
        position={Position.Right}
        id="agent-in"
        style={{ background: theme.colors.accent }}
      />

      <div className="flex items-center gap-2 mb-1">
        <span
          className="px-2 py-0.5 rounded text-xs font-bold"
          style={{ backgroundColor: statusColor, color: '#ffffff' }}
        >
          {label}
        </span>
        <span className="text-xs opacity-50">{block.status}</span>
      </div>

      {detail && (
        <div className="text-xs opacity-70 truncate" title={detail}>
          {detail}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: theme.colors.accent }}
      />
    </div>
  );
}

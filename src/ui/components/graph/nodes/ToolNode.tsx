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

function getStatusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case 'success':
      return { label: '\u2713', color: '#166534' };
    case 'error':
      return { label: '\u2717', color: '#991b1b' };
    case 'pending':
      return { label: '\u2026', color: '#854d0e' };
    default:
      return { label: '?', color: '#6b7280' };
  }
}

function formatTime(ms: number | undefined): string {
  if (ms == null) return '';
  if (ms < 1000) return `${String(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(tokensIn: number | undefined, tokensOut: number | undefined): string {
  const total = (tokensIn ?? 0) + (tokensOut ?? 0);
  if (total === 0) return '';
  if (total < 1000) return `${String(total)} tok`;
  return `${(total / 1000).toFixed(1)}k tok`;
}

export function ToolNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as ToolNodeData;

  const toolName = getToolName(block);
  const renderer = getToolRenderer(toolName);
  const status = getStatusBadge(block.status);
  const headerText = renderer.headerSummary(block.input, block.output);
  const keyArg = headerText.length > 50 ? headerText.slice(0, 50) + '\u2026' : headerText;
  const time = formatTime(block.wallTimeMs);
  const tokens = formatTokens(block.tokensIn, block.tokensOut);

  return (
    <div
      id={`block-${block.id}`}
      className="rounded cursor-pointer transition-shadow hover:shadow-lg font-mono"
      style={{
        width: 300,
        padding: '6px 10px',
        backgroundColor: theme.colors.toolBg,
        color: theme.colors.toolText,
        border: `1px solid ${theme.colors.accent}40`,
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

      <div className="flex items-center gap-1.5 text-xs">
        <span className="shrink-0">{renderer.icon}</span>
        <span className="font-bold shrink-0">{toolName}</span>
        <span className="opacity-60 truncate flex-1" title={headerText}>
          {keyArg}
        </span>
        <span
          className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ backgroundColor: status.color, color: '#fff' }}
        >
          {status.label}
        </span>
      </div>

      {(time || tokens) && (
        <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-40">
          {time && <span>{time}</span>}
          {tokens && <span>{tokens}</span>}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

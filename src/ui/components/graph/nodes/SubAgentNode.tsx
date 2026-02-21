import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { ToolBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface SubAgentNodeData {
  block: ToolBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

function extractTaskInfo(input: unknown): { agentType: string; description: string } {
  const data = input as Record<string, unknown> | undefined;
  if (!data) return { agentType: 'agent', description: '' };
  const agentType = typeof data.subagent_type === 'string' ? data.subagent_type : 'agent';
  const description =
    typeof data.description === 'string'
      ? data.description
      : typeof data.prompt === 'string'
        ? data.prompt.split('\n')[0]
        : '';
  return { agentType, description };
}

export function SubAgentNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as SubAgentNodeData;

  const { agentType, description } = extractTaskInfo(block.input);
  const preview = description.length > 80 ? description.slice(0, 80) + '\u2026' : description;
  const statusColor =
    block.status === 'success' ? '#166534' : block.status === 'error' ? '#991b1b' : '#854d0e';
  const statusLabel =
    block.status === 'success' ? '\u2713' : block.status === 'error' ? '\u2717' : '\u2026';

  return (
    <div
      id={`block-${block.id}`}
      className="rounded cursor-pointer transition-shadow hover:shadow-lg font-mono"
      style={{
        width: 300,
        padding: '6px 10px',
        backgroundColor: theme.colors.toolBg,
        color: theme.colors.toolText,
        border: `1px dashed ${theme.colors.accent}80`,
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
        <span className="shrink-0">{'\u{1F916}'}</span>
        <span
          className="px-1 py-0.5 rounded text-[10px] font-bold shrink-0"
          style={{ backgroundColor: `${theme.colors.accent}30`, color: theme.colors.accent }}
        >
          {agentType}
        </span>
        <span className="opacity-60 truncate flex-1" title={description}>
          {preview}
        </span>
        <span
          className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ backgroundColor: statusColor, color: '#fff' }}
        >
          {statusLabel}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

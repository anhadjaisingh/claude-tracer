import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { AgentBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface AgentNodeData {
  block: AgentBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

function formatTokens(tokensIn: number | undefined, tokensOut: number | undefined): string {
  const total = (tokensIn ?? 0) + (tokensOut ?? 0);
  if (total === 0) return '';
  if (total < 1000) return `${String(total)} tok`;
  return `${(total / 1000).toFixed(1)}k tok`;
}

export function AgentNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as AgentNodeData;

  // Truncate to ~200 chars (2-3 lines)
  const preview = block.content.length > 200 ? block.content.slice(0, 200) + '\u2026' : block.content;
  const tokens = formatTokens(block.tokensIn, block.tokensOut);
  const time = block.wallTimeMs != null ? `${(block.wallTimeMs / 1000).toFixed(1)}s` : '';

  return (
    <div
      id={`block-${block.id}`}
      className="rounded-lg cursor-pointer transition-shadow hover:shadow-lg"
      style={{
        width: 300,
        padding: '10px 14px',
        backgroundColor: theme.colors.agentBg,
        color: theme.colors.agentText,
        border: `2px solid ${theme.colors.accent}`,
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />

      <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{preview}</div>

      <div className="flex items-center gap-2 mt-1.5 text-[10px] opacity-50">
        {tokens && <span>{tokens}</span>}
        {time && <span>{time}</span>}
        {block.toolCalls.length > 0 && (
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(249,115,22,0.2)', color: '#fb923c' }}
          >
            {String(block.toolCalls.length)} tool call{block.toolCalls.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="tool-out"
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

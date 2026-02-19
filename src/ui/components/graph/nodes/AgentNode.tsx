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

export function AgentNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as AgentNodeData;

  const preview = block.content.length > 100 ? block.content.slice(0, 100) + '...' : block.content;

  return (
    <div
      id={`block-${block.id}`}
      className="rounded-lg cursor-pointer transition-shadow hover:shadow-lg"
      style={{
        width: 300,
        padding: '12px 16px',
        backgroundColor: theme.colors.agentBg,
        color: theme.colors.agentText,
        border: `2px solid ${theme.colors.accent}`,
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />

      <div className="flex items-center gap-2 mb-1 text-xs opacity-60">
        <span className="font-semibold uppercase">Agent</span>
        {block.tokensIn != null && <span>{block.tokensIn} in</span>}
        {block.tokensOut != null && <span>{block.tokensOut} out</span>}
        {block.wallTimeMs != null && <span>{(block.wallTimeMs / 1000).toFixed(1)}s</span>}
      </div>

      {block.thinking && (
        <div className="text-xs opacity-50 mb-1 truncate" style={{ maxWidth: 268 }}>
          thinking...
        </div>
      )}

      <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{preview}</div>

      {block.toolCalls.length > 0 && (
        <div
          className="mt-1 text-xs px-2 py-0.5 rounded-full inline-block"
          style={{ backgroundColor: 'rgba(249,115,22,0.2)', color: '#fb923c' }}
        >
          {block.toolCalls.length} tool call
          {block.toolCalls.length > 1 ? 's' : ''}
        </div>
      )}

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

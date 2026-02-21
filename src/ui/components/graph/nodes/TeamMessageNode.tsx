import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { TeamMessageBlock, AnyBlock } from '@/types';

interface TeamMessageNodeData {
  block: TeamMessageBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

export function TeamMessageNode({ data }: NodeProps) {
  const { block, onExpandBlock } = data as unknown as TeamMessageNodeData;

  const preview = block.content.length > 80 ? block.content.slice(0, 80) + '...' : block.content;
  const direction = block.recipient ? `\u2192 ${block.recipient}` : '';

  return (
    <div
      id={`block-${block.id}`}
      className="rounded-lg cursor-pointer transition-shadow hover:shadow-lg"
      style={{
        width: 300,
        padding: '12px 16px',
        backgroundColor: '#4c1d95',
        color: '#e9d5ff',
        border: '2px solid #8b5cf6',
      }}
      onClick={() => {
        onExpandBlock(block as unknown as AnyBlock);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />

      <div className="flex items-center gap-2 mb-1 text-xs opacity-70">
        <span className="font-semibold">{block.sender}</span>
        {direction && <span>{direction}</span>}
        <span className="ml-auto opacity-50">{block.messageType}</span>
      </div>

      <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{preview}</div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

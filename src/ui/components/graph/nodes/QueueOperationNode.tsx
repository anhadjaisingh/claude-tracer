import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { QueueOperationBlock, AnyBlock } from '@/types';

interface QueueOperationNodeData {
  block: QueueOperationBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

export function QueueOperationNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as QueueOperationNodeData;

  const opLabel = block.operation === 'enqueue' ? '+' : '\u2212';
  const opColor = block.operation === 'enqueue' ? '#818cf8' : '#f87171';
  const contentPreview = block.content
    ? block.content.length > 40
      ? block.content.slice(0, 40) + '\u2026'
      : block.content
    : '';

  return (
    <div
      id={`block-${block.id}`}
      className="rounded cursor-pointer transition-shadow hover:shadow-md font-mono"
      style={{
        width: 300,
        padding: '6px 10px',
        backgroundColor: 'rgba(129, 140, 248, 0.15)',
        color: theme.colors.userText,
        border: '1px solid #818cf8',
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-bold" style={{ color: opColor }}>
          {opLabel}
        </span>
        <span className="font-semibold">{block.operation}</span>
        {contentPreview && <span className="opacity-40 truncate flex-1">{contentPreview}</span>}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

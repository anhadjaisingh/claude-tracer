import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { ProgressBlock, AnyBlock } from '@/types';

interface ProgressNodeData {
  block: ProgressBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

export function ProgressNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as ProgressNodeData;

  const dataPreview = Object.entries(block.data)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 20) : String(v)}`)
    .join(', ');

  return (
    <div
      id={`block-${block.id}`}
      className="rounded cursor-pointer transition-shadow hover:shadow-md font-mono"
      style={{
        width: 300,
        padding: '6px 10px',
        backgroundColor: 'rgba(20, 184, 166, 0.15)',
        color: theme.colors.userText,
        border: '1px solid #14b8a6',
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
      <div className="flex items-center gap-1.5 text-xs">
        <span style={{ color: '#14b8a6' }}>&#x27F3;</span>
        <span className="font-semibold">{block.progressType}</span>
        {dataPreview && <span className="opacity-40 truncate flex-1">{dataPreview}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
    </div>
  );
}

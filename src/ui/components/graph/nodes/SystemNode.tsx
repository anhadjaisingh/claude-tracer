import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { SystemBlock, AnyBlock } from '@/types';

interface SystemNodeData {
  block: SystemBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

export function SystemNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as SystemNodeData;

  const keySummary = Object.keys(block.data).slice(0, 3).join(', ');

  return (
    <div
      id={`block-${block.id}`}
      className="rounded cursor-pointer transition-shadow hover:shadow-md font-mono"
      style={{
        width: 300,
        padding: '6px 10px',
        backgroundColor: 'rgba(107, 114, 128, 0.15)',
        color: theme.colors.userText,
        border: '1px solid #6b7280',
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="opacity-40">SYS</span>
        <span className="font-semibold">{block.subtype}</span>
        {keySummary && <span className="opacity-40 truncate flex-1">{keySummary}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
    </div>
  );
}

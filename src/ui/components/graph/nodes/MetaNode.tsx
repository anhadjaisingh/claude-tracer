import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { UserBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface MetaNodeData {
  block: UserBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

export function MetaNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as MetaNodeData;

  return (
    <div
      id={`block-${block.id}`}
      className="rounded-full cursor-pointer transition-shadow hover:shadow-md"
      style={{
        width: 200,
        padding: '6px 16px',
        backgroundColor: theme.colors.userBg + '80',
        color: theme.colors.userText,
        border: '1px solid #9ca3af',
        textAlign: 'center',
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#9ca3af' }} />

      <span className="text-xs opacity-60">{block.metaLabel ?? 'system'}</span>

      <Handle type="source" position={Position.Bottom} style={{ background: '#9ca3af' }} />
    </div>
  );
}

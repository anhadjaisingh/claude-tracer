import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { UserBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface UserNodeData {
  block: UserBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

export function UserNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as UserNodeData;

  const preview = block.content.length > 80 ? block.content.slice(0, 80) + '...' : block.content;

  return (
    <div
      id={`block-${block.id}`}
      className="rounded-lg cursor-pointer transition-shadow hover:shadow-lg"
      style={{
        width: 300,
        padding: '12px 16px',
        backgroundColor: theme.colors.userBg,
        color: theme.colors.userText,
        border: '2px solid #3b82f6',
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />

      <div className="flex items-center gap-2 mb-1 text-xs opacity-60">
        <span className="font-semibold uppercase">User</span>
        {block.tokensIn != null && <span>{block.tokensIn} tokens</span>}
      </div>

      <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{preview}</div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
    </div>
  );
}

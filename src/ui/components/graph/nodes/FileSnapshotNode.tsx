import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { FileSnapshotBlock, AnyBlock } from '@/types';

interface FileSnapshotNodeData {
  block: FileSnapshotBlock;
  onExpandBlock: (block: AnyBlock) => void;
  [key: string]: unknown;
}

export function FileSnapshotNode({ data }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock } = data as unknown as FileSnapshotNodeData;

  const fileNames = Object.keys(block.trackedFiles);
  const fileCount = fileNames.length;
  const preview = fileNames
    .slice(0, 3)
    .map((f) => f.split('/').pop())
    .join(', ');

  return (
    <div
      id={`block-${block.id}`}
      className="rounded cursor-pointer transition-shadow hover:shadow-md font-mono"
      style={{
        width: 300,
        padding: '6px 10px',
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: theme.colors.userText,
        border: '1px solid #22c55e',
      }}
      onClick={() => {
        onExpandBlock(block);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
      <div className="flex items-center gap-1.5 text-xs">
        <span style={{ color: '#22c55e' }}>&#x1F4C1;</span>
        <span className="font-semibold">{String(fileCount)} files</span>
        {preview && <span className="opacity-40 truncate flex-1">{preview}</span>}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

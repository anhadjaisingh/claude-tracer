import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export function CompactionNode({ id }: NodeProps) {
  return (
    <div
      id={`block-${id}`}
      className="flex items-center justify-center font-mono text-xs font-semibold"
      style={{
        width: 300,
        padding: '8px 16px',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        color: '#f59e0b',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
      Context Compacted
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

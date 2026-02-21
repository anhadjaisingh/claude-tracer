import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';
import type { UserBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface CommandNodeData {
  block: UserBlock;
  onExpandBlock: (block: AnyBlock) => void;
  collapsed: boolean;
  onToggleCollapse: (groupId: string) => void;
  childCount: number;
  [key: string]: unknown;
}

export function CommandNode({ data, id }: NodeProps) {
  const theme = useTheme();
  const { block, onExpandBlock, collapsed, onToggleCollapse, childCount } =
    data as unknown as CommandNodeData;

  const commandName = block.commandName ?? 'command';

  return (
    <div
      id={`block-${block.id}`}
      className="rounded-lg cursor-pointer transition-shadow hover:shadow-lg"
      style={{
        width: 300,
        padding: '8px 12px',
        backgroundColor: theme.colors.userBg,
        color: theme.colors.userText,
        border: `2px solid ${theme.colors.accent}60`,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />

      <div className="flex items-center gap-2">
        <span
          className="text-xs transition-transform cursor-pointer"
          style={{
            display: 'inline-block',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            opacity: 0.7,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(id);
          }}
        >
          &#9660;
        </span>

        <span
          className="px-2 py-0.5 rounded-full text-xs font-bold font-mono"
          style={{
            backgroundColor: `${theme.colors.accent}25`,
            color: theme.colors.accent,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onExpandBlock(block);
          }}
        >
          /{commandName}
        </span>

        {collapsed && childCount > 0 && (
          <span className="text-[10px] opacity-50">
            {String(childCount)} injected block{childCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

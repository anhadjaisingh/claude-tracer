import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTheme } from '../../../themes';

interface ChunkGroupNodeData {
  label: string;
  blockCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  durationMs: number;
  collapsed: boolean;
  onToggleCollapse: (groupId: string) => void;
  groupId: string;
  expandedWidth: number;
  expandedHeight: number;
  [key: string]: unknown;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1)}k`;
}

const COLLAPSED_WIDTH = 320;
const COLLAPSED_HEIGHT = 64;

export function ChunkGroupNode({ data, id }: NodeProps) {
  const theme = useTheme();
  const {
    label,
    blockCount,
    totalTokensIn,
    totalTokensOut,
    durationMs,
    collapsed,
    onToggleCollapse,
    expandedWidth,
    expandedHeight,
  } = data as unknown as ChunkGroupNodeData;

  const width = collapsed ? COLLAPSED_WIDTH : expandedWidth;
  const height = collapsed ? COLLAPSED_HEIGHT : expandedHeight;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: theme.colors.groupBg,
        border: `1px solid ${theme.colors.groupBorder}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />

      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        style={{
          backgroundColor: theme.colors.groupBadgeBg,
          borderBottom: collapsed ? 'none' : `1px solid ${theme.colors.groupBorder}`,
          color: theme.colors.groupText,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse(id);
        }}
      >
        {/* Collapse/expand chevron */}
        <span
          className="text-xs transition-transform"
          style={{
            display: 'inline-block',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            opacity: 0.7,
          }}
        >
          &#9660;
        </span>

        {/* Label */}
        <span className="text-xs font-semibold truncate flex-1">{label}</span>

        {/* Badges */}
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: theme.colors.groupBadgeBg, opacity: 0.8 }}
        >
          {String(blockCount)} blocks
        </span>
        {(totalTokensIn > 0 || totalTokensOut > 0) && (
          <span className="text-xs opacity-60">
            {formatTokens(totalTokensIn)}in/{formatTokens(totalTokensOut)}out
          </span>
        )}
        {durationMs > 0 && <span className="text-xs opacity-60">{formatDuration(durationMs)}</span>}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

export { COLLAPSED_WIDTH, COLLAPSED_HEIGHT };

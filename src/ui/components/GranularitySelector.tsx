import { useTheme } from '../themes';
import type { ChunkLevel } from '@/types';

const LEVELS: { level: ChunkLevel; label: string }[] = [
  { level: 'turn', label: 'Fine' },
  { level: 'task', label: 'Medium' },
  { level: 'theme', label: 'Coarse' },
];

interface Props {
  granularity: ChunkLevel;
  onGranularityChange: (level: ChunkLevel) => void;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
}

export function GranularitySelector({
  granularity,
  onGranularityChange,
  onCollapseAll,
  onExpandAll,
}: Props) {
  const theme = useTheme();
  const activeLabel = LEVELS.find((l) => l.level === granularity)?.label ?? 'Fine';

  return (
    <div className="flex flex-col items-center gap-1.5 py-3">
      <div className="flex items-center gap-3">
        {LEVELS.map(({ level }) => {
          const isActive = level === granularity;
          return (
            <button
              key={level}
              className="rounded-full border-0 p-0 cursor-pointer"
              style={{
                width: isActive ? 10 : 6,
                height: isActive ? 10 : 6,
                backgroundColor: isActive ? theme.colors.accent : 'transparent',
                border: isActive ? 'none' : `1.5px solid ${theme.colors.accent}80`,
                transition: 'all 150ms ease',
              }}
              onClick={() => {
                onGranularityChange(level);
              }}
              title={LEVELS.find((l) => l.level === level)?.label}
            />
          );
        })}
      </div>
      <span className="text-xs opacity-60" style={{ color: theme.colors.indexText }}>
        {activeLabel}
      </span>
      {(onCollapseAll ?? onExpandAll) && (
        <div className="flex items-center gap-2 mt-1">
          {onExpandAll && (
            <button
              className="text-xs cursor-pointer px-2 py-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{
                backgroundColor: 'transparent',
                color: theme.colors.indexText,
                border: `1px solid ${theme.colors.accent}40`,
              }}
              onClick={onExpandAll}
              title="Expand all groups"
            >
              Expand all
            </button>
          )}
          {onCollapseAll && (
            <button
              className="text-xs cursor-pointer px-2 py-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{
                backgroundColor: 'transparent',
                color: theme.colors.indexText,
                border: `1px solid ${theme.colors.accent}40`,
              }}
              onClick={onCollapseAll}
              title="Collapse all groups"
            >
              Collapse all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

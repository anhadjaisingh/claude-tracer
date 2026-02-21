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
}

export function GranularitySelector({ granularity, onGranularityChange }: Props) {
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
    </div>
  );
}

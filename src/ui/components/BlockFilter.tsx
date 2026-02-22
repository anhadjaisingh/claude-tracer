import { useTheme } from '../themes';

const BLOCK_TYPES = [
  'user',
  'agent',
  'tool',
  'system',
  'progress',
  'file-snapshot',
  'queue-operation',
  'team-message',
  'mcp',
] as const;

interface Props {
  hiddenTypes: Set<string>;
  onToggleType: (type: string) => void;
}

export function BlockFilter({ hiddenTypes, onToggleType }: Props) {
  const theme = useTheme();

  return (
    <div className="flex flex-col gap-1">
      {BLOCK_TYPES.map((type) => {
        const isVisible = !hiddenTypes.has(type);
        return (
          <button
            key={type}
            className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded cursor-pointer transition-all hover:bg-white/5"
            style={{
              backgroundColor: 'transparent',
              color: theme.colors.headerText,
              border: 'none',
              opacity: isVisible ? 1 : 0.4,
            }}
            onClick={() => {
              onToggleType(type);
            }}
          >
            <span>{type}</span>
            <span
              className="w-7 h-4 rounded-full relative transition-all"
              style={{
                backgroundColor: isVisible ? theme.colors.accent : 'rgba(255,255,255,0.15)',
              }}
            >
              <span
                className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                style={{
                  left: isVisible ? '14px' : '2px',
                }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

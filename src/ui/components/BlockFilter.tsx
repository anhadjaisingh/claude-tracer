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
    <div className="flex flex-wrap gap-1.5">
      {BLOCK_TYPES.map((type) => {
        const isHidden = hiddenTypes.has(type);
        return (
          <button
            key={type}
            className="text-xs px-2 py-0.5 rounded cursor-pointer transition-all"
            style={{
              backgroundColor: isHidden ? 'transparent' : `${theme.colors.accent}20`,
              color: theme.colors.headerText,
              border: `1px solid ${theme.colors.accent}${isHidden ? '20' : '60'}`,
              opacity: isHidden ? 0.4 : 1,
              textDecoration: isHidden ? 'line-through' : 'none',
            }}
            onClick={() => {
              onToggleType(type);
            }}
            title={isHidden ? `Show ${type} blocks` : `Hide ${type} blocks`}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}

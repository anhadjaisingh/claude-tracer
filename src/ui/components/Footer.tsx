import { useTheme } from '../themes';

interface Props {
  blockCount: number;
  isConnected: boolean;
}

export function Footer({ blockCount, isConnected }: Props) {
  const theme = useTheme();

  return (
    <footer
      className="flex items-center justify-between px-4 py-2 text-xs font-mono"
      style={{
        backgroundColor: theme.colors.headerBg,
        color: theme.colors.headerText,
      }}
    >
      <div className="flex items-center gap-4">
        <span>Blocks: {blockCount}</span>
        <span
          className={`flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-red-400'}`}
        >
          <span className="w-2 h-2 rounded-full bg-current"></span>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <button className="opacity-60 hover:opacity-100">⚙ Settings</button>
    </footer>
  );
}

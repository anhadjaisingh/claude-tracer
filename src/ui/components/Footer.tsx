import { useTheme } from '../themes';
import { SettingsPanel } from './SettingsPanel';
import type { ThemeName } from '../hooks/useSettings';

interface Props {
  blockCount: number;
  isConnected: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  themeName: ThemeName;
  onThemeChange: (name: ThemeName) => void;
}

export function Footer({
  blockCount,
  isConnected,
  settingsOpen,
  onToggleSettings,
  themeName,
  onThemeChange,
}: Props) {
  const theme = useTheme();

  return (
    <footer
      className="relative flex items-center justify-between px-4 py-2 text-xs font-mono"
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
      <div className="relative">
        <button
          className="px-2 py-1 rounded transition-colors"
          style={{
            backgroundColor: settingsOpen ? 'rgba(255,255,255,0.15)' : 'transparent',
            opacity: settingsOpen ? 1 : 0.6,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={onToggleSettings}
        >
          Settings
        </button>
        {settingsOpen && (
          <SettingsPanel
            themeName={themeName}
            onThemeChange={onThemeChange}
            onClose={onToggleSettings}
          />
        )}
      </div>
    </footer>
  );
}

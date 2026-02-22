import { useState } from 'react';
import { useTheme } from '../themes';
import { SettingsPanel } from './SettingsPanel';
import { BlockFilter } from './BlockFilter';
import type { ThemeName } from '../hooks/useSettings';

interface Props {
  blockCount: number;
  isConnected: boolean;
  filePath?: string;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  themeName: ThemeName;
  onThemeChange: (name: ThemeName) => void;
  nodesDraggable: boolean;
  onNodesDraggableChange: (value: boolean) => void;
  hiddenBlockTypes: Set<string>;
  onToggleBlockType: (type: string) => void;
}

function extractFileName(fullPath: string): string {
  const parts = fullPath.split('/');
  return parts[parts.length - 1] || fullPath;
}

export function Footer({
  blockCount,
  isConnected,
  filePath,
  settingsOpen,
  onToggleSettings,
  themeName,
  onThemeChange,
  nodesDraggable,
  onNodesDraggableChange,
  hiddenBlockTypes,
  onToggleBlockType,
}: Props) {
  const theme = useTheme();
  const [filterOpen, setFilterOpen] = useState(false);

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
        {filePath && (
          <span className="opacity-50 truncate max-w-xs" title={filePath}>
            {extractFileName(filePath)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            className="px-2 py-1 rounded transition-colors"
            style={{
              backgroundColor: filterOpen ? 'rgba(255,255,255,0.15)' : 'transparent',
              opacity: filterOpen ? 1 : 0.6,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={() => {
              setFilterOpen((prev) => !prev);
            }}
          >
            Filter{hiddenBlockTypes.size > 0 ? ` (${String(hiddenBlockTypes.size)})` : ''}
          </button>
          {filterOpen && (
            <div
              className="absolute bottom-full right-0 mb-2 w-72 rounded-lg shadow-lg border border-white/10 p-4"
              style={{
                backgroundColor: theme.colors.headerBg,
                color: theme.colors.headerText,
              }}
            >
              <h3 className="text-sm font-semibold mb-3">Block Type Filter</h3>
              <BlockFilter hiddenTypes={hiddenBlockTypes} onToggleType={onToggleBlockType} />
            </div>
          )}
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
              nodesDraggable={nodesDraggable}
              onNodesDraggableChange={onNodesDraggableChange}
              onClose={onToggleSettings}
            />
          )}
        </div>
      </div>
    </footer>
  );
}

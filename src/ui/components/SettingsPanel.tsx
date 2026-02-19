import { useEffect, useRef } from 'react';
import { useTheme } from '../themes';
import type { ThemeName } from '../hooks/useSettings';

interface Props {
  themeName: ThemeName;
  onThemeChange: (name: ThemeName) => void;
  nodesDraggable: boolean;
  onNodesDraggableChange: (value: boolean) => void;
  onClose: () => void;
}

const themeOptions: { value: ThemeName; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'claude', label: 'Claude' },
];

export function SettingsPanel({
  themeName,
  onThemeChange,
  nodesDraggable,
  onNodesDraggableChange,
  onClose,
}: Props) {
  const theme = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full right-0 mb-2 w-56 rounded-lg shadow-lg border border-white/10 p-4"
      style={{
        backgroundColor: theme.colors.headerBg,
        color: theme.colors.headerText,
      }}
    >
      <h3 className="text-sm font-semibold mb-3">Settings</h3>

      <div className="mb-3">
        <label className="text-xs opacity-70 block mb-2">Theme</label>
        <div className="flex flex-col gap-1">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onThemeChange(option.value);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left transition-colors"
              style={{
                backgroundColor:
                  themeName === option.value ? 'rgba(255,255,255,0.15)' : 'transparent',
              }}
            >
              <span
                className="w-3 h-3 rounded-full border border-white/30"
                style={{
                  backgroundColor: themeName === option.value ? theme.colors.accent : 'transparent',
                }}
              />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs opacity-70 block mb-2">Graph</label>
        <button
          onClick={() => {
            onNodesDraggableChange(!nodesDraggable);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left transition-colors w-full"
          style={{
            backgroundColor: nodesDraggable ? 'rgba(255,255,255,0.15)' : 'transparent',
          }}
        >
          <span
            className="w-3 h-3 rounded-full border border-white/30"
            style={{
              backgroundColor: nodesDraggable ? theme.colors.accent : 'transparent',
            }}
          />
          Node Dragging
        </button>
      </div>
    </div>
  );
}

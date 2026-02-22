import { useState, useCallback } from 'react';

export type ThemeName = 'claude' | 'dark' | 'light';

export function useSettings() {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem('claude-tracer-theme');
    if (stored === 'dark' || stored === 'light' || stored === 'claude') {
      return stored;
    }
    return 'dark';
  });

  const [nodesDraggable, setNodesDraggableState] = useState<boolean>(() => {
    const stored = localStorage.getItem('claude-tracer-nodes-draggable');
    return stored === 'true';
  });

  const [showMinimap, setShowMinimapState] = useState<boolean>(() => {
    const stored = localStorage.getItem('claude-tracer-show-minimap');
    return stored !== 'false'; // default to true
  });

  const setThemeName = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    localStorage.setItem('claude-tracer-theme', name);
  }, []);

  const setNodesDraggable = useCallback((value: boolean) => {
    setNodesDraggableState(value);
    localStorage.setItem('claude-tracer-nodes-draggable', String(value));
  }, []);

  const setShowMinimap = useCallback((value: boolean) => {
    setShowMinimapState(value);
    localStorage.setItem('claude-tracer-show-minimap', String(value));
  }, []);

  return {
    themeName,
    setThemeName,
    nodesDraggable,
    setNodesDraggable,
    showMinimap,
    setShowMinimap,
  };
}

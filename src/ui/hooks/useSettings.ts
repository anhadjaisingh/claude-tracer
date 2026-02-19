import { useState, useCallback } from 'react';

export type ThemeName = 'claude' | 'dark' | 'light';

export function useSettings() {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem('claude-tracer-theme');
    if (stored === 'dark' || stored === 'light' || stored === 'claude') {
      return stored;
    }
    return 'claude';
  });

  const setThemeName = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    localStorage.setItem('claude-tracer-theme', name);
  }, []);

  return { themeName, setThemeName };
}

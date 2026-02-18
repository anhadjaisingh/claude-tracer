import { createContext, useContext } from 'react';
import { claudeTheme, type Theme } from './claude';

export const ThemeContext = createContext<Theme>(claudeTheme);

export function useTheme() {
  return useContext(ThemeContext);
}

export { claudeTheme, type Theme };

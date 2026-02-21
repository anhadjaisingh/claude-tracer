import { createContext, useContext } from 'react';
import { claudeTheme, type Theme } from './claude';
import { darkTheme } from './dark';
import { lightTheme } from './light';

export const ThemeContext = createContext<Theme>(darkTheme);

export function useTheme() {
  return useContext(ThemeContext);
}

const themes: Record<string, Theme> = {
  claude: claudeTheme,
  dark: darkTheme,
  light: lightTheme,
};

export function getTheme(name: string): Theme {
  return themes[name] ?? claudeTheme;
}

export { claudeTheme, darkTheme, lightTheme, type Theme };

import type { Theme } from './claude';

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    background: '#111827', // grey-900
    agentBg: '#1f2937', // grey-800
    agentText: '#f3f4f6', // grey-100
    userBg: '#374151', // grey-700
    userText: '#f9fafb', // grey-50
    toolBg: '#0f0f0f', // near-black
    toolText: '#e5e5e5', // terminal white
    accent: '#60a5fa', // blue-400
    headerBg: 'rgba(0,0,0,0.9)',
    headerText: '#f3f4f6',
    indexText: '#d1d5db', // grey-300
    teamMessageBg: '#1e1b4b', // indigo-950
    teamMessageText: '#c7d2fe', // indigo-200
    teamMessageAccent: '#818cf8', // indigo-400
  },
};

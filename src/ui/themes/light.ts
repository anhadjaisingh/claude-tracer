import type { Theme } from './claude';

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background: '#f9fafb', // grey-50
    agentBg: '#e5e7eb', // grey-200
    agentText: '#111827', // grey-900
    userBg: '#ffffff', // white
    userText: '#111827', // grey-900
    toolBg: '#1f2937', // grey-800
    toolText: '#e5e5e5', // terminal white
    accent: '#2563eb', // blue-600
    headerBg: 'rgba(31,41,55,0.95)', // grey-800
    headerText: '#ffffff',
    indexText: '#374151', // grey-700
    teamMessageBg: '#eef2ff', // indigo-50
    teamMessageText: '#312e81', // indigo-900
    teamMessageAccent: '#4f46e5', // indigo-600
  },
};

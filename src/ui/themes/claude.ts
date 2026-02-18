export const claudeTheme = {
  name: 'claude',
  colors: {
    background: '#d97757', // claude terracotta
    agentBg: '#374151', // grey-700
    agentText: '#f3f4f6', // grey-100
    userBg: '#f9fafb', // grey-50
    userText: '#111827', // grey-900
    toolBg: '#0f0f0f', // near-black
    toolText: '#e5e5e5', // terminal white
    accent: '#f97316', // orange
    headerBg: 'rgba(0,0,0,0.8)',
    headerText: '#ffffff',
    indexText: '#f3f4f6', // light text on peach
  },
};

export type Theme = typeof claudeTheme;

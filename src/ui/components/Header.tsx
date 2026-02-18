import { useState } from 'react';
import { useTheme } from '../themes';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();

  return (
    <header
      className="flex items-center justify-between px-4 py-3"
      style={{
        backgroundColor: theme.colors.headerBg,
        color: theme.colors.headerText,
      }}
    >
      <h1 className="text-lg font-semibold font-mono"># tracer</h1>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
          }}
          className="px-3 py-1.5 rounded bg-white/10 text-white placeholder-white/50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/30"
        />
        <span className="text-xs opacity-60">0 of 0</span>
        <button className="px-2 py-1 text-sm opacity-60 hover:opacity-100">
          ◀
        </button>
        <button className="px-2 py-1 text-sm opacity-60 hover:opacity-100">
          ▶
        </button>
      </div>
    </header>
  );
}

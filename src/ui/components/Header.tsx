import type { SearchMode } from '../../types';
import { useTheme } from '../themes';

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount: number;
  currentResultIndex: number;
  onSearchNext: () => void;
  onSearchPrev: () => void;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
  embeddingProgress: number;
  isVectorReady: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  resultCount,
  currentResultIndex,
  onSearchNext,
  onSearchPrev,
  searchMode,
  onSearchModeChange,
  embeddingProgress,
  isVectorReady,
}: Props) {
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
            onSearchChange(e.target.value);
          }}
          className="px-3 py-1.5 rounded bg-white/10 text-white placeholder-white/50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/30"
        />

        {/* Mode toggle */}
        <div className="flex rounded bg-white/10 text-xs font-mono">
          <button
            className={`px-2 py-1 rounded-l transition-colors ${
              searchMode === 'keyword' ? 'bg-white/20 opacity-100' : 'opacity-60 hover:opacity-80'
            }`}
            onClick={() => {
              onSearchModeChange('keyword');
            }}
          >
            Keyword
          </button>
          <button
            className={`px-2 py-1 rounded-r transition-colors ${
              searchMode === 'smart' ? 'bg-white/20 opacity-100' : 'opacity-60 hover:opacity-80'
            }`}
            onClick={() => {
              onSearchModeChange('smart');
            }}
          >
            {searchMode === 'smart' && !isVectorReady && embeddingProgress >= 0
              ? `Smart (indexing ${String(embeddingProgress)}%...)`
              : 'Smart'}
          </button>
        </div>

        <span className="text-xs opacity-60">
          {resultCount > 0
            ? `${String(currentResultIndex + 1)} of ${String(resultCount)}`
            : '0 of 0'}
        </span>
        <button className="px-2 py-1 text-sm opacity-60 hover:opacity-100" onClick={onSearchPrev}>
          &#x25C0;
        </button>
        <button className="px-2 py-1 text-sm opacity-60 hover:opacity-100" onClick={onSearchNext}>
          &#x25B6;
        </button>
      </div>
    </header>
  );
}

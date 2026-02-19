import { useEffect, useState, useCallback } from 'react';
import { ThemeContext, getTheme } from './themes';
import { Header } from './components/Header';
import { TraceView } from './components/TraceView';
import { IndexSidebar } from './components/IndexSidebar';
import { Footer } from './components/Footer';
import { useSession } from './hooks/useSession';
import { useSearch } from './hooks/useSearch';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const { blocks, chunks, isConnected, scrollToBlock } = useSession();
  const search = useSearch(blocks);
  const { themeName, setThemeName } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const theme = getTheme(themeName);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((prev) => !prev);
  }, []);

  // Scroll to current search result
  useEffect(() => {
    if (search.currentBlockId) {
      scrollToBlock(search.currentBlockId);
    }
  }, [search.currentBlockId, scrollToBlock]);

  return (
    <ThemeContext.Provider value={theme}>
      <div className="h-screen flex flex-col" style={{ backgroundColor: theme.colors.background }}>
        <Header
          searchQuery={search.query}
          onSearchChange={search.handleSearch}
          resultCount={search.results.length}
          currentResultIndex={search.currentIndex}
          onSearchNext={search.next}
          onSearchPrev={search.prev}
        />

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto p-4">
            <TraceView blocks={blocks} />
          </main>

          <aside className="w-64 overflow-auto p-4 border-l border-white/20">
            <IndexSidebar chunks={chunks} />
          </aside>
        </div>

        <Footer
          blockCount={blocks.length}
          isConnected={isConnected}
          settingsOpen={settingsOpen}
          onToggleSettings={toggleSettings}
          themeName={themeName}
          onThemeChange={setThemeName}
        />
      </div>
    </ThemeContext.Provider>
  );
}

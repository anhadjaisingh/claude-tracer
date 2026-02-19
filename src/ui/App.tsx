import { useEffect, useState, useCallback, useRef } from 'react';
import { ThemeContext, getTheme } from './themes';
import { Header } from './components/Header';
import { GraphView } from './components/graph/GraphView';
import type { NavigateToBlockFn } from './components/graph/GraphView';
import { IndexSidebar } from './components/IndexSidebar';
import { Footer } from './components/Footer';
import { BlockOverlay } from './components/BlockOverlay';
import { useSession } from './hooks/useSession';
import { useHybridSearch } from './hooks/useHybridSearch';
import { useSettings } from './hooks/useSettings';
import { useOverlay } from './hooks/useOverlay';
import { useResizable } from './hooks/useResizable';

export default function App() {
  const { blocks, chunks, isConnected, connectionStatus, filePath } = useSession();
  const search = useHybridSearch(blocks);
  const { themeName, setThemeName, nodesDraggable, setNodesDraggable } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const overlay = useOverlay();
  const sidebar = useResizable({
    minWidth: 200,
    maxWidth: 600,
    defaultWidth: 256,
    storageKey: 'sidebar-width',
  });

  const theme = getTheme(themeName);

  // Store the navigateToBlock callback from GraphView.
  // This ref is set by GraphView's onNavigateReady prop, giving us access to
  // React Flow's setCenter() without needing to be inside ReactFlowProvider.
  const navigateToBlockRef = useRef<NavigateToBlockFn | null>(null);

  const handleNavigateReady = useCallback((fn: NavigateToBlockFn) => {
    navigateToBlockRef.current = fn;
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((prev) => !prev);
  }, []);

  // Scroll to current search result using the React Flow viewport API
  useEffect(() => {
    if (search.currentBlockId && navigateToBlockRef.current) {
      navigateToBlockRef.current(search.currentBlockId);
    }
  }, [search.currentBlockId]);

  const handleChunkClick = useCallback(
    (chunkId: string) => {
      const chunk = chunks.find((c) => c.id === chunkId);
      if (chunk && chunk.blockIds.length > 0 && navigateToBlockRef.current) {
        navigateToBlockRef.current(chunk.blockIds[0]);
      }
    },
    [chunks],
  );

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
          searchMode={search.mode}
          onSearchModeChange={search.setMode}
          embeddingProgress={search.embeddingProgress}
          isVectorReady={search.isVectorReady}
        />

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 relative" style={{ minHeight: 0 }}>
            {connectionStatus === 'connecting' && blocks.length === 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center z-20"
                style={{ backgroundColor: theme.colors.background }}
              >
                <div
                  className="tracer-spinner"
                  style={{
                    borderColor: `${theme.colors.accent}33`,
                    borderTopColor: theme.colors.accent,
                  }}
                />
                <span
                  className="mt-4 text-sm font-mono opacity-80"
                  style={{ color: theme.colors.agentText }}
                >
                  Connecting...
                </span>
              </div>
            )}
            <GraphView
              blocks={blocks}
              chunks={chunks}
              onExpandBlock={overlay.open}
              onNavigateReady={handleNavigateReady}
              nodesDraggable={nodesDraggable}
            />
          </main>

          {/* Resize handle on left edge of sidebar */}
          <div
            className="w-1 cursor-col-resize hover:bg-white/30 transition-colors flex-shrink-0"
            style={{
              backgroundColor: sidebar.isResizing ? 'rgba(255,255,255,0.3)' : 'transparent',
            }}
            {...sidebar.handleProps}
          />

          <aside
            className="overflow-auto p-4 border-l border-white/20 flex-shrink-0"
            style={{ width: sidebar.width }}
          >
            <IndexSidebar chunks={chunks} onChunkClick={handleChunkClick} />
          </aside>
        </div>

        <Footer
          blockCount={blocks.length}
          isConnected={isConnected}
          filePath={filePath}
          settingsOpen={settingsOpen}
          onToggleSettings={toggleSettings}
          themeName={themeName}
          onThemeChange={setThemeName}
          nodesDraggable={nodesDraggable}
          onNodesDraggableChange={setNodesDraggable}
        />
      </div>

      {overlay.overlayBlock && (
        <BlockOverlay block={overlay.overlayBlock} onClose={overlay.close} />
      )}
    </ThemeContext.Provider>
  );
}

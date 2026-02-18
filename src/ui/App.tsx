import { ThemeContext, claudeTheme } from './themes';
import { Header } from './components/Header';
import { TraceView } from './components/TraceView';
import { IndexSidebar } from './components/IndexSidebar';
import { Footer } from './components/Footer';
import { useSession } from './hooks/useSession';

export default function App() {
  const { blocks, chunks, isConnected } = useSession();

  return (
    <ThemeContext.Provider value={claudeTheme}>
      <div
        className="h-screen flex flex-col"
        style={{ backgroundColor: claudeTheme.colors.background }}
      >
        <Header />

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto p-4">
            <TraceView blocks={blocks} />
          </main>

          <aside className="w-64 overflow-auto p-4">
            <IndexSidebar chunks={chunks} />
          </aside>
        </div>

        <Footer blockCount={blocks.length} isConnected={isConnected} />
      </div>
    </ThemeContext.Provider>
  );
}

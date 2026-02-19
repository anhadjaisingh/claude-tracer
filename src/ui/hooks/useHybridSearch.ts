import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { BlockSearch } from '../../core/search';
import type { AnyBlock, SearchResult, SearchMode } from '../../types';

const SMART_DEBOUNCE_MS = 300;

interface WsSearchResultMessage {
  type: 'search:results';
  results: SearchResult[];
  mode: SearchMode;
  queryId: string;
}

interface WsEmbeddingProgressMessage {
  type: 'embeddings:progress';
  indexed: number;
  total: number;
}

type WsIncomingMessage =
  | WsSearchResultMessage
  | WsEmbeddingProgressMessage
  | { type: 'embeddings:ready' }
  | { type: string };

export function useHybridSearch(blocks: AnyBlock[]) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('keyword');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [smartResults, setSmartResults] = useState<SearchResult[]>([]);
  const [embeddingProgress, setEmbeddingProgress] = useState(-1);
  const [isVectorReady, setIsVectorReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyword search engine (local)
  const searchEngine = useMemo(() => {
    const search = new BlockSearch();
    if (blocks.length > 0) {
      search.index(blocks);
    }
    return search;
  }, [blocks]);

  // Keyword results (local, instant)
  const keywordResults: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    return searchEngine.search(query);
  }, [searchEngine, query]);

  // Connect to WebSocket for smart search messages
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as WsIncomingMessage;

        if (message.type === 'search:results') {
          const msg = message as WsSearchResultMessage;
          setSmartResults(msg.results);
          setCurrentIndex(0);
        } else if (message.type === 'embeddings:progress') {
          const msg = message as WsEmbeddingProgressMessage;
          const pct = msg.total > 0 ? Math.round((msg.indexed / msg.total) * 100) : 0;
          setEmbeddingProgress(pct);
        } else if (message.type === 'embeddings:ready') {
          setIsVectorReady(true);
          setEmbeddingProgress(100);
        }
      } catch {
        // Ignore non-search messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  // Send smart search query over WebSocket (debounced)
  const sendSmartSearch = useCallback((searchQuery: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN && searchQuery.trim()) {
        ws.send(
          JSON.stringify({
            type: 'search',
            query: searchQuery,
            mode: 'smart',
          }),
        );
      }
    }, SMART_DEBOUNCE_MS);
  }, []);

  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      setCurrentIndex(0);

      if (mode === 'smart') {
        if (!newQuery.trim()) {
          setSmartResults([]);
        } else {
          sendSmartSearch(newQuery);
        }
      }
    },
    [mode, sendSmartSearch],
  );

  // Re-search when mode changes
  const handleSetMode = useCallback(
    (newMode: SearchMode) => {
      setMode(newMode);
      setCurrentIndex(0);

      if (newMode === 'smart' && query.trim()) {
        sendSmartSearch(query);
      } else {
        setSmartResults([]);
      }
    },
    [query, sendSmartSearch],
  );

  // Pick results based on mode
  const results = mode === 'keyword' ? keywordResults : smartResults;

  const next = useCallback(() => {
    if (results.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % results.length);
    }
  }, [results.length]);

  const prev = useCallback(() => {
    if (results.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + results.length) % results.length);
    }
  }, [results.length]);

  return {
    query,
    mode,
    setMode: handleSetMode,
    results,
    currentIndex,
    currentBlockId: results[currentIndex]?.blockId ?? null,
    handleSearch,
    next,
    prev,
    embeddingProgress,
    isVectorReady,
  };
}

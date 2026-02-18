import { useState, useCallback, useMemo } from 'react';
import { BlockSearch } from '../../core/search';
import type { AnyBlock, SearchResult } from '../../types';

export function useSearch(blocks: AnyBlock[]) {
  const [query, setQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Build search index whenever blocks change
  const searchEngine = useMemo(() => {
    const search = new BlockSearch();
    if (blocks.length > 0) {
      search.index(blocks);
    }
    return search;
  }, [blocks]);

  // Derive results from query + engine (no setState needed)
  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    return searchEngine.search(query);
  }, [searchEngine, query]);

  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setCurrentIndex(0);
  }, []);

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
    results,
    currentIndex,
    currentBlockId: results[currentIndex]?.blockId ?? null,
    handleSearch,
    next,
    prev,
  };
}

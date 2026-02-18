import { useState, useCallback, useRef, useEffect } from 'react';
import { BlockSearch } from '../../core/search';
import type { AnyBlock, SearchResult } from '../../types';

export function useSearch(blocks: AnyBlock[]) {
  const searchRef = useRef(new BlockSearch());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Re-index whenever blocks change
  useEffect(() => {
    const search = new BlockSearch();
    if (blocks.length > 0) {
      search.index(blocks);
    }
    searchRef.current = search;

    // Re-run current query against new index
    if (query.trim()) {
      const newResults = search.search(query);
      setResults(newResults);
      setCurrentIndex(0);
    }
  }, [blocks, query]);

  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery);
    if (!newQuery.trim()) {
      setResults([]);
      setCurrentIndex(0);
      return;
    }
    const searchResults = searchRef.current.search(newQuery);
    setResults(searchResults);
    setCurrentIndex(0);
  }, []);

  const next = useCallback(() => {
    if (results.length > 0) {
      setCurrentIndex(prev => (prev + 1) % results.length);
    }
  }, [results.length]);

  const prev = useCallback(() => {
    if (results.length > 0) {
      setCurrentIndex(prev => (prev - 1 + results.length) % results.length);
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

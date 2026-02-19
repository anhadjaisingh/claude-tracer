import type { AnyBlock } from './blocks';

export interface SearchResult {
  blockId: string;
  score: number;
  matches?: SearchMatch[];
}

export interface SearchMatch {
  field: string;
  snippet: string;
}

export interface SearchOptions {
  limit?: number;
  types?: ('user' | 'agent' | 'tool' | 'mcp')[];
  chunkId?: string;
}

export interface SearchEngine {
  index(blocks: AnyBlock[]): void;
  addBlock(block: AnyBlock): void;
  search(query: string, options?: SearchOptions): SearchResult[];
  clear(): void;
}

export type SearchMode = 'keyword' | 'smart';

export interface SearchRequest {
  type: 'search';
  query: string;
  mode: SearchMode;
  limit?: number;
}

export interface SearchResultsMessage {
  type: 'search:results';
  results: SearchResult[];
  mode: SearchMode;
  queryId: string;
}

export interface EmbeddingProgressMessage {
  type: 'embeddings:progress';
  indexed: number;
  total: number;
}

export interface EmbeddingReadyMessage {
  type: 'embeddings:ready';
}

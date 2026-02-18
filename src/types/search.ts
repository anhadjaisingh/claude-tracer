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
  types?: Array<'user' | 'agent' | 'tool' | 'mcp'>;
  chunkId?: string;
}

export interface SearchEngine {
  index(blocks: AnyBlock[]): void;
  addBlock(block: AnyBlock): void;
  search(query: string, options?: SearchOptions): SearchResult[];
  clear(): void;
}

import { BlockSearch } from './search';
import { VectorIndex } from './vector-search';
import { EmbeddingEngine } from './embeddings';
import type { AnyBlock, SearchResult } from '@/types';

const KEYWORD_WEIGHT = 0.3;
const VECTOR_WEIGHT = 0.7;
const DEFAULT_LIMIT = 20;
const BATCH_SIZE = 32;

/**
 * Hybrid search engine that merges keyword (MiniSearch) and vector results.
 */
export class HybridSearchEngine {
  private keywordEngine = new BlockSearch();
  private vectorIndex = new VectorIndex();
  private embeddingEngine: EmbeddingEngine;
  private blockTexts = new Map<string, string>();
  private indexedCount = 0;
  private totalCount = 0;
  private vectorReady = false;

  constructor(embeddingEngine: EmbeddingEngine) {
    this.embeddingEngine = embeddingEngine;
  }

  /** Index a single block in both keyword and vector engines */
  async indexBlock(block: AnyBlock): Promise<void> {
    // Keyword index (instant)
    this.keywordEngine.addBlock(block);

    // Vector index (async)
    const text = this.extractText(block);
    this.blockTexts.set(block.id, text);

    if (this.embeddingEngine.isReady() && text.trim().length > 0) {
      const embedding = await this.embeddingEngine.embed(text);
      this.vectorIndex.set(block.id, embedding);
    }
  }

  /** Batch index blocks with progress tracking */
  async indexBlocks(
    blocks: AnyBlock[],
    onProgress?: (indexed: number, total: number) => void,
  ): Promise<void> {
    // Keyword index all at once (instant)
    this.keywordEngine.index(blocks);

    // Extract texts
    const textsWithIds: { id: string; text: string }[] = [];
    for (const block of blocks) {
      const text = this.extractText(block);
      this.blockTexts.set(block.id, text);
      if (text.trim().length > 0) {
        textsWithIds.push({ id: block.id, text });
      }
    }

    this.totalCount = textsWithIds.length;
    this.indexedCount = 0;

    // Wait for embedding engine to be ready
    if (!this.embeddingEngine.isReady()) {
      return;
    }

    // Batch process embeddings
    for (let i = 0; i < textsWithIds.length; i += BATCH_SIZE) {
      const batch = textsWithIds.slice(i, i + BATCH_SIZE);
      const texts = batch.map((item) => item.text);
      const embeddings = await this.embeddingEngine.embedBatch(texts);

      for (let j = 0; j < batch.length; j++) {
        this.vectorIndex.set(batch[j].id, embeddings[j]);
      }

      this.indexedCount = Math.min(i + batch.length, textsWithIds.length);
      onProgress?.(this.indexedCount, this.totalCount);
    }

    this.vectorReady = true;
  }

  /** Search with mode selection */
  async search(
    query: string,
    mode: 'keyword' | 'smart',
    limit: number = DEFAULT_LIMIT,
  ): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    if (mode === 'keyword') {
      return this.keywordEngine.search(query, { limit });
    }

    // Smart mode: hybrid keyword + vector
    const keywordResults = this.keywordEngine.search(query, { limit: limit * 2 });
    let vectorResults: { blockId: string; score: number }[] = [];

    if (this.vectorReady && this.embeddingEngine.isReady()) {
      const queryEmbedding = await this.embeddingEngine.embed(query);
      vectorResults = this.vectorIndex.search(queryEmbedding, limit * 2);
    }

    return this.mergeResults(keywordResults, vectorResults, limit);
  }

  /** Embedding progress (0-100) */
  embeddingProgress(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.indexedCount / this.totalCount) * 100);
  }

  /** Whether vector search is ready */
  isVectorReady(): boolean {
    return this.vectorReady;
  }

  /** Merge keyword and vector results with weighted scoring */
  private mergeResults(
    keywordResults: SearchResult[],
    vectorResults: { blockId: string; score: number }[],
    limit: number,
  ): SearchResult[] {
    // Normalize keyword scores to 0-1
    const maxKeywordScore = Math.max(...keywordResults.map((r) => r.score), 1);
    const normKeyword = new Map<string, number>();
    for (const r of keywordResults) {
      normKeyword.set(r.blockId, r.score / maxKeywordScore);
    }

    // Normalize vector scores to 0-1
    const maxVectorScore = Math.max(...vectorResults.map((r) => r.score), 1);
    const normVector = new Map<string, number>();
    for (const r of vectorResults) {
      normVector.set(r.blockId, r.score / maxVectorScore);
    }

    // Collect all unique block IDs
    const allBlockIds = new Set<string>([
      ...keywordResults.map((r) => r.blockId),
      ...vectorResults.map((r) => r.blockId),
    ]);

    // Combine scores
    const combined: SearchResult[] = [];
    for (const blockId of allBlockIds) {
      const kwScore = normKeyword.get(blockId) ?? 0;
      const vecScore = normVector.get(blockId) ?? 0;

      let score: number;
      if (kwScore > 0 && vecScore > 0) {
        // Both engines found it
        score = kwScore * KEYWORD_WEIGHT + vecScore * VECTOR_WEIGHT;
      } else if (kwScore > 0) {
        // Only keyword found it
        score = kwScore * KEYWORD_WEIGHT;
      } else {
        // Only vector found it
        score = vecScore * VECTOR_WEIGHT;
      }

      // Preserve matches from keyword results if available
      const kwResult = keywordResults.find((r) => r.blockId === blockId);
      combined.push({
        blockId,
        score,
        matches: kwResult?.matches,
      });
    }

    // Sort by combined score descending
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, limit);
  }

  /** Extract searchable text from a block */
  private extractText(block: AnyBlock): string {
    switch (block.type) {
      case 'user':
        return block.content;
      case 'agent':
        return [block.content, block.thinking].filter(Boolean).join(' ');
      case 'tool':
      case 'mcp':
        return [
          JSON.stringify(block.input),
          typeof block.output === 'string' ? block.output : JSON.stringify(block.output),
        ].join(' ');
      case 'team-message':
        return block.content;
      default:
        return '';
    }
  }
}

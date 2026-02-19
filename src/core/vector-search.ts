export interface VectorResult {
  blockId: string;
  score: number;
}

/**
 * In-memory vector index with cosine similarity search.
 * Storage: Map<string, Float32Array>. Linear scan over all embeddings.
 */
export class VectorIndex {
  private embeddings = new Map<string, Float32Array>();

  /** Add or update an embedding for a block */
  set(blockId: string, embedding: Float32Array): void {
    this.embeddings.set(blockId, embedding);
  }

  /** Search by cosine similarity, return top-k results */
  search(queryEmbedding: Float32Array, k: number): VectorResult[] {
    const results: VectorResult[] = [];

    for (const [blockId, embedding] of this.embeddings) {
      const score = cosineSimilarity(queryEmbedding, embedding);
      results.push({ blockId, score });
    }

    // Sort by score descending and take top-k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /** Number of indexed embeddings */
  size(): number {
    return this.embeddings.size;
  }

  /** Clear all embeddings */
  clear(): void {
    this.embeddings.clear();
  }
}

/**
 * Compute cosine similarity between two vectors.
 * Assumes vectors are already normalized (from the embedding model),
 * so cosine similarity = dot product.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${String(a.length)} vs ${String(b.length)}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

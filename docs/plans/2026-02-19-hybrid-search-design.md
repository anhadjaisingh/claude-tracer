# Hybrid Search: Keyword + Vector

## Context

Phase 1 search (MiniSearch keyword) is shipped and works well for exact matches,
file paths, error messages, and tool names. It falls short on semantic queries
like "when was Claude working on authentication" or "where did it struggle."

This design adds vector (embedding) search alongside keyword search, giving users
a mode toggle between instant keyword search and slower but smarter hybrid search.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Express Server (startup)                     │
│                                                                │
│  1. Parse JSONL → blocks (existing)                           │
│  2. Index blocks in MiniSearch (existing, instant)            │
│  3. Load Transformers.js + all-MiniLM-L6-v2 model (~22MB)    │
│  4. Background: compute embeddings for all blocks             │
│     - Batch process, ~15ms/block                              │
│     - Store Float32Array per block in memory                  │
│     - Broadcast progress % via WebSocket                      │
│  5. New blocks from file watcher → embed incrementally        │
│  6. Handle search requests via WebSocket                      │
└──────────────────────────────────────────────────────────────┘
```

### Server Components

#### `src/core/embeddings.ts` — Embedding Engine

Wraps `@xenova/transformers` (now `@huggingface/transformers`).

```typescript
interface EmbeddingEngine {
  /** Load model — call once at server startup */
  init(): Promise<void>;

  /** Whether the model is loaded and ready */
  isReady(): boolean;

  /** Embed a single text string → Float32Array (384 dims) */
  embed(text: string): Promise<Float32Array>;

  /** Batch embed for efficiency */
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}
```

- Model: `Xenova/all-MiniLM-L6-v2` quantized (22MB, 384 dimensions)
- Runs in Node.js via ONNX Runtime (bundled with Transformers.js)
- Model is downloaded on first run, cached in `~/.cache/huggingface/`

#### `src/core/vector-search.ts` — Vector Index

In-memory vector store with cosine similarity search.

```typescript
interface VectorIndex {
  /** Add or update an embedding for a block */
  set(blockId: string, embedding: Float32Array): void;

  /** Search by cosine similarity, return top-k results */
  search(queryEmbedding: Float32Array, k: number): VectorResult[];

  /** Number of indexed embeddings */
  size(): number;

  /** Clear all embeddings */
  clear(): void;
}

interface VectorResult {
  blockId: string;
  score: number; // cosine similarity, 0-1
}
```

Storage: `Map<string, Float32Array>`. Linear search over all embeddings.
At 384 dims × 4 bytes × 10K blocks = ~15MB. Cosine search over 10K takes <50ms.

No external vector DB dependency — keep it simple.

#### `src/core/hybrid-search.ts` — Result Merger

Combines keyword and vector results with weighted scoring.

```typescript
interface HybridSearchEngine {
  /** Index a block in both keyword and vector engines */
  indexBlock(block: AnyBlock): Promise<void>;

  /** Batch index */
  indexBlocks(blocks: AnyBlock[]): Promise<void>;

  /** Search with mode selection */
  search(query: string, mode: 'keyword' | 'smart', limit?: number): Promise<SearchResult[]>;

  /** Embedding progress (0-100) */
  embeddingProgress(): number;

  /** Whether vector search is ready */
  isVectorReady(): boolean;
}
```

Merge strategy:

- Normalize keyword scores to 0-1 range
- Normalize vector scores to 0-1 range
- Combined score = (keyword × 0.3) + (vector × 0.7)
- If a block appears in only one result set, use that score × its weight
- Sort by combined score descending

### WebSocket Protocol

New message types added to the existing protocol:

```typescript
// Client → Server
{ type: 'search', query: string, mode: 'keyword' | 'smart', limit?: number }

// Server → Client
{ type: 'search:results', results: SearchResult[], mode: string, queryId: string }
{ type: 'embeddings:progress', indexed: number, total: number }
{ type: 'embeddings:ready' }
```

The `queryId` prevents stale results from overwriting newer ones (user types fast).

### Client Components

#### Mode Toggle in Header

Add a toggle next to the search input:

```
[🔍 search...          ] [Keyword | Smart] [◀ 3 of 12 ▶]
```

- **Keyword** mode: uses existing local MiniSearch (instant, no server round-trip)
- **Smart** mode: sends query to server for hybrid search
- When Smart is selected but embeddings are not ready, show: `Smart (indexing 45%...)`
- Default: Keyword (always works, no wait)

#### `src/ui/hooks/useHybridSearch.ts`

Replaces/extends `useSearch` when mode is `smart`.

```typescript
interface UseHybridSearch {
  query: string;
  mode: 'keyword' | 'smart';
  setMode: (mode: 'keyword' | 'smart') => void;
  results: SearchResult[];
  currentIndex: number;
  currentBlockId: string | null;
  handleSearch: (query: string) => void;
  next: () => void;
  prev: () => void;
  embeddingProgress: number; // 0-100, -1 if not applicable
  isVectorReady: boolean;
}
```

- In `keyword` mode: delegates to existing `useSearch` hook (local MiniSearch)
- In `smart` mode: sends search over WebSocket, receives results from server
- Debounce smart queries by 300ms (embedding queries are more expensive)
- Cache query results for 5s to avoid redundant server calls

## Dependencies

| Package                | Size                | Purpose                         |
| ---------------------- | ------------------- | ------------------------------- |
| `@xenova/transformers` | ~5MB (+ 22MB model) | Embedding generation in Node.js |

No other new dependencies. Vector storage is custom (simple Map + cosine sim).

## Background Indexing Flow

```
Server starts → parse JSONL → blocks ready
  │
  ├─ MiniSearch.index(blocks)  ← instant
  │
  └─ async embedAllBlocks(blocks)
       │
       ├─ Load model (1-5s first time, cached after)
       │
       └─ For each batch of 32 blocks:
            ├─ Extract text content
            ├─ embedBatch(texts) → Float32Array[]
            ├─ vectorIndex.set(blockId, embedding)
            └─ broadcast { type: 'embeddings:progress', indexed, total }
       │
       └─ broadcast { type: 'embeddings:ready' }
```

New blocks from file watcher are embedded incrementally (single block, ~15ms).

## Performance Expectations

| Operation        | Latency | Notes                             |
| ---------------- | ------- | --------------------------------- |
| Model load       | 1-5s    | First run only, cached after      |
| Embed 1 block    | ~15ms   | Single block (incremental)        |
| Embed 1K blocks  | ~15s    | Batch, background                 |
| Embed 10K blocks | ~2.5min | Batch, background                 |
| Keyword search   | <10ms   | Local MiniSearch                  |
| Vector search    | <50ms   | Linear scan over 10K embeddings   |
| Hybrid search    | <60ms   | Parallel keyword + vector + merge |
| WS round-trip    | ~5ms    | Local network                     |

## Testing Plan

**Unit tests:**

- `embeddings.test.ts`: Model loads, single embed returns 384-dim vector, batch embed works
- `vector-search.test.ts`: Add/search/clear, cosine similarity correctness
- `hybrid-search.test.ts`: Merge logic (both engines return results, only one does, empty results)

**Integration tests:**

- Server starts, indexes blocks, reports progress via WS
- Client sends search query, receives ranked results
- Keyword mode works without waiting for embeddings

**Manual verification:**

- Load real session with `npm run local`
- Toggle between Keyword and Smart modes
- Verify Smart mode shows progress during indexing
- Search "authentication" in both modes, compare results

## File Summary

| File                              | New/Edit | Purpose                                       |
| --------------------------------- | -------- | --------------------------------------------- |
| `src/core/embeddings.ts`          | New      | Transformers.js wrapper                       |
| `src/core/vector-search.ts`       | New      | In-memory vector index                        |
| `src/core/hybrid-search.ts`       | New      | Merge keyword + vector results                |
| `src/server/index.ts`             | Edit     | Initialize embedding engine, handle search WS |
| `src/server/websocket.ts`         | Edit     | Add search request/response handlers          |
| `src/ui/hooks/useHybridSearch.ts` | New      | Client-side search hook with mode toggle      |
| `src/ui/components/Header.tsx`    | Edit     | Add mode toggle UI                            |
| `src/ui/App.tsx`                  | Edit     | Wire hybrid search hook                       |
| `src/types/index.ts`              | Edit     | Add search protocol types                     |
| `package.json`                    | Edit     | Add `@xenova/transformers` dependency         |

## Future (Not in Scope)

- LLM-powered "deep search" via Ollama (Phase 3)
- Embedding persistence to disk (recompute is fast enough for now)
- HNSW approximate nearest neighbor (linear search is fine for <50K blocks)
- Semantic search over chunk summaries

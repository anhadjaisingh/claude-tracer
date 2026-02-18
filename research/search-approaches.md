# Search Approaches for Claude-Tracer

## Project Context

**claude-tracer** is a standalone trace visualization and debugging tool that:

- Runs locally and generates a web-based visualizer
- Allows stepping through Claude Code session history
- Shows user prompts, agent reasoning, tool calls, MCP calls, outputs, tokens, timestamps
- Uses collapsible UI with chat-like layout (user right-aligned, agent left-aligned, tools furthest left)
- Has a right sidebar for index/TOC navigation
- Needs semantic search to answer questions like "when was Claude working on authentication"
- Must support chunking by TODO items / logical task boundaries
- Requires lazy loading and fast, responsive UI

**Input format**: Starting with Claude Code's JSONL session files (`~/.claude/projects/.../sessions/*.jsonl`), with pluggable parser abstraction for future formats (Codex, Jules, etc.)

**Key requirement**: Search must help users navigate long sessions (potentially thousands of blocks) by asking natural language questions and jumping to relevant sections.

---

## Search Approach 1: Keyword/Full-Text Search

### Overview

Traditional text matching using substring search, regular expressions, or full-text search indices. This is the foundation that should always be available.

### Implementation Options

#### Option A: MiniSearch (Recommended for Web)

```typescript
import MiniSearch from 'minisearch';

interface Block {
  id: string;
  type: 'user' | 'agent' | 'tool';
  content: string;
  toolName?: string;
  timestamp: number;
  chunkId?: string;
}

// Initialize index
const searchIndex = new MiniSearch<Block>({
  fields: ['content', 'toolName'], // Fields to index
  storeFields: ['id', 'type', 'timestamp', 'chunkId'], // Fields to return
  searchOptions: {
    boost: { toolName: 2 }, // Tool names weighted higher
    fuzzy: 0.2, // Allow ~20% character differences
    prefix: true, // Match prefixes ("auth" matches "authentication")
  },
});

// Index blocks
function indexBlocks(blocks: Block[]): void {
  searchIndex.addAll(blocks);
}

// Search
function search(query: string, limit = 20): SearchResult[] {
  return searchIndex.search(query, { limit });
}

// Incremental updates
function addBlock(block: Block): void {
  searchIndex.add(block);
}

function removeBlock(id: string): void {
  searchIndex.remove({ id });
}
```

**Package**: `minisearch` (~50KB minified)

#### Option B: SQLite FTS5 (Recommended for Electron/Node)

```typescript
import Database from 'better-sqlite3';

const db = new Database('traces.db');

// Create FTS5 virtual table
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
    content,
    tool_name,
    block_id UNINDEXED,
    block_type UNINDEXED,
    timestamp UNINDEXED,
    chunk_id UNINDEXED,
    tokenize='porter unicode61'
  );
`);

// Index a block
const insertStmt = db.prepare(`
  INSERT INTO blocks_fts (content, tool_name, block_id, block_type, timestamp, chunk_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function indexBlock(block: Block): void {
  insertStmt.run(
    block.content,
    block.toolName || '',
    block.id,
    block.type,
    block.timestamp,
    block.chunkId || '',
  );
}

// Search with ranking
const searchStmt = db.prepare(`
  SELECT block_id, block_type, timestamp, chunk_id,
         snippet(blocks_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
         bm25(blocks_fts) as score
  FROM blocks_fts
  WHERE blocks_fts MATCH ?
  ORDER BY score
  LIMIT ?
`);

function search(query: string, limit = 20): SearchResult[] {
  // FTS5 query syntax: "auth*" for prefix, "auth OR login" for OR
  const ftsQuery = query
    .split(/\s+/)
    .map((term) => `"${term}"*`)
    .join(' OR ');

  return searchStmt.all(ftsQuery, limit);
}
```

**Package**: `better-sqlite3` (~2MB native addon)

#### Option C: Lunr.js (Lightweight, Browser-Compatible)

```typescript
import lunr from 'lunr';

let searchIndex: lunr.Index;

function buildIndex(blocks: Block[]): void {
  searchIndex = lunr(function () {
    this.ref('id');
    this.field('content');
    this.field('toolName');

    // Add stemming for English
    this.pipeline.add(lunr.stemmer);
    this.searchPipeline.add(lunr.stemmer);

    blocks.forEach((block) => {
      this.add(block);
    });
  });
}

function search(query: string): SearchResult[] {
  return searchIndex.search(query);
}
```

**Package**: `lunr` (~8KB minified)

**Limitation**: Index must be rebuilt entirely for updates (no incremental add/remove).

### Quality Analysis

| Query Type        | Example                  | Result Quality | Notes                                 |
| ----------------- | ------------------------ | -------------- | ------------------------------------- |
| Exact match       | `"npm test"`             | Excellent      | Direct string match                   |
| Command/tool name | `Read file.ts`           | Excellent      | Indexed field                         |
| Error message     | `TypeError: undefined`   | Excellent      | Exact text                            |
| File path         | `src/auth/login.ts`      | Excellent      | Exact text                            |
| Partial/prefix    | `auth`                   | Good           | Matches "authentication", "authorize" |
| Typo              | `authentcation`          | Medium         | Fuzzy matching helps but imperfect    |
| Semantic          | `"when did it struggle"` | Poor           | Won't find "failed repeatedly"        |
| Conceptual        | `"working on login"`     | Poor           | Won't find "implementing auth"        |

### Performance & Scaling

#### Indexing Cost

| Session Size | Blocks  | MiniSearch | SQLite FTS5 | Lunr   |
| ------------ | ------- | ---------- | ----------- | ------ |
| Small        | 100     | <10ms      | <50ms       | <20ms  |
| Medium       | 1,000   | ~50ms      | ~200ms      | ~100ms |
| Large        | 10,000  | ~500ms     | ~1s         | ~800ms |
| Very Large   | 100,000 | ~5s        | ~10s        | ~8s    |

#### Search Cost

| Session Size | Blocks  | MiniSearch | SQLite FTS5 | Lunr  |
| ------------ | ------- | ---------- | ----------- | ----- |
| Small        | 100     | <1ms       | <1ms        | <1ms  |
| Medium       | 1,000   | <5ms       | <5ms        | <5ms  |
| Large        | 10,000  | <10ms      | <10ms       | <10ms |
| Very Large   | 100,000 | <50ms      | <20ms       | <30ms |

#### Memory Cost

| Session Size | Blocks  | Raw Text | MiniSearch Index | SQLite FTS5 | Lunr Index |
| ------------ | ------- | -------- | ---------------- | ----------- | ---------- |
| Small        | 100     | ~100KB   | ~30KB            | ~50KB       | ~40KB      |
| Medium       | 1,000   | ~1MB     | ~300KB           | ~400KB      | ~350KB     |
| Large        | 10,000  | ~10MB    | ~3MB             | ~4MB        | ~3.5MB     |
| Very Large   | 100,000 | ~100MB   | ~30MB            | ~40MB       | ~35MB      |

Index size is typically 20-40% of raw text size.

### Recommendation

**Use MiniSearch** for the web UI:

- Small bundle size (~50KB)
- Incremental updates supported
- Good fuzzy matching
- Works in browser and Node.js

---

## Search Approach 2: Vector/Embedding Search

### Overview

Pre-compute dense vector embeddings for each block, then use cosine similarity or approximate nearest neighbor (ANN) search to find semantically similar content.

### How Embeddings Work

```
Input text: "I'll implement user authentication using JWT tokens"
     │
     ▼
┌─────────────────────────────────┐
│  Embedding Model (e.g. MiniLM) │
│  - Tokenize text               │
│  - Process through transformer │
│  - Mean pooling over tokens    │
│  - Normalize to unit vector    │
└─────────────────────────────────┘
     │
     ▼
Output: [0.023, -0.156, 0.089, ..., 0.042]  (384 dimensions)
```

Similar concepts produce similar vectors:

- "implementing auth" ≈ "adding login functionality" (high cosine similarity)
- "implementing auth" ≠ "npm test" (low cosine similarity)

### Implementation Options

#### Option A: Transformers.js (Recommended - Fully Local)

```typescript
import { pipeline, env } from '@xenova/transformers';

// Configure for local-only operation
env.allowRemoteModels = true; // Download once, then cached
env.localModelPath = './models';

let embedder: any = null;

// Initialize (call once at startup)
async function initEmbedder(): Promise<void> {
  embedder = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2', // 80MB model, 384 dimensions
    { quantized: true }, // Use quantized version (~22MB)
  );
}

// Generate embedding for a single text
async function embed(text: string): Promise<number[]> {
  const output = await embedder(text, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data);
}

// Batch embedding for efficiency
async function embedBatch(texts: string[]): Promise<number[][]> {
  const outputs = await embedder(texts, {
    pooling: 'mean',
    normalize: true,
  });

  const embeddings: number[][] = [];
  const dims = 384;
  for (let i = 0; i < texts.length; i++) {
    embeddings.push(Array.from(outputs.data.slice(i * dims, (i + 1) * dims)));
  }
  return embeddings;
}
```

**Package**: `@xenova/transformers` (~5MB + model download)

**Models available**:

| Model                 | Dimensions | Size (Quantized) | Quality | Speed  |
| --------------------- | ---------- | ---------------- | ------- | ------ |
| `all-MiniLM-L6-v2`    | 384        | ~22MB            | Good    | Fast   |
| `all-MiniLM-L12-v2`   | 384        | ~40MB            | Better  | Medium |
| `bge-small-en-v1.5`   | 384        | ~40MB            | Better  | Medium |
| `bge-base-en-v1.5`    | 768        | ~130MB           | Great   | Slower |
| `nomic-embed-text-v1` | 768        | ~130MB           | Great   | Slower |

#### Option B: ONNX Runtime (More Control)

```typescript
import * as ort from 'onnxruntime-node';
import { AutoTokenizer } from '@xenova/transformers';

let session: ort.InferenceSession;
let tokenizer: any;

async function initEmbedder(): Promise<void> {
  session = await ort.InferenceSession.create('./models/all-MiniLM-L6-v2.onnx');
  tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');
}

async function embed(text: string): Promise<number[]> {
  const encoded = await tokenizer(text, {
    padding: true,
    truncation: true,
    max_length: 512,
  });

  const inputIds = new ort.Tensor('int64', encoded.input_ids.data, encoded.input_ids.dims);
  const attentionMask = new ort.Tensor(
    'int64',
    encoded.attention_mask.data,
    encoded.attention_mask.dims,
  );

  const outputs = await session.run({
    input_ids: inputIds,
    attention_mask: attentionMask,
  });

  // Mean pooling
  const embeddings = outputs.last_hidden_state.data;
  // ... pooling logic

  return normalizedEmbedding;
}
```

**Package**: `onnxruntime-node` (~50MB native addon)

#### Option C: Ollama Embeddings (If Already Using Ollama)

```typescript
import ollama from 'ollama';

async function embed(text: string): Promise<number[]> {
  const response = await ollama.embeddings({
    model: 'nomic-embed-text', // or 'mxbai-embed-large'
    prompt: text,
  });
  return response.embedding;
}
```

**Requires**: Ollama running locally with embedding model pulled.

### Vector Storage & Search

#### Option A: In-Memory with Linear Search (Simple, Small Sessions)

```typescript
interface BlockEmbedding {
  id: string;
  embedding: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot; // Vectors are normalized, so dot product = cosine similarity
}

function vectorSearch(
  queryEmbedding: number[],
  index: BlockEmbedding[],
  k: number,
): SearchResult[] {
  return index
    .map((item) => ({
      id: item.id,
      score: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
```

#### Option B: HNSW Index (Fast Approximate Search, Large Sessions)

```typescript
import { HierarchicalNSW } from 'hnswlib-node';

const dims = 384;
const maxElements = 100000;

// Initialize index
const index = new HierarchicalNSW('cosine', dims);
index.initIndex(maxElements, 16, 200, 100); // M, efConstruction, randomSeed

// Add embeddings
function addToIndex(id: number, embedding: number[]): void {
  index.addPoint(embedding, id);
}

// Search
function search(queryEmbedding: number[], k: number): { id: number; distance: number }[] {
  const result = index.searchKnn(queryEmbedding, k);
  return result.neighbors.map((id, i) => ({
    id,
    distance: result.distances[i],
  }));
}

// Persistence
index.writeIndexSync('embeddings.hnsw');
index.readIndexSync('embeddings.hnsw');
```

**Package**: `hnswlib-node` (~2MB native addon)

#### Option C: Vectra (Pure JS, No Native Dependencies)

```typescript
import { LocalIndex } from 'vectra';

const index = new LocalIndex('./vector-index');

// Create index if needed
if (!(await index.isIndexCreated())) {
  await index.createIndex();
}

// Add item
await index.insertItem({
  vector: embedding,
  metadata: { blockId, type, timestamp },
});

// Search
const results = await index.queryItems(queryEmbedding, 10);
```

**Package**: `vectra` (~50KB, pure JS)

### Quality Analysis

| Query Type    | Example                       | Result Quality | Notes                                     |
| ------------- | ----------------------------- | -------------- | ----------------------------------------- |
| Exact match   | `"npm test"`                  | Medium         | May miss, finds related                   |
| Semantic      | `"when did it struggle"`      | Good           | Finds "failed", "errors", "problems"      |
| Conceptual    | `"working on authentication"` | Good           | Finds "implementing login", "JWT", "auth" |
| Behavioral    | `"debugging issues"`          | Good           | Finds "troubleshooting", "fixing"         |
| Typo          | `"authentcation"`             | Good           | Embedding captures meaning                |
| Negation      | `"NOT authentication"`        | Poor           | Embeddings don't handle negation          |
| Specific code | `"line 42"`                   | Poor           | Too specific, better with keyword         |

### Performance & Scaling

#### Indexing Cost (Embedding Generation)

Using Transformers.js with `all-MiniLM-L6-v2` on M1 Mac:

| Session Size | Blocks  | Time (Sequential) | Time (Batched) | Notes                         |
| ------------ | ------- | ----------------- | -------------- | ----------------------------- |
| Small        | 100     | ~5s               | ~2s            | Model load dominates          |
| Medium       | 1,000   | ~30s              | ~15s           | ~15-30ms per block            |
| Large        | 10,000  | ~5min             | ~2.5min        | Background indexing essential |
| Very Large   | 100,000 | ~50min            | ~25min         | Consider incremental          |

**First run**: Add 1-5 seconds for model loading (cached afterward).

#### Search Cost

| Session Size | Blocks  | Linear Search | HNSW Search |
| ------------ | ------- | ------------- | ----------- |
| Small        | 100     | <1ms          | <1ms        |
| Medium       | 1,000   | ~5ms          | <1ms        |
| Large        | 10,000  | ~50ms         | <5ms        |
| Very Large   | 100,000 | ~500ms        | <10ms       |

HNSW provides O(log n) search vs O(n) for linear.

#### Memory Cost

| Session Size | Blocks  | Embeddings (384d) | HNSW Index | Total  |
| ------------ | ------- | ----------------- | ---------- | ------ |
| Small        | 100     | ~150KB            | ~200KB     | ~350KB |
| Medium       | 1,000   | ~1.5MB            | ~2MB       | ~3.5MB |
| Large        | 10,000  | ~15MB             | ~20MB      | ~35MB  |
| Very Large   | 100,000 | ~150MB            | ~200MB     | ~350MB |

Plus ~100-500MB for the embedding model in memory.

### Recommendation

**Use Transformers.js with `all-MiniLM-L6-v2`**:

- Fully local, no API calls
- Good balance of quality and speed
- 22MB quantized model
- Works in browser (WebAssembly) and Node.js

**For storage**:

- Small-medium sessions (<10K blocks): Linear search is fine
- Large sessions: Use HNSW via `hnswlib-node` or Vectra

---

## Search Approach 3: LLM-Powered Search

### Overview

Use a language model to understand the search query and identify relevant blocks through reasoning. This provides the highest quality for complex queries but has significant latency.

### Implementation Options

#### Option A: Ollama (Recommended for Local)

```typescript
import ollama from 'ollama';

interface BlockSummary {
  id: string;
  index: number;
  summary: string; // Pre-computed or truncated content
  type: 'user' | 'agent' | 'tool';
  toolName?: string;
}

async function llmSearch(
  query: string,
  blocks: BlockSummary[],
  model = 'llama3.2', // or 'mistral', 'phi3'
): Promise<string[]> {
  // Format blocks for context
  const blockContext = blocks
    .map((b, i) => `[${i}] ${b.type}${b.toolName ? ` (${b.toolName})` : ''}: ${b.summary}`)
    .join('\n');

  const prompt = `You are helping search through a coding session transcript.

Here are the blocks in the session:
${blockContext}

User's search query: "${query}"

Return a JSON array of block indices that are most relevant to the query, ordered by relevance.
Only include blocks that are genuinely relevant. Return at most 10 results.

Response format: {"indices": [3, 7, 12]}`;

  const response = await ollama.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    format: 'json',
    options: {
      temperature: 0,
      num_predict: 100,
    },
  });

  const result = JSON.parse(response.message.content);
  return result.indices.map((i: number) => blocks[i].id);
}
```

#### Option B: Two-Stage with Vector Pre-filtering

```typescript
async function hybridLlmSearch(
  query: string,
  allBlocks: Block[],
  embeddings: BlockEmbedding[],
): Promise<string[]> {
  // Stage 1: Vector search for candidates (fast)
  const queryEmbedding = await embed(query);
  const candidates = vectorSearch(queryEmbedding, embeddings, 50);

  // Stage 2: LLM re-ranking (slow but precise)
  const candidateBlocks = candidates.map((c) => allBlocks.find((b) => b.id === c.id)!);

  const summaries: BlockSummary[] = candidateBlocks.map((b, i) => ({
    id: b.id,
    index: i,
    summary: b.content.slice(0, 200), // Truncate for context
    type: b.type,
    toolName: b.toolName,
  }));

  return await llmSearch(query, summaries);
}
```

#### Option C: Pre-computed Summaries

Generate summaries during indexing, then search over summaries:

```typescript
async function generateBlockSummary(block: Block): Promise<string> {
  const prompt = `Summarize this ${block.type} block in one sentence:
${block.content.slice(0, 500)}`;

  const response = await ollama.generate({
    model: 'llama3.2',
    prompt,
    options: { num_predict: 50 },
  });

  return response.response;
}

// Index all blocks with summaries (do once, during initial indexing)
async function indexWithSummaries(blocks: Block[]): Promise<BlockSummary[]> {
  const summaries: BlockSummary[] = [];
  for (const block of blocks) {
    summaries.push({
      id: block.id,
      index: summaries.length,
      summary: await generateBlockSummary(block),
      type: block.type,
      toolName: block.toolName,
    });
  }
  return summaries;
}
```

### Quality Analysis

| Query Type  | Example                                    | Result Quality | Notes                          |
| ----------- | ------------------------------------------ | -------------- | ------------------------------ |
| Exact match | `"npm test"`                               | Good           | LLM can identify               |
| Semantic    | `"when did it struggle"`                   | Excellent      | Full reasoning                 |
| Complex     | `"authentication work after the refactor"` | Excellent      | Temporal reasoning             |
| Behavioral  | `"where did it make mistakes"`             | Excellent      | Understands intent             |
| Comparative | `"compare the two approaches it tried"`    | Excellent      | Can reason about relationships |
| Negation    | `"everything except tests"`                | Good           | Can handle negation            |

### Performance & Scaling

#### Search Latency by Model

| Model          | Size  | Local Latency | Quality   |
| -------------- | ----- | ------------- | --------- |
| `phi3:mini`    | 2.3GB | 1-3s          | Good      |
| `llama3.2:3b`  | 2GB   | 2-5s          | Good      |
| `mistral:7b`   | 4GB   | 3-8s          | Better    |
| `llama3.1:8b`  | 4.7GB | 5-15s         | Better    |
| `llama3.1:70b` | 40GB  | 30-60s        | Excellent |

#### Context Limits

| Model         | Context Window | Max Blocks (with summaries) |
| ------------- | -------------- | --------------------------- |
| `phi3:mini`   | 4K tokens      | ~50-100                     |
| `llama3.2:3b` | 8K tokens      | ~100-200                    |
| `mistral:7b`  | 32K tokens     | ~500-1000                   |
| `llama3.1:8b` | 128K tokens    | ~2000-5000                  |

For sessions larger than context window, use vector pre-filtering or hierarchical chunking.

#### Summary Generation Cost

| Session Size | Blocks | Time (3B model) | Time (7B model) |
| ------------ | ------ | --------------- | --------------- |
| Small        | 100    | ~2min           | ~5min           |
| Medium       | 1,000  | ~20min          | ~50min          |
| Large        | 10,000 | ~3hr            | ~8hr            |

Summary generation is a one-time cost, do it in background.

#### Memory Requirements

| Model         | VRAM/RAM Required |
| ------------- | ----------------- |
| `phi3:mini`   | 2-3GB             |
| `llama3.2:3b` | 2-4GB             |
| `mistral:7b`  | 4-8GB             |
| `llama3.1:8b` | 6-10GB            |

### Recommendation

**Use as optional enhancement, not primary search**:

- Latency (2-15s) is too slow for interactive search
- Excellent for "deep search" or "ask about this session" features
- Pre-compute summaries during initial indexing
- Use vector search for candidate filtering before LLM

---

## Hybrid Approach: Recommended Architecture

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         Search Input                             │
│  Query: "when was it working on authentication"                  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Query Analyzer                              │
│  - Detect query type (exact vs semantic vs complex)             │
│  - Route to appropriate engine(s)                               │
└───────┬─────────────────────────────────────────────┬───────────┘
        │                                             │
        ▼                                             ▼
┌───────────────────┐                       ┌───────────────────┐
│  Keyword Engine   │                       │  Vector Engine    │
│  (MiniSearch)     │                       │  (Transformers)   │
│                   │                       │                   │
│  - Exact matches  │                       │  - Semantic sim   │
│  - Fuzzy matching │                       │  - Concept match  │
│  - <10ms          │                       │  - <50ms          │
└────────┬──────────┘                       └─────────┬─────────┘
         │                                            │
         └──────────────────┬─────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Result Merger & Ranker                        │
│  - Combine results with weighted scoring                        │
│  - Deduplicate                                                  │
│  - Apply chunk/todo context boosting                            │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Optional: LLM Re-ranking                      │
│  - User-triggered "Deep Search"                                 │
│  - Re-rank top 50 candidates with LLM                           │
│  - 2-10s latency                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
interface SearchOptions {
  mode: 'fast' | 'smart' | 'deep';
  chunkFilter?: string; // Filter to specific chunk/todo
  limit?: number;
}

async function search(
  query: string,
  options: SearchOptions = { mode: 'smart' },
): Promise<SearchResult[]> {
  const limit = options.limit ?? 20;

  if (options.mode === 'fast') {
    // Keyword only - instant
    return keywordSearch(query, limit);
  }

  // Parallel keyword + vector search
  const [keywordResults, vectorResults] = await Promise.all([
    keywordSearch(query, limit * 2),
    vectorSearch(await embed(query), limit * 2),
  ]);

  // Merge with weighted scoring
  let merged = mergeResults(keywordResults, vectorResults, {
    keywordWeight: 0.3,
    vectorWeight: 0.7,
  });

  // Apply chunk filter if specified
  if (options.chunkFilter) {
    merged = merged.filter((r) => r.chunkId === options.chunkFilter);
  }

  if (options.mode === 'deep' && merged.length > 0) {
    // LLM re-ranking for deep search
    const topCandidates = merged.slice(0, 50);
    merged = await llmRerank(query, topCandidates);
  }

  return merged.slice(0, limit);
}

function mergeResults(
  keyword: SearchResult[],
  vector: SearchResult[],
  weights: { keywordWeight: number; vectorWeight: number },
): SearchResult[] {
  const merged = new Map<string, SearchResult>();

  // Normalize scores to 0-1 range
  const maxKeyword = Math.max(...keyword.map((r) => r.score), 1);
  const maxVector = Math.max(...vector.map((r) => r.score), 1);

  for (const r of keyword) {
    merged.set(r.id, {
      ...r,
      keywordScore: r.score / maxKeyword,
      vectorScore: 0,
      combinedScore: (r.score / maxKeyword) * weights.keywordWeight,
    });
  }

  for (const r of vector) {
    const existing = merged.get(r.id);
    if (existing) {
      existing.vectorScore = r.score / maxVector;
      existing.combinedScore += (r.score / maxVector) * weights.vectorWeight;
    } else {
      merged.set(r.id, {
        ...r,
        keywordScore: 0,
        vectorScore: r.score / maxVector,
        combinedScore: (r.score / maxVector) * weights.vectorWeight,
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.combinedScore - a.combinedScore);
}
```

---

## Cost Scaling Summary

### Indexing Cost by Session Size

| Size    | Blocks  | Keyword | Vector | LLM Summaries | Total (K+V) |
| ------- | ------- | ------- | ------ | ------------- | ----------- |
| Small   | 100     | <10ms   | ~5s    | ~2min         | ~5s         |
| Medium  | 1,000   | ~50ms   | ~30s   | ~20min        | ~30s        |
| Large   | 10,000  | ~500ms  | ~5min  | ~3hr          | ~5min       |
| V.Large | 100,000 | ~5s     | ~50min | ~30hr         | ~50min      |

### Search Cost by Session Size

| Size    | Blocks  | Keyword | Hybrid (K+V) | Deep (K+V+LLM) |
| ------- | ------- | ------- | ------------ | -------------- |
| Small   | 100     | <1ms    | ~20ms        | ~3s            |
| Medium  | 1,000   | <5ms    | ~30ms        | ~5s            |
| Large   | 10,000  | <10ms   | ~60ms        | ~10s           |
| V.Large | 100,000 | <50ms   | ~150ms       | ~15s           |

### Memory Cost by Session Size

| Size    | Blocks  | Text   | Keyword Index | Embeddings | LLM Model | Total (K+V) |
| ------- | ------- | ------ | ------------- | ---------- | --------- | ----------- |
| Small   | 100     | ~100KB | ~30KB         | ~350KB     | 100-500MB | ~500MB      |
| Medium  | 1,000   | ~1MB   | ~300KB        | ~3.5MB     | 100-500MB | ~505MB      |
| Large   | 10,000  | ~10MB  | ~3MB          | ~35MB      | 100-500MB | ~550MB      |
| V.Large | 100,000 | ~100MB | ~30MB         | ~350MB     | 100-500MB | ~1GB        |

Note: Embedding model is shared across all sessions.

---

## Phased Implementation Recommendation

### Phase 1: Keyword Search (1-2 days)

- MiniSearch for full-text indexing
- Fuzzy matching and prefix search
- Instant results (<50ms)

### Phase 2: Vector Search (3-5 days)

- Transformers.js with MiniLM model
- Background indexing with progress indicator
- Hybrid search combining keyword + vector
- Persist embeddings to avoid recomputation

### Phase 3: LLM Enhancement (5-7 days, optional)

- Ollama integration for "Deep Search"
- Pre-computed block summaries
- "Ask about this session" feature

Start with Phase 1, it covers 60-70% of search use cases and provides immediate value.

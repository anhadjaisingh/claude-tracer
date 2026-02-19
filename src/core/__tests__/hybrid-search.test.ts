import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridSearchEngine } from '../hybrid-search';
import { EmbeddingEngine } from '../embeddings';
import type { UserBlock, AgentBlock, ToolBlock } from '@/types';

// Mock @xenova/transformers
let embedCallCount = 0;
vi.mock('@xenova/transformers', () => {
  const mockPipeline = vi.fn().mockResolvedValue(
    vi.fn().mockImplementation(() => {
      embedCallCount++;
      const data = new Float32Array(384);
      // Make each embedding slightly different
      data[0] = embedCallCount / 10;
      data[1] = 1;
      return Promise.resolve({ data });
    }),
  );

  return {
    pipeline: mockPipeline,
  };
});

describe('HybridSearchEngine', () => {
  let engine: HybridSearchEngine;
  let embeddingEngine: EmbeddingEngine;

  const userBlock: UserBlock = {
    id: 'user-1',
    timestamp: 1000,
    type: 'user',
    content: 'Help me implement authentication',
  };

  const agentBlock: AgentBlock = {
    id: 'agent-1',
    timestamp: 2000,
    type: 'agent',
    content: 'I will help you implement JWT authentication',
    toolCalls: ['tool-1'],
  };

  const toolBlock: ToolBlock = {
    id: 'tool-1',
    timestamp: 3000,
    type: 'tool',
    parentId: 'agent-1',
    toolName: 'Read',
    input: { file_path: 'auth.ts' },
    output: 'file contents',
    status: 'success',
  };

  beforeEach(async () => {
    embedCallCount = 0;
    embeddingEngine = new EmbeddingEngine();
    await embeddingEngine.init();
    engine = new HybridSearchEngine(embeddingEngine);
  });

  it('keyword mode returns results without embeddings', async () => {
    await engine.indexBlocks([userBlock, agentBlock, toolBlock]);
    const results = await engine.search('authentication', 'keyword');
    expect(results.length).toBeGreaterThan(0);
  });

  it('smart mode returns results when embeddings are ready', async () => {
    await engine.indexBlocks([userBlock, agentBlock, toolBlock]);
    expect(engine.isVectorReady()).toBe(true);
    const results = await engine.search('authentication', 'smart');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty results for empty query', async () => {
    await engine.indexBlocks([userBlock]);
    const results = await engine.search('', 'keyword');
    expect(results).toHaveLength(0);
  });

  it('returns empty results for no-match query', async () => {
    await engine.indexBlocks([userBlock]);
    const results = await engine.search('xyzabc123', 'keyword');
    expect(results).toHaveLength(0);
  });

  it('tracks embedding progress', async () => {
    const progressUpdates: number[] = [];
    await engine.indexBlocks([userBlock, agentBlock, toolBlock], (indexed, total) => {
      progressUpdates.push(Math.round((indexed / total) * 100));
    });
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });

  it('isVectorReady returns false before indexing', () => {
    expect(engine.isVectorReady()).toBe(false);
  });

  it('isVectorReady returns true after indexing', async () => {
    await engine.indexBlocks([userBlock]);
    expect(engine.isVectorReady()).toBe(true);
  });

  it('embeddingProgress returns 0 when no blocks', () => {
    expect(engine.embeddingProgress()).toBe(0);
  });

  it('embeddingProgress returns 100 after indexing', async () => {
    await engine.indexBlocks([userBlock, agentBlock]);
    expect(engine.embeddingProgress()).toBe(100);
  });

  it('smart mode results have scores between 0 and 1', async () => {
    await engine.indexBlocks([userBlock, agentBlock, toolBlock]);
    const results = await engine.search('authentication', 'smart');
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('respects limit parameter', async () => {
    await engine.indexBlocks([userBlock, agentBlock, toolBlock]);
    const results = await engine.search('authentication', 'smart', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('can index single block incrementally', async () => {
    await engine.indexBlock(userBlock);
    const results = await engine.search('authentication', 'keyword');
    expect(results.length).toBeGreaterThan(0);
  });
});

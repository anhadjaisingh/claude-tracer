import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingEngine } from '../embeddings';

// Mock @xenova/transformers
vi.mock('@xenova/transformers', () => {
  const mockPipeline = vi.fn().mockResolvedValue(
    vi.fn().mockImplementation(() => {
      // Return a mock 384-dim embedding
      const data = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        data[i] = Math.random();
      }
      return Promise.resolve({ data });
    }),
  );

  return {
    pipeline: mockPipeline,
  };
});

describe('EmbeddingEngine', () => {
  let engine: EmbeddingEngine;

  beforeEach(() => {
    engine = new EmbeddingEngine();
  });

  it('starts as not ready', () => {
    expect(engine.isReady()).toBe(false);
  });

  it('becomes ready after init', async () => {
    await engine.init();
    expect(engine.isReady()).toBe(true);
  });

  it('throws if embed is called before init', async () => {
    await expect(engine.embed('test')).rejects.toThrow('not initialized');
  });

  it('embed returns a 384-dim Float32Array', async () => {
    await engine.init();
    const result = await engine.embed('hello world');
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(384);
  });

  it('embedBatch returns array of 384-dim Float32Arrays', async () => {
    await engine.init();
    const results = await engine.embedBatch(['hello', 'world', 'test']);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r).toBeInstanceOf(Float32Array);
      expect(r.length).toBe(384);
    }
  });

  it('embedBatch throws if not initialized', async () => {
    await expect(engine.embedBatch(['test'])).rejects.toThrow('not initialized');
  });

  it('has correct dims static property', () => {
    expect(EmbeddingEngine.dims).toBe(384);
  });
});

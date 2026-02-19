import { describe, it, expect, beforeEach } from 'vitest';
import { VectorIndex, cosineSimilarity } from '../vector-search';

function makeVector(dims: number, fill: number): Float32Array {
  const v = new Float32Array(dims);
  v.fill(fill);
  return v;
}

function normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (const val of v) {
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  const result = new Float32Array(v.length);
  for (const [i, val] of v.entries()) {
    result[i] = val / norm;
  }
  return result;
}

describe('cosineSimilarity', () => {
  it('returns 1 for identical normalized vectors', () => {
    const v = normalize(makeVector(384, 1));
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([4, 0]);
    const b = new Float32Array([0, 3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = normalize(makeVector(10, 1));
    const b = normalize(makeVector(10, -1));
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('throws on dimension mismatch', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2]);
    expect(() => cosineSimilarity(a, b)).toThrow('dimension mismatch');
  });

  it('returns 0 for zero vectors', () => {
    const a = makeVector(10, 0);
    const b = normalize(makeVector(10, 1));
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('computes known similarity', () => {
    // [1, 1, 0] and [1, 0, 1] -> cos = 1 / (sqrt(2) * sqrt(2)) = 0.5
    const a = new Float32Array([1, 1, 0]);
    const b = new Float32Array([1, 0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });
});

describe('VectorIndex', () => {
  let index: VectorIndex;

  beforeEach(() => {
    index = new VectorIndex();
  });

  it('starts empty', () => {
    expect(index.size()).toBe(0);
  });

  it('can add and count embeddings', () => {
    index.set('a', normalize(makeVector(384, 1)));
    index.set('b', normalize(makeVector(384, 2)));
    expect(index.size()).toBe(2);
  });

  it('updates existing embedding', () => {
    index.set('a', normalize(makeVector(384, 1)));
    index.set('a', normalize(makeVector(384, 2)));
    expect(index.size()).toBe(1);
  });

  it('search returns results sorted by similarity', () => {
    // Create distinct vectors
    const query = new Float32Array(384);
    query[0] = 1; // mostly in dimension 0

    const close = new Float32Array(384);
    close[0] = 0.9;
    close[1] = 0.1;

    const far = new Float32Array(384);
    far[1] = 1; // mostly in dimension 1

    index.set('close', close);
    index.set('far', far);

    const results = index.search(query, 2);
    expect(results).toHaveLength(2);
    expect(results[0].blockId).toBe('close');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('search respects k limit', () => {
    for (let i = 0; i < 10; i++) {
      index.set(`b-${String(i)}`, normalize(makeVector(384, i + 1)));
    }

    const results = index.search(normalize(makeVector(384, 1)), 3);
    expect(results).toHaveLength(3);
  });

  it('search returns empty array when index is empty', () => {
    const results = index.search(normalize(makeVector(384, 1)), 5);
    expect(results).toHaveLength(0);
  });

  it('clear removes all embeddings', () => {
    index.set('a', normalize(makeVector(384, 1)));
    index.set('b', normalize(makeVector(384, 2)));
    index.clear();
    expect(index.size()).toBe(0);
  });
});

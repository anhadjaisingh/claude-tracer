import { describe, it, expect } from 'vitest';
import type { Chunk } from '../chunks';

describe('Chunk types', () => {
  it('allows creating theme-level chunk', () => {
    const chunk: Chunk = {
      id: 'theme-1',
      level: 'theme',
      label: 'Implementing authentication',
      blockIds: [],
      childChunkIds: ['task-1', 'task-2'],
      totalTokensIn: 1000,
      totalTokensOut: 500,
      totalWallTimeMs: 30000,
    };
    expect(chunk.level).toBe('theme');
  });

  it('allows creating task-level chunk with parent', () => {
    const chunk: Chunk = {
      id: 'task-1',
      level: 'task',
      label: 'Add login form',
      blockIds: ['block-1', 'block-2'],
      childChunkIds: [],
      parentChunkId: 'theme-1',
      totalTokensIn: 500,
      totalTokensOut: 250,
      totalWallTimeMs: 15000,
    };
    expect(chunk.parentChunkId).toBe('theme-1');
  });

  it('allows creating turn-level chunk', () => {
    const chunk: Chunk = {
      id: 'turn-1',
      level: 'turn',
      label: 'User asks about login',
      blockIds: ['block-1', 'block-2', 'block-3'],
      childChunkIds: [],
      parentChunkId: 'task-1',
      totalTokensIn: 200,
      totalTokensOut: 100,
      totalWallTimeMs: 5000,
    };
    expect(chunk.level).toBe('turn');
    expect(chunk.blockIds).toHaveLength(3);
  });
});

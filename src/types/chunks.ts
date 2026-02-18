export type ChunkLevel = 'theme' | 'task' | 'turn';

export interface Chunk {
  id: string;
  level: ChunkLevel;
  label: string;
  blockIds: string[];
  childChunkIds: string[];
  parentChunkId?: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalWallTimeMs: number;
}

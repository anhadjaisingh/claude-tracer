export type ChunkLevel = 'theme' | 'task' | 'turn';

export type BoundarySignal =
  | { type: 'time-gap'; gapMs: number }
  | { type: 'git-commit'; message?: string }
  | { type: 'git-push' }
  | { type: 'pr-creation'; prNumber?: string }
  | { type: 'branch-switch'; fromBranch: string; toBranch: string }
  | { type: 'user-pattern'; pattern: string }
  | { type: 'task-spawn'; agentId: string };

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
  boundarySignals?: BoundarySignal[];
  startTimestamp?: number;
  endTimestamp?: number;
}

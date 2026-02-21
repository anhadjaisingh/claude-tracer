import { describe, it, expect } from 'vitest';
import { filterBlocks, DEFAULT_FILTER_CONFIG } from '../filter';
import type {
  AnyBlock,
  UserBlock,
  AgentBlock,
  SystemBlock,
  ProgressBlock,
  FileSnapshotBlock,
  QueueOperationBlock,
} from '@/types';

function makeUserBlock(id: string): UserBlock {
  return { id, timestamp: 0, type: 'user', content: 'Hello' };
}

function makeAgentBlock(id: string): AgentBlock {
  return { id, timestamp: 0, type: 'agent', content: 'Hi', toolCalls: [] };
}

function makeSystemBlock(id: string, subtype = 'turn_duration'): SystemBlock {
  return { id, timestamp: 0, type: 'system', subtype, data: {} };
}

function makeProgressBlock(id: string): ProgressBlock {
  return { id, timestamp: 0, type: 'progress', progressType: 'bash_progress', data: {} };
}

function makeFileSnapshotBlock(id: string): FileSnapshotBlock {
  return { id, timestamp: 0, type: 'file-snapshot', messageId: 'msg-1', trackedFiles: {} };
}

function makeQueueOperationBlock(id: string): QueueOperationBlock {
  return { id, timestamp: 0, type: 'queue-operation', operation: 'enqueue', content: 'msg' };
}

describe('filterBlocks', () => {
  it('passes through user and agent blocks with any config', () => {
    const blocks: AnyBlock[] = [makeUserBlock('1'), makeAgentBlock('2')];
    const result = filterBlocks(blocks, {
      showSystem: false,
      showProgress: false,
      showFileSnapshots: false,
      showQueueOps: false,
    });
    expect(result.length).toBe(2);
  });

  it('uses default config to show system blocks and hide progress/file-snapshot/queue-op', () => {
    const blocks: AnyBlock[] = [
      makeUserBlock('1'),
      makeSystemBlock('2'),
      makeProgressBlock('3'),
      makeFileSnapshotBlock('4'),
      makeQueueOperationBlock('5'),
    ];
    const result = filterBlocks(blocks, DEFAULT_FILTER_CONFIG);
    expect(result.length).toBe(2);
    expect(result.map((b) => b.id)).toEqual(['1', '2']);
  });

  it('shows all blocks when all config flags are true', () => {
    const blocks: AnyBlock[] = [
      makeUserBlock('1'),
      makeSystemBlock('2'),
      makeProgressBlock('3'),
      makeFileSnapshotBlock('4'),
      makeQueueOperationBlock('5'),
    ];
    const result = filterBlocks(blocks, {
      showSystem: true,
      showProgress: true,
      showFileSnapshots: true,
      showQueueOps: true,
    });
    expect(result.length).toBe(5);
  });

  it('hides system blocks when showSystem is false', () => {
    const blocks: AnyBlock[] = [makeUserBlock('1'), makeSystemBlock('2')];
    const result = filterBlocks(blocks, { ...DEFAULT_FILTER_CONFIG, showSystem: false });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });

  it('shows progress blocks when showProgress is true', () => {
    const blocks: AnyBlock[] = [makeUserBlock('1'), makeProgressBlock('2')];
    const result = filterBlocks(blocks, { ...DEFAULT_FILTER_CONFIG, showProgress: true });
    expect(result.length).toBe(2);
  });

  it('shows file-snapshot blocks when showFileSnapshots is true', () => {
    const blocks: AnyBlock[] = [makeUserBlock('1'), makeFileSnapshotBlock('2')];
    const result = filterBlocks(blocks, { ...DEFAULT_FILTER_CONFIG, showFileSnapshots: true });
    expect(result.length).toBe(2);
  });

  it('shows queue-operation blocks when showQueueOps is true', () => {
    const blocks: AnyBlock[] = [makeUserBlock('1'), makeQueueOperationBlock('2')];
    const result = filterBlocks(blocks, { ...DEFAULT_FILTER_CONFIG, showQueueOps: true });
    expect(result.length).toBe(2);
  });

  it('uses DEFAULT_FILTER_CONFIG when no config is provided', () => {
    const blocks: AnyBlock[] = [makeUserBlock('1'), makeSystemBlock('2'), makeProgressBlock('3')];
    const result = filterBlocks(blocks);
    expect(result.length).toBe(2);
    expect(result.map((b) => b.id)).toEqual(['1', '2']);
  });

  it('returns empty array for empty input', () => {
    const result = filterBlocks([]);
    expect(result.length).toBe(0);
  });
});

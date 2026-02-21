import type { AnyBlock } from '@/types';
import {
  isSystemBlock,
  isProgressBlock,
  isFileSnapshotBlock,
  isQueueOperationBlock,
} from '@/types';

export interface FilterConfig {
  showSystem: boolean;
  showProgress: boolean;
  showFileSnapshots: boolean;
  showQueueOps: boolean;
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  showSystem: true,
  showProgress: false,
  showFileSnapshots: false,
  showQueueOps: false,
};

export function filterBlocks(
  blocks: AnyBlock[],
  config: FilterConfig = DEFAULT_FILTER_CONFIG,
): AnyBlock[] {
  return blocks.filter((block) => {
    if (isSystemBlock(block)) return config.showSystem;
    if (isProgressBlock(block)) return config.showProgress;
    if (isFileSnapshotBlock(block)) return config.showFileSnapshots;
    if (isQueueOperationBlock(block)) return config.showQueueOps;
    return true;
  });
}

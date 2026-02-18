import type { AnyBlock, Chunk, ChunkLevel, UserBlock } from '@/types';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock } from '@/types';

/**
 * Creates hierarchical chunks from blocks
 */
export class Chunker {
  private chunkIdCounter = 0;

  /**
   * Create chunks from blocks
   * Currently implements turn-level chunking (user -> agent -> tools)
   */
  createChunks(blocks: AnyBlock[]): Chunk[] {
    const chunks: Chunk[] = [];
    let currentTurn: Chunk | null = null;

    for (const block of blocks) {
      if (isUserBlock(block)) {
        const userBlock = block as UserBlock;
        if (userBlock.isMeta) {
          // isMeta user blocks don't start new turns
          if (currentTurn) {
            currentTurn.blockIds.push(block.id);
          }
          continue;
        }
        // Start a new turn
        if (currentTurn) {
          this.finalizeChunk(currentTurn, blocks);
          chunks.push(currentTurn);
        }
        currentTurn = this.createChunk('turn', this.getTurnLabel(block));
        currentTurn.blockIds.push(block.id);
      } else if (isAgentBlock(block)) {
        if (!currentTurn) {
          // Agent without preceding user (e.g., system prompt response)
          currentTurn = this.createChunk('turn', 'Agent response');
        }
        currentTurn.blockIds.push(block.id);
      } else if ((isToolBlock(block) || isMcpBlock(block)) && currentTurn) {
        currentTurn.blockIds.push(block.id);
      }
    }

    // Don't forget the last turn
    if (currentTurn) {
      this.finalizeChunk(currentTurn, blocks);
      chunks.push(currentTurn);
    }

    return chunks;
  }

  private createChunk(level: ChunkLevel, label: string): Chunk {
    return {
      id: `chunk-${++this.chunkIdCounter}`,
      level,
      label,
      blockIds: [],
      childChunkIds: [],
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalWallTimeMs: 0,
    };
  }

  private getTurnLabel(userBlock: AnyBlock): string {
    if (isUserBlock(userBlock)) {
      const content = userBlock.content;
      return content.length > 50 ? content.slice(0, 47) + '...' : content;
    }
    return 'Turn';
  }

  private finalizeChunk(chunk: Chunk, allBlocks: AnyBlock[]): void {
    const chunkBlocks = allBlocks.filter(b => chunk.blockIds.includes(b.id));

    chunk.totalTokensIn = chunkBlocks.reduce(
      (sum, b) => sum + (b.tokensIn || 0),
      0,
    );
    chunk.totalTokensOut = chunkBlocks.reduce(
      (sum, b) => sum + (b.tokensOut || 0),
      0,
    );
    chunk.totalWallTimeMs = chunkBlocks.reduce(
      (sum, b) => sum + (b.wallTimeMs || 0),
      0,
    );
  }
}

import type { AnyBlock, ParsedSession, SessionMetadata, TraceParser, Chunk } from '@/types';

/**
 * Abstract base class for trace parsers
 */
export abstract class BaseParser implements TraceParser {
  private blockIdCounter = 0;

  abstract parse(content: string): ParsedSession;
  abstract parseLine(line: string): AnyBlock | AnyBlock[] | null;
  abstract canParse(content: string): boolean;

  /**
   * Generate a unique block ID
   */
  generateBlockId(): string {
    return `block-${String(++this.blockIdCounter)}-${String(Date.now())}`;
  }

  /**
   * Create a session object with default metadata
   */
  protected createSession(
    filePath: string,
    blocks: AnyBlock[],
    chunks: Chunk[] = [],
    metadata: Partial<SessionMetadata> = {},
  ): ParsedSession {
    const startTime = blocks.length > 0 ? Math.min(...blocks.map((b) => b.timestamp)) : Date.now();

    const endTime = blocks.length > 0 ? Math.max(...blocks.map((b) => b.timestamp)) : undefined;

    return {
      id: this.generateSessionId(filePath),
      filePath,
      blocks,
      chunks,
      metadata: {
        startTime,
        endTime,
        ...metadata,
      },
    };
  }

  /**
   * Generate a session ID from file path
   */
  private generateSessionId(filePath: string): string {
    const filename = filePath.split('/').pop() ?? 'unknown';
    return `session-${filename}-${String(Date.now())}`;
  }
}

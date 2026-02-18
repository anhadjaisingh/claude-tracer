import { watch, type ChokidarOptions, type FSWatcher } from 'chokidar';
import fs from 'fs';
import type { AnyBlock, TraceParser } from '@/types';

/**
 * Simple fallback parser for when ClaudeCodeParser is not available.
 * Handles basic JSONL line parsing into blocks.
 */
class SimpleLineParser implements TraceParser {
  private blockIdCounter = 0;

  parse(content: string) {
    const lines = content.trim().split('\n').filter((l) => l.trim());
    const blocks: AnyBlock[] = [];
    for (const line of lines) {
      const block = this.parseLine(line);
      if (block) blocks.push(block);
    }
    return {
      id: `session-${Date.now()}`,
      filePath: '',
      blocks,
      chunks: [],
      metadata: { startTime: Date.now() },
    };
  }

  parseLine(line: string): AnyBlock | null {
    try {
      const data = JSON.parse(line) as Record<string, unknown>;
      const id = `block-${++this.blockIdCounter}-${Date.now()}`;
      const timestamp = data.timestamp
        ? new Date(data.timestamp as string).getTime()
        : Date.now();

      if (data.type === 'user') {
        const message = data.message as Record<string, unknown> | undefined;
        return {
          id,
          timestamp,
          type: 'user',
          content: (message?.content as string) ?? '',
        };
      }

      // Generic fallback: treat as user block
      return {
        id,
        timestamp,
        type: 'user',
        content: JSON.stringify(data),
      };
    } catch {
      return null;
    }
  }

  canParse(_content: string): boolean {
    return true;
  }
}

export interface SessionWatcherOptions {
  parser?: TraceParser;
  chokidar?: ChokidarOptions;
}

export class SessionWatcher {
  private watcher: FSWatcher | null = null;
  private parser: TraceParser;
  private chokidarOptions: ChokidarOptions;
  private lastPosition = 0;
  private filePath: string = '';

  constructor(options: SessionWatcherOptions = {}) {
    this.parser = options.parser ?? new SimpleLineParser();
    this.chokidarOptions = options.chokidar ?? {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    };
  }

  async watch(
    filePath: string,
    onBlocks: (blocks: AnyBlock[], isInitial: boolean) => void,
  ): Promise<void> {
    this.filePath = filePath;

    // Initial read
    const content = fs.readFileSync(filePath, 'utf-8');
    const blocks = this.parseContent(content);
    this.lastPosition = fs.statSync(filePath).size;
    onBlocks(blocks, true);

    // Watch for changes
    this.watcher = watch(filePath, this.chokidarOptions);

    this.watcher.on('change', () => {
      const newBlocks = this.readNewContent();
      if (newBlocks.length > 0) {
        onBlocks(newBlocks, false);
      }
    });

    // Wait for watcher to be ready before resolving
    await new Promise<void>((resolve) => {
      this.watcher!.on('ready', resolve);
    });
  }

  private readNewContent(): AnyBlock[] {
    const stats = fs.statSync(this.filePath);
    if (stats.size <= this.lastPosition) {
      return [];
    }

    const fd = fs.openSync(this.filePath, 'r');
    const newSize = stats.size - this.lastPosition;
    const buffer = Buffer.alloc(newSize);
    fs.readSync(fd, buffer, 0, newSize, this.lastPosition);
    fs.closeSync(fd);

    this.lastPosition = stats.size;

    const newContent = buffer.toString('utf-8');
    return this.parseContent(newContent);
  }

  private parseContent(content: string): AnyBlock[] {
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.trim());
    const blocks: AnyBlock[] = [];

    for (const line of lines) {
      const block = this.parser.parseLine(line);
      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

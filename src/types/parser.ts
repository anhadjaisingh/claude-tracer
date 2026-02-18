import type { AnyBlock } from './blocks';
import type { Chunk } from './chunks';

export interface SessionMetadata {
  projectPath?: string;
  startTime: number;
  endTime?: number;
  model?: string;
}

export interface ParsedSession {
  id: string;
  filePath: string;
  blocks: AnyBlock[];
  chunks: Chunk[];
  metadata: SessionMetadata;
}

export interface TraceParser {
  parse(content: string): ParsedSession;
  parseLine(line: string): AnyBlock | null;
  canParse(content: string): boolean;
}

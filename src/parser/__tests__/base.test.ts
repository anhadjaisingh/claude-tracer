import { describe, it, expect } from 'vitest';
import { BaseParser } from '../base';
import type { AnyBlock, ParsedSession } from '@/types';

class TestParser extends BaseParser {
  parse(content: string): ParsedSession {
    void content;
    return this.createSession('test.jsonl', []);
  }

  parseLine(line: string): AnyBlock | null {
    void line;
    return null;
  }

  canParse(content: string): boolean {
    return content.startsWith('TEST');
  }
}

describe('BaseParser', () => {
  it('generates unique block IDs', () => {
    const parser = new TestParser();
    const id1 = parser.generateBlockId();
    const id2 = parser.generateBlockId();
    expect(id1).not.toBe(id2);
  });

  it('creates session with metadata', () => {
    const parser = new TestParser();
    const session = parser.parse('TEST');
    expect(session.filePath).toBe('test.jsonl');
    expect(session.metadata.startTime).toBeDefined();
  });
});

import { describe, it, expect } from 'vitest';
import { parseArgs } from '../cli';

describe('CLI argument parsing', () => {
  it('parses file path argument', () => {
    const args = parseArgs(['./session.jsonl']);
    expect(args.file).toBe('./session.jsonl');
  });

  it('parses port option', () => {
    const args = parseArgs(['-p', '8080']);
    expect(args.port).toBe(8080);
  });

  it('parses long port option', () => {
    const args = parseArgs(['--port', '9000']);
    expect(args.port).toBe(9000);
  });

  it('parses file with port', () => {
    const args = parseArgs(['./session.jsonl', '-p', '4000']);
    expect(args.file).toBe('./session.jsonl');
    expect(args.port).toBe(4000);
  });

  it('handles no arguments', () => {
    const args = parseArgs([]);
    expect(args.file).toBeUndefined();
    expect(args.port).toBeUndefined();
  });

  it('recognizes help flag', () => {
    const args = parseArgs(['-h']);
    expect(args.help).toBe(true);
  });

  it('recognizes version flag', () => {
    const args = parseArgs(['-v']);
    expect(args.version).toBe(true);
  });
});

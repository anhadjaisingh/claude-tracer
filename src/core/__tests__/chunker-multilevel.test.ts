import { describe, it, expect } from 'vitest';
import { Chunker } from '../chunker';
import type { AnyBlock, UserBlock, AgentBlock, ToolBlock } from '@/types';

function makeUser(id: string, timestamp: number, content: string): UserBlock {
  return { id, timestamp, type: 'user', content };
}

function makeAgent(
  id: string,
  timestamp: number,
  content: string,
  toolCalls: string[] = [],
  tokensIn = 0,
  tokensOut = 0,
): AgentBlock {
  return { id, timestamp, type: 'agent', content, toolCalls, tokensIn, tokensOut };
}

function makeTool(
  id: string,
  timestamp: number,
  parentId: string,
  toolName: string,
  input: unknown = {},
): ToolBlock {
  return { id, timestamp, type: 'tool', parentId, toolName, input, output: '', status: 'success' };
}

describe('Chunker - createChunksAtLevel', () => {
  it('dispatches to createChunks for turn level', () => {
    const blocks: AnyBlock[] = [makeUser('u1', 1000, 'Hello'), makeAgent('a1', 2000, 'Hi')];

    const chunker = new Chunker();
    const turnChunks = chunker.createChunks(blocks);
    const chunker2 = new Chunker();
    const dispatched = chunker2.createChunksAtLevel(blocks, 'turn');

    expect(dispatched.length).toBe(turnChunks.length);
    expect(dispatched[0].level).toBe('turn');
  });

  it('dispatches to createTaskChunks for task level', () => {
    const blocks: AnyBlock[] = [makeUser('u1', 1000, 'Hello'), makeAgent('a1', 2000, 'Hi')];

    const chunker = new Chunker();
    const chunks = chunker.createChunksAtLevel(blocks, 'task');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].level).toBe('task');
  });

  it('dispatches to createThemeChunks for theme level', () => {
    const blocks: AnyBlock[] = [makeUser('u1', 1000, 'Hello'), makeAgent('a1', 2000, 'Hi')];

    const chunker = new Chunker();
    const chunks = chunker.createChunksAtLevel(blocks, 'theme');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].level).toBe('theme');
  });
});

describe('Chunker - Task-Level Chunking', () => {
  it('merges consecutive turns without boundaries into one task chunk', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Start feature'),
      makeAgent('a1', 2000, 'Working on it'),
      makeUser('u2', 3000, 'Add error handling'),
      makeAgent('a2', 4000, 'Done'),
      makeUser('u3', 5000, 'Add tests'),
      makeAgent('a3', 6000, 'Tests added'),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    // No boundaries → all turns merge into 1 task
    expect(taskChunks.length).toBe(1);
    expect(taskChunks[0].level).toBe('task');
    expect(taskChunks[0].childChunkIds.length).toBe(3);
    expect(taskChunks[0].blockIds).toContain('u1');
    expect(taskChunks[0].blockIds).toContain('a3');
  });

  it('splits at git commit boundaries', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Implement feature'),
      makeAgent('a1', 2000, 'Working', ['t1']),
      makeTool('t1', 3000, 'a1', 'Bash', { command: 'git commit -m "feat: login"' }),
      makeUser('u2', 4000, 'Now fix tests'),
      makeAgent('a2', 5000, 'Fixing'),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    // Commit creates a boundary → 2 task chunks
    expect(taskChunks.length).toBe(2);
    expect(taskChunks[0].blockIds).toContain('u1');
    expect(taskChunks[0].blockIds).toContain('t1');
    expect(taskChunks[1].blockIds).toContain('u2');
  });

  it('splits at PR creation boundaries', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Create the PR'),
      makeAgent('a1', 2000, 'Creating', ['t1']),
      makeTool('t1', 3000, 'a1', 'Bash', {
        command: 'gh pr create --title "feat: login" --body "Adds login"',
      }),
      makeUser('u2', 4000, 'Now work on something else'),
      makeAgent('a2', 5000, 'On it'),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    expect(taskChunks.length).toBe(2);
  });

  it('splits at time gaps > 5 minutes', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'First task'),
      makeAgent('a1', 2000, 'Done'),
      // 6-minute gap (360000ms)
      makeUser('u2', 362000, 'Second task'),
      makeAgent('a2', 363000, 'Working'),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    // Time gap > 5 min → 2 task chunks
    expect(taskChunks.length).toBe(2);
  });

  it('does NOT split at time gaps between 3-5 minutes', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'First task'),
      makeAgent('a1', 2000, 'Done'),
      // 4-minute gap (240000ms) - over turn threshold but under task threshold
      makeUser('u2', 242000, 'Continue task'),
      makeAgent('a2', 243000, 'Working'),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    // 4 min gap splits turns but not tasks (since 4 < 5 min)
    expect(taskChunks.length).toBe(1);
  });

  it('splits at user direction changes', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Implement auth'),
      makeAgent('a1', 2000, 'Done'),
      makeUser('u2', 3000, "Now let's work on the UI"),
      makeAgent('a2', 4000, 'Working on UI'),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    // "Now let's" creates direction change → 2 tasks
    expect(taskChunks.length).toBe(2);
  });

  it('produces fewer chunks than turn-level for same input', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'First'),
      makeAgent('a1', 2000, 'OK'),
      makeUser('u2', 3000, 'Second'),
      makeAgent('a2', 4000, 'OK'),
      makeUser('u3', 5000, 'Third'),
      makeAgent('a3', 6000, 'OK'),
    ];

    const chunker1 = new Chunker();
    const turnChunks = chunker1.createChunks(blocks);
    const chunker2 = new Chunker();
    const taskChunks = chunker2.createTaskChunks(blocks);

    expect(taskChunks.length).toBeLessThanOrEqual(turnChunks.length);
  });

  it('uses commit message as task label when commit is in the turn', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Implement feature'),
      makeAgent('a1', 2000, 'Working', ['t1']),
      makeTool('t1', 3000, 'a1', 'Bash', { command: 'git commit -m "feat: add auth"' }),
      makeUser('u2', 4000, 'Next thing'),
      makeAgent('a2', 5000, 'OK'),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    // First task inherits label from its first child turn, which contains
    // the commit tool block — turn-level generateLabel picks up the commit message
    expect(taskChunks[0].label).toBe('feat: add auth');
  });

  it('aggregates tokens across child turns', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'First'),
      makeAgent('a1', 2000, 'OK', [], 100, 50),
      makeUser('u2', 3000, 'Second'),
      makeAgent('a2', 4000, 'OK', [], 200, 75),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    expect(taskChunks.length).toBe(1);
    expect(taskChunks[0].totalTokensIn).toBe(300);
    expect(taskChunks[0].totalTokensOut).toBe(125);
  });

  it('sets timestamps from first and last child turn', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'First'),
      makeAgent('a1', 2000, 'OK'),
      makeUser('u2', 3000, 'Second'),
      makeAgent('a2', 4000, 'OK'),
    ];

    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks(blocks);

    expect(taskChunks[0].startTimestamp).toBe(1000);
    expect(taskChunks[0].endTimestamp).toBe(4000);
  });

  it('returns empty array for empty input', () => {
    const chunker = new Chunker();
    const taskChunks = chunker.createTaskChunks([]);
    expect(taskChunks.length).toBe(0);
  });
});

describe('Chunker - Theme-Level Chunking', () => {
  it('merges consecutive tasks without large time gaps into one theme', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Implement auth'),
      makeAgent('a1', 2000, 'Done', ['t1']),
      makeTool('t1', 3000, 'a1', 'Bash', { command: 'git commit -m "feat: auth"' }),
      makeUser('u2', 4000, 'Add tests'),
      makeAgent('a2', 5000, 'Tests added'),
    ];

    const chunker = new Chunker();
    const themeChunks = chunker.createThemeChunks(blocks);

    // Two tasks (split by commit) but no 30-min gap → 1 theme
    expect(themeChunks.length).toBe(1);
    expect(themeChunks[0].level).toBe('theme');
    expect(themeChunks[0].childChunkIds.length).toBe(2);
  });

  it('splits at time gaps > 30 minutes', () => {
    const ms30Min = 30 * 60 * 1000;
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Morning work'),
      makeAgent('a1', 2000, 'Done'),
      // 31-minute gap
      makeUser('u2', 1000 + ms30Min + 60_000, 'Afternoon work'),
      makeAgent('a2', 2000 + ms30Min + 60_000, 'Done'),
    ];

    const chunker = new Chunker();
    const themeChunks = chunker.createThemeChunks(blocks);

    expect(themeChunks.length).toBe(2);
    expect(themeChunks[0].level).toBe('theme');
    expect(themeChunks[1].level).toBe('theme');
  });

  it('does NOT split at time gaps under 30 minutes', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Task A'),
      makeAgent('a1', 2000, 'Done', ['t1']),
      makeTool('t1', 3000, 'a1', 'Bash', { command: 'git commit -m "feat: A"' }),
      // 20-minute gap (under 30 min threshold)
      makeUser('u2', 1000 + 20 * 60 * 1000, 'Task B'),
      makeAgent('a2', 2000 + 20 * 60 * 1000, 'Done'),
    ];

    const chunker = new Chunker();
    const themeChunks = chunker.createThemeChunks(blocks);

    // 20 min gap doesn't split themes
    expect(themeChunks.length).toBe(1);
  });

  it('produces fewer chunks than task-level for same input', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Impl A'),
      makeAgent('a1', 2000, 'Done', ['t1']),
      makeTool('t1', 3000, 'a1', 'Bash', { command: 'git commit -m "A"' }),
      makeUser('u2', 4000, 'Impl B'),
      makeAgent('a2', 5000, 'Done', ['t2']),
      makeTool('t2', 6000, 'a2', 'Bash', { command: 'git commit -m "B"' }),
      makeUser('u3', 7000, 'Impl C'),
      makeAgent('a3', 8000, 'Done'),
    ];

    const chunker1 = new Chunker();
    const taskChunks = chunker1.createTaskChunks(blocks);
    const chunker2 = new Chunker();
    const themeChunks = chunker2.createThemeChunks(blocks);

    expect(themeChunks.length).toBeLessThanOrEqual(taskChunks.length);
  });

  it('uses first task label as theme label', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Build authentication system'),
      makeAgent('a1', 2000, 'Done'),
      makeUser('u2', 4000, 'Add tests'),
      makeAgent('a2', 5000, 'Done'),
    ];

    const chunker = new Chunker();
    const themeChunks = chunker.createThemeChunks(blocks);

    // Theme label inherits from first task, which inherits from first turn's user content
    expect(themeChunks[0].label).toBe('Build authentication system');
  });

  it('aggregates stats across child tasks', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Task A'),
      makeAgent('a1', 2000, 'Done', [], 100, 50),
      makeUser('u2', 3000, 'Task B'),
      makeAgent('a2', 4000, 'Done', [], 200, 75),
    ];

    const chunker = new Chunker();
    const themeChunks = chunker.createThemeChunks(blocks);

    expect(themeChunks[0].totalTokensIn).toBe(300);
    expect(themeChunks[0].totalTokensOut).toBe(125);
  });

  it('sets timestamps from first and last child task', () => {
    const blocks: AnyBlock[] = [
      makeUser('u1', 1000, 'Start'),
      makeAgent('a1', 2000, 'OK'),
      makeUser('u2', 3000, 'Continue'),
      makeAgent('a2', 10000, 'Done'),
    ];

    const chunker = new Chunker();
    const themeChunks = chunker.createThemeChunks(blocks);

    expect(themeChunks[0].startTimestamp).toBe(1000);
    expect(themeChunks[0].endTimestamp).toBe(10000);
  });

  it('returns empty array for empty input', () => {
    const chunker = new Chunker();
    const themeChunks = chunker.createThemeChunks([]);
    expect(themeChunks.length).toBe(0);
  });
});

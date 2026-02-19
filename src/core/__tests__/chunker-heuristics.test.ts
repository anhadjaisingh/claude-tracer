import { describe, it, expect } from 'vitest';
import { Chunker } from '../chunker';
import type { AnyBlock, UserBlock, AgentBlock, ToolBlock } from '@/types';

// Helper to create a user block
function makeUser(id: string, timestamp: number, content: string): UserBlock {
  return { id, timestamp, type: 'user', content };
}

// Helper to create an agent block
function makeAgent(
  id: string,
  timestamp: number,
  content: string,
  toolCalls: string[] = [],
): AgentBlock {
  return { id, timestamp, type: 'agent', content, toolCalls };
}

// Helper to create a tool block
function makeTool(
  id: string,
  timestamp: number,
  parentId: string,
  toolName: string,
  input: unknown = {},
  output: unknown = '',
): ToolBlock {
  return { id, timestamp, type: 'tool', parentId, toolName, input, output, status: 'success' };
}

describe('Chunker - Heuristic Boundary Detection', () => {
  describe('Time-gap boundaries', () => {
    it('creates a new chunk when time gap exceeds 3 minutes', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'First task'),
        makeAgent('a1', 2000, 'Working on first task'),
        // 4-minute gap (240000ms)
        makeUser('u2', 242000, 'Second task'),
        makeAgent('a2', 243000, 'Working on second task'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
      expect(turns[0].blockIds).toContain('u1');
      expect(turns[0].blockIds).toContain('a1');
      expect(turns[1].blockIds).toContain('u2');
      expect(turns[1].blockIds).toContain('a2');

      // The second chunk should have a time-gap boundary signal
      expect(turns[1].boundarySignals).toBeDefined();
      expect(turns[1].boundarySignals).toContainEqual(
        expect.objectContaining({ type: 'time-gap' }),
      );
    });

    it('does NOT create a new chunk for gaps under 3 minutes', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'First task'),
        makeAgent('a1', 2000, 'Working on first task'),
        // 2-minute gap (120000ms) - under threshold
        makeAgent('a2', 122000, 'Still working'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      // Should stay in the same chunk since no new user message
      expect(turns.length).toBe(1);
    });
  });

  describe('Tool-call pattern boundaries', () => {
    it('creates a boundary after git commit', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Implement the feature'),
        makeAgent('a1', 2000, 'Working on it', ['t1']),
        makeTool('t1', 3000, 'a1', 'Bash', { command: 'git commit -m "feat: add login"' }),
        makeUser('u2', 4000, 'Now fix the tests'),
        makeAgent('a2', 5000, 'Fixing tests'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
      // First chunk should contain u1, a1, t1
      expect(turns[0].blockIds).toContain('t1');
      // Second chunk should start at u2
      expect(turns[1].blockIds).toContain('u2');
    });

    it('creates a boundary after git push', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Push the changes'),
        makeAgent('a1', 2000, 'Pushing', ['t1']),
        makeTool('t1', 3000, 'a1', 'Bash', { command: 'git push origin main' }),
        makeUser('u2', 4000, 'Now work on something else'),
        makeAgent('a2', 5000, 'On it'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
    });

    it('creates a boundary after gh pr create', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Create a PR'),
        makeAgent('a1', 2000, 'Creating PR', ['t1']),
        makeTool('t1', 3000, 'a1', 'Bash', {
          command: 'gh pr create --title "feat: login" --body "Adds login"',
        }),
        makeUser('u2', 4000, 'Now review the other PR'),
        makeAgent('a2', 5000, 'Reviewing'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
      // Check for pr-creation boundary signal
      expect(turns[1].boundarySignals).toContainEqual(
        expect.objectContaining({ type: 'pr-creation' }),
      );
    });

    it('creates a boundary when git checkout -b is used (new branch)', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Start a new feature'),
        makeAgent('a1', 2000, 'Creating branch', ['t1']),
        makeTool('t1', 3000, 'a1', 'Bash', { command: 'git checkout -b feat/new-feature' }),
        makeAgent('a3', 4000, 'Working on the new branch', ['t2']),
        makeTool('t2', 5000, 'a3', 'Read', { file_path: '/src/index.ts' }),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      // The checkout -b should trigger a boundary signal on the chunk containing it
      const allSignals = turns.flatMap((t) => t.boundarySignals ?? []);
      expect(allSignals).toContainEqual(expect.objectContaining({ type: 'branch-switch' }));
    });
  });

  describe('User message pattern boundaries', () => {
    it('creates a boundary for "Now let\'s..." messages', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Implement the auth system'),
        makeAgent('a1', 2000, 'Working on auth'),
        makeUser('u2', 3000, "Now let's work on the tests"),
        makeAgent('a2', 4000, 'Working on tests'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
      expect(turns[1].boundarySignals).toContainEqual(
        expect.objectContaining({ type: 'user-pattern' }),
      );
    });

    it('creates a boundary for "Next:" messages', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Fix the bug'),
        makeAgent('a1', 2000, 'Fixed'),
        makeUser('u2', 3000, 'Next: implement the feature'),
        makeAgent('a2', 4000, 'Implementing'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
    });

    it('creates a boundary for "Moving on to..." messages', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Fix the bug'),
        makeAgent('a1', 2000, 'Fixed'),
        makeUser('u2', 3000, 'Moving on to the deployment setup'),
        makeAgent('a2', 4000, 'Setting up deployment'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
    });

    it('creates a boundary for slash commands', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Implement feature'),
        makeAgent('a1', 2000, 'Done'),
        makeUser('u2', 3000, '/commit'),
        makeAgent('a2', 4000, 'Committing'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
    });

    it('does NOT create extra boundary for normal continuation messages', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Implement the auth system'),
        makeAgent('a1', 2000, 'Working on auth'),
        makeUser('u2', 3000, 'Can you also add error handling?'),
        makeAgent('a2', 4000, 'Adding error handling'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      // Normal user messages still create new turns (existing behavior)
      // but should NOT have a user-pattern boundary signal
      expect(turns.length).toBe(2);
      // The second chunk should NOT have a user-pattern signal
      const userPatternSignals = (turns[1].boundarySignals ?? []).filter(
        (s) => s.type === 'user-pattern',
      );
      expect(userPatternSignals.length).toBe(0);
    });
  });

  describe('Chunk labels', () => {
    it('uses first sentence of user content as label', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Implement JWT authentication for the API. It should use RS256.'),
        makeAgent('a1', 2000, 'Working on it'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turn = chunks.find((c) => c.level === 'turn');

      expect(turn?.label).toBe('Implement JWT authentication for the API');
    });

    it('truncates long first sentences to 80 chars', () => {
      const longMsg =
        'Implement a comprehensive authentication system with JWT tokens and refresh token rotation and multi-factor authentication support for the entire API surface';
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, longMsg),
        makeAgent('a1', 2000, 'Working on it'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turn = chunks.find((c) => c.level === 'turn');

      // Label should be at most 80 chars
      expect(turn?.label.length).toBeLessThanOrEqual(80);
      expect(turn?.label).toMatch(/\.\.\.$/);
    });

    it('includes git commit message in label when present', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Commit the changes'),
        makeAgent('a1', 2000, 'Committing', ['t1']),
        makeTool('t1', 3000, 'a1', 'Bash', { command: 'git commit -m "feat: add login page"' }),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turn = chunks.find((c) => c.level === 'turn');

      expect(turn?.label).toContain('feat: add login page');
    });

    it('includes PR info in label when gh pr create is present', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Create a PR'),
        makeAgent('a1', 2000, 'Creating PR', ['t1']),
        makeTool('t1', 3000, 'a1', 'Bash', {
          command: 'gh pr create --title "feat: login" --body "Adds login"',
        }),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turn = chunks.find((c) => c.level === 'turn');

      expect(turn?.label).toContain('PR');
    });

    it('uses short content directly when under 80 chars', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'Fix the login bug'),
        makeAgent('a1', 2000, 'Fixed'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turn = chunks.find((c) => c.level === 'turn');

      expect(turn?.label).toBe('Fix the login bug');
    });
  });

  describe('Timestamps on chunks', () => {
    it('sets startTimestamp and endTimestamp on chunks', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'First task'),
        makeAgent('a1', 2000, 'Working'),
        makeTool('t1', 3000, 'a1', 'Read', {}),
        makeUser('u2', 5000, 'Second task'),
        makeAgent('a2', 6000, 'Working on second'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns[0].startTimestamp).toBe(1000);
      expect(turns[0].endTimestamp).toBe(3000);
      expect(turns[1].startTimestamp).toBe(5000);
      expect(turns[1].endTimestamp).toBe(6000);
    });
  });

  describe('Boundary signals are recorded', () => {
    it('records multiple boundary signals on the same chunk', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'First task'),
        makeAgent('a1', 2000, 'Done', ['t1']),
        makeTool('t1', 3000, 'a1', 'Bash', { command: 'git commit -m "feat: done"' }),
        // Time gap of 4 minutes AND a "Now let's" user pattern
        makeUser('u2', 243000, "Now let's do the next thing"),
        makeAgent('a2', 244000, 'On it'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns.length).toBe(2);
      const signals = turns[1].boundarySignals ?? [];
      const signalTypes = signals.map((s) => s.type);
      expect(signalTypes).toContain('time-gap');
      expect(signalTypes).toContain('user-pattern');
    });

    it('first chunk has no boundary signals', () => {
      const blocks: AnyBlock[] = [
        makeUser('u1', 1000, 'First task'),
        makeAgent('a1', 2000, 'Working'),
      ];

      const chunker = new Chunker();
      const chunks = chunker.createChunks(blocks);
      const turns = chunks.filter((c) => c.level === 'turn');

      expect(turns[0].boundarySignals ?? []).toEqual([]);
    });
  });
});

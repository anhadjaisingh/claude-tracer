import type { AnyBlock, BoundarySignal, Chunk, ChunkLevel } from '@/types';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock, isTeamMessageBlock } from '@/types';

/** Time gap threshold for boundary detection (3 minutes in ms) */
const TIME_GAP_THRESHOLD_MS = 3 * 60 * 1000;

/** Maximum label length */
const MAX_LABEL_LENGTH = 80;

/** Patterns that signal a new task in user messages */
const NEW_TASK_PATTERNS: { regex: RegExp; name: string }[] = [
  { regex: /^now\s+let['\u2019]?s\s/i, name: "Now let's..." },
  { regex: /^let['\u2019]?s\s/i, name: "Let's..." },
  { regex: /^next[,:]\s/i, name: 'Next:' },
  { regex: /^moving\s+on\s+to\s/i, name: 'Moving on to...' },
  { regex: /^move\s+on\s+to\s/i, name: 'Move on to...' },
  { regex: /^task[:\s]/i, name: 'Task:' },
  { regex: /^todo[:\s]/i, name: 'TODO:' },
  { regex: /^\/[a-z]/i, name: 'Slash command' },
];

/**
 * Detects if a Bash tool call command represents a task boundary.
 * Returns boundary signals if the command matches known patterns.
 */
function detectToolBoundarySignals(block: AnyBlock): BoundarySignal[] {
  if (!isToolBlock(block)) return [];
  if (block.toolName !== 'Bash') return [];

  const input = block.input as Record<string, unknown> | null;
  const cmd = typeof input?.command === 'string' ? input.command : '';
  const signals: BoundarySignal[] = [];

  // Git commit
  const commitMatch = /git\s+commit\s+(?:-[^m]*\s+)*-m\s+["']([^"']*)["']/i.exec(cmd);
  if (commitMatch) {
    signals.push({ type: 'git-commit', message: commitMatch[1] });
  } else if (/git\s+commit/i.test(cmd)) {
    signals.push({ type: 'git-commit' });
  }

  // Git push
  if (/git\s+push/i.test(cmd)) {
    signals.push({ type: 'git-push' });
  }

  // PR creation
  const prTitleMatch = /gh\s+pr\s+create\s+.*--title\s+["']([^"']*)["']/i.exec(cmd);
  if (prTitleMatch) {
    signals.push({ type: 'pr-creation', prNumber: prTitleMatch[1] });
  } else if (/gh\s+pr\s+create/i.test(cmd)) {
    signals.push({ type: 'pr-creation' });
  }

  // Branch switch (git checkout -b or git switch -c)
  const branchMatch = /git\s+(?:checkout\s+-b|switch\s+-c)\s+(\S+)/i.exec(cmd);
  if (branchMatch) {
    signals.push({ type: 'branch-switch', fromBranch: '', toBranch: branchMatch[1] });
  }

  return signals;
}

/**
 * Detects if a user message matches a new-task pattern.
 * Returns the matching pattern name or null.
 */
function detectUserMessagePattern(content: string): string | null {
  const trimmed = content.trim();
  for (const { regex, name } of NEW_TASK_PATTERNS) {
    if (regex.test(trimmed)) {
      return name;
    }
  }
  return null;
}

/**
 * Generates a meaningful label for a chunk.
 * Priority:
 * 1. Git commit message (if present in chunk)
 * 2. PR title (if present in chunk)
 * 3. First sentence of user content
 * 4. Truncated user content (up to MAX_LABEL_LENGTH)
 * 5. Fallback to 'Turn'
 */
function generateLabel(userContent: string | null, chunkBlocks: AnyBlock[]): string {
  // Check for git commit message in chunk's tool blocks
  for (const block of chunkBlocks) {
    if (!isToolBlock(block) || block.toolName !== 'Bash') continue;
    const input = block.input as Record<string, unknown> | null;
    const cmd = typeof input?.command === 'string' ? input.command : '';

    // Extract commit message
    const commitMatch = /git\s+commit\s+(?:-[^m]*\s+)*-m\s+["']([^"']*)["']/i.exec(cmd);
    if (commitMatch) {
      return commitMatch[1];
    }

    // Extract PR title
    const prMatch = /gh\s+pr\s+create\s+.*--title\s+["']([^"']*)["']/i.exec(cmd);
    if (prMatch) {
      return `PR: ${prMatch[1]}`;
    }
  }

  // Use user content
  if (userContent) {
    return extractLabel(userContent);
  }

  return 'Turn';
}

/**
 * Extracts a label from user content.
 * Uses first sentence if available, otherwise truncates.
 */
function extractLabel(content: string): string {
  const trimmed = content.trim();

  // Try to extract the first sentence (ending with . ! or ?)
  const sentenceMatch = /^([^.!?]+)[.!?]/.exec(trimmed);
  if (sentenceMatch) {
    const sentence = sentenceMatch[1].trim();
    if (sentence.length <= MAX_LABEL_LENGTH) {
      return sentence;
    }
    return sentence.slice(0, MAX_LABEL_LENGTH - 3) + '...';
  }

  // No sentence boundary found, use the full content
  if (trimmed.length <= MAX_LABEL_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, MAX_LABEL_LENGTH - 3) + '...';
}

/**
 * Creates hierarchical chunks from blocks with heuristic boundary detection.
 *
 * Boundary signals detected:
 * - Time gaps > 3 minutes between consecutive blocks
 * - Tool-call patterns: git commit, git push, gh pr create, git checkout -b
 * - User message patterns: "Now let's...", "Next:", "Moving on to...", slash commands
 */
export class Chunker {
  private chunkIdCounter = 0;

  /**
   * Create chunks from blocks with heuristic boundary detection.
   * Enhances turn-level chunking with:
   * - Time gap detection (> 3 min)
   * - Tool boundary signals (git commit/push/PR/branch)
   * - User message pattern detection
   * - Improved labels (first sentence, commit messages, PR titles)
   * - Timestamps (start/end)
   * - Boundary signal recording
   */
  createChunks(blocks: AnyBlock[]): Chunk[] {
    const chunks: Chunk[] = [];
    let currentTurn: Chunk | null = null;
    let previousBlock: AnyBlock | null = null;
    // Track tool signals that should mark the boundary of the NEXT chunk
    let endOfUnitSignals: BoundarySignal[] = [];

    for (const block of blocks) {
      // Detect time gap between consecutive blocks
      const timeGapSignal = this.detectTimeGap(previousBlock, block);

      if (isUserBlock(block)) {
        const userBlock = block;
        if (userBlock.isMeta) {
          // isMeta user blocks don't start new turns
          if (currentTurn) {
            currentTurn.blockIds.push(block.id);
          }
          previousBlock = block;
          continue;
        }

        // Collect boundary signals for this new chunk
        const signals: BoundarySignal[] = [...endOfUnitSignals];
        endOfUnitSignals = [];

        if (timeGapSignal) {
          signals.push(timeGapSignal);
        }

        // Detect user message pattern
        const pattern = detectUserMessagePattern(userBlock.content);
        if (pattern) {
          signals.push({ type: 'user-pattern', pattern });
        }

        // Start a new turn
        if (currentTurn) {
          this.finalizeChunk(currentTurn, blocks);
          chunks.push(currentTurn);
        }

        // Label will be generated at finalization time (needs full chunk blocks)
        currentTurn = this.createChunk('turn', extractLabel(userBlock.content));
        currentTurn.blockIds.push(block.id);

        // Only attach boundary signals if this is not the first chunk
        if (chunks.length > 0 && signals.length > 0) {
          currentTurn.boundarySignals = signals;
        }
      } else if (isAgentBlock(block)) {
        currentTurn ??= this.createChunk('turn', 'Agent response');
        currentTurn.blockIds.push(block.id);
      } else if ((isToolBlock(block) || isMcpBlock(block)) && currentTurn) {
        currentTurn.blockIds.push(block.id);

        // Detect tool boundary signals
        const toolSignals = detectToolBoundarySignals(block);
        for (const signal of toolSignals) {
          if (signal.type === 'branch-switch') {
            // Branch switches are "start of unit" signals -- record on current chunk
            currentTurn.boundarySignals = currentTurn.boundarySignals ?? [];
            currentTurn.boundarySignals.push(signal);
          } else {
            // Commit, push, PR are "end of unit" signals -- defer to next chunk
            endOfUnitSignals.push(signal);
          }
        }
      } else if (isTeamMessageBlock(block)) {
        // Team messages don't start new turns
        if (currentTurn) {
          currentTurn.blockIds.push(block.id);
        }
      } else {
        // System, progress, file-snapshot, queue-operation blocks
        // don't start new turns — add to current chunk
        if (currentTurn) {
          currentTurn.blockIds.push(block.id);
        }
      }

      previousBlock = block;
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
      id: `chunk-${String(++this.chunkIdCounter)}`,
      level,
      label,
      blockIds: [],
      childChunkIds: [],
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalWallTimeMs: 0,
      boundarySignals: [],
    };
  }

  /**
   * Detect a time gap boundary signal between two blocks.
   * Returns a BoundarySignal if the gap exceeds TIME_GAP_THRESHOLD_MS.
   */
  private detectTimeGap(prevBlock: AnyBlock | null, currBlock: AnyBlock): BoundarySignal | null {
    if (!prevBlock) return null;
    const gap = currBlock.timestamp - prevBlock.timestamp;
    if (gap > TIME_GAP_THRESHOLD_MS) {
      return { type: 'time-gap', gapMs: gap };
    }
    return null;
  }

  private finalizeChunk(chunk: Chunk, allBlocks: AnyBlock[]): void {
    const chunkBlocks = allBlocks.filter((b) => chunk.blockIds.includes(b.id));

    chunk.totalTokensIn = chunkBlocks.reduce((sum, b) => sum + (b.tokensIn ?? 0), 0);
    chunk.totalTokensOut = chunkBlocks.reduce((sum, b) => sum + (b.tokensOut ?? 0), 0);
    chunk.totalWallTimeMs = chunkBlocks.reduce((sum, b) => sum + (b.wallTimeMs ?? 0), 0);

    // Set timestamps
    if (chunkBlocks.length > 0) {
      chunk.startTimestamp = chunkBlocks[0].timestamp;
      chunk.endTimestamp = chunkBlocks[chunkBlocks.length - 1].timestamp;
    }

    // Improve label based on chunk contents (git commit, PR, etc.)
    const userBlock = chunkBlocks.find((b) => isUserBlock(b));
    const userContent = userBlock && isUserBlock(userBlock) ? userBlock.content : null;
    chunk.label = generateLabel(userContent, chunkBlocks);
  }
}

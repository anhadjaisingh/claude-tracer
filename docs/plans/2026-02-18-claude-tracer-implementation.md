# Claude-Tracer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local trace visualization tool for Claude Code sessions with live-reload, collapsible blocks, and hierarchical navigation.

**Architecture:** Node server (Express + WebSocket) serves a React UI. Parser reads JSONL files, Core organizes blocks into chunks with search, UI renders chat-like visualization with arrows. Single process handles file watching and live updates.

**Tech Stack:** TypeScript, React, Vite, Tailwind CSS, Express, WebSocket (ws), chokidar, MiniSearch, react-window

---

## Phase 0: Project Setup

### Task 0.1: Initialize Project Structure

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `.gitignore`

**Step 1: Initialize package.json**

```bash
cd /Users/anhad/Projects/claude-tracer
npm init -y
```

**Step 2: Install core dependencies**

```bash
npm install express ws chokidar minisearch react react-dom react-window
npm install -D typescript @types/node @types/express @types/ws @types/react @types/react-dom vite @vitejs/plugin-react tailwindcss postcss autoprefixer concurrently
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create tsconfig.node.json for server**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist/server"
  },
  "include": ["src/server/**/*", "src/types/**/*", "src/parser/**/*", "src/core/**/*"]
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.log
.DS_Store
```

**Step 6: Create directory structure**

```bash
mkdir -p src/{types,parser,core,server,ui/{components,hooks,styles,themes}}
```

**Step 7: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json .gitignore
git commit -m "chore: initialize project with TypeScript and dependencies"
```

---

### Task 0.2: Configure Vite and Tailwind

**Files:**
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `src/ui/styles/globals.css`
- Create: `src/ui/index.html`

**Step 1: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/ui',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
```

**Step 2: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/ui/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        claude: {
          orange: '#f97316',
          peach: '#ffedd5',
          cream: '#fff7ed',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

**Step 3: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 4: Create src/ui/styles/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-background: #ffedd5;
  --color-agent-bg: #374151;
  --color-agent-text: #f3f4f6;
  --color-user-bg: #f9fafb;
  --color-user-text: #111827;
  --color-tool-bg: #0f0f0f;
  --color-tool-text: #e5e5e5;
  --color-accent: #f97316;
}

body {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  background-color: var(--color-background);
}
```

**Step 5: Create src/ui/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claude Tracer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

**Step 6: Commit**

```bash
git add vite.config.ts tailwind.config.js postcss.config.js src/ui/
git commit -m "chore: configure Vite, Tailwind, and base styles"
```

---

### Task 0.3: Add npm scripts

**Files:**
- Modify: `package.json`

**Step 1: Update package.json scripts**

Add to package.json:

```json
{
  "type": "module",
  "bin": {
    "claude-tracer": "./dist/server/index.js"
  },
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:ui\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:ui": "vite",
    "build": "npm run build:server && npm run build:ui",
    "build:server": "tsc -p tsconfig.node.json",
    "build:ui": "vite build",
    "start": "node dist/server/index.js",
    "test": "vitest",
    "lint": "tsc --noEmit"
  }
}
```

**Step 2: Install tsx for dev server**

```bash
npm install -D tsx vitest
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add npm scripts for dev and build"
```

---

## Phase 1: Types (Shared Contract)

> **Note:** This phase establishes the interfaces all teammates code against. Complete this before parallel work begins.

### Task 1.1: Define Block Types

**Files:**
- Create: `src/types/blocks.ts`
- Create: `src/types/index.ts`

**Step 1: Write test for block type guards**

Create: `src/types/__tests__/blocks.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock } from '../blocks';
import type { Block, UserBlock, AgentBlock, ToolBlock } from '../blocks';

describe('Block type guards', () => {
  it('identifies UserBlock correctly', () => {
    const block: UserBlock = {
      id: '1',
      timestamp: Date.now(),
      type: 'user',
      content: 'Hello',
    };
    expect(isUserBlock(block)).toBe(true);
    expect(isAgentBlock(block)).toBe(false);
  });

  it('identifies AgentBlock correctly', () => {
    const block: AgentBlock = {
      id: '2',
      timestamp: Date.now(),
      type: 'agent',
      content: 'Hi there',
      toolCalls: [],
    };
    expect(isAgentBlock(block)).toBe(true);
    expect(isUserBlock(block)).toBe(false);
  });

  it('identifies ToolBlock correctly', () => {
    const block: ToolBlock = {
      id: '3',
      timestamp: Date.now(),
      type: 'tool',
      parentId: '2',
      toolName: 'Read',
      input: { file_path: '/test.txt' },
      output: 'file contents',
      status: 'success',
    };
    expect(isToolBlock(block)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test src/types/__tests__/blocks.test.ts
```

Expected: FAIL - module not found

**Step 3: Create src/types/blocks.ts**

```typescript
/**
 * Base block interface for all trace entries
 */
export interface Block {
  id: string;
  timestamp: number;
  type: 'user' | 'agent' | 'tool' | 'mcp';
  parentId?: string;
  tokensIn?: number;
  tokensOut?: number;
  wallTimeMs?: number;
}

/**
 * User message block
 */
export interface UserBlock extends Block {
  type: 'user';
  content: string;
}

/**
 * Agent response block
 */
export interface AgentBlock extends Block {
  type: 'agent';
  content: string;
  thinking?: string;
  toolCalls: string[]; // IDs of child tool blocks
}

/**
 * Tool invocation block
 */
export interface ToolBlock extends Block {
  type: 'tool';
  parentId: string; // Required - belongs to an agent turn
  toolName: string;
  input: unknown;
  output: unknown;
  status: 'pending' | 'success' | 'error';
}

/**
 * MCP server call block
 */
export interface McpBlock extends Block {
  type: 'mcp';
  parentId: string;
  serverName: string;
  method: string;
  input: unknown;
  output: unknown;
  status: 'pending' | 'success' | 'error';
}

/**
 * Union type of all block types
 */
export type AnyBlock = UserBlock | AgentBlock | ToolBlock | McpBlock;

// Type guards
export function isUserBlock(block: Block): block is UserBlock {
  return block.type === 'user';
}

export function isAgentBlock(block: Block): block is AgentBlock {
  return block.type === 'agent';
}

export function isToolBlock(block: Block): block is ToolBlock {
  return block.type === 'tool';
}

export function isMcpBlock(block: Block): block is McpBlock {
  return block.type === 'mcp';
}
```

**Step 4: Run test to verify it passes**

```bash
npm test src/types/__tests__/blocks.test.ts
```

Expected: PASS

**Step 5: Create src/types/index.ts**

```typescript
export * from './blocks';
```

**Step 6: Commit**

```bash
git add src/types/
git commit -m "feat(types): add Block types with type guards"
```

---

### Task 1.2: Define Chunk Types

**Files:**
- Create: `src/types/chunks.ts`
- Modify: `src/types/index.ts`

**Step 1: Write test for chunk types**

Create: `src/types/__tests__/chunks.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type { Chunk } from '../chunks';

describe('Chunk types', () => {
  it('allows creating theme-level chunk', () => {
    const chunk: Chunk = {
      id: 'theme-1',
      level: 'theme',
      label: 'Implementing authentication',
      blockIds: [],
      childChunkIds: ['task-1', 'task-2'],
      totalTokensIn: 1000,
      totalTokensOut: 500,
      totalWallTimeMs: 30000,
    };
    expect(chunk.level).toBe('theme');
  });

  it('allows creating task-level chunk with parent', () => {
    const chunk: Chunk = {
      id: 'task-1',
      level: 'task',
      label: 'Add login form',
      blockIds: ['block-1', 'block-2'],
      childChunkIds: [],
      parentChunkId: 'theme-1',
      totalTokensIn: 500,
      totalTokensOut: 250,
      totalWallTimeMs: 15000,
    };
    expect(chunk.parentChunkId).toBe('theme-1');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test src/types/__tests__/chunks.test.ts
```

Expected: FAIL - module not found

**Step 3: Create src/types/chunks.ts**

```typescript
/**
 * Chunk level in hierarchy
 * - theme: High-level goal/conversation topic
 * - task: TODO item Claude is working on
 * - turn: Individual user<>agent exchange
 */
export type ChunkLevel = 'theme' | 'task' | 'turn';

/**
 * Hierarchical grouping of blocks
 */
export interface Chunk {
  id: string;
  level: ChunkLevel;
  label: string;
  blockIds: string[];
  childChunkIds: string[];
  parentChunkId?: string;

  // Aggregate stats
  totalTokensIn: number;
  totalTokensOut: number;
  totalWallTimeMs: number;
}
```

**Step 4: Update src/types/index.ts**

```typescript
export * from './blocks';
export * from './chunks';
```

**Step 5: Run test to verify it passes**

```bash
npm test src/types/__tests__/chunks.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/types/
git commit -m "feat(types): add Chunk types for hierarchical grouping"
```

---

### Task 1.3: Define Parser Interface

**Files:**
- Create: `src/types/parser.ts`
- Modify: `src/types/index.ts`

**Step 1: Create src/types/parser.ts**

```typescript
import type { AnyBlock } from './blocks';
import type { Chunk } from './chunks';

/**
 * Metadata about a parsed session
 */
export interface SessionMetadata {
  projectPath?: string;
  startTime: number;
  endTime?: number;
  model?: string;
}

/**
 * Complete parsed session
 */
export interface ParsedSession {
  id: string;
  filePath: string;
  blocks: AnyBlock[];
  chunks: Chunk[];
  metadata: SessionMetadata;
}

/**
 * Interface for trace file parsers
 * Implement this to add support for new formats (Codex, Jules, etc.)
 */
export interface TraceParser {
  /**
   * Parse entire file content
   */
  parse(content: string): ParsedSession;

  /**
   * Parse a single line (for incremental updates)
   */
  parseLine(line: string): AnyBlock | null;

  /**
   * Check if this parser can handle the given content
   */
  canParse(content: string): boolean;
}
```

**Step 2: Update src/types/index.ts**

```typescript
export * from './blocks';
export * from './chunks';
export * from './parser';
```

**Step 3: Commit**

```bash
git add src/types/
git commit -m "feat(types): add TraceParser interface"
```

---

### Task 1.4: Define Search Interface

**Files:**
- Create: `src/types/search.ts`
- Modify: `src/types/index.ts`

**Step 1: Create src/types/search.ts**

```typescript
import type { AnyBlock } from './blocks';

/**
 * Search result with relevance score
 */
export interface SearchResult {
  blockId: string;
  score: number;
  matches?: SearchMatch[];
}

/**
 * Match location within a block
 */
export interface SearchMatch {
  field: string;
  snippet: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  types?: Array<'user' | 'agent' | 'tool' | 'mcp'>;
  chunkId?: string;
}

/**
 * Interface for search engines
 */
export interface SearchEngine {
  /**
   * Index blocks for searching
   */
  index(blocks: AnyBlock[]): void;

  /**
   * Add a single block to index
   */
  addBlock(block: AnyBlock): void;

  /**
   * Search for blocks matching query
   */
  search(query: string, options?: SearchOptions): SearchResult[];

  /**
   * Clear the index
   */
  clear(): void;
}
```

**Step 2: Update src/types/index.ts**

```typescript
export * from './blocks';
export * from './chunks';
export * from './parser';
export * from './search';
```

**Step 3: Commit**

```bash
git add src/types/
git commit -m "feat(types): add SearchEngine interface"
```

---

### Task 1.5: Team Lead Review of Types

**Action:** Team Lead reviews all types in `src/types/` before parallel work begins.

**Review checklist:**
- [ ] Block types cover all Claude Code JSONL entry types
- [ ] Chunk hierarchy supports theme → task → turn levels
- [ ] Parser interface supports incremental parsing for live-reload
- [ ] Search interface is flexible enough for future vector/LLM search
- [ ] All types are properly exported from index.ts

**If changes needed:** Update types and commit before proceeding to Phase 2.

---

## Phase 2: Parser (Agent 1)

> **Teammate:** Parser Teammate
> **Worktree:** `../claude-tracer-parser`
> **Owns:** `src/parser/`

### Task 2.1: Create Base Parser Class

**Files:**
- Create: `src/parser/base.ts`
- Create: `src/parser/index.ts`

**Step 1: Write test for base parser**

Create: `src/parser/__tests__/base.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { BaseParser } from '../base';
import type { AnyBlock, ParsedSession } from '@/types';

class TestParser extends BaseParser {
  parse(content: string): ParsedSession {
    return this.createSession('test.jsonl', []);
  }

  parseLine(line: string): AnyBlock | null {
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
```

**Step 2: Run test to verify it fails**

```bash
npm test src/parser/__tests__/base.test.ts
```

Expected: FAIL

**Step 3: Create src/parser/base.ts**

```typescript
import type { AnyBlock, ParsedSession, SessionMetadata, TraceParser, Chunk } from '@/types';

/**
 * Abstract base class for trace parsers
 */
export abstract class BaseParser implements TraceParser {
  private blockIdCounter = 0;

  abstract parse(content: string): ParsedSession;
  abstract parseLine(line: string): AnyBlock | null;
  abstract canParse(content: string): boolean;

  /**
   * Generate a unique block ID
   */
  generateBlockId(): string {
    return `block-${++this.blockIdCounter}-${Date.now()}`;
  }

  /**
   * Create a session object with default metadata
   */
  protected createSession(
    filePath: string,
    blocks: AnyBlock[],
    chunks: Chunk[] = [],
    metadata: Partial<SessionMetadata> = {}
  ): ParsedSession {
    const startTime = blocks.length > 0
      ? Math.min(...blocks.map(b => b.timestamp))
      : Date.now();

    const endTime = blocks.length > 0
      ? Math.max(...blocks.map(b => b.timestamp))
      : undefined;

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
    const filename = filePath.split('/').pop() || 'unknown';
    return `session-${filename}-${Date.now()}`;
  }
}
```

**Step 4: Create src/parser/index.ts**

```typescript
export { BaseParser } from './base';
```

**Step 5: Run test to verify it passes**

```bash
npm test src/parser/__tests__/base.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/parser/
git commit -m "feat(parser): add BaseParser abstract class"
```

---

### Task 2.2: Implement Claude Code JSONL Parser

**Files:**
- Create: `src/parser/claude-code.ts`
- Modify: `src/parser/index.ts`

**Step 1: Write test for Claude Code parser**

Create: `src/parser/__tests__/claude-code.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ClaudeCodeParser } from '../claude-code';

describe('ClaudeCodeParser', () => {
  const parser = new ClaudeCodeParser();

  it('canParse returns true for Claude Code JSONL', () => {
    const content = '{"type":"user","message":{"role":"user","content":"Hello"}}';
    expect(parser.canParse(content)).toBe(true);
  });

  it('parses user message', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'Hello Claude' },
      timestamp: '2026-02-18T10:00:00Z',
    });

    const block = parser.parseLine(line);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('user');
    expect((block as any).content).toBe('Hello Claude');
  });

  it('parses assistant message', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }]
      },
      timestamp: '2026-02-18T10:00:01Z',
    });

    const block = parser.parseLine(line);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('agent');
    expect((block as any).content).toBe('Hi there!');
  });

  it('parses tool use', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'tool-1',
          name: 'Read',
          input: { file_path: '/test.txt' },
        }],
      },
      timestamp: '2026-02-18T10:00:02Z',
    });

    const block = parser.parseLine(line);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('agent');
  });

  it('parses tool result', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: 'file contents here',
        }],
      },
      timestamp: '2026-02-18T10:00:03Z',
    });

    const block = parser.parseLine(line);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('tool');
    expect((block as any).toolName).toBeDefined();
  });

  it('parses complete session', () => {
    const content = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2026-02-18T10:00:00Z' }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] }, timestamp: '2026-02-18T10:00:01Z' }),
    ].join('\n');

    const session = parser.parse(content);
    expect(session.blocks.length).toBe(2);
    expect(session.blocks[0].type).toBe('user');
    expect(session.blocks[1].type).toBe('agent');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test src/parser/__tests__/claude-code.test.ts
```

Expected: FAIL

**Step 3: Create src/parser/claude-code.ts**

```typescript
import { BaseParser } from './base';
import type {
  AnyBlock,
  ParsedSession,
  UserBlock,
  AgentBlock,
  ToolBlock
} from '@/types';

interface ClaudeCodeEntry {
  type: 'user' | 'assistant' | 'system';
  message: {
    role: string;
    content: string | ContentBlock[];
  };
  timestamp?: string;
  costUSD?: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
  thinking?: string;
}

/**
 * Parser for Claude Code session JSONL files
 */
export class ClaudeCodeParser extends BaseParser {
  private pendingToolCalls: Map<string, { name: string; input: unknown; agentBlockId: string }> = new Map();
  private currentAgentBlockId: string | null = null;

  canParse(content: string): boolean {
    try {
      const firstLine = content.split('\n')[0];
      const entry = JSON.parse(firstLine);
      return 'type' in entry && 'message' in entry;
    } catch {
      return false;
    }
  }

  parse(content: string): ParsedSession {
    const lines = content.trim().split('\n').filter(line => line.trim());
    const blocks: AnyBlock[] = [];

    for (const line of lines) {
      const block = this.parseLine(line);
      if (block) {
        blocks.push(block);
      }
    }

    return this.createSession('session.jsonl', blocks);
  }

  parseLine(line: string): AnyBlock | null {
    try {
      const entry: ClaudeCodeEntry = JSON.parse(line);
      return this.parseEntry(entry);
    } catch {
      return null;
    }
  }

  private parseEntry(entry: ClaudeCodeEntry): AnyBlock | null {
    const timestamp = entry.timestamp
      ? new Date(entry.timestamp).getTime()
      : Date.now();

    if (entry.type === 'user') {
      return this.parseUserEntry(entry, timestamp);
    }

    if (entry.type === 'assistant') {
      return this.parseAssistantEntry(entry, timestamp);
    }

    return null;
  }

  private parseUserEntry(entry: ClaudeCodeEntry, timestamp: number): AnyBlock | null {
    const content = entry.message.content;

    // Check if it's a tool result
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const toolCall = this.pendingToolCalls.get(block.tool_use_id);
          if (toolCall) {
            this.pendingToolCalls.delete(block.tool_use_id);
            const toolBlock: ToolBlock = {
              id: this.generateBlockId(),
              timestamp,
              type: 'tool',
              parentId: toolCall.agentBlockId,
              toolName: toolCall.name,
              input: toolCall.input,
              output: block.content,
              status: 'success',
            };
            return toolBlock;
          }
        }
      }
    }

    // Regular user message
    const userBlock: UserBlock = {
      id: this.generateBlockId(),
      timestamp,
      type: 'user',
      content: typeof content === 'string' ? content : this.extractTextContent(content),
    };
    return userBlock;
  }

  private parseAssistantEntry(entry: ClaudeCodeEntry, timestamp: number): AnyBlock | null {
    const content = entry.message.content;
    const blockId = this.generateBlockId();
    this.currentAgentBlockId = blockId;

    let textContent = '';
    let thinking: string | undefined;
    const toolCallIds: string[] = [];

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textContent += block.text;
        }
        if (block.type === 'thinking' && block.thinking) {
          thinking = block.thinking;
        }
        if (block.type === 'tool_use' && block.id && block.name) {
          this.pendingToolCalls.set(block.id, {
            name: block.name,
            input: block.input,
            agentBlockId: blockId,
          });
          toolCallIds.push(block.id);
        }
      }
    } else if (typeof content === 'string') {
      textContent = content;
    }

    const agentBlock: AgentBlock = {
      id: blockId,
      timestamp,
      type: 'agent',
      content: textContent,
      thinking,
      toolCalls: toolCallIds,
      tokensIn: entry.inputTokens,
      tokensOut: entry.outputTokens,
      wallTimeMs: entry.durationMs,
    };

    return agentBlock;
  }

  private extractTextContent(content: ContentBlock[]): string {
    return content
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text!)
      .join('\n');
  }
}
```

**Step 4: Update src/parser/index.ts**

```typescript
export { BaseParser } from './base';
export { ClaudeCodeParser } from './claude-code';
```

**Step 5: Run test to verify it passes**

```bash
npm test src/parser/__tests__/claude-code.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/parser/
git commit -m "feat(parser): implement Claude Code JSONL parser"
```

---

## Phase 3: Core (Agent 2)

> **Teammate:** Core Teammate
> **Worktree:** `../claude-tracer-core`
> **Owns:** `src/core/`

### Task 3.1: Implement MiniSearch Wrapper

**Files:**
- Create: `src/core/search.ts`
- Create: `src/core/index.ts`

**Step 1: Write test for search**

Create: `src/core/__tests__/search.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BlockSearch } from '../search';
import type { UserBlock, AgentBlock, ToolBlock } from '@/types';

describe('BlockSearch', () => {
  let search: BlockSearch;

  const userBlock: UserBlock = {
    id: 'user-1',
    timestamp: 1000,
    type: 'user',
    content: 'Help me implement authentication',
  };

  const agentBlock: AgentBlock = {
    id: 'agent-1',
    timestamp: 2000,
    type: 'agent',
    content: 'I will help you implement JWT authentication',
    toolCalls: ['tool-1'],
  };

  const toolBlock: ToolBlock = {
    id: 'tool-1',
    timestamp: 3000,
    type: 'tool',
    parentId: 'agent-1',
    toolName: 'Read',
    input: { file_path: 'auth.ts' },
    output: 'file contents',
    status: 'success',
  };

  beforeEach(() => {
    search = new BlockSearch();
    search.index([userBlock, agentBlock, toolBlock]);
  });

  it('finds blocks by content', () => {
    const results = search.search('authentication');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.blockId === 'user-1')).toBe(true);
  });

  it('finds tool blocks by tool name', () => {
    const results = search.search('Read');
    expect(results.some(r => r.blockId === 'tool-1')).toBe(true);
  });

  it('filters by block type', () => {
    const results = search.search('authentication', { types: ['user'] });
    expect(results.every(r => r.blockId.startsWith('user'))).toBe(true);
  });

  it('respects limit option', () => {
    const results = search.search('authentication', { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('can add blocks incrementally', () => {
    const newBlock: UserBlock = {
      id: 'user-2',
      timestamp: 4000,
      type: 'user',
      content: 'Now add tests',
    };
    search.addBlock(newBlock);
    const results = search.search('tests');
    expect(results.some(r => r.blockId === 'user-2')).toBe(true);
  });

  it('can clear the index', () => {
    search.clear();
    const results = search.search('authentication');
    expect(results.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test src/core/__tests__/search.test.ts
```

Expected: FAIL

**Step 3: Create src/core/search.ts**

```typescript
import MiniSearch from 'minisearch';
import type {
  AnyBlock,
  SearchEngine,
  SearchOptions,
  SearchResult,
  UserBlock,
  AgentBlock,
  ToolBlock,
  McpBlock,
} from '@/types';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock } from '@/types';

interface IndexedBlock {
  id: string;
  type: string;
  content: string;
  toolName?: string;
}

/**
 * MiniSearch-based block search engine
 */
export class BlockSearch implements SearchEngine {
  private miniSearch: MiniSearch<IndexedBlock>;
  private blockTypes: Map<string, string> = new Map();

  constructor() {
    this.miniSearch = new MiniSearch<IndexedBlock>({
      fields: ['content', 'toolName'],
      storeFields: ['id', 'type'],
      searchOptions: {
        boost: { toolName: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  index(blocks: AnyBlock[]): void {
    const documents = blocks.map(block => this.blockToDocument(block));
    this.miniSearch.addAll(documents);
    blocks.forEach(b => this.blockTypes.set(b.id, b.type));
  }

  addBlock(block: AnyBlock): void {
    const document = this.blockToDocument(block);
    this.miniSearch.add(document);
    this.blockTypes.set(block.id, block.type);
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const { limit = 20, types, chunkId } = options;

    let results = this.miniSearch.search(query, { limit: limit * 2 });

    // Filter by type if specified
    if (types && types.length > 0) {
      results = results.filter(r => {
        const blockType = this.blockTypes.get(r.id);
        return blockType && types.includes(blockType as any);
      });
    }

    return results.slice(0, limit).map(r => ({
      blockId: r.id,
      score: r.score,
      matches: r.match ? Object.entries(r.match).map(([field, terms]) => ({
        field,
        snippet: Array.from(terms as Set<string>).join(', '),
      })) : undefined,
    }));
  }

  clear(): void {
    this.miniSearch.removeAll();
    this.blockTypes.clear();
  }

  private blockToDocument(block: AnyBlock): IndexedBlock {
    const doc: IndexedBlock = {
      id: block.id,
      type: block.type,
      content: this.extractContent(block),
    };

    if (isToolBlock(block)) {
      doc.toolName = block.toolName;
    }

    if (isMcpBlock(block)) {
      doc.toolName = `${block.serverName}:${block.method}`;
    }

    return doc;
  }

  private extractContent(block: AnyBlock): string {
    if (isUserBlock(block)) {
      return block.content;
    }
    if (isAgentBlock(block)) {
      return [block.content, block.thinking].filter(Boolean).join(' ');
    }
    if (isToolBlock(block) || isMcpBlock(block)) {
      return [
        JSON.stringify(block.input),
        typeof block.output === 'string' ? block.output : JSON.stringify(block.output),
      ].join(' ');
    }
    return '';
  }
}
```

**Step 4: Create src/core/index.ts**

```typescript
export { BlockSearch } from './search';
```

**Step 5: Run test to verify it passes**

```bash
npm test src/core/__tests__/search.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/core/
git commit -m "feat(core): implement MiniSearch-based block search"
```

---

### Task 3.2: Implement Chunker

**Files:**
- Create: `src/core/chunker.ts`
- Modify: `src/core/index.ts`

**Step 1: Write test for chunker**

Create: `src/core/__tests__/chunker.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Chunker } from '../chunker';
import type { AnyBlock, UserBlock, AgentBlock, ToolBlock } from '@/types';

describe('Chunker', () => {
  const chunker = new Chunker();

  const blocks: AnyBlock[] = [
    { id: 'u1', timestamp: 1000, type: 'user', content: 'Start task 1' } as UserBlock,
    { id: 'a1', timestamp: 2000, type: 'agent', content: 'Working on task 1', toolCalls: ['t1'] } as AgentBlock,
    { id: 't1', timestamp: 3000, type: 'tool', parentId: 'a1', toolName: 'Read', input: {}, output: '', status: 'success' } as ToolBlock,
    { id: 'u2', timestamp: 4000, type: 'user', content: 'Now task 2' } as UserBlock,
    { id: 'a2', timestamp: 5000, type: 'agent', content: 'Working on task 2', toolCalls: [] } as AgentBlock,
  ];

  it('creates turn-level chunks for each user-agent exchange', () => {
    const chunks = chunker.createChunks(blocks);
    const turns = chunks.filter(c => c.level === 'turn');
    expect(turns.length).toBe(2);
  });

  it('groups tool blocks with their parent agent', () => {
    const chunks = chunker.createChunks(blocks);
    const turn1 = chunks.find(c => c.level === 'turn' && c.blockIds.includes('a1'));
    expect(turn1?.blockIds).toContain('t1');
  });

  it('calculates aggregate stats', () => {
    const blocksWithTokens: AnyBlock[] = [
      { id: 'u1', timestamp: 1000, type: 'user', content: 'Hello', tokensIn: 10 } as UserBlock,
      { id: 'a1', timestamp: 2000, type: 'agent', content: 'Hi', toolCalls: [], tokensIn: 100, tokensOut: 50, wallTimeMs: 1000 } as AgentBlock,
    ];
    const chunks = chunker.createChunks(blocksWithTokens);
    const turn = chunks.find(c => c.level === 'turn');
    expect(turn?.totalTokensIn).toBe(110);
    expect(turn?.totalTokensOut).toBe(50);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test src/core/__tests__/chunker.test.ts
```

Expected: FAIL

**Step 3: Create src/core/chunker.ts**

```typescript
import type { AnyBlock, Chunk, ChunkLevel } from '@/types';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock } from '@/types';

/**
 * Creates hierarchical chunks from blocks
 */
export class Chunker {
  private chunkIdCounter = 0;

  /**
   * Create chunks from blocks
   * Currently implements turn-level chunking (user → agent → tools)
   * TODO: Add task-level (TodoWrite) and theme-level detection
   */
  createChunks(blocks: AnyBlock[]): Chunk[] {
    const chunks: Chunk[] = [];
    let currentTurn: Chunk | null = null;
    let currentAgentId: string | null = null;

    for (const block of blocks) {
      if (isUserBlock(block)) {
        // Start a new turn
        if (currentTurn) {
          this.finalizeChunk(currentTurn, blocks);
          chunks.push(currentTurn);
        }
        currentTurn = this.createChunk('turn', this.getTurnLabel(block));
        currentTurn.blockIds.push(block.id);
        currentAgentId = null;
      } else if (isAgentBlock(block)) {
        if (!currentTurn) {
          // Agent without preceding user (e.g., system prompt response)
          currentTurn = this.createChunk('turn', 'Agent response');
        }
        currentTurn.blockIds.push(block.id);
        currentAgentId = block.id;
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
      // Truncate to first 50 chars
      const content = userBlock.content;
      return content.length > 50 ? content.slice(0, 47) + '...' : content;
    }
    return 'Turn';
  }

  private finalizeChunk(chunk: Chunk, allBlocks: AnyBlock[]): void {
    const chunkBlocks = allBlocks.filter(b => chunk.blockIds.includes(b.id));

    chunk.totalTokensIn = chunkBlocks.reduce((sum, b) => sum + (b.tokensIn || 0), 0);
    chunk.totalTokensOut = chunkBlocks.reduce((sum, b) => sum + (b.tokensOut || 0), 0);
    chunk.totalWallTimeMs = chunkBlocks.reduce((sum, b) => sum + (b.wallTimeMs || 0), 0);
  }
}
```

**Step 4: Update src/core/index.ts**

```typescript
export { BlockSearch } from './search';
export { Chunker } from './chunker';
```

**Step 5: Run test to verify it passes**

```bash
npm test src/core/__tests__/chunker.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/core/
git commit -m "feat(core): implement Chunker for hierarchical grouping"
```

---

## Phase 4: Server (Agent 3)

> **Teammate:** Server Teammate
> **Worktree:** `../claude-tracer-server`
> **Owns:** `src/server/`

### Task 4.1: Create Express App

**Files:**
- Create: `src/server/app.ts`
- Create: `src/server/index.ts`

**Step 1: Create src/server/app.ts**

```typescript
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Serve static UI files in production
  const uiPath = path.join(__dirname, '../../dist/ui');
  app.use(express.static(uiPath));

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(uiPath, 'index.html'));
  });

  return app;
}
```

**Step 2: Create src/server/index.ts (entry point)**

```typescript
#!/usr/bin/env node

import { createServer } from 'http';
import { createApp } from './app';
import { createWebSocketServer } from './websocket';
import { SessionWatcher } from './watcher';
import { parseArgs } from './cli';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const app = createApp();
  const server = createServer(app);
  const wss = createWebSocketServer(server);

  if (args.file) {
    const watcher = new SessionWatcher();
    watcher.watch(args.file, (blocks) => {
      wss.broadcast({ type: 'blocks:update', blocks });
    });
  }

  const port = args.port || 3000;
  server.listen(port, () => {
    console.log(`Claude Tracer running at http://localhost:${port}`);
    if (args.file) {
      console.log(`Watching: ${args.file}`);
    }
  });
}

main().catch(console.error);
```

**Step 3: Commit**

```bash
git add src/server/
git commit -m "feat(server): add Express app skeleton"
```

---

### Task 4.2: Implement CLI Argument Parsing

**Files:**
- Create: `src/server/cli.ts`

**Step 1: Write test for CLI parsing**

Create: `src/server/__tests__/cli.test.ts`

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
npm test src/server/__tests__/cli.test.ts
```

Expected: FAIL

**Step 3: Create src/server/cli.ts**

```typescript
export interface CliArgs {
  file?: string;
  port?: number;
  help?: boolean;
  version?: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      args.help = true;
    } else if (arg === '-v' || arg === '--version') {
      args.version = true;
    } else if (arg === '-p' || arg === '--port') {
      const port = parseInt(argv[++i], 10);
      if (!isNaN(port)) {
        args.port = port;
      }
    } else if (!arg.startsWith('-') && !args.file) {
      args.file = arg;
    }
  }

  return args;
}

export function printHelp(): void {
  console.log(`
Usage: claude-tracer [options] [session-file]

Arguments:
  session-file          Path to .jsonl session file (optional)

Options:
  -p, --port <number>   Port to run server on (default: 3000)
  -h, --help            Show help
  -v, --version         Show version

Examples:
  claude-tracer                              # Opens session picker
  claude-tracer ./session.jsonl              # Opens specific file in watch mode
  npx claude-tracer ./session.jsonl          # Via npx
`);
}

export function printVersion(): void {
  // Read from package.json in production
  console.log('claude-tracer v0.1.0');
}
```

**Step 4: Run test to verify it passes**

```bash
npm test src/server/__tests__/cli.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/
git commit -m "feat(server): add CLI argument parsing"
```

---

### Task 4.3: Implement WebSocket Server

**Files:**
- Create: `src/server/websocket.ts`

**Step 1: Create src/server/websocket.ts**

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { AnyBlock, Chunk } from '@/types';

export interface WsMessage {
  type: 'blocks:update' | 'blocks:new' | 'session:init' | 'error';
  blocks?: AnyBlock[];
  chunks?: Chunk[];
  error?: string;
}

export interface TracerWebSocketServer {
  broadcast(message: WsMessage): void;
  close(): void;
}

export function createWebSocketServer(server: Server): TracerWebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  return {
    broadcast(message: WsMessage) {
      const data = JSON.stringify(message);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    },
    close() {
      wss.close();
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/server/
git commit -m "feat(server): add WebSocket server for live updates"
```

---

### Task 4.4: Implement File Watcher

**Files:**
- Create: `src/server/watcher.ts`

**Step 1: Write test for watcher**

Create: `src/server/__tests__/watcher.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionWatcher } from '../watcher';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('SessionWatcher', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-test-'));
    testFile = path.join(tmpDir, 'test.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads initial file content', async () => {
    const line = JSON.stringify({ type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: new Date().toISOString() });
    fs.writeFileSync(testFile, line + '\n');

    const watcher = new SessionWatcher();
    const callback = vi.fn();

    await watcher.watch(testFile, callback);

    expect(callback).toHaveBeenCalled();
    const blocks = callback.mock.calls[0][0];
    expect(blocks.length).toBe(1);

    watcher.stop();
  });

  it('detects new lines appended to file', async () => {
    fs.writeFileSync(testFile, '');

    const watcher = new SessionWatcher();
    const callback = vi.fn();

    await watcher.watch(testFile, callback);

    // Append a new line
    const line = JSON.stringify({ type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: new Date().toISOString() });
    fs.appendFileSync(testFile, line + '\n');

    // Wait for file watcher to detect change
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(callback).toHaveBeenCalledTimes(2); // Initial + update

    watcher.stop();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test src/server/__tests__/watcher.test.ts
```

Expected: FAIL

**Step 3: Create src/server/watcher.ts**

```typescript
import chokidar from 'chokidar';
import fs from 'fs';
import { ClaudeCodeParser } from '@/parser';
import type { AnyBlock } from '@/types';

export class SessionWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private parser = new ClaudeCodeParser();
  private lastPosition = 0;
  private filePath: string = '';

  async watch(
    filePath: string,
    onBlocks: (blocks: AnyBlock[], isInitial: boolean) => void
  ): Promise<void> {
    this.filePath = filePath;

    // Initial read
    const content = fs.readFileSync(filePath, 'utf-8');
    const blocks = this.parseContent(content);
    this.lastPosition = fs.statSync(filePath).size;
    onBlocks(blocks, true);

    // Watch for changes
    this.watcher = chokidar.watch(filePath, {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', () => {
      const newBlocks = this.readNewContent();
      if (newBlocks.length > 0) {
        onBlocks(newBlocks, false);
      }
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
    const lines = content.trim().split('\n').filter(line => line.trim());
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
```

**Step 4: Run test to verify it passes**

```bash
npm test src/server/__tests__/watcher.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/
git commit -m "feat(server): add file watcher with incremental parsing"
```

---

## Phase 5: UI (Agent 4)

> **Teammate:** UI Teammate
> **Worktree:** `../claude-tracer-ui`
> **Owns:** `src/ui/`

### Task 5.1: Create React Entry Point and Theme

**Files:**
- Create: `src/ui/main.tsx`
- Create: `src/ui/App.tsx`
- Create: `src/ui/themes/index.ts`
- Create: `src/ui/themes/claude.ts`

**Step 1: Create src/ui/themes/claude.ts**

```typescript
export const claudeTheme = {
  name: 'claude',
  colors: {
    background: '#ffedd5',      // peach
    agentBg: '#374151',         // grey-700
    agentText: '#f3f4f6',       // grey-100
    userBg: '#f9fafb',          // grey-50
    userText: '#111827',        // grey-900
    toolBg: '#0f0f0f',          // near-black
    toolText: '#e5e5e5',        // terminal white
    accent: '#f97316',          // orange
    headerBg: 'rgba(0,0,0,0.8)',
    headerText: '#ffffff',
    indexText: '#f3f4f6',       // light text on peach
  },
};

export type Theme = typeof claudeTheme;
```

**Step 2: Create src/ui/themes/index.ts**

```typescript
import { createContext, useContext } from 'react';
import { claudeTheme, type Theme } from './claude';

export const ThemeContext = createContext<Theme>(claudeTheme);

export function useTheme() {
  return useContext(ThemeContext);
}

export { claudeTheme, type Theme };
```

**Step 3: Create src/ui/App.tsx**

```typescript
import { ThemeContext, claudeTheme } from './themes';
import { Header } from './components/Header';
import { TraceView } from './components/TraceView';
import { IndexSidebar } from './components/IndexSidebar';
import { Footer } from './components/Footer';
import { useSession } from './hooks/useSession';
import './styles/globals.css';

export function App() {
  const { blocks, chunks, isConnected } = useSession();

  return (
    <ThemeContext.Provider value={claudeTheme}>
      <div
        className="h-screen flex flex-col"
        style={{ backgroundColor: claudeTheme.colors.background }}
      >
        <Header />

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto p-4">
            <TraceView blocks={blocks} />
          </main>

          <aside className="w-64 overflow-auto p-4">
            <IndexSidebar chunks={chunks} />
          </aside>
        </div>

        <Footer
          blockCount={blocks.length}
          isConnected={isConnected}
        />
      </div>
    </ThemeContext.Provider>
  );
}
```

**Step 4: Create src/ui/main.tsx**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 5: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): add React entry point and Claude theme"
```

---

### Task 5.2: Create useSession Hook

**Files:**
- Create: `src/ui/hooks/useSession.ts`

**Step 1: Create src/ui/hooks/useSession.ts**

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { AnyBlock, Chunk } from '@/types';

interface WsMessage {
  type: 'blocks:update' | 'blocks:new' | 'session:init' | 'error';
  blocks?: AnyBlock[];
  chunks?: Chunk[];
}

export function useSession() {
  const [blocks, setBlocks] = useState<AnyBlock[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'session:init':
          case 'blocks:update':
            if (message.blocks) {
              setBlocks(message.blocks);
            }
            if (message.chunks) {
              setChunks(message.chunks);
            }
            break;

          case 'blocks:new':
            if (message.blocks) {
              setBlocks(prev => [...prev, ...message.blocks!]);
            }
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const scrollToBlock = useCallback((blockId: string) => {
    const element = document.getElementById(`block-${blockId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return {
    blocks,
    chunks,
    isConnected,
    scrollToBlock,
  };
}
```

**Step 2: Commit**

```bash
git add src/ui/hooks/
git commit -m "feat(ui): add useSession hook for WebSocket connection"
```

---

### Task 5.3: Create Block Components

**Files:**
- Create: `src/ui/components/UserBlock.tsx`
- Create: `src/ui/components/AgentBlock.tsx`
- Create: `src/ui/components/ToolBlock.tsx`

**Step 1: Create src/ui/components/UserBlock.tsx**

```typescript
import { useState } from 'react';
import { useTheme } from '../themes';
import type { UserBlock as UserBlockType } from '@/types';

interface Props {
  block: UserBlockType;
}

export function UserBlock({ block }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();

  const preview = block.content.length > 100 && !isExpanded
    ? block.content.slice(0, 100) + '...'
    : block.content;

  return (
    <div
      id={`block-${block.id}`}
      className="flex justify-end mb-4"
    >
      <div
        className="max-w-xl p-4 rounded-lg cursor-pointer transition-all hover:shadow-md"
        style={{
          backgroundColor: theme.colors.userBg,
          color: theme.colors.userText,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 mb-2 text-xs opacity-60">
          <span>user</span>
          {block.tokensIn && <span>{block.tokensIn} tokens</span>}
        </div>
        <div className="whitespace-pre-wrap font-mono text-sm">
          {preview}
        </div>
        {block.content.length > 100 && (
          <button
            className="text-xs mt-2 opacity-60 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          >
            {isExpanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create src/ui/components/AgentBlock.tsx**

```typescript
import { useState } from 'react';
import { useTheme } from '../themes';
import type { AgentBlock as AgentBlockType } from '@/types';

interface Props {
  block: AgentBlockType;
}

export function AgentBlock({ block }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const theme = useTheme();

  const preview = block.content.length > 200 && !isExpanded
    ? block.content.slice(0, 200) + '...'
    : block.content;

  return (
    <div
      id={`block-${block.id}`}
      className="flex justify-start mb-4"
    >
      <div
        className="max-w-2xl p-4 rounded-lg cursor-pointer transition-all hover:shadow-md"
        style={{
          backgroundColor: theme.colors.agentBg,
          color: theme.colors.agentText,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 mb-2 text-xs opacity-60">
          <span>agent</span>
          {block.tokensIn && <span>{block.tokensIn} in</span>}
          {block.tokensOut && <span>{block.tokensOut} out</span>}
          {block.wallTimeMs && <span>{(block.wallTimeMs / 1000).toFixed(1)}s</span>}
        </div>

        {block.thinking && (
          <div className="mb-2">
            <button
              className="text-xs opacity-60 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); setShowThinking(!showThinking); }}
            >
              {showThinking ? '▲ Hide thinking' : '▼ Show thinking'}
            </button>
            {showThinking && (
              <div
                className="mt-2 p-2 rounded text-xs opacity-80 whitespace-pre-wrap"
                style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
              >
                {block.thinking}
              </div>
            )}
          </div>
        )}

        <div className="whitespace-pre-wrap font-mono text-sm">
          {preview}
        </div>

        {block.content.length > 200 && (
          <button
            className="text-xs mt-2 opacity-60 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          >
            {isExpanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        )}

        {block.toolCalls.length > 0 && (
          <div className="mt-2 text-xs opacity-60">
            {block.toolCalls.length} tool call{block.toolCalls.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create src/ui/components/ToolBlock.tsx**

```typescript
import { useState } from 'react';
import { useTheme } from '../themes';
import type { ToolBlock as ToolBlockType } from '@/types';

interface Props {
  block: ToolBlockType;
}

export function ToolBlock({ block }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();

  const inputPreview = typeof block.input === 'string'
    ? block.input
    : JSON.stringify(block.input, null, 2);

  const outputPreview = typeof block.output === 'string'
    ? block.output
    : JSON.stringify(block.output, null, 2);

  return (
    <div
      id={`block-${block.id}`}
      className="flex justify-start ml-8 mb-2"
    >
      <div
        className="max-w-xl p-3 rounded cursor-pointer transition-all hover:shadow-md font-mono text-xs"
        style={{
          backgroundColor: theme.colors.toolBg,
          color: theme.colors.toolText,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: block.status === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {block.toolName}
          </span>
          <span className="opacity-60">{block.status}</span>
        </div>

        {isExpanded && (
          <>
            <div className="mt-2">
              <div className="opacity-60 mb-1">Input:</div>
              <pre className="whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                {inputPreview.slice(0, 500)}
                {inputPreview.length > 500 && '...'}
              </pre>
            </div>
            <div className="mt-2">
              <div className="opacity-60 mb-1">Output:</div>
              <pre className="whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                {outputPreview.slice(0, 500)}
                {outputPreview.length > 500 && '...'}
              </pre>
            </div>
          </>
        )}

        {!isExpanded && (
          <div className="opacity-60">Click to expand</div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/ui/components/
git commit -m "feat(ui): add UserBlock, AgentBlock, and ToolBlock components"
```

---

### Task 5.4: Create Layout Components

**Files:**
- Create: `src/ui/components/Header.tsx`
- Create: `src/ui/components/Footer.tsx`
- Create: `src/ui/components/IndexSidebar.tsx`
- Create: `src/ui/components/TraceView.tsx`

**Step 1: Create src/ui/components/Header.tsx**

```typescript
import { useState } from 'react';
import { useTheme } from '../themes';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();

  return (
    <header
      className="flex items-center justify-between px-4 py-3"
      style={{
        backgroundColor: theme.colors.headerBg,
        color: theme.colors.headerText,
      }}
    >
      <h1 className="text-lg font-semibold font-mono"># tracer</h1>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 rounded bg-white/10 text-white placeholder-white/50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/30"
        />
        <span className="text-xs opacity-60">0 of 0</span>
        <button className="px-2 py-1 text-sm opacity-60 hover:opacity-100">◀</button>
        <button className="px-2 py-1 text-sm opacity-60 hover:opacity-100">▶</button>
      </div>
    </header>
  );
}
```

**Step 2: Create src/ui/components/Footer.tsx**

```typescript
import { useTheme } from '../themes';

interface Props {
  blockCount: number;
  isConnected: boolean;
}

export function Footer({ blockCount, isConnected }: Props) {
  const theme = useTheme();

  return (
    <footer
      className="flex items-center justify-between px-4 py-2 text-xs font-mono"
      style={{
        backgroundColor: theme.colors.headerBg,
        color: theme.colors.headerText,
      }}
    >
      <div className="flex items-center gap-4">
        <span>Blocks: {blockCount}</span>
        <span
          className={`flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-red-400'}`}
        >
          <span className="w-2 h-2 rounded-full bg-current"></span>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <button className="opacity-60 hover:opacity-100">⚙ Settings</button>
    </footer>
  );
}
```

**Step 3: Create src/ui/components/IndexSidebar.tsx**

```typescript
import { useTheme } from '../themes';
import type { Chunk } from '@/types';

interface Props {
  chunks: Chunk[];
  onChunkClick?: (chunkId: string) => void;
}

export function IndexSidebar({ chunks, onChunkClick }: Props) {
  const theme = useTheme();

  return (
    <div
      className="h-full"
      style={{ color: theme.colors.indexText }}
    >
      <h2 className="text-sm font-semibold mb-4 opacity-80">INDEX</h2>

      {chunks.length === 0 ? (
        <p className="text-xs opacity-60">No chunks yet</p>
      ) : (
        <ul className="space-y-2">
          {chunks.map((chunk, index) => (
            <li
              key={chunk.id}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onChunkClick?.(chunk.id)}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-60">○</span>
                <span className="truncate">{chunk.label}</span>
              </div>
              <div className="text-xs opacity-50 ml-5">
                {chunk.totalTokensIn + chunk.totalTokensOut} tokens
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Step 4: Create src/ui/components/TraceView.tsx**

```typescript
import { useTheme } from '../themes';
import { UserBlock } from './UserBlock';
import { AgentBlock } from './AgentBlock';
import { ToolBlock } from './ToolBlock';
import { isUserBlock, isAgentBlock, isToolBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface Props {
  blocks: AnyBlock[];
}

export function TraceView({ blocks }: Props) {
  const theme = useTheme();

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-0 right-0 flex gap-1">
        <button
          className="w-8 h-8 rounded flex items-center justify-center text-lg"
          style={{
            backgroundColor: theme.colors.headerBg,
            color: theme.colors.headerText,
          }}
        >
          −
        </button>
        <button
          className="w-8 h-8 rounded flex items-center justify-center text-lg"
          style={{
            backgroundColor: theme.colors.headerBg,
            color: theme.colors.headerText,
          }}
        >
          +
        </button>
      </div>

      {/* Blocks */}
      <div className="pt-12">
        {blocks.length === 0 ? (
          <div
            className="text-center py-20 opacity-60"
            style={{ color: theme.colors.agentText }}
          >
            No blocks to display. Open a session file to begin.
          </div>
        ) : (
          blocks.map((block) => {
            if (isUserBlock(block)) {
              return <UserBlock key={block.id} block={block} />;
            }
            if (isAgentBlock(block)) {
              return <AgentBlock key={block.id} block={block} />;
            }
            if (isToolBlock(block)) {
              return <ToolBlock key={block.id} block={block} />;
            }
            return null;
          })
        )}
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/ui/components/
git commit -m "feat(ui): add Header, Footer, IndexSidebar, and TraceView components"
```

---

## Phase 6: Integration

### Task 6.1: Wire Up Server with Parser and Core

**Files:**
- Modify: `src/server/index.ts`

**Step 1: Update src/server/index.ts**

```typescript
#!/usr/bin/env node

import { createServer } from 'http';
import { createApp } from './app';
import { createWebSocketServer } from './websocket';
import { SessionWatcher } from './watcher';
import { parseArgs, printHelp, printVersion } from './cli';
import { Chunker } from '@/core';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  const app = createApp();
  const server = createServer(app);
  const wss = createWebSocketServer(server);
  const chunker = new Chunker();

  let allBlocks: any[] = [];

  if (args.file) {
    const watcher = new SessionWatcher();

    watcher.watch(args.file, (blocks, isInitial) => {
      if (isInitial) {
        allBlocks = blocks;
      } else {
        allBlocks = [...allBlocks, ...blocks];
      }

      const chunks = chunker.createChunks(allBlocks);

      wss.broadcast({
        type: isInitial ? 'session:init' : 'blocks:new',
        blocks: isInitial ? allBlocks : blocks,
        chunks,
      });
    });
  }

  const port = args.port || 3000;
  server.listen(port, () => {
    console.log(`\n  Claude Tracer running at http://localhost:${port}\n`);
    if (args.file) {
      console.log(`  Watching: ${args.file}\n`);
    } else {
      console.log(`  No session file specified. Use: claude-tracer <file.jsonl>\n`);
    }
  });
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add src/server/
git commit -m "feat(server): integrate parser, core, and websocket"
```

---

### Task 6.2: End-to-End Test

**Step 1: Build the project**

```bash
npm run build
```

**Step 2: Create test session file**

```bash
cat > /tmp/test-session.jsonl << 'EOF'
{"type":"user","message":{"role":"user","content":"Hello Claude, help me write a function"},"timestamp":"2026-02-18T10:00:00Z"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'd be happy to help! What kind of function would you like?"}]},"timestamp":"2026-02-18T10:00:01Z","inputTokens":50,"outputTokens":20}
{"type":"user","message":{"role":"user","content":"A function that adds two numbers"},"timestamp":"2026-02-18T10:00:02Z"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Here's a simple add function:"},{"type":"tool_use","id":"tool-1","name":"Write","input":{"file_path":"add.ts","content":"export function add(a: number, b: number): number {\n  return a + b;\n}"}}]},"timestamp":"2026-02-18T10:00:03Z","inputTokens":100,"outputTokens":50}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tool-1","content":"File written successfully"}]},"timestamp":"2026-02-18T10:00:04Z"}
EOF
```

**Step 3: Run the tool**

```bash
npm start -- /tmp/test-session.jsonl
```

**Step 4: Open browser**

Navigate to http://localhost:3000

**Expected:** See the chat-like interface with:
- User messages on the right (light background)
- Agent messages on the left (grey background)
- Tool block (black background) indented under agent

**Step 5: Test live reload**

Append a new line to the session file:

```bash
echo '{"type":"user","message":{"role":"user","content":"Thanks!"},"timestamp":"2026-02-18T10:00:05Z"}' >> /tmp/test-session.jsonl
```

**Expected:** New user message appears in UI without refresh

**Step 6: Commit**

```bash
git add .
git commit -m "test: verify end-to-end integration"
```

---

## Phase 7: Polish

### Task 7.1: Add SVG Connection Lines

**Files:**
- Create: `src/ui/components/ConnectionLines.tsx`
- Modify: `src/ui/components/TraceView.tsx`

*(Implementation details for SVG arrows connecting blocks)*

---

### Task 7.2: Implement Search with Navigation

**Files:**
- Create: `src/ui/hooks/useSearch.ts`
- Modify: `src/ui/components/Header.tsx`

*(Implementation details for search with next/prev navigation)*

---

### Task 7.3: Add Virtual Scrolling

**Files:**
- Modify: `src/ui/components/TraceView.tsx`

*(Implementation using react-window for large sessions)*

---

### Task 7.4: Implement Zoom Controls

**Files:**
- Create: `src/ui/hooks/useZoom.ts`
- Modify: `src/ui/components/TraceView.tsx`
- Modify: `src/ui/components/IndexSidebar.tsx`

*(Implementation for zoom in/out affecting detail level)*

---

## Checkpoint: Team Lead Review

After Phase 6 integration, Team Lead should review:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] End-to-end flow works with real Claude Code session files
- [ ] UI matches design (chat layout, colors, typography)
- [ ] Live reload works correctly
- [ ] No TypeScript errors (`npm run lint`)

---

## Future Tasks (Phase 2+)

- [ ] Session picker UI when no file provided
- [ ] Vector search integration (Transformers.js)
- [ ] LLM-powered deep search (Ollama)
- [ ] TODO-based chunking detection
- [ ] Theme-level chunking heuristics
- [ ] Standalone binary build
- [ ] Additional format adapters

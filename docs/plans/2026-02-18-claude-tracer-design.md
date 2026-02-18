# Claude-Tracer Design Document

**Date:** 2026-02-18
**Status:** Approved

## Overview

claude-tracer is a standalone trace visualization and debugging tool for Claude Code sessions. It runs locally, parses session JSONL files, and generates an interactive web-based visualizer for stepping through conversation history.

## Goals

- Visualize Claude Code sessions with user prompts, agent reasoning, tool calls, MCP calls
- Show token usage, wall time, timestamps for each block
- Support collapsible UI with hierarchical chunking (theme → task → block)
- Enable semantic navigation via search and index sidebar
- Live-reload when watching active sessions
- Support future formats (Codex, Jules) via pluggable parser

## Non-Goals (for Phase 1)

- Vector/LLM-powered semantic search (Phase 2+)
- Standalone binary distribution
- VS Code extension
- Block rearrangement/editing

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| UI Framework | React + Vite |
| Styling | Tailwind CSS |
| Server | Node.js + Express |
| Live Updates | WebSocket (ws) |
| File Watching | chokidar |
| Search | MiniSearch |
| Virtual Scrolling | react-window |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              claude-tracer                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   parser/   │    │    core/    │    │   server/   │    │     ui/     │  │
│  │             │    │             │    │             │    │             │  │
│  │ - JSONL     │───▶│ - Blocks    │───▶│ - Express   │───▶│ - React     │  │
│  │ - Adapters  │    │ - Chunks    │    │ - WebSocket │    │ - Tailwind  │  │
│  │             │    │ - Search    │    │ - File watch│    │ - Zoom/Pan  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                  │                  │          │
│         └──────────────────┴──────────────────┴──────────────────┘          │
│                                     │                                       │
│                              ┌──────▼──────┐                                │
│                              │   types/    │                                │
│                              │  (shared)   │                                │
│                              └─────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Single Node process** handles:
- Serving static React UI
- File watching (chokidar)
- WebSocket for pushing live updates

## Data Models

### Blocks

```typescript
interface Block {
  id: string;
  timestamp: number;
  type: 'user' | 'agent' | 'tool' | 'mcp';
  parentId?: string;
  tokensIn?: number;
  tokensOut?: number;
  wallTimeMs?: number;
}

interface UserBlock extends Block {
  type: 'user';
  content: string;
}

interface AgentBlock extends Block {
  type: 'agent';
  content: string;
  thinking?: string;
  toolCalls: string[];
}

interface ToolBlock extends Block {
  type: 'tool';
  toolName: string;
  input: unknown;
  output: unknown;
  status: 'pending' | 'success' | 'error';
}

interface McpBlock extends Block {
  type: 'mcp';
  serverName: string;
  method: string;
  input: unknown;
  output: unknown;
  status: 'pending' | 'success' | 'error';
}
```

### Chunks (Hierarchical Grouping)

```typescript
interface Chunk {
  id: string;
  level: 'theme' | 'task' | 'turn';
  label: string;
  blockIds: string[];
  childChunkIds: string[];
  parentChunkId?: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalWallTimeMs: number;
}
```

**Hierarchy:**
- **Theme** (highest) — High-level goal/conversation topic
- **Task** — TODO item Claude is working on
- **Turn** (lowest) — Individual user↔agent exchange

### Parser Interface

```typescript
interface TraceParser {
  parse(content: string): ParsedSession;
  parseLine(line: string): Block;
}

interface ParsedSession {
  id: string;
  filePath: string;
  blocks: Block[];
  chunks: Chunk[];
  metadata: SessionMetadata;
}
```

## UI Design

### Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  # tracer                    [🔍 Search / Filter]                           │
├───────────────────────────────────────────────────────────────┬─────────────┤
│                                               [−] [+]         │  INDEX      │
│                                                               │             │
│                              ┌───────────────────────────┐    │  ○ Task 1   │
│                              │ ▸ user                    │    │  ● Task 2   │
│                              │   "Help me implement…"    │    │  ○ Task 3   │
│                              └─────────────┬─────────────┘    │             │
│                                            │                  │             │
│                    ┌───────────────────────┘                  │ (scrollable)│
│                    ▼                                          │             │
│  ┌─────────────────────────────────┐                          │             │
│  │ ▸ agent                         │                          │             │
│  │   "I'll start by exploring…"    │                          │             │
│  └─┬───────────────────────────────┘                          │             │
│    │                                                          │             │
│    ├────────┬────────┬────────┐                               │             │
│    ▼        ▼        ▼        ▼                               │             │
│  ┌──────┐┌──────┐┌──────┐┌──────┐                             │             │
│  │ Read ││ Grep ││ Bash ││ Edit │                             │             │
│  └──────┘└──────┘└──────┘└──────┘                             │             │
│    │        │        │        │                               │             │
│    └────────┴────────┴────────┘                               │             │
│                    │                                          │             │
│                    └───────────────────────┐                  │             │
│                                            ▼                  │             │
│                              ┌───────────────────────────┐    │             │
│                              │ ▸ user                    │    │             │
│                              └───────────────────────────┘    │             │
│                                                               │             │
├───────────────────────────────────────────────────────────────┴─────────────┤
│  Block 12 of 47  │  Tokens: 2,341 in / 892 out  │  ⚙ Settings               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key UI Elements

| Element | Alignment | Behavior |
|---------|-----------|----------|
| User blocks | Right-aligned | Collapsible, shows summary when collapsed |
| Agent blocks | Left-aligned | Collapsible, includes thinking section |
| Tool blocks | Furthest left | Collapsible, shows tool name + input/output |
| Arrows | SVG layer | Connect user→agent→tools→user flow |
| Index sidebar | Right side | Click to scroll, reflects zoom level |
| Zoom controls | Top-right of main | (+)/(-) adjust detail level |

### Search Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│  [🔍 Search: "authentication"          ] [◀] [▶]  3 of 12      │
│     ☑ User messages  ☑ Agent messages  ☑ Tool calls            │
└─────────────────────────────────────────────────────────────────┘
```

| Feature | Behavior |
|---------|----------|
| Search input | Debounced 300ms, searches as you type |
| Result count | Shows "N of M" (current / total matches) |
| Next/Prev | `[◀]` `[▶]` buttons or `↑`/`↓` keys to navigate |
| Filters | Toggle block types to include |
| Highlighting | Current match prominent, other matches subtle |
| Clear | Escape or X clears filter |

## Theme & Typography

### Color Palette (Claude Theme)

| Element | Background | Text |
|---------|------------|------|
| Page background | Orange/peach (Claude brand) | — |
| Agent blocks | Grey (`#374151` / `gray-700`) | Light grey/white (`#f3f4f6`) |
| User blocks | Light grey/white (`#f9fafb`) | Black (`#111827`) |
| Tool/code blocks | Black (`#0f0f0f`) | White terminal (`#e5e5e5`) |
| Header/footer | Semi-transparent dark | White |
| Index sidebar | Orange/peach (same as page) | Light grey/white (`#f3f4f6`) |
| Arrows/connections | Grey (`#6b7280`) | — |

### Claude Brand Colors Reference

```css
--claude-orange: #f97316;      /* Primary orange */
--claude-peach: #ffedd5;       /* Light peach background */
--claude-cream: #fff7ed;       /* Lighter variant */
```

### Typography

**Font:** Monospace throughout for code-focused feel

```css
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
```

| Element | Size | Weight |
|---------|------|--------|
| Headers | 1.25rem | 600 |
| Body/content | 0.875rem | 400 |
| Code/tool output | 0.8125rem | 400 |
| Labels/meta | 0.75rem | 500 |

### Theme System

Implement as swappable theme via CSS variables and Tailwind config:

```typescript
// src/ui/themes/index.ts
export interface Theme {
  name: string;
  colors: {
    background: string;
    agentBg: string;
    agentText: string;
    userBg: string;
    userText: string;
    toolBg: string;
    toolText: string;
    accent: string;
  };
}

export const claudeTheme: Theme = {
  name: 'claude',
  colors: {
    background: '#ffedd5',  // peach
    agentBg: '#374151',     // grey-700
    agentText: '#f3f4f6',   // grey-100
    userBg: '#f9fafb',      // grey-50
    userText: '#111827',    // grey-900
    toolBg: '#0f0f0f',      // near-black
    toolText: '#e5e5e5',    // terminal white
    accent: '#f97316',      // orange
  },
};
```

Theme can be swapped later by defining new theme objects and applying via React context.

## CLI Interface

```
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
```

**Behavior:**
- No file argument → scan `~/.claude/projects/` → show picker UI
- With file argument → watch file, serve UI, open browser

## Live Update Loop

```
Session File (.jsonl)     Node Server              Browser (React)
       │                       │                        │
       │                       │                        │
  Claude appends block         │                        │
       │                       │                        │
       ├── file change ───────▶│                        │
       │                       │ 1. Read new bytes      │
       │                       │ 2. Parse new lines     │
       │                       │ 3. Update chunks       │
       │                       │                        │
       │                       ├── WebSocket push ─────▶│
       │                       │   {type:'blocks:new'}  │
       │                       │                        │
       │                       │        4. Append to state
       │                       │        5. Re-render    │
       │                       │        6. Auto-scroll  │
```

## Project Structure

```
claude-tracer/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
│
├── src/
│   ├── types/                # Shared interfaces
│   │   ├── index.ts
│   │   ├── blocks.ts
│   │   ├── chunks.ts
│   │   ├── session.ts
│   │   ├── parser.ts
│   │   └── search.ts
│   │
│   ├── parser/               # JSONL parsing
│   │   ├── index.ts
│   │   ├── base.ts
│   │   ├── claude-code.ts
│   │   └── adapters/
│   │
│   ├── core/                 # Business logic
│   │   ├── index.ts
│   │   ├── chunker.ts
│   │   ├── search.ts
│   │   └── stats.ts
│   │
│   ├── server/               # Node server
│   │   ├── index.ts
│   │   ├── app.ts
│   │   ├── watcher.ts
│   │   ├── websocket.ts
│   │   └── picker.ts
│   │
│   └── ui/                   # React app
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       ├── hooks/
│       └── styles/
│
├── research/
│   └── search-approaches.md
│
└── docs/
    ├── plans/
    └── team-setup.md
```

## Agent Team Structure

See `docs/team-setup.md` for full team configuration.

| Teammate | Owns | Responsibility |
|----------|------|----------------|
| Parser | `src/parser/` | JSONL parsing, pluggable adapters |
| Core | `src/core/` | Chunking, search, stats |
| Server | `src/server/` | Express, WebSocket, file watching |
| UI | `src/ui/` | React components, visualization |

**Coordination:** `src/types/` is the shared contract. Interface changes coordinated through Team Lead.

## Future Phases

### Phase 2: Semantic Search
- Vector embeddings via Transformers.js (MiniLM)
- Hybrid keyword + vector search
- See `research/search-approaches.md`

### Phase 3: LLM Enhancement
- Ollama integration for "Deep Search"
- "Ask about this session" feature
- Pre-computed block summaries

### Future Features
- Sub-agent/swarm visualization
- Standalone binary distribution
- Additional format adapters (Codex, Jules)

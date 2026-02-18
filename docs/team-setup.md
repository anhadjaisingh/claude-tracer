# Claude-Tracer Agent Team Setup

This document describes the agent team structure for parallel development of claude-tracer.

## Project Context

**claude-tracer** is a standalone trace visualization and debugging tool that:
- Runs locally via CLI (`claude-tracer ./session.jsonl` or `npx claude-tracer`)
- Generates a web-based visualizer for stepping through Claude Code sessions
- Shows user prompts, agent reasoning, tool calls, MCP calls, outputs, tokens, timestamps
- Uses collapsible chat-like UI (user right-aligned, agent left-aligned, tools furthest left)
- Has a right sidebar for index/TOC navigation with hierarchical chunking
- Supports live-reload when watching active sessions
- Includes zoom controls (+/-) for adjusting detail level

## Project Structure

```
claude-tracer/
├── package.json              # Root package, scripts for dev/build/start
├── tsconfig.json             # Shared TypeScript config
├── vite.config.ts            # Vite config for UI build
├── tailwind.config.js        # Tailwind config
│
├── src/
│   ├── types/                # Shared interfaces (the contract)
│   │   ├── index.ts          # Re-exports all types
│   │   ├── blocks.ts         # Block, UserBlock, AgentBlock, ToolBlock, McpBlock
│   │   ├── chunks.ts         # Chunk hierarchy types
│   │   ├── session.ts        # ParsedSession, SessionMetadata
│   │   ├── parser.ts         # TraceParser interface
│   │   └── search.ts         # SearchEngine interface, SearchResult
│   │
│   ├── parser/               # Parser Teammate
│   │   ├── index.ts          # Exports ClaudeCodeParser
│   │   ├── base.ts           # Abstract TraceParser base class
│   │   ├── claude-code.ts    # JSONL parser for Claude Code sessions
│   │   └── adapters/         # Future: codex.ts, jules.ts, etc.
│   │
│   ├── core/                 # Core Teammate
│   │   ├── index.ts          # Exports chunker, search
│   │   ├── chunker.ts        # Builds Chunk hierarchy from Blocks
│   │   ├── search.ts         # MiniSearch wrapper
│   │   └── stats.ts          # Token/time aggregation utilities
│   │
│   ├── server/               # Server Teammate
│   │   ├── index.ts          # Entry point, CLI handling
│   │   ├── app.ts            # Express app setup
│   │   ├── watcher.ts        # File watcher + incremental parsing
│   │   ├── websocket.ts      # WebSocket server for live updates
│   │   └── picker.ts         # Session picker (scans ~/.claude/projects/)
│   │
│   └── ui/                   # UI Teammate
│       ├── index.html        # HTML entry point
│       ├── main.tsx          # React entry point
│       ├── App.tsx           # Root component
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── SearchBar.tsx
│       │   ├── TraceView.tsx
│       │   ├── BlockList.tsx
│       │   ├── UserBlock.tsx
│       │   ├── AgentBlock.tsx
│       │   ├── ToolBlock.tsx
│       │   ├── ConnectionLines.tsx
│       │   ├── ZoomControls.tsx
│       │   ├── IndexSidebar.tsx
│       │   └── Footer.tsx
│       ├── hooks/
│       │   ├── useSession.ts      # WebSocket connection, block state
│       │   ├── useSearch.ts       # Search state and filtering
│       │   └── useZoom.ts         # Zoom level state
│       └── styles/
│           └── globals.css        # Tailwind imports
│
├── research/                 # Research documents
│   └── search-approaches.md
│
├── docs/
│   ├── plans/                # Design docs
│   └── team-setup.md         # This file
│
└── dist/                     # Build output (gitignored)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| UI Framework | React + Vite |
| Styling | Tailwind CSS |
| Server | Node.js + Express |
| Live Updates | WebSocket (ws) |
| File Watching | chokidar |
| Search | MiniSearch (Phase 1) |
| Virtual Scrolling | react-window |

## Agent Team Structure

### Team Composition

```
Team Lead (coordination, review, synthesis)
    │
    ├── Parser Teammate
    │   └── Owns: src/parser/, contributes to src/types/
    │
    ├── Core Teammate
    │   └── Owns: src/core/, contributes to src/types/
    │
    ├── Server Teammate
    │   └── Owns: src/server/
    │
    └── UI Teammate
        └── Owns: src/ui/
```

### Teammate Responsibilities

#### Parser Teammate
- Implement `TraceParser` interface in `src/types/parser.ts`
- Build Claude Code JSONL parser (`src/parser/claude-code.ts`)
- Create pluggable adapter pattern for future formats
- Handle incremental parsing for streaming/watch mode
- Test with real Claude Code session files

#### Core Teammate
- Define Block and Chunk data models in `src/types/`
- Implement chunking logic (theme → task → turn hierarchy)
- Build MiniSearch integration for keyword search
- Create token/time aggregation utilities
- Ensure efficient updates for live-reload scenario

#### Server Teammate
- Set up Express server serving static UI build
- Implement WebSocket server for live updates
- Build file watcher with incremental parsing
- Create session picker (scan ~/.claude/projects/)
- Handle CLI argument parsing (file path vs picker mode)

#### UI Teammate
- Build React component tree (Header, TraceView, Sidebar, Footer)
- Implement collapsible blocks (UserBlock, AgentBlock, ToolBlock)
- Create SVG arrow connections between blocks
- Add zoom controls (+/-) for detail level
- Implement virtual scrolling for large sessions
- Connect to WebSocket for live updates

### Shared Interface Contract

The `src/types/` folder is the shared contract. All teammates code against these interfaces:

```typescript
// Key interfaces teammates must respect:

interface TraceParser {
  parse(content: string): ParsedSession;
  parseLine(line: string): Block;
}

interface Block {
  id: string;
  timestamp: number;
  type: 'user' | 'agent' | 'tool' | 'mcp';
  parentId?: string;
  tokensIn?: number;
  tokensOut?: number;
  wallTimeMs?: number;
}

interface Chunk {
  id: string;
  level: 'theme' | 'task' | 'turn';
  label: string;
  blockIds: string[];
  childChunkIds: string[];
}

interface SearchEngine {
  index(blocks: Block[]): void;
  search(query: string, limit?: number): SearchResult[];
}
```

### Coordination Protocol

**Interface changes require coordination:**
1. Teammate needing change messages the Team Lead
2. Team Lead broadcasts proposed change to affected teammates
3. Affected teammates confirm or suggest modifications
4. Team Lead approves final interface, one teammate makes the change
5. Other teammates pull and adapt

**File ownership prevents conflicts:**
- Each teammate works only in their owned directories
- `src/types/` changes are coordinated through Team Lead
- No two teammates edit the same file

### Git Worktree Strategy

Each teammate works in a separate git worktree:

```bash
# Team Lead creates worktrees
git worktree add ../claude-tracer-parser parser-work
git worktree add ../claude-tracer-core core-work
git worktree add ../claude-tracer-server server-work
git worktree add ../claude-tracer-ui ui-work
```

Teammates work on feature branches, merge through Team Lead review.

---

## Spawning the Team

Use this prompt to spawn the agent team:

```
Create an agent team for building claude-tracer, a trace visualization tool.

Read docs/team-setup.md for full context on the project structure and
teammate responsibilities.

Spawn four teammates:
1. Parser Teammate - owns src/parser/, implements JSONL parsing with pluggable adapters
2. Core Teammate - owns src/core/, implements chunking logic and MiniSearch integration
3. Server Teammate - owns src/server/, implements Express + WebSocket + file watching
4. UI Teammate - owns src/ui/, implements React components with Tailwind

Each teammate should work in their own git worktree. The src/types/ folder is
the shared contract - coordinate through me (Team Lead) for any interface changes.

Require plan approval before teammates make changes. Review their plans against
the design in docs/plans/ before approving.
```

---

## Task Breakdown for Team

### Phase 1: Foundation (all teammates in parallel)

**Parser Teammate:**
- [ ] Set up src/types/parser.ts interface
- [ ] Implement base TraceParser class
- [ ] Build ClaudeCodeParser for JSONL files
- [ ] Add incremental parsing support

**Core Teammate:**
- [ ] Set up src/types/blocks.ts and chunks.ts
- [ ] Implement Block type guards and utilities
- [ ] Build Chunker class for hierarchy creation
- [ ] Integrate MiniSearch for keyword search

**Server Teammate:**
- [ ] Set up Express app skeleton
- [ ] Implement CLI argument parsing
- [ ] Add session file picker
- [ ] Set up WebSocket server

**UI Teammate:**
- [ ] Set up Vite + React + Tailwind
- [ ] Build layout components (Header, Footer, Sidebar)
- [ ] Create basic block components
- [ ] Set up WebSocket hook

### Phase 2: Integration

**All teammates:**
- [ ] Connect components end-to-end
- [ ] Test with real Claude Code session files
- [ ] Fix interface mismatches

### Phase 3: Polish

- [ ] Add zoom controls
- [ ] Implement SVG arrows
- [ ] Add virtual scrolling
- [ ] Test live-reload with active sessions

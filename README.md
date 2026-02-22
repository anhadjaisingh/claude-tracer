# claude-tracer

Trace visualization and debugging tool for Claude Code sessions.

## What is this?

When you use [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (Anthropic's CLI for Claude), every session is recorded as a JSONL log file under `~/.claude/projects/`. These files capture the full conversation: user messages, agent responses, tool calls, sub-agent spawns, team messages, token usage, and more. They're comprehensive but difficult to read as raw JSON.

claude-tracer parses these session files and renders them as an interactive graph. Each block in the conversation becomes a node, edges show parent-child relationships, and the columnar layout reveals the structure at a glance -- user messages on the right, agent responses in the middle, tool calls and sub-agents on the left. The wider the graph, the deeper the nesting.

Use it to understand what happened in a long agent session, debug unexpected tool call chains, analyze where tokens were spent, or review how a multi-agent team coordinated. It runs entirely locally -- no data leaves your machine.

## Features

### Graph Visualization

- **React Flow graph** with columnar layout: horizontal position encodes nesting depth, vertical position encodes time
- **Smart edge routing** with directional arrows (right-to-left for spawning work, left-to-right for returning results)
- **Collapsible chunk groups** that visually group related blocks into named sections
- **Minimap** for orientation in large sessions (toggleable)
- **Node dragging** for manual layout adjustments (toggleable)
- **Zoom and pan** with configurable scroll behavior (pan-on-scroll, pinch-to-zoom)

### Session Navigation

- **Multi-level granularity** with three chunk levels:
  - **Turn** -- one chunk per user-agent exchange
  - **Task** -- merges turns into task groups, split at git commits, PRs, time gaps (>5 min), or explicit user direction changes ("Now let's...", "Next:", slash commands)
  - **Theme** -- merges tasks into high-level themes, split at large time gaps (>30 min), PR creation, or when groups exceed 6 tasks
- **Table of contents sidebar** with active-chunk highlighting that tracks your viewport position
- **Chunk labels** derived from commit messages, PR titles, or the first user message in each chunk
- **Search** with keyword mode (instant, MiniSearch-powered) and smart mode (hybrid keyword + vector search)
- **Search result navigation** that pans the graph viewport to each matched block

### Block Types

Every block type in a Claude Code session is parsed and rendered with a dedicated node style:

- **User** -- human messages (right column, light bubble)
- **Agent** -- Claude's responses with optional extended thinking
- **Tool** -- tool calls (Bash, Read, Write, Grep, Glob, etc.) with input/output and success/error status
- **MCP** -- Model Context Protocol calls to external servers, with server name and method
- **Sub-agent** -- spawned Task agents shown as nested sub-graphs
- **Command** -- slash commands (/commit, /review-pr, etc.)
- **Meta** -- system-injected context (skills, caveats, permissions)
- **Team message** -- inter-agent communication (message, broadcast, shutdown)
- **System** -- internal system events
- **Progress** -- progress indicators for long-running operations
- **File snapshot** -- file history snapshots with tracked file metadata
- **Queue operation** -- enqueue/remove operations on the message queue
- **Compaction boundary** -- marks where context compaction occurred

### Filtering and Display

- **Block type filter** with toggle controls to show/hide specific block types
- **Three themes**: Dark (default), Light, and Claude (terracotta accent)
- **Block overlay** -- click any node to open a modal with the full content and raw JSON
- **Collapse/expand all** controls for chunk groups
- **Resizable sidebar** by dragging its edge

### Token Analytics

- **Per-block token counts** (input and output tokens) displayed on nodes
- **Per-chunk aggregated tokens** shown in the sidebar table of contents
- **Duration tracking** (wall time) per block and per chunk

## Quickstart

```bash
# Clone and install
git clone https://github.com/anhadjaisingh/claude-tracer.git
cd claude-tracer
npm install

# Run with a specific session file
npm run dev -- -f ~/.claude/projects/<project-hash>/sessions/<session-id>.jsonl

# Or start the server without a file and open the browser
npm run dev
# Then open http://localhost:5173
```

### Finding your session files

Claude Code stores session logs at:

```
~/.claude/projects/<project-hash>/sessions/<session-id>.jsonl
```

On macOS and Linux, you can list recent sessions with:

```bash
ls -lt ~/.claude/projects/*/sessions/*.jsonl | head -20
```

Each `.jsonl` file is a complete session recording. Pick one and pass it with the `-f` flag.

## Development

**Stack:** TypeScript, React 19, Vite 7, Tailwind CSS v4, Express 5, WebSocket, MiniSearch, React Flow v12.

```bash
npm run dev          # Start Express + Vite dev servers concurrently
npm run test:run     # Run unit tests (vitest) once
npm test             # Run unit tests in watch mode
npm run test:e2e     # Run E2E tests (Playwright)
npm run lint         # ESLint check
npm run format       # Prettier format
npm run typecheck    # TypeScript type checking
npm run build        # Production build (server + UI)
```

### Project Structure

```
src/
  types/      Shared type definitions (Block, Chunk, etc.)
  parser/     JSONL parser for Claude Code session files
  core/       Chunker (turn/task/theme grouping), search indexing
  server/     Express + WebSocket server, file watching
  ui/         React app (components, hooks, themes)
e2e/          Playwright E2E tests and fixtures
```

### Testing

Unit tests use **vitest** and live alongside source files in `__tests__/` directories. E2E tests use **Playwright** and live in `e2e/specs/`. Test fixtures (sample JSONL sessions) are in `e2e/fixtures/sessions/`.

## License

MIT

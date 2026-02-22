# claude-tracer

Parses Claude Code session JSONL files and renders them as interactive node graphs. Understand long agent sessions, debug tool call chains, track token spend, and review multi-agent coordination — all locally.

![Graph overview](docs/screenshots/graph-overview.png)

## Quickstart

```bash
git clone https://github.com/anhadjaisingh/claude-tracer.git
cd claude-tracer
npm install

# Run with a session file
npm run dev -- -f ~/.claude/projects/<project-hash>/sessions/<session-id>.jsonl
```

Then open [http://localhost:5173](http://localhost:5173).

### Finding session files

Claude Code stores sessions at `~/.claude/projects/<project-hash>/sessions/<session-id>.jsonl`. List recent ones with:

```bash
ls -lt ~/.claude/projects/*/sessions/*.jsonl | head -20
```

## Features

### Graph visualization

Columnar layout where horizontal position encodes nesting depth (user messages right, agent center, tools left) and vertical position encodes time. Collapsible chunk groups, minimap, node dragging, zoom/pan.

### Table of contents and granularity

The sidebar shows a table of contents derived from the session's structure. It highlights which chunk you're currently viewing as you scroll. Three granularity levels control how blocks are grouped:

- **Fine** — one chunk per user-agent exchange (turn-level)
- **Medium** — merges turns into task groups, split at git commits, PRs, time gaps (>5 min), or explicit direction changes ("Now let's...", "Next:", slash commands)
- **Coarse** — merges tasks into high-level themes, split at large time gaps (>30 min), PR creation, or when groups exceed 6 tasks

Chunk labels are derived from commit messages, PR titles, or the first user message in each group. Each chunk shows its block count, aggregated token usage (in/out), and wall-clock duration.

### Token analytics

Every node shows its token count (input and output). Chunk group headers aggregate tokens across all blocks in the group. The sidebar TOC shows per-chunk token summaries so you can quickly identify where tokens were spent.

### Search

**Keyword mode** is instant, powered by MiniSearch with fuzzy matching. **Smart mode** adds hybrid keyword + vector search using local embeddings (computed in-browser via transformers.js) for semantic matching — find blocks by meaning, not just exact words. Results navigate the viewport to each matched block with a yellow highlight border.

![Search with highlighted result](docs/screenshots/search.png)

### Block types

Every Claude Code block type gets a dedicated node component:

- **User** — human messages (right column, gray bubble)
- **Agent** — Claude's responses with token counts and tool call badges
- **Tool** — tool calls (Bash, Read, Write, Grep, Glob, etc.) with input/output and success/error status
- **MCP** — Model Context Protocol calls to external servers
- **Sub-agent** — spawned Task agents shown as nested sub-graphs
- **Command** — slash commands (/commit, /review-pr, etc.)
- **Meta** — system-injected context (skills, caveats, permissions)
- **Team message** — inter-agent communication (message, broadcast, shutdown)
- **System** — internal system events (stop hooks, configuration)
- **Progress** — progress indicators for long-running operations
- **File snapshot** — file history snapshots with tracked file metadata
- **Queue operation** — enqueue/remove operations on the message queue
- **Compaction boundary** — marks where context compaction occurred, visually distinct so you can see where Claude's memory was compressed

### Block overlay

Click any node to inspect the full content, token counts, tool call details, and raw block data.

![Block detail overlay](docs/screenshots/block-overlay.png)

### Filtering and settings

Toggle block types on/off to hide noise (e.g. hide system/progress blocks to focus on the conversation). Three themes (Dark, Light, Claude). Configurable minimap and node dragging.

<p float="left">
  <img src="docs/screenshots/filter-panel.png" width="200" alt="Block type filter" />
  <img src="docs/screenshots/settings-panel.png" width="200" alt="Settings panel" />
</p>

## Development

**Stack:** TypeScript, React 19, Vite 7, Tailwind CSS v4, Express 5, WebSocket, MiniSearch, React Flow v12.

```bash
npm run dev          # Start Express + Vite dev servers
npm run test:run     # Unit tests (vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run build        # Production build
```

### Project structure

```
src/
  types/      Shared type definitions (Block, Chunk, etc.)
  parser/     JSONL parser for Claude Code session files
  core/       Chunker (turn/task/theme grouping), search indexing
  server/     Express + WebSocket server, file watching
  ui/         React app (components, hooks, themes)
e2e/          Playwright E2E tests and fixtures
```

## License

MIT

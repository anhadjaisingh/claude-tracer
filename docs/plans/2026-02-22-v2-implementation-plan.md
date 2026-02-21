# V2 Graph Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete parser, compact rendering, compaction markers, grouping granularity, slash command/sub-agent collapsing, and quick fixes.

**Architecture:** Parse all JSONL entry types → filter/aggregate → compact graph rendering. Multi-level chunker feeds a granularity selector. Collapsible nodes for slash commands and sub-agents reuse the chunk group expand/collapse pattern.

**Tech Stack:** TypeScript, React, Vite, Tailwind v4, React Flow, vitest

**Design doc:** `docs/plans/2026-02-22-v2-graph-improvements-design.md`

---

## Dependency Graph

```
PR 1 (Parser)  ──────────┐
                          ├──→ PR 3 (Special Nodes) ──→ PR 5 (Granularity UI)
PR 2 (UI Quick Fixes) ───┤                              ↑
                          └──→ PR 4 (Multi-level Chunker)┘
```

**Phase 1** (parallel): PR 1 + PR 2
**Phase 2** (parallel, after PR 1): PR 3 + PR 4
**Phase 3** (after PR 4): PR 5

---

## PR 1: Complete Parser + Filter Module

**Agent:** Parser teammate (`/Users/anhad/Projects/claude-tracer-parser`)
**Branch:** `feat/complete-parser`
**Files to modify:** `src/types/blocks.ts`, `src/types/index.ts`, `src/parser/claude-code.ts`, `src/core/filter.ts` (new), `src/server/index.ts`

### Task 1.1: Add new block types

**Files:** `src/types/blocks.ts`, `src/types/index.ts`

Add to `src/types/blocks.ts`:

```typescript
export interface SystemBlock extends Block {
  type: 'system';
  subtype: string;
  data: Record<string, unknown>;
}

export interface ProgressBlock extends Block {
  type: 'progress';
  progressType: string;
  data: Record<string, unknown>;
  parentToolUseId?: string;
}

export interface FileSnapshotBlock extends Block {
  type: 'file-snapshot';
  messageId: string;
  trackedFiles: Record<string, { backupFileName: string; version: number; backupTime: string }>;
}

export interface QueueOperationBlock extends Block {
  type: 'queue-operation';
  operation: 'enqueue' | 'remove';
  content?: string;
}
```

Update `AnyBlock` union to include all 4 new types. Add type guard functions (`isSystemBlock`, `isProgressBlock`, `isFileSnapshotBlock`, `isQueueOperationBlock`). Update `Block.type` union.

Update `src/types/index.ts` to re-export all new types and guards.

### Task 1.2: Write parser tests for new entry types

**Files:** `src/parser/__tests__/claude-code.test.ts`

Write tests for each new entry type. Use real JSONL examples from `docs/jsonl-format.md`:

- `system` with `subtype: 'turn_duration'` → `SystemBlock`
- `system` with `subtype: 'compact_boundary'` → `SystemBlock`
- `system` with `subtype: 'stop_hook_summary'` → `SystemBlock`
- `progress` with `data.type: 'bash_progress'` → `ProgressBlock`
- `progress` with `data.type: 'agent_progress'` → `ProgressBlock`
- `progress` with `data.type: 'hook_progress'` → `ProgressBlock`
- `file-history-snapshot` → `FileSnapshotBlock`
- `queue-operation` with `operation: 'enqueue'` → `QueueOperationBlock`
- Verify existing `user` and `assistant` parsing still works (no regressions)

### Task 1.3: Implement parser changes

**Files:** `src/parser/claude-code.ts`

Update `ClaudeCodeEntry.type` union to include all types. Update `parseEntry()` to route all types:

```typescript
private parseEntry(entry: ClaudeCodeEntry): AnyBlock | null {
  const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();

  if (entry.type === 'user') return this.parseUserEntry(entry, timestamp);
  if (entry.type === 'assistant') return this.parseAssistantEntry(entry, timestamp);
  if (entry.type === 'system') return this.parseSystemEntry(entry, timestamp);
  if (entry.type === 'progress') return this.parseProgressEntry(entry, timestamp);
  if (entry.type === 'file-history-snapshot') return this.parseFileSnapshotEntry(entry, timestamp);
  if (entry.type === 'queue-operation') return this.parseQueueOperationEntry(entry, timestamp);

  // Unknown type — still emit a block (SystemBlock with subtype 'unknown')
  return { id: this.generateBlockId(), timestamp, type: 'system', subtype: 'unknown', data: entry as Record<string, unknown> };
}
```

Implement each `parse*Entry()` method. Extract relevant fields for each block type.

Also parse `uuid` and `parentUuid` from entries and store them on the Block base type (add `uuid?: string` and `sourceParentUuid?: string` to `Block` interface). These are needed for proper tree-structure rendering later.

### Task 1.4: Create filter module

**Files:** `src/core/filter.ts`, `src/core/__tests__/filter.test.ts`

```typescript
export interface FilterConfig {
  showSystem: boolean;        // default: true (needed for compaction)
  showProgress: boolean;      // default: false (noisy, hide by default)
  showFileSnapshots: boolean; // default: false (noisy, hide by default)
  showQueueOps: boolean;      // default: false (rare, hide by default)
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  showSystem: true,
  showProgress: false,
  showFileSnapshots: false,
  showQueueOps: false,
};

export function filterBlocks(blocks: AnyBlock[], config: FilterConfig = DEFAULT_FILTER_CONFIG): AnyBlock[] {
  return blocks.filter((block) => {
    if (isSystemBlock(block)) return config.showSystem;
    if (isProgressBlock(block)) return config.showProgress;
    if (isFileSnapshotBlock(block)) return config.showFileSnapshots;
    if (isQueueOperationBlock(block)) return config.showQueueOps;
    return true; // always show user, agent, tool, mcp, team-message
  });
}
```

Write tests for filter module (filter in/out each type based on config flags).

### Task 1.5: Wire filter into server pipeline

**Files:** `src/server/index.ts` (or wherever blocks are sent to WebSocket)

Apply `filterBlocks()` after parsing, before sending to clients. The filter config should be part of the server's state (defaulting to `DEFAULT_FILTER_CONFIG`).

### Task 1.6: Run all tests, lint, commit

Run: `npx vitest run && npx tsc --noEmit && npx eslint 'src/**/*.{ts,tsx}'`

Commit, push, open PR.

---

## PR 2: UI Quick Fixes + Compact Rendering

**Agent:** UI teammate (`/Users/anhad/Projects/claude-tracer-ui`)
**Branch:** `feat/ui-quick-fixes`
**Files to modify:** `src/ui/hooks/useSettings.ts`, `src/ui/themes/index.ts`, `src/ui/components/graph/GraphView.tsx`, `src/ui/components/graph/buildGraph.ts`, `src/ui/components/graph/nodes/ToolNode.tsx`, `src/ui/components/graph/nodes/AgentNode.tsx`

### Task 2.1: Dark theme default

**Files:** `src/ui/hooks/useSettings.ts`, `src/ui/themes/index.ts`

In `useSettings.ts` line 11: change `return 'claude'` to `return 'dark'`.
In `themes/index.ts` line 6: change `createContext<Theme>(claudeTheme)` to `createContext<Theme>(darkTheme)`.

### Task 2.2: Scroll-to-pan fix

**Files:** `src/ui/components/graph/GraphView.tsx`

Add to the `<ReactFlow>` component (around line 292):
```
zoomOnScroll={false}
panOnScroll={true}
```

### Task 2.3: Collapsed group edge fix

**Files:** `src/ui/components/graph/buildGraph.ts`, possibly `src/ui/components/graph/layout.ts`

Investigate why group-to-group edges disappear when a group is collapsed. The `addGroupEdge()` function (line 185) creates edges between group node IDs, not block IDs, so they shouldn't be hidden by `hiddenBlockIds`. Debug:

1. Check if collapsed group nodes get `hidden: true` in the layout
2. Check if React Flow hides edges when the source/target node has zero visible children
3. Ensure collapsed group nodes have valid position and dimensions in the layout
4. Ensure group-to-group edges use the default handles (bottom → top) of the chunkGroup nodes

The fix likely involves ensuring collapsed chunkGroup nodes retain valid dimensions and that their edges are never marked hidden.

### Task 2.4: Compact tool block rendering

**Files:** `src/ui/components/graph/nodes/ToolNode.tsx`

Redesign the ToolNode component to show a single-line summary:

```
[icon] ToolName: key_arg  [✓/✗]  [time]  [tokens]
```

Key arg extraction per tool:
- **Bash**: `input.command` (first 60 chars)
- **Read**: `input.file_path`
- **Grep/Glob**: `input.pattern`
- **Edit/Write**: `input.file_path`
- **Task**: `input.description` or first line of `input.prompt`
- **TodoWrite**: count of items

Use the tool renderer registry for icon mapping. Remove the full input/output display from the node — all detail is in the overlay.

Stats shown as small gray text: `1.2s · 340 tok`

### Task 2.5: Compact agent block rendering

**Files:** `src/ui/components/graph/nodes/AgentNode.tsx`

Truncate agent text to first 2-3 lines (max ~200 chars). Hide thinking content entirely from the node.

Show stats at bottom: `[token count] · [time] · [N tool calls]`

### Task 2.6: Write tests for compact rendering

**Files:** `src/ui/__tests__/nodes.test.ts` (or create if needed)

Test that:
- ToolNode renders one-liner with tool name and key arg
- ToolNode shows success/error badge
- AgentNode truncates text to ~200 chars
- AgentNode hides thinking content

### Task 2.7: Run all tests, lint, take screenshots, commit

Run tests, lint, typecheck. Start a dev server, open in Playwright, take screenshot to verify compact rendering looks good. Commit, push, open PR.

---

## PR 3: Special Block Types + Compaction Node

**Agent:** UI teammate (`/Users/anhad/Projects/claude-tracer-ui`)
**Branch:** `feat/special-blocks`
**Depends on:** PR 1 merged (needs `SystemBlock` type)

### Task 3.1: Compaction node

**Files:** `src/ui/components/graph/nodes/CompactionNode.tsx` (new), `src/ui/components/graph/nodes/index.ts`, `src/ui/components/graph/buildGraph.ts`, `src/ui/components/graph/layout.ts`, `src/ui/components/graph/GraphView.tsx`

Create `CompactionNode` — a full-width amber divider:
- Background: `rgba(245, 158, 11, 0.15)`, border: `#f59e0b`
- Label: "Context Compacted" centered
- No expand/overlay behavior
- Spans all columns in the layout

Register `'compaction'` in `nodeTypes` in `GraphView.tsx`.

Update `buildGraph.ts` `getNodeType()` to return `'compaction'` for `SystemBlock` with `subtype === 'compact_boundary'`.

Update `layout.ts` to handle compaction nodes as full-width (spanning all column positions).

### Task 3.2: Slash command detection in parser

**Files:** `src/parser/claude-code.ts`

In `parseUserEntry()`, detect the `<command-name>...</command-name>` XML wrapper pattern. When found, set `isCommand: true` and `commandName: string` on the `UserBlock`.

Add `isCommand?: boolean` and `commandName?: string` to `UserBlock` in `src/types/blocks.ts`.

### Task 3.3: Slash command collapsible node

**Files:** `src/ui/components/graph/nodes/CommandNode.tsx` (new), `src/ui/components/graph/nodes/index.ts`, `src/ui/components/graph/buildGraph.ts`, `src/ui/components/graph/GraphView.tsx`

Create `CommandNode` — user-side pill showing `/command-name` with chevron:
- Render on the right column (user side)
- Chevron to expand/collapse child nodes (the injected user/agent messages following the command)
- When collapsed: just the command pill
- When expanded: child nodes visible beneath it
- Click on expanded children opens overlay (same as other blocks)

The grouping logic: in `buildGraph.ts`, after detecting a `UserBlock` with `isCommand: true`, collect subsequent blocks until the next non-meta user message. These become children of the command group.

Reuse the same collapse pattern as `ChunkGroupNode` (chevron toggle, `collapsedGroups` state).

### Task 3.4: Sub-agent expandable node

**Files:** `src/ui/components/graph/nodes/SubAgentNode.tsx` (new), `src/ui/components/graph/nodes/index.ts`, `src/ui/components/graph/buildGraph.ts`

Create `SubAgentNode` for `ToolBlock` where `toolName === 'Task'`:
- Shows: agent type badge, description/prompt first line
- Status badge (from output)
- Chevron for future sub-tree expansion (disabled for now — JSONL loading deferred)
- Compact one-liner like other tool blocks

Update `getNodeType()` in `buildGraph.ts` to return `'subagent'` for Task tool blocks.

### Task 3.5: Fix teammate message parsing

**Files:** `src/parser/claude-code.ts`

Current issue: `TeamMessageBlock` is only emitted when SendMessage is the sole content of an assistant entry. Fix to always emit it alongside the agent block. When an assistant entry has both text/tools AND a SendMessage, emit both blocks.

### Task 3.6: Tests, screenshots, commit

Write tests for compaction node, command node, sub-agent node. Take screenshots. Commit, push, open PR.

---

## PR 4: Multi-Level Chunker

**Agent:** Core teammate (`/Users/anhad/Projects/claude-tracer-core`)
**Branch:** `feat/multi-level-chunker`
**Depends on:** PR 1 merged (needs new block types for proper chunking)

### Task 4.1: Add chunk level types

**Files:** `src/types/chunks.ts`

Ensure `ChunkLevel` includes: `'turn' | 'task' | 'theme'`.

Add `granularity` concept — the Chunker should accept a level parameter.

### Task 4.2: Write tests for task-level chunking

**Files:** `src/core/__tests__/chunker.test.ts`

Test that task-level chunking:
- Merges consecutive turns that don't cross commit/PR/time-gap boundaries
- Splits at git commits, PR creation, time gaps > 5 min
- Produces fewer chunks than turn-level for the same input
- Labels use the most significant event (commit msg > PR title > first user msg)

### Task 4.3: Implement task-level chunking

**Files:** `src/core/chunker.ts`

Add `createTaskChunks(blocks: AnyBlock[]): Chunk[]` method.

Approach: first create turn-level chunks, then merge consecutive turns that don't cross "end-of-unit" boundaries (git commit, PR creation, time gap > 5 min, explicit user direction change). Each merged group becomes a task-level chunk with `level: 'task'` and `childChunkIds` pointing to the constituent turn chunks.

### Task 4.4: Write tests for theme-level chunking

**Files:** `src/core/__tests__/chunker.test.ts`

Test that theme-level chunking:
- Merges consecutive task-level chunks
- Splits at time gaps > 30 min, major topic shifts
- Produces the fewest chunks
- Labels summarize the overarching topic

### Task 4.5: Implement theme-level chunking

**Files:** `src/core/chunker.ts`

Add `createThemeChunks(blocks: AnyBlock[]): Chunk[]` method.

Approach: first create task-level chunks, then merge into themes. Boundaries: time gaps > 30 min, topic shifts (detected by comparing first user messages across tasks).

### Task 4.6: Add granularity parameter

**Files:** `src/core/chunker.ts`

Add `createChunksAtLevel(blocks: AnyBlock[], level: ChunkLevel): Chunk[]` dispatcher:
- `'turn'` → existing `createChunks()`
- `'task'` → `createTaskChunks()`
- `'theme'` → `createThemeChunks()`

### Task 4.7: Wire into server

**Files:** `src/server/index.ts`, `src/server/websocket.ts`

The server should accept a granularity parameter from the client via WebSocket message and respond with appropriate chunks.

### Task 4.8: Tests, commit

Run all tests, lint, typecheck. Commit, push, open PR.

---

## PR 5: Granularity Dot Selector UI

**Agent:** UI teammate (`/Users/anhad/Projects/claude-tracer-ui`)
**Branch:** `feat/granularity-selector`
**Depends on:** PR 4 merged (needs multi-level chunker)

### Task 5.1: Add granularity state

**Files:** `src/ui/hooks/useSettings.ts`

Add `granularity: ChunkLevel` to settings (default: `'turn'`). Persist to localStorage.

### Task 5.2: Create GranularitySelector component

**Files:** `src/ui/components/GranularitySelector.tsx` (new)

A horizontal row at the bottom of the sidebar:
- 3 dots (small circles), equally spaced
- Active dot: filled with accent color, slightly larger
- Inactive dots: outline only, muted color
- Below the dots: active level name ("Fine", "Medium", "Coarse")
- Level name mapping: `turn` → "Fine", `task` → "Medium", `theme` → "Coarse"
- Click a dot to switch level
- Smooth transition (dot fill animates)

### Task 5.3: Wire into sidebar

**Files:** `src/ui/components/IndexSidebar.tsx`, `src/ui/App.tsx`

Place `GranularitySelector` at the bottom of the sidebar. When the user changes granularity, send the new level to the server via WebSocket and update local state.

### Task 5.4: Wire into server/graph

When granularity changes, the server re-chunks at the new level and sends updated chunks via WebSocket. The graph re-renders with the new grouping.

### Task 5.5: Tests, screenshots, commit

Test the selector renders correctly. Take screenshots at each granularity level. Commit, push, open PR.

---

## Worktree Assignment

| PR | Agent Role | Worktree | Phase |
|----|-----------|----------|-------|
| PR 1 | Parser | `claude-tracer-parser` | 1 |
| PR 2 | UI | `claude-tracer-ui` | 1 |
| PR 3 | UI | `claude-tracer-ui` | 2 |
| PR 4 | Core | `claude-tracer-core` | 2 |
| PR 5 | UI | `claude-tracer-ui` | 3 |

## Port Allocation

| Agent | Express | Vite |
|-------|---------|------|
| Parser | 5000 | 5001 |
| Core | 5002 | 5003 |
| UI | 5006 | 5007 |

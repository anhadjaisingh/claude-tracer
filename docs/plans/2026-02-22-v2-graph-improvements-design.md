# V2 Graph Improvements Design

## Context

Claude-tracer is a trace visualization tool for Claude Code JSONL sessions. The current implementation works but has several issues: the parser skips non-user/assistant entry types, tool blocks are noisy, grouping is fixed at one level, and several block types (slash commands, sub-agents, compaction) lack proper visual treatment.

This design covers 8 improvements to be implemented together.

## 1. Complete Parser — No Skipped Entries

**Problem:** The parser in `src/parser/claude-code.ts` currently returns `null` for `system`, `progress`, `file-history-snapshot`, and `queue-operation` entries (line 137). This means the trace visualization is incomplete.

**Design:**

Add new block types to `src/types/blocks.ts`:

```typescript
export interface SystemBlock extends Block {
  type: 'system';
  subtype: string; // 'turn_duration' | 'stop_hook_summary' | 'compact_boundary' | etc.
  data: Record<string, unknown>; // raw system event data
}

export interface ProgressBlock extends Block {
  type: 'progress';
  progressType: string; // 'hook_progress' | 'bash_progress' | 'agent_progress' | 'mcp_progress' | 'query_update' | 'search_results_received'
  data: Record<string, unknown>; // raw progress data
  parentToolUseId?: string; // links to the tool call that spawned this progress
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

Update `AnyBlock` union to include all new types. Add type guard functions.

**Parser changes:** `parseEntry()` should parse ALL entry types into their respective blocks. No more `return null` for known types. Only return null for genuinely malformed/unparseable lines.

**Filter/Aggregator module:** Create `src/core/filter.ts` — a separate module that takes `AnyBlock[]` and applies display rules:

- `FilterConfig` interface with boolean flags for each block type (e.g., `showSystem`, `showProgress`, `showFileSnapshots`, `showQueueOps`)
- Default config hides file-history-snapshot and queue-operation (noisy, rarely useful)
- Shows system blocks (especially compact_boundary)
- Shows progress blocks (useful for understanding tool execution)
- The filter is applied AFTER parsing, BEFORE graph building
- The filter config can be exposed in the UI settings later

## 2. Dark Theme Default

**Change:** In `src/ui/hooks/useSettings.ts`, change the default theme from `'claude'` to `'dark'` (line 11). Also update `src/ui/themes/index.ts` to use `darkTheme` as the context default.

## 3. Compaction Boundary Visual Treatment

**Problem:** When context compaction occurs, it's invisible in the trace. Users need to know where the model's context was truncated/summarized.

**Design:**

When the parser encounters a `system` entry with `subtype: 'compact_boundary'`, it creates a `SystemBlock` with `subtype: 'compact_boundary'`.

In the graph, this block renders as a **CompactionNode** — a special node type:

- Full-width amber/yellow horizontal divider
- Label: "Context Compacted" centered on the divider
- Amber background: `rgba(245, 158, 11, 0.15)` with amber border `#f59e0b`
- Sits in the flow between whatever blocks surround it (spans all columns)
- No expand/overlay behavior (it's a marker, not content)

Add `compaction` to the `nodeTypes` map in `GraphView.tsx`. Create `CompactionNode` component in `src/ui/components/graph/nodes/`.

The layout engine needs to handle this as a full-width node that spans across all columns.

## 4. Scroll-to-Pan Fix

**Problem:** Two-finger scroll on Mac triggers zoom instead of pan.

**Fix:** Add these props to the `<ReactFlow>` component in `GraphView.tsx`:

```
zoomOnScroll={false}
panOnScroll={true}
```

Users can still zoom with pinch gesture or the zoom controls.

## 5. Grouping Granularity Control

**Problem:** The TOC/sidebar currently shows one fixed level of grouping (turn-level chunks). Users need to switch between granularity levels.

**Design:**

Three granularity levels:

1. **Fine** — Every turn (user message + agent response + tool calls = 1 group). This is roughly what we have now.
2. **Medium** — Task-level groups. Multiple turns that work toward the same goal (e.g., "implementing feature X" might span 5-10 turns). Detected by heuristics: commit messages, PR creation, large time gaps, topic shifts.
3. **Coarse** — Theme-level topics. High-level conversation segments (e.g., "authentication work", "UI refactoring"). Fewer, larger groups.

**UI Control:** At the bottom of the sidebar/TOC, a horizontal row of:

- 3 dots (small circles), one per level
- The active dot is filled/highlighted with the accent color
- Below the dots, the active level name is displayed (e.g., "Fine", "Medium", "Coarse")
- Clicking a dot switches the granularity level

**Implementation:**

- The chunker (`src/core/chunker.ts`) needs to support all 3 levels. It currently does turn-level. Add `chunkAtTaskLevel()` and `chunkAtThemeLevel()` functions.
- The sidebar receives the current granularity level and requests the appropriate chunks.
- The graph re-renders with the new grouping when the level changes.
- State stored in the `useSettings` hook, persisted to localStorage.

**Chunker heuristics for Medium (task-level):**

- Groups turns that share a common goal
- Boundaries: commit messages, PR creation/merge, explicit user direction changes, time gaps > 5 min
- Merge consecutive Fine chunks that don't cross these boundaries

**Chunker heuristics for Coarse (theme-level):**

- Groups tasks into high-level topics
- Boundaries: major topic shifts, time gaps > 30 min, different feature areas
- Uses the first meaningful user message in each group as the label

## 6. Compact Block Rendering

**Problem:** Tool blocks and agent blocks show too much content, making the graph noisy.

**Design:**

### Tool Blocks (Bash, Read, Grep, Edit, Write, Glob, Task, etc.)

Render as a compact one-liner:

```
[icon] ToolName: key_argument  [success/error badge]  [1.2s]  [340 tokens]
```

Examples:

- `Read: src/auth.ts  ✓  0.1s  120 tok`
- `$ Bash: npm test  ✗  4.2s  890 tok`
- `Grep: "TODO" in src/  ✓  0.3s  210 tok`

The "key argument" is extracted per tool:

- **Bash:** the command (truncated)
- **Read:** file_path
- **Grep/Glob:** pattern
- **Edit/Write:** file_path
- **Task:** agent description/prompt first line
- **TodoWrite:** "N todos"

Click opens the overlay with full input/output.

### Agent Blocks

Trim to first 2-3 lines of text content. Show token count and time.

```
Agent text preview here, first couple
of lines only...
                          [1.2K tok]  [3.1s]  [3 tool calls]
```

Thinking content is hidden from the node, visible in overlay.

### Meta Blocks

Keep current pill treatment. They're already compact.

## 7. Collapsed Group Edge Fix

**Problem:** When a chunk group is collapsed, the arrow from that group to the next group disappears.

**Analysis:** `buildGraph.ts` creates group-to-group edges via `addGroupEdge()` (line 176-183). These edges connect chunk node IDs, not block IDs. They should NOT be affected by the `hiddenBlockIds` check. The bug is likely in:

1. The layout engine not positioning collapsed group nodes correctly, making edges invisible
2. Or React Flow hiding edges when all children of a group are hidden

**Fix approach:** Debug by checking if the group-to-group edges are present in the edge array and whether they have `hidden: false`. If the issue is layout-related, ensure collapsed groups still get valid positions and dimensions. The group-to-group edges should use the group node's handles, not child block handles.

## 8. Special Block Types

### Slash Commands

**Detection:** User entries where content matches `<command-name>...</command-name>` XML pattern.

**Rendering:** A collapsible **CommandNode** on the user side (right column):

- Shows `/command-name` as a pill/badge
- Chevron icon to expand/collapse (same pattern as chunk groups)
- When expanded: shows the chain of user/agent messages that the slash command injection produces as child nodes
- When collapsed: just the pill with command name
- Clicking expanded child nodes opens the overlay (not the expand/collapse)

**Parser change:** Detect the XML wrapper in user entries. Set a flag like `isCommand: true` and `commandName: string` on UserBlock. The aggregator/filter module groups the command entry + its injected sub-messages into a collapsible group.

### Sub-agent Invocations (Task tool)

**Detection:** Tool blocks where `toolName === 'Task'`.

**Rendering:** A **SubAgentNode** with:

- Shows: agent type, description/prompt first line
- Chevron to expand sub-tree (if sub-agent JSONL file can be located and parsed)
- When expanded: inline sub-agent blocks as children
- When collapsed: summary node with result status
- Badge showing sub-agent status (running, completed, error)

**Parser change:** The Task tool call's input contains `description`, `prompt`, `subagent_type`. Extract these into the ToolBlock's parsed data. For sub-agent JSONL parsing, this is a future enhancement — for now, show the tool input/output with the expandable UX ready.

### Teammate Messages (SendMessage)

**Current state:** `TeamMessageNode` exists but parser only catches SendMessage when it's the sole content of an assistant entry.

**Fix:** The parser should always emit a `TeamMessageBlock` when it encounters a SendMessage tool_use, even alongside other content. The agent block and team message block are siblings — both should appear in the graph.

## Implementation Order

1. **Types + Parser** (foundation) — Add new block types, parse all entries, emit all blocks
2. **Filter module** — Create `src/core/filter.ts`, wire into server/UI pipeline
3. **Quick fixes** — Dark theme default, scroll-to-pan, collapsed group edges
4. **Compact rendering** — One-liner tool blocks, trimmed agent blocks, stats badges
5. **Compaction node** — New CompactionNode component + layout support
6. **Slash command collapsing** — Command detection, grouping, CommandNode component
7. **Sub-agent expansion** — SubAgentNode, expandable UX (JSONL loading deferred)
8. **Teammate message fix** — Parser fix for concurrent SendMessage + other content
9. **Grouping granularity** — Multi-level chunker, dot selector UI, sidebar integration

Steps 1-3 are foundational. Steps 4-8 can be parallelized. Step 9 depends on the chunker changes and is independent of the UI work in 4-8.

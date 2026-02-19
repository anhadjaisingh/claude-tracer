# Session Context — 2026-02-19

> Pickup notes for the next session. Read this first.

## What Got Done This Session

- **PR #19**: Custom columnar layout replacing elkjs — merged
- **PR #20**: UI graph tweaks (meta column sharing, yellow search highlight, tool renderer wiring, bezier edges, arrowheads, interactive minimap, disabled dragging, dynamic columns) — merged to main, PR closed
- **PR #21**: Semantic grouping with collapsible chunk groups — merged
- **Merge conflicts** between PR #20 and #21 resolved on main
- **197 tests passing**, typecheck/lint/build all clean
- All changes live on `npm run local`

## Pending Cleanup

- **ui-tweaks team agent** is still alive but unresponsive to shutdown. The team `ui-and-grouping` needs cleanup:
  ```bash
  rm -rf ~/.claude/teams/ui-and-grouping ~/.claude/tasks/ui-and-grouping
  ```
  May also need to kill any lingering tmux panes (`tmux list-panes -a` to check).

- **Remote branch cleanup**: `feat/ui-graph-tweaks` deleted locally, may still exist on remote:
  ```bash
  git push origin --delete feat/ui-graph-tweaks
  git push origin --delete feat/semantic-grouping
  ```

## Known Issues / Next Work

1. **Scroll-to-pan**: User requested that mouse scroll should pan (not zoom). Was sent to ui-tweaks agent mid-flight but unclear if it was implemented. Check if `zoomOnScroll={false}` and `panOnScroll={true}` are set on the `<ReactFlow>` component in `GraphView.tsx`. If not, add them.

2. **Teammate message parsing**: Real JSONL data contains `<teammate-message>` entries that need special handling:
   - Parse `teammate_id`, `color`, `summary` attributes from the XML-like wrapper
   - Render as `TeamMessageBlock` instead of `UserBlock`
   - Place in left columns of the graph
   - The `TeamMessageNode` graph component already exists but parser doesn't emit `TeamMessageBlock` yet

3. **Visual polish**: After loading real session data, there may be more layout/rendering issues to address. User tends to test with real data and report batches of tweaks.

4. **Port isolation for agents**: Added to CLAUDE.md but agents may still default to port 3000. When spawning agents, remind them to use unique ports (e.g., 5000+random) and clean up after.

## Architecture State

- **Main branch**: all features integrated, 197 tests
- **Layout**: Custom synchronous columnar layout in `src/ui/components/graph/layout.ts`
  - `flatLayout()` for sessions without chunks
  - `groupedLayout()` for sessions with semantic chunk groups
  - Dynamic column allocation via `buildColumnX()`
  - Meta nodes share user column (TYPE_ORDER has 4 entries, not 5)
- **Graph rendering**: React Flow v12, custom node types (User, Agent, Tool, Meta, TeamMessage, ChunkGroup)
- **Tool renderers**: Registry at `src/ui/renderers/registry.ts`, wired into both overlay (`ToolBlock.tsx`) and graph (`ToolNode.tsx`)
- **Search**: MiniSearch + vector hybrid search, connected to UI via `useSearch` hook
- **Grouping**: Chunker creates semantic groups, `buildGraph` creates parent/child React Flow nodes, collapse/expand via chevron

## Key Files

| Area | File |
|------|------|
| Layout engine | `src/ui/components/graph/layout.ts` |
| Graph builder | `src/ui/components/graph/buildGraph.ts` |
| Main graph view | `src/ui/components/graph/GraphView.tsx` |
| Node components | `src/ui/components/graph/nodes/` |
| Tool renderers | `src/ui/renderers/registry.ts` |
| Parser | `src/parser/claude-code.ts` |
| Chunker | `src/core/chunker.ts` |
| Types | `src/types/blocks.ts`, `src/types/chunks.ts` |
| App shell | `src/ui/App.tsx` |

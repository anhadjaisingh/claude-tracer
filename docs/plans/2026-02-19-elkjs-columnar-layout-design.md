# Design: ELKjs Columnar Graph Layout

## Problem

The current graph layout uses dagre, which places nodes based on graph topology
without any awareness of block-type columns. This produces layouts where user
messages, agent responses, and tool calls are interleaved horizontally with no
visual structure. The `fitView` prop also centers the viewport on the middle of
the graph instead of starting at the top.

## Solution

Replace dagre with elkjs using its `partitioning` feature to assign nodes to
fixed columns based on block type. This gives a columnar layout where horizontal
position encodes nesting depth and vertical position encodes time.

## Layout Engine: dagre → elkjs

### ELK Configuration

```
algorithm: layered
direction: DOWN
partitioning.activate: true
```

### Column Assignment

Each block type maps to a fixed partition number. Lower partition IDs appear on
the left.

| Block type       | Partition | Position  |
| ---------------- | --------- | --------- |
| Tool / MCP       | 0         | Leftmost  |
| Teammate message | 1         |           |
| Agent response   | 2         |           |
| Meta/system      | 3         |           |
| User message     | 4         | Rightmost |

The horizontal span between leftmost and rightmost active nodes visually
indicates operation complexity — narrow means simple back-and-forth, wide means
deep tool use or multi-agent work.

Partition numbers are fixed for now. If finer depth distinction is needed later
(e.g., sub-agent tools at partition -1), the mapping can be extended.

### Async Layout

elkjs returns a Promise. The current synchronous `useMemo` layout pattern
changes to `useEffect` + `useState`:

1. `useMemo` builds the raw nodes and edges from blocks (synchronous).
2. `useEffect` calls `elk.layout()` and sets positioned nodes/edges on resolve.
3. React Flow renders once positions are available.

## Edges

All edges use a single neutral color:

- Black on light/claude themes.
- Gray on dark theme.

No per-type edge coloring or animation. Node colors already encode block type.
Edge type remains `smoothstep` for clean right-angle routing.

The `getEdgeStyle()` function in `buildGraph.ts` is removed. Edge construction
logic (toolCalls, parentId, sequential flow) stays the same.

## Initial Viewport

Replace `fitView` with explicit viewport positioning:

- After layout completes, find the first node (topmost user message).
- Use `useReactFlow().setViewport()` to position the camera so that node is
  visible near the top-right of the screen.
- Default zoom: 1.0.

## Theme Changes

Add `edgeColor` to the theme type:

| Theme  | edgeColor |
| ------ | --------- |
| Claude | `#000000` |
| Light  | `#000000` |
| Dark   | `#9ca3af` |

## Files Changed

| File                                    | Change                                                      |
| --------------------------------------- | ----------------------------------------------------------- |
| `package.json`                          | Add `elkjs`, remove `dagre`                                 |
| `src/ui/components/graph/layout.ts`     | Rewrite: dagre → elkjs with partitioning                    |
| `src/ui/components/graph/buildGraph.ts` | Remove `getEdgeStyle()`, uniform edge color, add partitions |
| `src/ui/components/graph/GraphView.tsx` | Async layout, replace `fitView` with `setViewport`          |
| `src/ui/themes/types.ts`               | Add `edgeColor`                                             |
| `src/ui/themes/claude.ts`              | Add `edgeColor: '#000000'`                                  |
| `src/ui/themes/dark.ts`                | Add `edgeColor: '#9ca3af'`                                  |
| `src/ui/themes/light.ts`               | Add `edgeColor: '#000000'`                                  |

No new files. No changes to parser, server, types, or core.

## Testing

### Unit Tests (vitest)

**`layout.test.ts`** — test the elkjs layout function directly:

- Partition assignment: given nodes with block types, verify correct partition
  numbers are assigned (user → 4, agent → 2, tool → 0, etc.).
- Column ordering: given a user→agent→tool graph, verify output x-positions
  reflect column order (tool.x < agent.x < user.x).
- Parallel tool calls: verify they share the same partition but get distinct
  positions.
- Validity: returned positions are valid numbers (no NaN, no negative dims).

**`buildGraph.test.ts`** — test graph construction:

- Correct node types assigned from blocks.
- Edges created for toolCalls, parentId, and sequential flow.
- All edges have uniform style (no per-type colors).

### E2E Tests (Playwright)

**Viewport test:** Load a session, verify the first node is visible within the
viewport bounds (not scrolled to middle).

**Column ordering test:** Load a session with user + agent + tool blocks. Query
rendered node positions and assert user.x > agent.x > tool.x.

**Edge color test:** Verify all rendered edge SVG paths use the same stroke
color.

---

_Last updated: 2026-02-19_

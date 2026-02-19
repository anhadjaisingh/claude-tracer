# UI & UX Requirements

Authoritative source of truth for how claude-tracer should look, feel, and behave.
Any agent making UI changes **must** read this file first and ensure their changes
conform to these requirements. If a change conflicts with a requirement, surface
the conflict to the TL or human for resolution — do not silently break a requirement.

## Layout

### Initial View

- The graph must start at the **top** of the conversation, showing the first
  user message. The viewport should be positioned so the first node is visible
  near the top-left of the screen on load.
- The sidebar should be visible by default at its stored width (or 256px default).

### Graph Layout — Columnar Nesting-Depth Model

The graph uses a **columnar layout** where horizontal position encodes nesting
depth and vertical position encodes time.

#### Columns

- **Rightmost column (depth 0):** User messages. Always the rightmost nodes.
- **Next column left (depth 1):** Main agent responses.
- **Further left (depth 2+):** Tool calls, MCP calls, teammate/sub-agent messages.
  Each additional level of nesting moves one column to the left.

The horizontal span between the rightmost and leftmost active nodes is a visual
indicator of how nested/parallel the current operation is. A narrow graph means
simple back-and-forth; a wide graph means deep tool use or multi-agent work.

#### Vertical Flow

- Time flows **top to bottom**.
- Sequential blocks within the same column stack vertically.
- Parallel operations (multiple tool calls, concurrent teammate work) fan out
  horizontally within their depth column, stacking side-by-side.

#### Edges and Arrows

- **Right → left** arrows represent spawning work (user → agent, agent → tool,
  agent → teammate).
- **Left → right** arrows represent returning results (tool → agent, teammate →
  agent).
- Every parent block must have an edge to each of its children — the user should
  be able to follow the full conversation lifecycle by following arrows.
- Edge style encodes relationship type (see Edge Styles below).

#### Edge Styles

- All edges are **black** (or white in dark theme) — a single neutral color.
- Node colors already encode block type; edge color should not compete.
- Animated edges may be used sparingly for in-progress operations (future).

### Navigation

- Scroll/pan to navigate the graph. Zoom in/out with mouse wheel or pinch.
- Sidebar chunk list: clicking a chunk scrolls/pans the graph to that section.
- Search results: navigating between results pans to the matched block.

## Blocks

### Block Types and Visual Hierarchy

| Block Type       | Column (depth) | Style                                   |
| ---------------- | -------------- | --------------------------------------- |
| User message     | 0 (rightmost)  | Light/white bubble, right-justified     |
| Meta/system      | 0 (rightmost)  | Compact pill/tag, collapsed by default  |
| Agent response   | 1              | Dark bubble, left-justified             |
| Tool call        | 2+             | Compact, monospace, dark terminal style |
| MCP call         | 2+             | Same as tool call                       |
| Teammate message | 2+             | Distinct accent color (purple/indigo)   |

### Block Interactions

- **Click** a block to open the overlay modal with full content.
- **Hover** should provide a subtle highlight or shadow.
- Blocks should show a concise preview by default, not full content.

## Overlay Modal

- Opens as a centered modal overlay with backdrop blur.
- Shows the full content of the clicked block.
- Close with Escape key, clicking backdrop, or close button.
- No navigation between blocks in the overlay (single block view).

## Sidebar

- Resizable by dragging the left edge.
- Shows chunk/turn list for the session.
- Clicking a chunk navigates the main view to that section.
- Each chunk should have a visible border/separator.

## Search

- Search bar in the header with result count and prev/next navigation.
- Mode toggle: Keyword (instant, local) vs Smart (hybrid keyword+vector, server-side).
- Navigating search results pans the graph to the matched block.

## Granularity Control (Future)

- A granularity slider or level selector controls how much detail the graph shows.
- At the highest level, nodes are **semantic sub-graphs** — named groups of blocks
  that represent a logical unit of work (e.g., a TODO item, a PR, a Claude task).
- Drilling into a sub-graph expands it to show the individual blocks within.
- This enables navigating very long sessions: first find the high-level work item,
  then drill down to the specific messages and tool calls.
- The sidebar chunk/turn list should reflect the current granularity level.
- **Not yet implemented.** The current UI shows all blocks at full detail. This
  section captures the intended direction for future development.

## Responsive Behavior

- The tool is designed for desktop use (1280px+ width).
- No mobile layout required.
- Minimum usable width: ~900px (sidebar can be collapsed).

## Performance

- The UI should remain responsive with sessions up to 10K blocks.
- Initial render should complete within 2 seconds for a 1K-block session.
- Search results should appear within 100ms for keyword mode.

## Theme

- Three themes: Claude (default terracotta), Dark, Light.
- Theme selection persists in localStorage.
- All block colors, backgrounds, and text must respect the active theme.

---

_Last updated: 2026-02-19_

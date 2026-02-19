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

### Graph Layout

- The conversation flows **top to bottom** as a DAG.
- Sequential blocks (user → agent → tool → agent) flow vertically.
- Parallel operations (multiple tool calls, teammate messages) fan out horizontally.
- Edges connect every parent block to its children — the user should be able to
  follow the full conversation flow by following arrows.

### Navigation

- Scroll/pan to navigate the graph. Zoom in/out with mouse wheel or pinch.
- Sidebar chunk list: clicking a chunk scrolls/pans the graph to that section.
- Search results: navigating between results pans to the matched block.

## Blocks

### Block Types and Visual Hierarchy

| Block Type       | Position             | Style                                   |
| ---------------- | -------------------- | --------------------------------------- |
| User message     | Right-aligned column | Light/white bubble, right-justified     |
| Agent response   | Left-aligned column  | Dark bubble, left-justified             |
| Tool call        | Indented under agent | Compact, monospace, dark terminal style |
| MCP call         | Indented under agent | Same as tool call                       |
| Meta/system      | Centered or right    | Compact pill/tag, collapsed by default  |
| Teammate message | Left-aligned         | Distinct accent color (purple/indigo)   |

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

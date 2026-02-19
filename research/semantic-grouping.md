# Semantic Chunking and Grouping of Conversation Nodes

Research on approaches for automatically (and manually) grouping blocks in claude-tracer into collapsible, navigable sub-graphs representing logical units of work.

**Date:** 2026-02-19
**Status:** Research complete, ready for design decisions

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Heuristic-Based Grouping](#1-heuristic-based-grouping)
3. [Existing Approaches in Other Tools](#2-existing-approaches-in-other-tools)
4. [React Flow Sub-Graph Implementation](#3-react-flow-sub-graph-implementation)
5. [LLM-Assisted Grouping](#4-llm-assisted-grouping)
6. [Manual Grouping](#5-manual-grouping)
7. [Recommended Phased Approach](#6-recommended-phased-approach)

---

## Problem Statement

Claude Code sessions can contain thousands of blocks (user messages, agent responses,
tool calls, MCP calls, teammate messages). The current UI renders every block as an
individual node in a DAG. For long sessions this is overwhelming -- users need to
first see high-level "work items" (e.g., "implementing auth feature", "fixing CI",
"creating PR #12") and then drill into the constituent messages.

**Current state:** The `Chunker` class in `src/core/chunker.ts` already implements
turn-level chunking (each user message starts a new turn-chunk that includes the
subsequent agent response and tool calls). The `Chunk` type in `src/types/chunks.ts`
supports a three-level hierarchy: `theme > task > turn`. Only `turn` is implemented
today. We need the `task` and `theme` levels.

**Goal:** Automatically detect logical work boundaries and render them as collapsible
sub-graphs in the React Flow visualization.

---

## 1. Heuristic-Based Grouping

These approaches detect group boundaries using only the data already present in the
JSONL session file -- no external models or API calls required. They run in-process
at parse time and produce deterministic, reproducible results.

### 1.1 Time-Gap Boundaries

**Signal:** A long pause between consecutive blocks indicates the user stepped away
and may be starting a new task when they return.

**How it works:**

```
for each consecutive pair of blocks (A, B):
  gap = B.timestamp - A.timestamp
  if gap > THRESHOLD:
    start new group at B
```

**Threshold selection:**

- Under 30 seconds: likely still the same thought (reading output, thinking)
- 30 seconds to 2 minutes: borderline -- user may be reviewing
- 2 to 5 minutes: probable topic switch
- Over 5 minutes: strong signal of a new work unit
- Over 30 minutes: almost certainly a new session conceptually

A reasonable default is 3-5 minutes, with a user-configurable slider.

**Pros:**

- Trivially simple to implement
- Works for all session types regardless of content
- Zero false positives for very long gaps (>30 min)

**Cons:**

- Short tasks that happen rapidly will be merged together
- A user who pauses to read docs mid-task will trigger a false boundary
- Does not capture _what_ the group is about -- only _when_ it started

**Recommendation:** Use as a supplementary signal combined with other heuristics,
not as the sole grouping mechanism. Weight: medium.

### 1.2 User Message Patterns

**Signal:** The content of user messages often explicitly signals a new task.

**Patterns to detect:**

| Pattern                            | Signal Strength | Example                               |
| ---------------------------------- | --------------- | ------------------------------------- |
| Imperative opener                  | Strong          | "Now let's...", "Next:", "Move on to" |
| Question after long agent output   | Medium          | "Can you also...", "What about..."    |
| Slash commands / skill invocations | Strong          | `/commit`, `/review-pr`, `/init`      |
| Pasted error / stack trace         | Medium          | Lines starting with `Error:`, `at `   |
| File path mention (new context)    | Weak            | "Look at src/auth/..."                |
| Explicit task statement            | Strong          | "Task: ...", "TODO: ..."              |
| "Let's" / "Let me" starters        | Medium          | "Let's fix the tests"                 |

**Implementation sketch:**

```typescript
const NEW_TASK_PATTERNS = [
  /^(now\s+)?let['']?s\s/i,
  /^next[,:]\s/i,
  /^move\s+on\s+to\s/i,
  /^task[:\s]/i,
  /^todo[:\s]/i,
  /^can\s+you\s+(also|now)\s/i,
  /^<command-name>/, // slash commands in JSONL
];

function isNewTaskSignal(content: string): boolean {
  return NEW_TASK_PATTERNS.some((p) => p.test(content.trim()));
}
```

**Pros:**

- Captures the user's intent directly
- No latency or external dependencies
- Slash commands are particularly reliable boundaries

**Cons:**

- Fragile -- depends on user writing style
- Many users just type instructions without preamble
- Regex patterns need ongoing tuning

**Recommendation:** Use as a strong supplementary signal. Slash commands and
explicit task statements are the most reliable subset. Weight: medium-high.

### 1.3 Tool-Call Patterns as Boundaries

**Signal:** Certain tool calls represent natural boundaries in a workflow.

**End-of-work-unit signals:**

| Tool / Action                     | Boundary Type   | Rationale                            |
| --------------------------------- | --------------- | ------------------------------------ |
| `Bash` with `git commit`          | End of unit     | Code committed = milestone           |
| `Bash` with `git push`            | End of unit     | Work published                       |
| `Bash` with `gh pr create`        | End of unit     | PR created = deliverable complete    |
| `Bash` with `git checkout -b`     | Start of unit   | New branch = new feature             |
| `Bash` with `npm test` / `pytest` | End of sub-unit | Validation checkpoint                |
| `TodoWrite`                       | Boundary        | Explicit task management             |
| `Skill` (any)                     | Start of unit   | Skill invocation = structured action |
| `Task` (sub-agent spawn)          | Sub-graph       | Parallel work unit                   |

**Implementation sketch:**

```typescript
function detectToolBoundary(block: ToolBlock): 'start' | 'end' | 'subgraph' | null {
  if (block.toolName === 'Bash') {
    const cmd = String(block.input?.command ?? '');
    if (/git\s+commit/.test(cmd)) return 'end';
    if (/git\s+push/.test(cmd)) return 'end';
    if (/gh\s+pr\s+create/.test(cmd)) return 'end';
    if (/git\s+checkout\s+-b/.test(cmd)) return 'start';
    if (/npm\s+test|pytest|vitest/.test(cmd)) return 'end';
  }
  if (block.toolName === 'TodoWrite') return 'end';
  if (block.toolName === 'Task') return 'subgraph';
  return null;
}
```

**Pros:**

- Very high signal-to-noise ratio -- git commits really are milestones
- Deterministic and content-agnostic
- Sub-agent spawning maps perfectly to sub-graph boundaries

**Cons:**

- Only works when the agent uses these tools (not all sessions involve git)
- Misses non-tool-mediated task switches
- Over-segments if there are many small commits

**Recommendation:** Use as a high-confidence signal. Git commit/push and PR creation
are the strongest indicators. Task tool spawning should always create a sub-graph.
Weight: high.

### 1.4 Todo/Task Tool as Explicit Boundaries

**Signal:** The JSONL format includes a `todos` field on user entries that captures
the snapshot of the todo list at that moment. Changes to the todo list represent
explicit task transitions.

```json
{
  "type": "user",
  "todos": [
    { "content": "Implement auth", "status": "completed" },
    { "content": "Write tests", "status": "in_progress", "activeForm": "Working on test suite" }
  ]
}
```

**How it works:**

- Compare `todos` snapshots between consecutive user entries
- When a todo transitions from `in_progress` to `completed`, that is a boundary
- When a new todo appears as `in_progress`, that starts a new group
- The `content` field of the active todo becomes the group label

**Implementation sketch:**

```typescript
function detectTodoBoundary(
  prevTodos: Todo[] | undefined,
  currTodos: Todo[] | undefined,
): { boundary: boolean; label?: string } {
  if (!prevTodos || !currTodos) return { boundary: false };

  const prevActive = prevTodos.find((t) => t.status === 'in_progress');
  const currActive = currTodos.find((t) => t.status === 'in_progress');

  if (prevActive?.content !== currActive?.content) {
    return {
      boundary: true,
      label: currActive?.content ?? currActive?.activeForm,
    };
  }
  return { boundary: false };
}
```

**Pros:**

- Highest-confidence signal available -- the agent explicitly manages tasks
- Provides natural group labels from the todo content
- Captures the agent's own understanding of work boundaries

**Cons:**

- Not all sessions use todos (many simple sessions skip TodoWrite entirely)
- Parser currently discards the `todos` field -- need to extract it
- Todo snapshots are only on user entries, not on every block

**Recommendation:** When present, this should be the primary grouping signal. It is
the closest thing to ground truth for "what task is the agent working on." Weight:
very high (when available).

### 1.5 Branch Switching and PR Lifecycle

**Signal:** Git branch names and PR operations provide natural work-unit labels.

The JSONL format includes `gitBranch` on every entry. When this field changes, the
user or agent has switched contexts.

```typescript
function detectBranchSwitch(prevBranch: string, currBranch: string): boolean {
  return prevBranch !== currBranch && currBranch !== 'main' && currBranch !== 'master';
}
```

**Pros:**

- Branch names are excellent group labels ("feature/auth", "fix/ci-pipeline")
- Branch switches are unambiguous boundaries
- Data is already in every JSONL entry

**Cons:**

- Some workflows stay on a single branch
- Quick branch checkout for investigation may create noise

**Recommendation:** Strong boundary signal. The branch name can serve as the group
label. Weight: high.

### 1.6 Composite Heuristic Scoring

Rather than relying on any single signal, combine them with weighted scores:

```typescript
interface BoundaryScore {
  timeGap: number; // 0-1 normalized
  userPattern: number; // 0 or 1
  toolBoundary: number; // 0 or 1
  todoChange: number; // 0 or 1
  branchSwitch: number; // 0 or 1
}

function computeBoundaryScore(score: BoundaryScore): number {
  return (
    score.timeGap * 0.15 +
    score.userPattern * 0.15 +
    score.toolBoundary * 0.25 +
    score.todoChange * 0.3 +
    score.branchSwitch * 0.15
  );
}

const BOUNDARY_THRESHOLD = 0.3;
```

Groups are split at any point where the composite score exceeds the threshold.
Individual high-confidence signals (todo change, git commit) can independently
trigger a split even if other signals are absent.

**Label generation priority:**

1. Active todo content (if available)
2. Git branch name (if changed)
3. First user message content (truncated)
4. "Group N" fallback

---

## 2. Existing Approaches in Other Tools

### 2.1 Observability Tools (Jaeger, Honeycomb, Zipkin)

Distributed tracing tools face a very similar problem: a single request can generate
hundreds or thousands of spans across services, and users need to navigate this
hierarchy efficiently.

**Key patterns:**

| Pattern                    | Description                                      | Applicable?   |
| -------------------------- | ------------------------------------------------ | ------------- |
| Waterfall/timeline view    | Spans as horizontal bars, time on x-axis         | Partially     |
| Collapsible span trees     | Click to expand/collapse child spans             | Yes, directly |
| Service grouping           | Spans grouped by service name                    | Analogous     |
| Depth-based collapsing     | Collapse all spans at depth > N                  | Yes           |
| Critical path highlighting | Bold the slowest path through the trace          | Future        |
| Mini-map navigation        | Gantt chart overview for navigating large traces | Already have  |

**Honeycomb's approach is particularly relevant:**

- Collapse a span and all children with left-arrow key
- Expand with right-arrow key
- "Collapse all at this level" for bulk operations
- "Zoom into subtree" to re-root the view at a specific span
- Dependent count badges show how many children are hidden

**What to adopt:**

- Collapse/expand interaction model (click or keyboard)
- Badge showing count of hidden children
- "Zoom into" to focus on a sub-graph
- Keyboard navigation (arrow keys to expand/collapse/navigate)

### 2.2 Chat UIs and Conversation Threading

Long conversation interfaces (Slack, Discord, Google Chat) use threading to keep
related messages together:

- **Threads:** Replies are nested under a parent message, collapsible
- **Channels/Topics:** Messages pre-sorted into named categories
- **Message groups:** Consecutive messages from the same sender grouped visually

**Applicable patterns:**

- Visual grouping of consecutive blocks from the same "phase" (user typing, agent
  working, tool execution) -- already partly done with turn-level chunks
- Collapsible thread-like views for tool call sequences
- "N more messages" summary when collapsed, similar to Slack's "N replies"

**What to adopt:**

- "N blocks" badge on collapsed groups
- Summary line when collapsed (first user message + outcome)

### 2.3 Code Review Tools (Graphite, Stacked Diffs)

Graphite and similar tools decompose large changes into a stack of small, logical
PRs. Each PR in the stack represents one coherent unit of work.

**Applicable insight:** The same principle applies to session visualization. A long
session is like a large diff -- it should be decomposed into "stacked" logical units
where each unit is:

- Self-contained (has a clear start and end)
- Labeled with its purpose
- Reviewable independently
- Connected to the units before/after it

**What to adopt:**

- The mental model of "stacked work units" maps perfectly to our task-level chunks
- Stack visualization (vertical list of groups with dependency arrows)
- Each group shows: label, block count, duration, status (in-progress/completed)

### 2.4 Graph Visualization with Collapsible Sub-Graphs

**Cytoscape.js** has first-class support for compound (parent-child) nodes:

- `cytoscape-expand-collapse` extension provides expand/collapse for compound nodes
- Nodes specify `parent` in their data to become children
- Collapsed nodes show a summary badge
- Supports animated transitions between states

**D3 Force Layouts:**

- No built-in compound node support
- Can be simulated with custom force functions that cluster related nodes
- Hull/convex-hull rendering to visually group nodes without nesting

**React Flow** (our current library) -- detailed in next section.

---

## 3. React Flow Sub-Graph Implementation

React Flow v12 (which we already use at `^12.10.0`) supports grouping through
several mechanisms. This section covers the APIs, patterns, and performance
characteristics relevant to our use case.

### 3.1 Parent-Child Grouping (`parentId`)

React Flow's primary grouping mechanism is the `parentId` property on nodes.

```typescript
const nodes: Node[] = [
  // Parent group node
  {
    id: 'group-1',
    type: 'group', // Built-in type: no handles, acts as container
    data: { label: 'Implementing auth feature' },
    position: { x: 0, y: 0 },
    style: {
      width: 400,
      height: 600,
      backgroundColor: 'rgba(59, 130, 246, 0.05)',
      borderRadius: 8,
      border: '1px solid rgba(59, 130, 246, 0.2)',
    },
  },
  // Child nodes -- positioned relative to parent
  {
    id: 'block-1',
    type: 'user',
    data: { block: userBlock },
    position: { x: 40, y: 50 }, // Relative to parent's top-left
    parentId: 'group-1', // <-- This makes it a child
    extent: 'parent', // Constrain drag to within parent
  },
  {
    id: 'block-2',
    type: 'agent',
    data: { block: agentBlock },
    position: { x: 40, y: 180 },
    parentId: 'group-1',
    extent: 'parent',
  },
];
```

**Key behaviors:**

- Child nodes are positioned relative to their parent (0,0 = parent's top-left)
- Moving the parent moves all children
- `extent: 'parent'` prevents children from being dragged outside
- Parent must appear before children in the nodes array
- Parent needs explicit `width` and `height` (not auto-calculated)

### 3.2 LabeledGroupNode Component

React Flow provides a `LabeledGroupNode` component (from `@xyflow/react`) for
labeled container nodes:

```typescript
import { LabeledGroupNode } from '@xyflow/react';

const nodeTypes = {
  labeledGroup: LabeledGroupNode,
  user: UserNode,
  agent: AgentNode,
  tool: ToolNode,
};

// Usage:
{
  id: 'group-1',
  type: 'labeledGroup',
  data: {
    label: 'Implementing auth feature',
    // Optional: custom styling
  },
  position: { x: 0, y: 0 },
  style: { width: 400, height: 600 },
}
```

For our use case, we will likely want a **custom group node** that shows:

- Group label (from todo content, branch name, or first user message)
- Block count badge
- Token count summary
- Duration
- Expand/collapse toggle button

### 3.3 Expand/Collapse Implementation

React Flow does not have built-in expand/collapse, but it provides the primitives
to implement it. The official example uses the `hidden` property on nodes and edges.

**Approach: Toggle `hidden` on child nodes**

```typescript
interface GroupState {
  [groupId: string]: boolean; // true = expanded
}

function toggleGroup(
  groupId: string,
  groupState: GroupState,
  allNodes: Node[],
  allEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const isExpanding = !groupState[groupId];

  // Find all child node IDs for this group
  const childIds = new Set(allNodes.filter((n) => n.parentId === groupId).map((n) => n.id));

  const updatedNodes = allNodes.map((node) => {
    if (childIds.has(node.id)) {
      return { ...node, hidden: !isExpanding };
    }
    if (node.id === groupId) {
      // Resize the group node when collapsing
      return {
        ...node,
        style: {
          ...node.style,
          width: isExpanding ? node.data.expandedWidth : 320,
          height: isExpanding ? node.data.expandedHeight : 80,
        },
        data: {
          ...node.data,
          collapsed: !isExpanding,
        },
      };
    }
    return node;
  });

  // Hide edges connected to hidden nodes
  const updatedEdges = allEdges.map((edge) => {
    const sourceHidden = childIds.has(edge.source) && !isExpanding;
    const targetHidden = childIds.has(edge.target) && !isExpanding;
    return {
      ...edge,
      hidden: sourceHidden || targetHidden,
    };
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}
```

**Collapsed group node rendering:**

When collapsed, the group node should render as a single compact node showing:

- Label
- "12 blocks" count
- Summary of first/last action
- Click to expand

When expanded, it renders as a container with all child nodes visible inside.

### 3.4 Layout with ELK.js (Recommended Over Dagre for Sub-Graphs)

**Critical finding: dagre does not support sub-flows / compound nodes.** Our current
layout uses dagre, which treats all nodes as flat. To support hierarchical grouping,
we should migrate to ELK.js which has native support for compound nodes.

**ELK.js hierarchical layout:**

```typescript
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// ELK expects a nested structure (unlike dagre's flat structure)
async function layoutWithGroups(
  groups: GroupData[],
  blocks: AnyBlock[],
  edges: Edge[],
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
    children: groups.map((group) => ({
      id: group.id,
      // ELK compound node -- contains children
      layoutOptions: {
        'elk.padding': '[top=40,left=12,bottom=12,right=12]',
      },
      children: group.blockIds.map((blockId) => ({
        id: blockId,
        width: 320,
        height: estimateBlockHeight(blockId),
      })),
      edges: edges
        .filter((e) => group.blockIds.includes(e.source) && group.blockIds.includes(e.target))
        .map((e) => ({
          id: e.id,
          sources: [e.source],
          targets: [e.target],
        })),
    })),
    edges: edges
      .filter((e) => !sameGroup(e.source, e.target, groups))
      .map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
  };

  const layouted = await elk.layout(elkGraph);

  // Convert ELK positions back to React Flow nodes
  const rfNodes: Node[] = [];

  for (const elkGroup of layouted.children ?? []) {
    // Group container node
    rfNodes.push({
      id: elkGroup.id,
      type: 'taskGroup',
      position: { x: elkGroup.x ?? 0, y: elkGroup.y ?? 0 },
      style: { width: elkGroup.width, height: elkGroup.height },
      data: { label: groups.find((g) => g.id === elkGroup.id)?.label },
    });

    // Child nodes (positioned relative to parent)
    for (const elkChild of elkGroup.children ?? []) {
      rfNodes.push({
        id: elkChild.id,
        type: getNodeType(elkChild.id),
        position: { x: elkChild.x ?? 0, y: elkChild.y ?? 0 },
        parentId: elkGroup.id,
        extent: 'parent',
        data: { block: getBlock(elkChild.id) },
      });
    }
  }

  return { nodes: rfNodes, edges };
}
```

**ELK.js vs dagre comparison:**

| Feature                  | dagre       | ELK.js                    |
| ------------------------ | ----------- | ------------------------- |
| Compound/nested nodes    | No          | Yes (native)              |
| Layout algorithms        | 1 (layered) | 10+ (layered, force, etc) |
| Configuration options    | Minimal     | Extensive                 |
| Bundle size              | ~30KB       | ~140KB (bundled)          |
| Async layout             | No          | Yes (Web Worker support)  |
| Layout speed (1K nodes)  | ~50ms       | ~100ms                    |
| Layout speed (10K nodes) | ~500ms      | ~1-2s                     |

**Migration path:** We can keep dagre as the default for flat views and use ELK.js
only when grouping is enabled, lazy-loading the ELK.js bundle.

### 3.5 Performance Considerations

**React Flow with many nodes:**

React Flow uses viewport-based rendering (only nodes in view are rendered to the
DOM). This provides good performance even with thousands of nodes. Key settings:

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  onlyRenderVisibleElements // Enable virtualization
  // ...
/>
```

**Performance with grouping:**

| Scenario                         | Nodes in DOM | Layout Time | Interactive? |
| -------------------------------- | ------------ | ----------- | ------------ |
| 100 blocks, no grouping          | ~100         | <50ms       | Smooth       |
| 1K blocks, no grouping           | ~200\*       | ~200ms      | Smooth       |
| 1K blocks, grouped (20 groups)   | ~40\*        | ~150ms      | Smooth       |
| 10K blocks, no grouping          | ~300\*       | ~2s         | Acceptable   |
| 10K blocks, grouped (100 groups) | ~100\*       | ~500ms      | Smooth       |

\*With virtualization, only visible nodes are rendered.

**Key insight:** Grouping actually _improves_ performance because collapsed groups
reduce the total node count. A session with 10K blocks collapsed into 100 groups
renders only ~100 nodes initially.

**Optimization strategies:**

1. Start collapsed -- render all groups collapsed, expand on click
2. Use `React.memo` on custom group and block node components
3. Memoize `style` objects and `data` props to prevent unnecessary re-renders
4. Use ELK.js in a Web Worker to prevent layout from blocking the main thread
5. Debounce layout recalculation when expanding/collapsing multiple groups

### 3.6 Two-Level View Architecture

To support the granularity control described in `docs/ui-requirements.md`, implement
two rendering modes that share the same data model:

**Overview Mode (default for large sessions):**

- Render one node per group (task-level chunk)
- Edges between groups based on sequential order
- Click a group to enter Detail Mode for that group

**Detail Mode (default for small sessions, or after drill-down):**

- Render all blocks within a single group (or all blocks if ungrouped)
- Full DAG visualization with tool call edges
- "Back to overview" button to return

This avoids the complexity of nested React Flow sub-graphs and instead uses a
simple view-switching mechanism. The sidebar always shows the group list and
highlights which group is currently in detail view.

---

## 4. LLM-Assisted Grouping

### 4.1 Group Label Generation

Once heuristic boundaries are established, an LLM can generate meaningful labels
for each group by reading the first few blocks.

**Prompt template:**

```
You are labeling sections of a coding session transcript.

Here are the first few messages in this section:
- User: "Let's implement JWT authentication for the API"
- Agent: [Read src/auth/middleware.ts] [Read src/routes/login.ts]
- Agent: "I'll create the auth middleware with token validation..."
- Tool: [Write src/auth/jwt.ts]

Generate a short label (3-8 words) that describes what work is being done.
Return only the label, no explanation.

Label:
```

**Expected output:** `"Implement JWT authentication middleware"`

**Implementation options:**

| Option           | Latency         | Quality   | Dependency             |
| ---------------- | --------------- | --------- | ---------------------- |
| Claude API       | 200-500ms/group | Excellent | API key, network       |
| Ollama (local)   | 500ms-2s/group  | Good      | Ollama running locally |
| Transformers.js  | 2-5s/group      | Medium    | Large model download   |
| Pattern matching | <1ms/group      | Fair      | None                   |

**Recommended approach:** Generate labels asynchronously after initial render.
Show heuristic labels immediately (from todo content or first user message), then
replace them with LLM-generated labels as they become available.

```typescript
async function generateGroupLabels(
  groups: Chunk[],
  blocks: AnyBlock[]
): AsyncGenerator<{ groupId: string; label: string }> {
  for (const group of groups) {
    const groupBlocks = blocks.filter(b => group.blockIds.includes(b.id));
    const summary = summarizeBlocks(groupBlocks.slice(0, 5));

    const response = await fetch('/api/label', {
      method: 'POST',
      body: JSON.stringify({ summary }),
    });

    const { label } = await response.json();
    yield { groupId: group.id, label };
  }
}
```

### 4.2 Boundary Detection with LLM

For higher-quality boundary detection, an LLM can review the full session and
identify logical task transitions.

**Prompt template:**

```
Analyze this coding session transcript and identify the distinct tasks or work items.
For each task, specify the starting block index and a short label.

Blocks:
[0] User: "Hello, let's work on the auth system"
[1] Agent: [Read src/auth.ts] "I'll start by reviewing..."
[2] Tool: [Read src/auth.ts] -> 45 lines
...
[45] User: "Great, now let's fix the CI pipeline"
[46] Agent: [Read .github/workflows/ci.yml] ...

Return JSON: { "tasks": [{ "startIndex": 0, "label": "..." }, ...] }
```

**Latency concern:** For a 1000-block session, the prompt alone would be ~50K tokens.
This is feasible with Claude (200K context) but expensive and slow (5-15 seconds).

**Mitigation strategies:**

1. Summarize blocks before sending (tool name + first line only)
2. Use vector search to identify candidate boundaries, then have the LLM confirm
3. Process in chunks of 100 blocks with sliding window overlap
4. Cache results -- session content is immutable once written

### 4.3 UX for LLM-Assisted Features

**Progressive enhancement model:**

```
Initial load (0ms):       Heuristic groups with basic labels
                          ↓
Background (1-5s):        LLM generates improved labels
                          ↓
On-demand (user action):  "Re-analyze grouping" button triggers
                          full LLM boundary detection
```

**UI indicators:**

- Shimmer/skeleton on group labels while LLM is generating
- "AI-generated" badge on LLM labels (distinguishable from heuristic labels)
- "Improve labels" button in settings or toolbar
- Loading spinner on individual groups being re-analyzed

**Latency management:**

- All LLM calls are non-blocking -- UI is usable immediately with heuristic groups
- Labels stream in as they are generated (one group at a time)
- Results cached in localStorage keyed by session file hash
- If Ollama/API is unavailable, gracefully fall back to heuristic labels

---

## 5. Manual Grouping

### 5.1 User-Created Groups

Users should be able to override automatic grouping by manually creating groups.

**Interaction model:**

1. **Select blocks:** Shift+click or drag-select multiple blocks
2. **Group action:** Right-click context menu > "Group selected blocks" or toolbar button
3. **Name the group:** Inline text input on the new group node
4. **Persist:** Save to a `.claude-tracer-groups.json` sidecar file

### 5.2 Drag Blocks Between Groups

React Flow supports dynamic parent-child relationships. Users could drag a block
from one group to another:

```typescript
// On node drag stop, check if it's over a different group
const onNodeDragStop: NodeMouseHandler = useCallback(
  (_event, node) => {
    if (!node.parentId) return;

    // Find which group node the dragged node is now over
    const groupNodes = nodes.filter((n) => n.type === 'taskGroup');
    const targetGroup = groupNodes.find((g) => isOverlapping(node.position, g.position, g.style));

    if (targetGroup && targetGroup.id !== node.parentId) {
      // Move node to new group
      setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, parentId: targetGroup.id } : n)),
      );
    }
  },
  [nodes, setNodes],
);
```

**Pros:**

- Gives users full control over grouping
- Handles edge cases that heuristics miss
- Familiar interaction pattern (drag-and-drop)

**Cons:**

- Significant implementation effort
- Need to persist manual overrides
- Re-layout required on every group change
- Complex interaction when combined with auto-grouping

### 5.3 Split and Merge Groups

Additional manual operations:

- **Split:** Click a block within a group > "Split group here" -- divides the group
  at that block into two groups
- **Merge:** Select two adjacent groups > "Merge groups"
- **Dissolve:** Select a group > "Ungroup" -- removes the group, blocks become
  top-level

### 5.4 Persistence Format

```json
{
  "version": 1,
  "sessionFile": "abc123.jsonl",
  "sessionHash": "sha256:...",
  "manualGroups": [
    {
      "id": "manual-group-1",
      "label": "Auth implementation",
      "blockIds": ["block-5", "block-6", "block-7", "block-8"],
      "color": "#3b82f6"
    }
  ],
  "overrides": {
    "block-12": { "groupId": "manual-group-1" },
    "block-15": { "groupId": null }
  }
}
```

Manual groups take priority over automatic groups. The `overrides` map handles
individual block reassignments.

---

## 6. Recommended Phased Approach

### Phase 1: Heuristic Grouping + Simple Collapse (3-5 days)

**What to build:**

- Extend `Chunker` to produce task-level chunks using the composite heuristic
  scoring system (Section 1.6)
- Extract `todos` field from JSONL parser for todo-based boundaries
- Detect git commit/push/PR creation tool calls as boundaries
- Detect branch switches via `gitBranch` field changes
- Detect time gaps > 3 minutes as supplementary signal
- Implement "Overview Mode" in the graph view -- one node per task-chunk
- Click a task node to expand and show all blocks within (Detail Mode)
- Sidebar shows task-chunk list instead of turn-level list

**What NOT to build yet:**

- ELK.js layout (keep dagre for now, render overview as flat graph)
- Nested sub-graphs (use view-switching instead)
- Manual grouping
- LLM labels

**Dependencies:** None new. Uses existing parser, chunker, and React Flow.

**Data model changes:**

```typescript
// Extend Chunk type
export interface Chunk {
  id: string;
  level: ChunkLevel; // 'theme' | 'task' | 'turn'
  label: string;
  blockIds: string[];
  childChunkIds: string[];
  parentChunkId?: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalWallTimeMs: number;
  // NEW fields:
  boundarySignals: BoundarySignal[]; // What triggered this boundary
  collapsed: boolean; // UI state
  startTimestamp: number;
  endTimestamp: number;
}

type BoundarySignal =
  | { type: 'time-gap'; gapMs: number }
  | { type: 'todo-change'; fromTodo?: string; toTodo?: string }
  | { type: 'git-commit'; message?: string }
  | { type: 'git-push' }
  | { type: 'pr-creation'; prNumber?: string }
  | { type: 'branch-switch'; fromBranch: string; toBranch: string }
  | { type: 'user-pattern'; pattern: string }
  | { type: 'task-spawn'; agentId: string };
```

### Phase 2: React Flow Sub-Graphs + ELK.js (5-7 days)

**What to build:**

- Migrate layout engine from dagre to ELK.js (with dagre as fallback)
- Implement proper nested sub-graph rendering with `parentId`
- Custom `TaskGroupNode` component with label, block count, duration
- Collapse/expand with animation (resize group node, toggle child `hidden`)
- Keyboard navigation (arrow keys to expand/collapse)
- Sub-agent spawning (`Task` tool) creates nested sub-graphs automatically

**Dependencies:** `elkjs` npm package (~140KB bundled)

### Phase 3: LLM-Assisted Labels (2-3 days)

**What to build:**

- Server-side endpoint for label generation
- Support Ollama (local) and Claude API as backends
- Progressive label loading (heuristic first, LLM labels replace async)
- Cache LLM labels in localStorage
- Settings toggle to enable/disable LLM labeling

**Dependencies:** Optional Ollama or Claude API key.

### Phase 4: Manual Grouping (3-5 days)

**What to build:**

- Selection-based grouping (shift+click, then "Group")
- Drag blocks between groups
- Split/merge group operations
- Sidecar file persistence for manual overrides
- Undo/redo for grouping operations

**Dependencies:** None new.

### Phase 5: LLM Boundary Detection (2-3 days, experimental)

**What to build:**

- "Re-analyze session" button that sends summarized blocks to LLM
- LLM suggests boundary revisions
- User reviews and accepts/rejects suggestions
- Confidence scores on auto-detected boundaries

**Dependencies:** Ollama or Claude API (same as Phase 3).

---

## Appendix A: Summary of Signals and Weights

| Signal               | Weight | Confidence | Available In       | Implementation Effort |
| -------------------- | ------ | ---------- | ------------------ | --------------------- |
| Todo changes         | 0.30   | Very High  | `todos` field      | Low (parser change)   |
| Git commit/push      | 0.25   | High       | Tool call content  | Low (regex)           |
| Branch switch        | 0.15   | High       | `gitBranch` field  | Low (field compare)   |
| User message pattern | 0.15   | Medium     | User block content | Low (regex)           |
| Time gap             | 0.15   | Medium     | Timestamps         | Trivial               |
| Task tool spawn      | N/A    | Definitive | Tool call name     | Low                   |
| PR creation          | N/A    | Definitive | Tool call content  | Low (regex)           |

## Appendix B: React Flow API Quick Reference

```typescript
// Node with parentId (child of group)
{
  id: 'child-1',
  parentId: 'group-1',        // Makes this a child node
  extent: 'parent',           // Constrains to parent bounds
  position: { x: 10, y: 40 }, // Relative to parent
  hidden: false,               // Toggle for collapse
}

// Group node (container)
{
  id: 'group-1',
  type: 'group',               // Built-in: no handles
  style: { width: 400, height: 600 },
  data: { label: 'Task name' },
}

// Hide/show for collapse
setNodes(nodes => nodes.map(n =>
  n.parentId === groupId
    ? { ...n, hidden: collapsed }
    : n
));

setEdges(edges => edges.map(e => ({
  ...e,
  hidden: isChildEdge(e, groupId) && collapsed,
})));
```

## Appendix C: ELK.js Configuration for Hierarchical Layout

```typescript
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '50',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN', // Key: layout children too
  'elk.padding': '[top=40,left=12,bottom=12,right=12]',
};
```

## Appendix D: Research Sources

- [React Flow Expand/Collapse Example](https://reactflow.dev/examples/layout/expand-collapse)
- [React Flow Sub-Flows](https://reactflow.dev/learn/layouting/sub-flows)
- [React Flow Sub-Flow Example](https://reactflow.dev/examples/grouping/sub-flows)
- [React Flow Parent-Child Relation](https://reactflow.dev/examples/grouping/parent-child-relation)
- [React Flow Selection Grouping](https://reactflow.dev/examples/grouping/selection-grouping)
- [React Flow LabeledGroupNode](https://reactflow.dev/ui/components/labeled-group-node)
- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance)
- [React Flow Node API Reference](https://reactflow.dev/api-reference/types/node)
- [React Flow ELK.js Example](https://reactflow.dev/examples/layout/elkjs)
- [ELK.js/Dagre with Subflows Discussion](https://github.com/xyflow/xyflow/discussions/3495)
- [React Flow Automated Layout Library](https://github.com/Jalez/react-flow-automated-layout)
- [Cytoscape.js Expand-Collapse Extension](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse)
- [Honeycomb Trace Explorer Docs](https://docs.honeycomb.io/investigate/analyze/explore-traces/)
- [OpenTelemetry Traces Concepts](https://opentelemetry.io/docs/concepts/signals/traces/)
- [Graphite Stacked Diffs Guide](https://graphite.com/guides/stacked-diffs)
- [LLM-Based Topic Labeling (arXiv)](https://arxiv.org/html/2502.18469v1)
- [Topic Segmentation Using Generative LMs (arXiv)](https://arxiv.org/html/2601.03276)
- [SEGLLM: Topic-Oriented Call Segmentation](https://ieeexplore.ieee.org/document/10446156/)

# ELKjs Columnar Graph Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace dagre with elkjs to get a partition-based columnar graph layout where horizontal position encodes block type (user rightmost, tools leftmost), edges are uniform black/white, and the viewport starts at the top of the conversation.

**Architecture:** elkjs computes node positions using its `layered` algorithm with `partitioning` enabled. Each block type maps to a fixed partition number. React Flow renders the positioned nodes. Layout is async (elkjs returns a Promise), so GraphView uses useEffect+useState instead of useMemo.

**Tech Stack:** elkjs (bundled, ~1.6MB uncompressed — fine for local tool), React Flow v12, vitest, Playwright.

**Essential docs to read before starting:**
- `docs/ui-requirements.md` — authoritative UI/UX constraints
- `docs/plans/2026-02-19-elkjs-columnar-layout-design.md` — approved design

---

### Task 1: Add `edgeColor` to Theme Type and All Themes

**Files:**
- Modify: `src/ui/themes/claude.ts:1-21`
- Modify: `src/ui/themes/dark.ts:1-21`
- Modify: `src/ui/themes/light.ts:1-21`

**Step 1: Write the failing test**

Create: `src/ui/themes/__tests__/themes.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { claudeTheme } from '../claude';
import { darkTheme } from '../dark';
import { lightTheme } from '../light';

describe('themes', () => {
  it('all themes include edgeColor', () => {
    expect(claudeTheme.colors.edgeColor).toBeDefined();
    expect(darkTheme.colors.edgeColor).toBeDefined();
    expect(lightTheme.colors.edgeColor).toBeDefined();
  });

  it('edgeColor is a valid hex color', () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    expect(claudeTheme.colors.edgeColor).toMatch(hexPattern);
    expect(darkTheme.colors.edgeColor).toMatch(hexPattern);
    expect(lightTheme.colors.edgeColor).toMatch(hexPattern);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/themes/__tests__/themes.test.ts`
Expected: FAIL — `edgeColor` property does not exist.

**Step 3: Write minimal implementation**

In `src/ui/themes/claude.ts`, add to the `colors` object:

```typescript
    edgeColor: '#000000', // black
```

In `src/ui/themes/dark.ts`, add to the `colors` object:

```typescript
    edgeColor: '#9ca3af', // gray-400
```

In `src/ui/themes/light.ts`, add to the `colors` object:

```typescript
    edgeColor: '#000000', // black
```

The `Theme` type is inferred from `claudeTheme` via `typeof`, so adding the field to `claude.ts` extends the type automatically. `dark.ts` and `light.ts` implement `Theme`, so TypeScript will enforce the new field.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/themes/__tests__/themes.test.ts`
Expected: PASS

**Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors (confirms dark.ts and light.ts satisfy the updated Theme type).

**Step 6: Commit**

```bash
git add src/ui/themes/ src/ui/themes/__tests__/themes.test.ts
git commit -m "feat: add edgeColor to all themes"
```

---

### Task 2: Swap dagre for elkjs in package.json

**Files:**
- Modify: `package.json`

**Step 1: Install elkjs and remove dagre**

```bash
npm install elkjs
npm uninstall dagre @types/dagre
```

**Step 2: Verify package.json**

Run: `node -e "const p = require('./package.json'); console.log('elkjs:', !!p.dependencies.elkjs, 'dagre:', !!p.dependencies.dagre)"`
Expected: `elkjs: true dagre: false`

**Step 3: Run typecheck to find all broken dagre imports**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in `src/ui/components/graph/layout.ts` — `Cannot find module 'dagre'`. This is expected and will be fixed in Task 3.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap dagre for elkjs dependency"
```

---

### Task 3: Rewrite `layout.ts` with elkjs

**Files:**
- Rewrite: `src/ui/components/graph/layout.ts`
- Create: `src/ui/components/graph/__tests__/layout.test.ts`

**Step 1: Write failing tests**

Create: `src/ui/components/graph/__tests__/layout.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { layoutGraph, getPartition } from '../layout';

function makeNode(id: string, type: string): Node {
  return {
    id,
    type,
    data: {},
    position: { x: 0, y: 0 },
  };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

describe('getPartition', () => {
  it('assigns partition 0 to tool nodes', () => {
    expect(getPartition('tool')).toBe(0);
  });

  it('assigns partition 1 to team-message nodes', () => {
    expect(getPartition('team-message')).toBe(1);
  });

  it('assigns partition 2 to agent nodes', () => {
    expect(getPartition('agent')).toBe(2);
  });

  it('assigns partition 3 to meta nodes', () => {
    expect(getPartition('meta')).toBe(3);
  });

  it('assigns partition 4 to user nodes', () => {
    expect(getPartition('user')).toBe(4);
  });
});

describe('layoutGraph', () => {
  it('returns positioned nodes with valid coordinates', async () => {
    const nodes = [
      makeNode('u1', 'user'),
      makeNode('a1', 'agent'),
      makeNode('t1', 'tool'),
    ];
    const edges = [makeEdge('u1', 'a1'), makeEdge('a1', 't1')];

    const result = await layoutGraph(nodes, edges);

    for (const node of result.nodes) {
      expect(node.position.x).not.toBeNaN();
      expect(node.position.y).not.toBeNaN();
    }
  });

  it('places user nodes to the right of agent nodes', async () => {
    const nodes = [
      makeNode('u1', 'user'),
      makeNode('a1', 'agent'),
    ];
    const edges = [makeEdge('u1', 'a1')];

    const result = await layoutGraph(nodes, edges);

    const userNode = result.nodes.find((n) => n.id === 'u1')!;
    const agentNode = result.nodes.find((n) => n.id === 'a1')!;
    expect(userNode.position.x).toBeGreaterThan(agentNode.position.x);
  });

  it('places agent nodes to the right of tool nodes', async () => {
    const nodes = [
      makeNode('u1', 'user'),
      makeNode('a1', 'agent'),
      makeNode('t1', 'tool'),
    ];
    const edges = [makeEdge('u1', 'a1'), makeEdge('a1', 't1')];

    const result = await layoutGraph(nodes, edges);

    const agentNode = result.nodes.find((n) => n.id === 'a1')!;
    const toolNode = result.nodes.find((n) => n.id === 't1')!;
    expect(agentNode.position.x).toBeGreaterThan(toolNode.position.x);
  });

  it('preserves edges unchanged', async () => {
    const nodes = [makeNode('u1', 'user'), makeNode('a1', 'agent')];
    const edges = [makeEdge('u1', 'a1')];

    const result = await layoutGraph(nodes, edges);
    expect(result.edges).toEqual(edges);
  });

  it('handles empty graph', async () => {
    const result = await layoutGraph([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/components/graph/__tests__/layout.test.ts`
Expected: FAIL — `layoutGraph` and `getPartition` don't exist yet (or old dagre code errors on missing module).

**Step 3: Write implementation**

Rewrite `src/ui/components/graph/layout.ts`:

```typescript
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

const elk = new ELK();

const NODE_WIDTH = 320;
const BASE_NODE_HEIGHT = 80;

const PARTITION_MAP: Record<string, number> = {
  tool: 0,
  'team-message': 1,
  agent: 2,
  meta: 3,
  user: 4,
};

export function getPartition(nodeType: string | undefined): number {
  return PARTITION_MAP[nodeType ?? 'user'] ?? 4;
}

function estimateHeight(node: Node): number {
  const data: Record<string, unknown> = node.data;
  const block = data.block as Record<string, unknown> | undefined;
  if (!block) return BASE_NODE_HEIGHT;

  switch (node.type) {
    case 'meta':
      return 40;
    case 'tool':
      return 90;
    case 'agent': {
      const toolCalls = block.toolCalls as string[] | undefined;
      const hasThinking = Boolean(block.thinking);
      let height = BASE_NODE_HEIGHT;
      if (toolCalls && toolCalls.length > 0) height += 20;
      if (hasThinking) height += 16;
      return height;
    }
    default:
      return BASE_NODE_HEIGHT;
  }
}

export async function layoutGraph(
  nodes: Node[],
  edges: Edge[],
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.partitioning.activate': 'true',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '50',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: estimateHeight(node),
      layoutOptions: {
        'elk.partitioning.partition': String(getPartition(node.type)),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layoutResult = await elk.layout(elkGraph);

  const positionMap = new Map<string, { x: number; y: number }>();
  for (const child of layoutResult.children ?? []) {
    positionMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  const layoutedNodes = nodes.map((node) => {
    const pos = positionMap.get(node.id) ?? { x: 0, y: 0 };
    return {
      ...node,
      position: pos,
    };
  });

  return { nodes: layoutedNodes, edges };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/components/graph/__tests__/layout.test.ts`
Expected: PASS — all 9 tests.

**Step 5: Run lint and typecheck**

Run: `npx eslint src/ui/components/graph/layout.ts && npx tsc --noEmit`
Expected: Clean. If elkjs has no bundled types, you may need to add a declaration file — see troubleshooting below.

**Troubleshooting:** If TypeScript cannot find types for `elkjs/lib/elk.bundled.js`, create `src/ui/components/graph/elk.d.ts`:

```typescript
declare module 'elkjs/lib/elk.bundled.js' {
  import ELK from 'elkjs';
  export default ELK;
}
```

**Step 6: Commit**

```bash
git add src/ui/components/graph/layout.ts src/ui/components/graph/__tests__/layout.test.ts
# Include elk.d.ts if created
git commit -m "feat: replace dagre with elkjs partitioned layout"
```

---

### Task 4: Update `buildGraph.ts` — Uniform Edge Color, Remove `getEdgeStyle`

**Files:**
- Modify: `src/ui/components/graph/buildGraph.ts`
- Create: `src/ui/components/graph/__tests__/buildGraph.test.ts`

**Step 1: Write failing tests**

Create: `src/ui/components/graph/__tests__/buildGraph.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildGraph } from '../buildGraph';
import type { UserBlock, AgentBlock, ToolBlock } from '@/types';

function makeUserBlock(id: string, content: string): UserBlock {
  return { id, type: 'user', timestamp: Date.now(), content };
}

function makeAgentBlock(id: string, content: string, toolCalls: string[] = []): AgentBlock {
  return { id, type: 'agent', timestamp: Date.now(), content, toolCalls };
}

function makeToolBlock(id: string, parentId: string, toolName: string): ToolBlock {
  return {
    id,
    type: 'tool',
    timestamp: Date.now(),
    parentId,
    toolName,
    input: {},
    output: {},
    status: 'success',
  };
}

describe('buildGraph', () => {
  const noop = () => {};

  it('creates nodes with correct types', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const { nodes } = buildGraph(blocks, noop);

    expect(nodes.find((n) => n.id === 'u1')?.type).toBe('user');
    expect(nodes.find((n) => n.id === 'a1')?.type).toBe('agent');
  });

  it('creates edges for agent toolCalls', () => {
    const blocks = [
      makeUserBlock('u1', 'hello'),
      makeAgentBlock('a1', 'reading', ['t1']),
      makeToolBlock('t1', 'a1', 'Read'),
    ];
    const { edges } = buildGraph(blocks, noop);

    const toolEdge = edges.find((e) => e.source === 'a1' && e.target === 't1');
    expect(toolEdge).toBeDefined();
  });

  it('creates sequential flow edges between user and agent', () => {
    const blocks = [makeUserBlock('u1', 'hello'), makeAgentBlock('a1', 'hi')];
    const { edges } = buildGraph(blocks, noop);

    const flowEdge = edges.find((e) => e.source === 'u1' && e.target === 'a1');
    expect(flowEdge).toBeDefined();
  });

  it('all edges have no custom stroke color or animation', () => {
    const blocks = [
      makeUserBlock('u1', 'hello'),
      makeAgentBlock('a1', 'reading', ['t1']),
      makeToolBlock('t1', 'a1', 'Read'),
    ];
    const { edges } = buildGraph(blocks, noop);

    for (const edge of edges) {
      expect(edge.style).toBeUndefined();
      expect(edge.animated).toBeUndefined();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/components/graph/__tests__/buildGraph.test.ts`
Expected: FAIL — the "all edges have no custom stroke color" test fails because current edges have per-type colors and animation.

**Step 3: Update implementation**

In `src/ui/components/graph/buildGraph.ts`:

1. Delete the entire `getEdgeStyle` function (lines 15-41).
2. Replace the `addEdge` function to remove all style/animated properties:

```typescript
  function addEdge(source: string, target: string): void {
    const edgeId = `${source}->${target}`;
    if (edgeIds.has(edgeId)) return;
    edgeIds.add(edgeId);

    edges.push({
      id: edgeId,
      source,
      target,
    });
  }
```

3. Update all `addEdge` call sites to remove the `sourceType`/`targetType` arguments. Every call becomes `addEdge(source, target)`.

Specifically, update these sections:
- Line 87: `addEdge(block.id, toolCallId, 'agent', 'tool')` → `addEdge(block.id, toolCallId)`
- Line 103: `addEdge(block.parentId, block.id, getNodeType(parent), 'tool')` → `addEdge(block.parentId, block.id)`
- Lines 122-131: All `addEdge(current.id, next.id, ...)` → `addEdge(current.id, next.id)`

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/components/graph/__tests__/buildGraph.test.ts`
Expected: PASS — all 4 tests.

**Step 5: Run lint**

Run: `npx eslint src/ui/components/graph/buildGraph.ts`
Expected: Clean (no unused `getEdgeStyle` function).

**Step 6: Commit**

```bash
git add src/ui/components/graph/buildGraph.ts src/ui/components/graph/__tests__/buildGraph.test.ts
git commit -m "feat: uniform edges, remove per-type edge styling"
```

---

### Task 5: Update `GraphView.tsx` — Async Layout + Initial Viewport

**Files:**
- Modify: `src/ui/components/graph/GraphView.tsx`

This task has no unit test — it is React component wiring. E2E tests (Task 6) cover the behavior.

**Step 1: Rewrite GraphView.tsx**

Key changes:
1. `layoutGraph` is now async — use `useEffect` + `useState` instead of `useMemo`.
2. Remove `fitView` prop.
3. Use `useReactFlow().setViewport()` to position camera at the first node after layout.
4. Apply theme `edgeColor` via `defaultEdgeOptions`.

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTheme } from '../../themes';
import { buildGraph } from './buildGraph';
import { layoutGraph } from './layout';
import { UserNode, AgentNode, ToolNode, MetaNode, TeamMessageNode } from './nodes';
import type { AnyBlock } from '@/types';

const nodeTypes = {
  user: UserNode,
  agent: AgentNode,
  tool: ToolNode,
  meta: MetaNode,
  'team-message': TeamMessageNode,
};

function minimapNodeColor(node: { type?: string }): string {
  switch (node.type) {
    case 'user':
      return '#3b82f6';
    case 'agent':
      return '#f97316';
    case 'tool':
      return '#0f0f0f';
    case 'meta':
      return '#9ca3af';
    case 'team-message':
      return '#8b5cf6';
    default:
      return '#6b7280';
  }
}

interface Props {
  blocks: AnyBlock[];
  onExpandBlock: (block: AnyBlock) => void;
}

function GraphViewInner({ blocks, onExpandBlock }: Props) {
  const theme = useTheme();
  const { setViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const initialViewportSet = useRef(false);

  useEffect(() => {
    if (blocks.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: rawNodes, edges: rawEdges } = buildGraph(blocks, onExpandBlock);

    let cancelled = false;
    layoutGraph(rawNodes, rawEdges).then((result) => {
      if (cancelled) return;
      setNodes(result.nodes);
      setEdges(result.edges);

      // Set initial viewport to show the first node near the top-right
      if (!initialViewportSet.current && result.nodes.length > 0) {
        initialViewportSet.current = true;

        // Find the topmost node (smallest y)
        let topNode = result.nodes[0];
        for (const node of result.nodes) {
          if (node.position.y < topNode.position.y) {
            topNode = node;
          }
        }

        // Position viewport so the top node is visible with some padding
        setViewport({
          x: -(topNode.position.x - 100),
          y: -(topNode.position.y - 50),
          zoom: 1,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [blocks, onExpandBlock, setNodes, setEdges, setViewport]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const block = (node.data as { block: AnyBlock }).block;
      onExpandBlock(block);
    },
    [onExpandBlock],
  );

  if (blocks.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full opacity-60"
        style={{ color: theme.colors.agentText }}
      >
        No blocks to display. Open a session file to begin.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: theme.colors.edgeColor, strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          style={{
            backgroundColor: theme.colors.headerBg,
            borderColor: 'rgba(255,255,255,0.2)',
          }}
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(0,0,0,0.3)"
          style={{
            backgroundColor: theme.colors.headerBg,
          }}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.1)"
        />
      </ReactFlow>
    </div>
  );
}

export function GraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  );
}
```

**Important notes for the implementer:**
- `useReactFlow()` must be called inside a `<ReactFlowProvider>`. The current code does not use a provider because `fitView` is a prop. After this change, GraphView wraps its inner component with `<ReactFlowProvider>`.
- Check if the parent component (`App.tsx`) already has a `<ReactFlowProvider>`. If so, don't double-wrap — just use `useReactFlow()` directly. If not, add the provider in `GraphView` as shown above.
- The `initialViewportSet` ref prevents re-centering on every WebSocket update — only the first layout positions the viewport.

**Step 2: Run typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/ui/components/graph/GraphView.tsx`
Expected: Clean.

**Step 3: Commit**

```bash
git add src/ui/components/graph/GraphView.tsx
git commit -m "feat: async elkjs layout with initial viewport positioning"
```

---

### Task 6: E2E Tests — Viewport, Column Ordering, Edge Colors

**Files:**
- Create: `e2e/specs/graph-layout.spec.ts`
- Modify: `e2e/fixtures/sessions/tool-calls.jsonl` (if needed — it already has user + agent + tool blocks)

**Step 1: Write E2E tests**

Create: `e2e/specs/graph-layout.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Graph layout', () => {
  test('first node is visible in viewport on load', async ({ page }) => {
    await page.goto('/');

    // Wait for the React Flow canvas to have nodes rendered
    const rfNode = page.locator('.react-flow__node').first();
    await expect(rfNode).toBeVisible({ timeout: 15_000 });

    // Check the first node is within the viewport (not scrolled offscreen)
    const box = await rfNode.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const viewport = page.viewportSize()!;
      expect(box.x).toBeGreaterThanOrEqual(-box.width);
      expect(box.y).toBeGreaterThanOrEqual(-box.height);
      expect(box.x).toBeLessThan(viewport.width);
      expect(box.y).toBeLessThan(viewport.height);
    }
  });

  test('user nodes are to the right of agent nodes', async ({ page }) => {
    await page.goto('/');

    // Wait for nodes to render
    await expect(page.locator('.react-flow__node')).toHaveCount(1, {
      timeout: 15_000,
    });
    // Actually wait for multiple nodes
    await page.waitForFunction(
      () => document.querySelectorAll('.react-flow__node').length >= 3,
      { timeout: 15_000 },
    );

    // Get positions of user and agent nodes via the DOM transform attribute
    const positions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      const result: { type: string; x: number }[] = [];
      for (const node of nodes) {
        const type = Array.from(node.classList)
          .find((c) => c.startsWith('react-flow__node-'))
          ?.replace('react-flow__node-', '');
        const transform = (node as HTMLElement).style.transform;
        const match = transform.match(/translate\(([^,]+)px/);
        if (type && match) {
          result.push({ type, x: parseFloat(match[1]) });
        }
      }
      return result;
    });

    const userXs = positions.filter((p) => p.type === 'user').map((p) => p.x);
    const agentXs = positions.filter((p) => p.type === 'agent').map((p) => p.x);

    // At least one of each must exist
    expect(userXs.length).toBeGreaterThan(0);
    expect(agentXs.length).toBeGreaterThan(0);

    const minUserX = Math.min(...userXs);
    const maxAgentX = Math.max(...agentXs);
    expect(minUserX).toBeGreaterThan(maxAgentX);
  });

  test('all edges use the same stroke color', async ({ page }) => {
    await page.goto('/');

    // Wait for edges to render
    await page.waitForFunction(
      () => document.querySelectorAll('.react-flow__edge path').length >= 1,
      { timeout: 15_000 },
    );

    const strokeColors = await page.evaluate(() => {
      const paths = document.querySelectorAll('.react-flow__edge path');
      const colors = new Set<string>();
      for (const path of paths) {
        const stroke = (path as SVGPathElement).style.stroke;
        if (stroke) colors.add(stroke);
      }
      return [...colors];
    });

    // All edges should use exactly one stroke color
    expect(strokeColors.length).toBe(1);
  });
});
```

**Step 2: Run E2E tests**

Run: `npx playwright test e2e/specs/graph-layout.spec.ts`
Expected: PASS — all 3 tests. The dev server starts automatically via playwright.config.ts webServer config.

**Step 3: Commit**

```bash
git add e2e/specs/graph-layout.spec.ts
git commit -m "test: add e2e tests for graph layout, viewport, and edge colors"
```

---

### Task 7: Final Verification

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass (existing + new layout + buildGraph + theme tests).

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean.

**Step 3: Run lint**

Run: `npx eslint .`
Expected: Clean.

**Step 4: Run all E2E tests**

Run: `npx playwright test`
Expected: All tests pass (existing smoke + sidebar + new graph-layout tests).

**Step 5: Manual spot check**

Start the dev server: `npm run dev -- -f ./e2e/fixtures/sessions/tool-calls.jsonl`

Verify:
- Graph loads with the first user message visible near the top
- User messages are in the rightmost column
- Agent messages are one column to the left
- Tool calls are in the leftmost column
- All edges are the same color (black on claude/light themes)
- Zoom and pan work normally

---

_Last updated: 2026-02-19_

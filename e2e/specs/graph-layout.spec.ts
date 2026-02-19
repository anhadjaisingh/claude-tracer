import { test, expect } from '@playwright/test';

test.describe('Graph layout', () => {
  test('topmost node is visible in viewport on load', async ({ page }) => {
    await page.goto('/');

    // Wait for the React Flow canvas to have nodes rendered
    await page.locator('.react-flow__node').first().waitFor({ timeout: 15_000 });

    // Find the topmost node (smallest screen y) and verify it's in the viewport
    const topBox = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      let best: DOMRect | null = null;
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (!best || rect.top < best.top) best = rect;
      }
      return best ? { x: best.x, y: best.y, width: best.width, height: best.height } : null;
    });

    expect(topBox).not.toBeNull();
    if (topBox) {
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      if (viewport) {
        expect(topBox.x).toBeGreaterThanOrEqual(-topBox.width);
        expect(topBox.y).toBeGreaterThanOrEqual(-topBox.height);
        expect(topBox.x).toBeLessThan(viewport.width);
        expect(topBox.y).toBeLessThan(viewport.height);
      }
    }
  });

  test('user nodes are in the rightmost column (larger X than agent nodes)', async ({ page }) => {
    await page.goto('/');

    // Wait for multiple nodes to render
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 3, {
      timeout: 15_000,
    });

    // Get positions of nodes via the DOM transform attribute
    const positions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      const result: { type: string; x: number; y: number }[] = [];
      for (const node of nodes) {
        const type = Array.from(node.classList)
          .find((c) => c.startsWith('react-flow__node-'))
          ?.replace('react-flow__node-', '');
        const transform = (node as HTMLElement).style.transform;
        const match = transform.match(/translate\(\s*([^,]+)px,\s*([^)]+)px/);
        if (type && match) {
          result.push({ type, x: parseFloat(match[1]), y: parseFloat(match[2]) });
        }
      }
      return result;
    });

    const userXs = positions.filter((p) => p.type === 'user').map((p) => p.x);
    const agentXs = positions.filter((p) => p.type === 'agent').map((p) => p.x);

    // At least one of each must exist
    expect(userXs.length).toBeGreaterThan(0);
    expect(agentXs.length).toBeGreaterThan(0);

    // In the columnar layout, user nodes have a larger X than agent nodes
    const minUserX = Math.min(...userXs);
    const maxAgentX = Math.max(...agentXs);
    expect(minUserX).toBeGreaterThan(maxAgentX);
  });

  test('columnar layout: tool < agent < user on X axis', async ({ page }) => {
    await page.goto('/');

    // Wait for multiple nodes to render
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 3, {
      timeout: 15_000,
    });

    // Get X positions of nodes via the DOM transform attribute
    const positions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      const result: { type: string; x: number }[] = [];
      for (const node of nodes) {
        const type = Array.from(node.classList)
          .find((c) => c.startsWith('react-flow__node-'))
          ?.replace('react-flow__node-', '');
        const transform = (node as HTMLElement).style.transform;
        const match = transform.match(/translate\(\s*([^,]+)px/);
        if (type && match) {
          result.push({ type, x: parseFloat(match[1]) });
        }
      }
      return result;
    });

    const toolXs = positions.filter((p) => p.type === 'tool').map((p) => p.x);
    const agentXs = positions.filter((p) => p.type === 'agent').map((p) => p.x);
    const userXs = positions.filter((p) => p.type === 'user').map((p) => p.x);

    // Verify columnar ordering when all three node types are present
    if (toolXs.length > 0 && agentXs.length > 0) {
      const maxToolX = Math.max(...toolXs);
      const minAgentX = Math.min(...agentXs);
      expect(maxToolX).toBeLessThan(minAgentX);
    }

    if (agentXs.length > 0 && userXs.length > 0) {
      const maxAgentX = Math.max(...agentXs);
      const minUserX = Math.min(...userXs);
      expect(maxAgentX).toBeLessThan(minUserX);
    }
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

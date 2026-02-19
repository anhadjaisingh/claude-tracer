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

  test('user nodes are below agent nodes', async ({ page }) => {
    await page.goto('/');

    // Wait for multiple nodes to render
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 3, {
      timeout: 15_000,
    });

    // Get positions of user and agent nodes via the DOM transform attribute
    const positions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      const result: { type: string; y: number }[] = [];
      for (const node of nodes) {
        const type = Array.from(node.classList)
          .find((c) => c.startsWith('react-flow__node-'))
          ?.replace('react-flow__node-', '');
        const transform = (node as HTMLElement).style.transform;
        const match = transform.match(/translate\([^,]+px,\s*([^)]+)px/);
        if (type && match) {
          result.push({ type, y: parseFloat(match[1]) });
        }
      }
      return result;
    });

    const userYs = positions.filter((p) => p.type === 'user').map((p) => p.y);
    const agentYs = positions.filter((p) => p.type === 'agent').map((p) => p.y);

    // At least one of each must exist
    expect(userYs.length).toBeGreaterThan(0);
    expect(agentYs.length).toBeGreaterThan(0);

    const minUserY = Math.min(...userYs);
    const maxAgentY = Math.max(...agentYs);
    expect(minUserY).toBeGreaterThan(maxAgentY);
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

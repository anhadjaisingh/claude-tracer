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
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      if (viewport) {
        expect(box.x).toBeGreaterThanOrEqual(-box.width);
        expect(box.y).toBeGreaterThanOrEqual(-box.height);
        expect(box.x).toBeLessThan(viewport.width);
        expect(box.y).toBeLessThan(viewport.height);
      }
    }
  });

  test('user nodes are to the right of agent nodes', async ({ page }) => {
    await page.goto('/');

    // Wait for multiple nodes to render
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

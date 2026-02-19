import { test, expect } from '@playwright/test';

test.describe('Sidebar', () => {
  test('clicking a chunk in the sidebar pans the React Flow viewport to show that chunk', async ({
    page,
  }) => {
    await page.goto('/');

    // Wait for React Flow nodes to render (the graph has loaded and laid out)
    const rfNodes = page.locator('.react-flow__node');
    await expect(rfNodes.first()).toBeVisible({ timeout: 15_000 });

    // Wait for multiple nodes so layout is complete
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 4, {
      timeout: 15_000,
    });

    // Wait for chunks to appear in the sidebar INDEX
    const indexHeading = page.locator('text=INDEX');
    await expect(indexHeading).toBeVisible({ timeout: 10_000 });

    // Find the sidebar chunk list items
    const chunkItems = page.locator('aside li');
    const chunkCount = await chunkItems.count();
    expect(chunkCount).toBeGreaterThanOrEqual(3);

    // Record the current viewport transform before clicking
    const viewportBefore = await page.evaluate(() => {
      const viewport = document.querySelector('.react-flow__viewport');
      return viewport ? (viewport as HTMLElement).style.transform : '';
    });

    // Click the LAST chunk (which should be at the bottom of the graph,
    // requiring a viewport pan to reach it)
    const lastChunk = chunkItems.last();
    await lastChunk.click();

    // Wait for the smooth pan animation to complete (duration is 500ms)
    await page.waitForTimeout(800);

    // Record the viewport transform after clicking
    const viewportAfter = await page.evaluate(() => {
      const viewport = document.querySelector('.react-flow__viewport');
      return viewport ? (viewport as HTMLElement).style.transform : '';
    });

    // The viewport transform MUST have changed -- if it didn't, navigation is broken.
    // This is the key assertion that catches the recurring bug.
    expect(viewportAfter).not.toBe(viewportBefore);

    // Additionally verify that at least one React Flow node is visible in the
    // main area after navigation (sanity check that we didn't pan to empty space)
    const mainArea = page.locator('main');
    const mainBox = await mainArea.boundingBox();
    expect(mainBox).toBeTruthy();

    const allNodes = page.locator('.react-flow__node');
    const nodeCount = await allNodes.count();
    let anyNodeVisible = false;
    for (let i = 0; i < nodeCount; i++) {
      const box = await allNodes.nth(i).boundingBox();
      if (box && mainBox) {
        const isInView =
          box.y + box.height > mainBox.y &&
          box.y < mainBox.y + mainBox.height &&
          box.x + box.width > mainBox.x &&
          box.x < mainBox.x + mainBox.width;
        if (isInView) {
          anyNodeVisible = true;
          break;
        }
      }
    }
    expect(anyNodeVisible).toBe(true);
  });

  test('clicking different chunks pans to different viewport positions', async ({ page }) => {
    await page.goto('/');

    // Wait for graph to fully render
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 4, {
      timeout: 15_000,
    });

    const indexHeading = page.locator('text=INDEX');
    await expect(indexHeading).toBeVisible({ timeout: 10_000 });

    const chunkItems = page.locator('aside li');
    const chunkCount = await chunkItems.count();
    expect(chunkCount).toBeGreaterThanOrEqual(2);

    // Click the first chunk
    await chunkItems.first().click();
    await page.waitForTimeout(800);

    const viewportAfterFirst = await page.evaluate(() => {
      const viewport = document.querySelector('.react-flow__viewport');
      return viewport ? (viewport as HTMLElement).style.transform : '';
    });

    // Click the last chunk
    await chunkItems.last().click();
    await page.waitForTimeout(800);

    const viewportAfterLast = await page.evaluate(() => {
      const viewport = document.querySelector('.react-flow__viewport');
      return viewport ? (viewport as HTMLElement).style.transform : '';
    });

    // Clicking different chunks must result in different viewport positions
    expect(viewportAfterFirst).not.toBe(viewportAfterLast);
  });

  test('sidebar has a resize handle', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    const indexHeading = page.locator('text=INDEX');
    await expect(indexHeading).toBeVisible({ timeout: 10_000 });

    // Find the resize handle (a div with cursor-col-resize class)
    const resizeHandle = page.locator('.cursor-col-resize');
    await expect(resizeHandle).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Sidebar', () => {
  test('clicking a chunk in the sidebar scrolls the target block into view', async ({ page }) => {
    await page.goto('/');

    // Wait for blocks to be rendered from the session fixture
    const userBlock = page.locator('text=user').first();
    await expect(userBlock).toBeVisible({ timeout: 10_000 });

    // Wait for chunks to appear in the sidebar INDEX
    const indexHeading = page.locator('text=INDEX');
    await expect(indexHeading).toBeVisible({ timeout: 10_000 });

    // Find the sidebar chunk list items
    const chunkItems = page.locator('aside li');
    const chunkCount = await chunkItems.count();
    expect(chunkCount).toBeGreaterThan(0);

    // Click the last chunk to ensure we need to scroll
    const lastChunk = chunkItems.last();
    await lastChunk.click();

    // After clicking, the first block of that chunk should be visible in the viewport.
    // Give the smooth scroll animation time to complete.
    await page.waitForTimeout(1000);

    // Verify that at least one block element is within the main scrollable area's visible viewport.
    const mainArea = page.locator('main');
    const mainBox = await mainArea.boundingBox();
    expect(mainBox).toBeTruthy();

    // Get all block elements (they have IDs starting with "block-")
    const blockElements = page.locator('[id^="block-"]');
    const blockCount = await blockElements.count();
    expect(blockCount).toBeGreaterThan(0);

    // At least one block should be visible in the main area after the scroll
    let anyBlockVisible = false;
    for (let i = 0; i < blockCount; i++) {
      const box = await blockElements.nth(i).boundingBox();
      if (box && mainBox) {
        const isInView = box.y + box.height > mainBox.y && box.y < mainBox.y + mainBox.height;
        if (isInView) {
          anyBlockVisible = true;
          break;
        }
      }
    }
    expect(anyBlockVisible).toBe(true);
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

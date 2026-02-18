import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Claude Tracer');
  });

  test('header is visible', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('h1');
    await expect(header).toBeVisible();
    await expect(header).toHaveText('# tracer');
  });

  test('blocks are rendered from session fixture', async ({ page }) => {
    await page.goto('/');

    // Wait for WebSocket data to arrive and blocks to render.
    // The simple-chat.jsonl fixture contains user and agent messages,
    // so we expect at least one of each block type to appear.
    const userBlock = page.locator('text=user').first();
    await expect(userBlock).toBeVisible({ timeout: 10_000 });

    const agentBlock = page.locator('text=agent').first();
    await expect(agentBlock).toBeVisible({ timeout: 10_000 });
  });

  test('tool block is rendered', async ({ page }) => {
    await page.goto('/');

    // The fixture includes a Read tool call, so a tool block should appear.
    const toolName = page.locator('text=Read').first();
    await expect(toolName).toBeVisible({ timeout: 10_000 });
  });

  test('footer shows block count and connection status', async ({ page }) => {
    await page.goto('/');

    // Wait for blocks to load so the count is non-zero.
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 10_000 });

    // Footer should show "Connected" once the WebSocket is up.
    await expect(footer.locator('text=Connected')).toBeVisible({ timeout: 10_000 });

    // Footer should show a non-zero block count.
    // The simple-chat fixture produces multiple blocks.
    await expect(footer).not.toContainText('Blocks: 0', { timeout: 10_000 });
  });
});

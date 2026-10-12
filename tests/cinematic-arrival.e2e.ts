import { expect, test } from '@playwright/test';

test('visitor enters the real museum through the cinematic arrival', async ({ page }) => {
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
  await expect(intro).toBeVisible({ timeout: 30_000 });
  const enter = intro.getByRole('button', { name: 'Enter the museum' });
  await expect(enter).toBeEnabled({ timeout: 15_000 });
  await enter.click();
  await expect(intro).toHaveCount(0);
  const state = await page.evaluate(() => ({
    running: Boolean(window.__museum),
    frozen: window.__museum?.player.isFrozen ?? null,
    captured: window.__museum?.input.uiCaptured,
  }));
  expect(state.running).toBe(true);
  expect(state.captured).toBe(false);
});

test('QA route bypasses the visitor title', async ({ page }) => {
  await page.goto('/?qa=1');
  await expect(page.locator('.cinematic-arrival')).toHaveCount(0);
});

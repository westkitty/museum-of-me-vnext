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
  expect(await page.evaluate(() => ['museum-canvas', 'ui-root', 'a11y-root']
    .every((id) => document.getElementById(id)?.inert === false))).toBe(true);
});

test('QA route bypasses the visitor title', async ({ page }) => {
  await page.goto('/?qa=1');
  await expect(page.locator('.cinematic-arrival')).toHaveCount(0);
});


test('keyboard visitor can dismiss the ready introduction', async ({ page }) => {
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
  // The first production visitor test already allows 30 seconds for software-WebGL
  // initialization. The keyboard path must make the same cold-start allowance,
  // while still requiring a real dialog and an enabled entry action.
  await expect(intro).toBeVisible({ timeout: 30_000 });
  const enter = intro.getByRole('button', { name: 'Enter the museum' });
  await expect(enter).toBeEnabled({ timeout: 15_000 });
  await enter.focus();
  await page.keyboard.press('Tab');
  await expect(enter).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(intro).toHaveCount(0);
  expect(await page.evaluate(() => window.__museum?.input.uiCaptured)).toBe(false);
});


test('prewarming introduction owns keyboard focus before entry is enabled', async ({ page }) => {
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
  await expect(intro).toBeVisible({ timeout: 30_000 });
  const enter = intro.getByRole('button');
  // Containment rather than brittle text-node matching under slow software WebGL.
  await expect.poll(async () => page.evaluate(() =>
    Boolean(document.querySelector('.cinematic-arrival')?.contains(document.activeElement)),
  ), { timeout: 20_000 }).toBe(true);
  expect(await page.evaluate(() => ['museum-canvas', 'ui-root', 'a11y-root']
    .every((id) => document.getElementById(id)?.inert === true))).toBe(true);
  if (await enter.isDisabled()) {
    await page.keyboard.press('Tab');
    await expect.poll(async () => page.evaluate(() => {
      const active = document.activeElement;
      const dialog = document.querySelector('.cinematic-arrival');
      return Boolean(dialog?.contains(active) && ['H1', 'BUTTON'].includes(active?.tagName ?? ''));
    }), { timeout: 20_000 }).toBe(true);
  }
});

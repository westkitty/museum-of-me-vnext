import { expect, test } from '@playwright/test';

test('first visitor title uses the accessible dialog, real prewarm and live scene', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
  await expect(intro).toBeVisible();
  const title = intro.getByRole('button', { name: 'Enter the museum' });
  const state = await page.evaluate(() => ({
    dwell: window.__museum?.titlePrewarmStatus.minimumDwellMs,
    zone: window.__museum?.currentZone,
  }));
  expect(state).toEqual({ dwell: 4000, zone: 'plaza' });
  await expect(title).toBeEnabled({ timeout: 20_000 });
  await title.click();
  await expect(intro).toHaveCount(0);
  const entered = await page.evaluate(() => ({
    entered: window.__museum?.arrivalEntered,
    zone: window.__museum?.currentZone,
    frozen: window.__museum?.player.isFrozen,
    captured: window.__museum?.input.uiCaptured,
  }));
  expect(entered).toEqual({ entered: true, zone: 'plaza', frozen: false, captured: false });
  await expect(page.getByRole('button', { name: 'Enter the museum and capture mouse look' })).toBeHidden();
});

test('QA and Workshop paths bypass the visitor title dwell', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__museum?.arrivalReady)).toBe(true);
});

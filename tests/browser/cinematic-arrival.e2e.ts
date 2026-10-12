import { expect, test } from '@playwright/test';

test('first visitor title uses the existing HUD, real prewarm and live scene', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  const title = page.getByRole('button', { name: 'Enter the museum and capture mouse look' });
  await expect(title).toBeVisible();
  expect(await page.locator('.cinematic-arrival').count()).toBe(0);
  const state = await page.evaluate(() => ({
    dwell: window.__museum?.titlePrewarmStatus.minimumDwellMs,
    zone: window.__museum?.currentZone,
    ready: window.__museum?.arrivalReady,
  }));
  expect(state.dwell).toBe(4000);
  expect(state.zone).toBe('plaza');
  await expect.poll(() => page.evaluate(() => window.__museum?.arrivalReady), { timeout: 20_000 }).toBe(true);
  await title.click();
  await expect(title).toBeHidden();
  const entered = await page.evaluate(() => ({
    entered: window.__museum?.arrivalEntered,
    zone: window.__museum?.currentZone,
    frozen: window.__museum?.player.isFrozen,
  }));
  expect(entered).toEqual({ entered: true, zone: 'plaza', frozen: false });
});

test('QA and Workshop paths bypass the visitor title dwell', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__museum?.arrivalReady)).toBe(true);
});

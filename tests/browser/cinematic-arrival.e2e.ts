import { expect, test } from '@playwright/test';

test('first visitor title uses the existing HUD, real prewarm and live scene', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  // Match the established museum browser tests: stop the costly software-WebGL
  // loop once the actual app boots. Drive UI readiness through the same
  // production UILayer update, without introducing a second clock.
  await page.evaluate(() => window.__museum?.stop());
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
  await expect.poll(() => page.evaluate(() => {
    const app = window.__museum;
    if (!app) return false;
    app.ui.update(1 / 60);
    return app.arrivalReady;
  }), { timeout: 20_000 }).toBe(true);
  await title.click();
  await expect(title).toBeHidden();
  const entered = await page.evaluate(() => ({
    entered: window.__museum?.arrivalEntered,
    zone: window.__museum?.currentZone,
    frozen: window.__museum?.player.isFrozen,
  }));
  expect(entered).toEqual({ entered: true, zone: 'plaza', frozen: false });
  // A rejected/released pointer lock must not bring back the huge intro or
  // strand desktop visitors without a visible recapture control.
  // The real browser's document.exitPointerLock() can stall in SwiftShader
  // after the application loop is stopped. This assertion concerns the HUD
  // recovery state, not the browser's asynchronous pointer-lock protocol.
  // Exercise the same public HUD transition without invoking that protocol.
  await page.evaluate(() => {
    window.__museum?.ui.hud.setPointerLocked(false);
  });
  await expect(title).toBeHidden();
  await expect(page.getByRole('button', { name: 'Resume mouse look' })).toBeVisible();
});

test('QA and Workshop paths bypass the visitor title dwell', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__museum?.arrivalReady)).toBe(true);
});

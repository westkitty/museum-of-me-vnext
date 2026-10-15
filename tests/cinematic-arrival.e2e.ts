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

test('desktop entry never captures mouse implicitly; mouse-look remains a separate choice', async ({ page }) => {
  // Observe the native API call without replacing its behavior. Initial entry
  // must not request capture; otherwise software-WebGL CI can stall input.
  await page.addInitScript(() => {
    const stats = window as typeof window & { __pointerRequests?: number };
    stats.__pointerRequests = 0;
    const native = HTMLCanvasElement.prototype.requestPointerLock;
    HTMLCanvasElement.prototype.requestPointerLock = function () {
      stats.__pointerRequests = (stats.__pointerRequests ?? 0) + 1;
      return native.call(this);
    };
  });
  // Navigation only needs the first response. Waiting for every asset to
  // finish can starve the browser driver under software WebGL.
  await page.goto('/', { waitUntil: 'commit' });
  const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
  await expect(intro.getByText('Six wings. Thirty-five exhibits.', { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(intro.getByText('Walk with WASD or arrow keys', { exact: false })).toBeVisible();
  await expect(intro.getByText('After entering, select Resume mouse look', { exact: false })).toBeVisible();
  const enter = intro.getByRole('button', { name: 'Enter the museum' });
  await expect(enter).toBeEnabled({ timeout: 20_000 });
  // The real app already rendered and completed its title prewarm. Prevent
  // software-WebGL frames from starving the browser protocol while asserting
  // DOM entry and keyboard input (the normal game loop is covered elsewhere).
  await page.evaluate(() => window.__museum?.stop());
  await enter.click();
  await expect(intro).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resume mouse look' })).toBeVisible();
  expect(await page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    attempts: (window as typeof window & { __pointerRequests?: number }).__pointerRequests,
    locked: Boolean(document.pointerLockElement),
    captured: window.__museum?.input.uiCaptured,
  }))).toEqual({ coarse: false, attempts: 0, locked: false, captured: false });
  await page.keyboard.down('w');
  expect(await page.evaluate(() => window.__museum?.input.isDown('forward'))).toBe(true);
  await page.keyboard.up('w');
});

test('coarse-pointer arrival exposes touch instructions without mouse-only recovery chrome', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
    await expect(intro).toBeVisible({ timeout: 30_000 });
    await expect(intro.locator('.cinematic-arrival__orientation--touch')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const enter = intro.getByRole('button', { name: 'Enter the museum' });
    await expect(enter).toBeEnabled({ timeout: 20_000 });
    await enter.tap();
    await expect(intro).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Resume mouse look' })).toBeHidden();
    expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  } finally {
    await context.close();
  }
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

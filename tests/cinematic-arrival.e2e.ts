import { expect, test } from '@playwright/test';

/**
 * The welcome is a title over the live island, not a gate (2026-11-20): it has
 * no "Enter the museum" button. Admission is the ticket kiosk by the doors,
 * which also starts loading the galleries. See docs/ENTRANCE_ATRIUM_2026-11-20.md.
 */

test('visitor arrives under a non-modal welcome and can walk at once', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  const intro = page.getByRole('region', { name: 'Welcome to the Museum of Me' });
  await expect(intro).toBeVisible({ timeout: 30_000 });
  await expect(intro).toContainText('take a ticket at the kiosk');
  await expect(page.getByRole('button', { name: /^Enter the museum$/ })).toHaveCount(0);
  // Pause continuous rendering for deterministic state assertions on
  // software-WebGL CI runners.
  await page.evaluate(() => window.__museum?.stop());
  const state = await page.evaluate(() => ({
    frozen: window.__museum?.player.isFrozen ?? null,
    captured: window.__museum?.input.uiCaptured,
    ticket: window.__museum?.ticket ?? null,
  }));
  expect(state).toEqual({ frozen: false, captured: false, ticket: null });
  // Nothing behind the title is made inert.
  expect(await page.evaluate(() => ['museum-canvas', 'ui-root', 'a11y-root']
    .every((id) => document.getElementById(id)?.inert === false))).toBe(true);
});

test('desktop arrival never captures mouse implicitly; mouse-look remains a separate choice', async ({ page }) => {
  // Observe the native API call without replacing its behavior. Arrival must
  // not request capture; otherwise software-WebGL CI can stall input.
  await page.addInitScript(() => {
    const stats = window as typeof window & { __pointerRequests?: number };
    stats.__pointerRequests = 0;
    const native = HTMLCanvasElement.prototype.requestPointerLock;
    HTMLCanvasElement.prototype.requestPointerLock = function () {
      stats.__pointerRequests = (stats.__pointerRequests ?? 0) + 1;
      return native.call(this);
    };
  });
  await page.goto('/', { waitUntil: 'commit' });
  const intro = page.getByRole('region', { name: 'Welcome to the Museum of Me' });
  await expect(intro.getByText('Six wings. Thirty-five exhibits.', { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(intro.getByText('Walk with WASD or arrow keys', { exact: false })).toBeVisible();
  await expect(intro.getByText('Select Resume mouse look', { exact: false })).toBeVisible();
  await page.evaluate(() => window.__museum?.stop());
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
    await page.goto('/', { waitUntil: 'commit' });
    const intro = page.getByRole('region', { name: 'Welcome to the Museum of Me' });
    await expect(intro).toBeVisible({ timeout: 30_000 });
    await expect(intro.locator('.cinematic-arrival__orientation--touch')).toBeVisible();
    await page.evaluate(() => window.__museum?.stop());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Museum', exact: true })).toBeVisible();
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

test('keyboard visitor can dismiss the welcome with Escape', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  const intro = page.getByRole('region', { name: 'Welcome to the Museum of Me' });
  await expect(intro).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.__museum?.stop());
  await expect(intro.getByRole('link', { name: 'Browse the collection' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(intro).toHaveCount(0);
  expect(await page.evaluate(() => ({
    entered: window.__museum?.arrivalEntered,
    captured: window.__museum?.input.uiCaptured,
  }))).toEqual({ entered: true, captured: false });
});

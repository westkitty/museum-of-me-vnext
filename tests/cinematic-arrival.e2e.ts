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

test('mouse arrival requests pointer look in the entry click and retains a recovery control', async ({ page }) => {
  // Instrument the real browser API without substituting a successful result.
  // Headless environments can deny a valid lock request; the fallback must work.
  await page.addInitScript(() => {
    const stats = window as typeof window & { __pointerRequests?: number };
    stats.__pointerRequests = 0;
    const native = HTMLCanvasElement.prototype.requestPointerLock;
    HTMLCanvasElement.prototype.requestPointerLock = function () {
      stats.__pointerRequests = (stats.__pointerRequests ?? 0) + 1;
      return native.call(this);
    };
  });
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
  await expect(intro.getByText('Six wings. Thirty-five exhibits.', { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(intro.getByText('Walk with WASD or arrow keys', { exact: false })).toBeVisible();
  const enter = intro.getByRole('button', { name: 'Enter the museum' });
  await expect(enter).toBeEnabled({ timeout: 20_000 });
  await enter.click();
  await expect(intro).toHaveCount(0);
  const result = await page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    attempted: (window as typeof window & { __pointerRequests?: number }).__pointerRequests,
    locked: document.pointerLockElement?.id === 'museum-canvas',
    fallback: !(document.querySelector<HTMLButtonElement>('.hud__resume-look')?.hidden ?? true),
  }));
  expect(result.coarse).toBe(false);
  expect(result.attempted).toBe(1);
  expect(result.locked || result.fallback).toBe(true);
  if (result.locked) await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume mouse look' })).toBeVisible();
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

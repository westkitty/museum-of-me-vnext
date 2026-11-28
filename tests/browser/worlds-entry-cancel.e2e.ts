import { expect, test, type Page } from '@playwright/test';
import { aimAt, bootPreview, placeInMuseum } from './helpers/world-journey';
import { keyboardVisitor } from './helpers/visitor';
import { APPROACHES } from './helpers/natural-approach';

/**
 * V7 regression: Esc while a world is still opening must cancel it.
 *
 * Disabling the focused Enter button ("Opening…") dropped keyboard focus to
 * the page, out of reach of the dialog's Esc handler, so the visitor's Esc was
 * ignored and the world opened anyway when the load finished (3 of 4 tries in
 * the V7 probe; the long-session test caught it). Focus now waits on Back.
 *
 * DIAGNOSTIC SCOPE: the visitor is placed at the W03 anchor (the walk there is
 * proven elsewhere) and the loader is wrapped with a 6 s delay, so the
 * "Opening…" window is long and deterministic. The dialog, keys and host are real.
 */
const AT: readonly [number, number, number] = [-37.4, -0.3, 134];
const SLOW_MS = 6000;

const world = (page: Page) => page.evaluate(() => String(window.__museum!.activeWorld));

test('Esc during "Opening…" cancels the entry: focus waits on Back and the world never opens', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await bootPreview(page, 'w03');
  keyboardVisitor(page);
  await page.evaluate((delay) => {
    const app = window.__museum!;
    const original = app.pocketRegistry.get('W03')!.load!;
    app.pocketRegistry.registerWorld('W03', {
      readiness: 'verified',
      load: async (ctx, signal) => { await new Promise((r) => setTimeout(r, delay)); return original(ctx, signal); },
    });
  }, SLOW_MS);

  for (let i = 0; i < 3; i++) {
    await placeInMuseum(page, AT, -Math.PI / 2, -0.25);
    await aimAt(page, APPROACHES.W03.aim, APPROACHES.W03.anchorId);
    await page.keyboard.press('f');
    const dialog = page.getByRole('dialog', { name: APPROACHES.W03.title });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
    await expect(dialog.getByRole('button', { name: 'Opening…' })).toBeVisible();
    // Let Chrome's focus fix-up run, as it had in the failing runs.
    await page.waitForTimeout(300);
    await expect(dialog.getByRole('button', { name: 'Back (Esc)' }), `try ${i}: focus waits on Back`).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog, `try ${i}: Esc closes the dialog at once`).toBeHidden({ timeout: 1000 });
    await page.waitForTimeout(SLOW_MS + 2000); // past the slow load's resolution
    expect(await world(page), `try ${i}: the cancelled world never opens`).toBe('exterior');
    expect(await page.evaluate(() => window.__museum!.scene.children.filter((c) => c.name.startsWith('pocket-world:')).length)).toBe(0);
    expect(await page.evaluate(() => window.__museum!.player.isFrozen)).toBe(false);
  }
  expect(errors).toEqual([]);
});

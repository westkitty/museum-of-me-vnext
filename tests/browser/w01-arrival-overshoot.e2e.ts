import { expect, test, type Page } from '@playwright/test';
import type { W01StateSnapshot } from '../../src/world/pocket/w01/types';
import {
  aimAt, bootPreview, enterFromAnchor, placeInMuseum, pose, snapshot, walkTo,
} from './helpers/world-journey';

/**
 * V7 regression for the V6 W01 aim miss ("unexplained 5.8 m displacement").
 *
 * Cause: running is fast (15.5 m/s). The V6 keyboard walker checked its
 * position once per poll, kept Shift+W held until a poll found it inside the
 * tolerance, and only then let go. On a loaded host the polls and key events
 * were far apart, so the visitor covered metres at full run between "arrived"
 * and the key release, then slid on (a released run stops in ~2.5 m). The
 * V6 miss was a 6.2 m overshoot exactly along the walk toward the whale
 * departure. The failure belongs to the test walker, not to W01: W01's
 * geometry and the museum's movement feel are unchanged.
 *
 * The test reproduces the loaded-host timing without touching the app: every
 * read the test runner makes (page.evaluate) is delayed, as when the runner
 * process is starved while the browser keeps rendering. (Throttling the
 * browser's CPU does not reproduce it: that slows the game loop by the same
 * factor.) Input is only W/Shift/Q/E/PageUp/PageDown/F, and the test asserts
 * that the walker now arrives settled and the aim succeeds.
 */

/**
 * Starve the runner: every page read and every key event the test sends waits
 * `ms` first, as when the runner process is starved while the browser keeps
 * rendering in real time. Returns a function that restores the page.
 */
function starveRunner(page: Page, ms: number): () => void {
  const wait = () => new Promise((resolve) => setTimeout(resolve, ms));
  const kb = page.keyboard;
  const original = { evaluate: page.evaluate.bind(page), down: kb.down.bind(kb), up: kb.up.bind(kb) };
  const p = page as { evaluate: Page['evaluate'] };
  p.evaluate = (async (...args: Parameters<Page['evaluate']>) => { await wait(); return original.evaluate(...args); }) as Page['evaluate'];
  kb.down = async (...args) => { await wait(); return original.down(...args); };
  kb.up = async (...args) => { await wait(); return original.up(...args); };
  return () => { p.evaluate = original.evaluate; kb.down = original.down; kb.up = original.up; };
}

async function horizontalSpeed(page: Page): Promise<number> {
  return page.evaluate(() => {
    const v = window.__museum!.player.velocity;
    return Math.hypot(v.x, v.z);
  });
}

test('W01: a run that arrives with a starved test runner settles at the departure and the aim still lands', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = await bootPreview(page, 'w01');
  await placeInMuseum(page, [53.5, -0.5, 4], -Math.PI / 2, -0.15); // labelled DIAGNOSTIC placement at the pearl
  await aimAt(page, [56, 0.5, 4], 'pocket-portal:w01');
  await enterFromAnchor(page, /Lagoon Depths/i, 'W01');
  expect((await snapshot<W01StateSnapshot>(page, 'W01')).station).toBe('central');

  // Characterize the movement feel this regression depends on: from a full
  // run, releasing W slides the visitor on for a couple of metres. (Not a
  // defect; it is recorded so a future movement change re-examines the walker.)
  const start = await walkTo(page, 0, 3, { tolerance: 0.6 });
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  await expect.poll(() => horizontalSpeed(page), { timeout: 5_000 }).toBeGreaterThan(14);
  const released = await pose(page);
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  await expect.poll(() => horizontalSpeed(page), { timeout: 5_000 }).toBeLessThan(0.05);
  const rest = await pose(page);
  const slide = Math.hypot(rest.x - released.x, rest.z - released.z);
  console.log(JSON.stringify({ start: [start.x, start.z], released: [released.x, released.z], rest: [rest.x, rest.z], slide: +slide.toFixed(2) }));
  expect(slide).toBeGreaterThan(1.5);
  expect(slide).toBeLessThan(3);

  // Loaded-host timing. The V6 miss needs one slow poll to find the visitor
  // inside the tolerance while still at full run, which depends on exactly how
  // slow the runner is; a sweep of runner delays covers that window instead of
  // relying on luck. Each pass starts from the ray-return landing spot.
  const results: { delayMs: number; drift: number; focused: string | null }[] = [];
  for (const delayMs of [150, 200, 250, 300, 350]) {
    await walkTo(page, 5.5, -1.5, { tolerance: 0.6 });
    const restore = starveRunner(page, delayMs);
    let focused: string | null = null;
    let drift = Number.NaN;
    try {
      const t0 = Date.now();
      await walkTo(page, 0, -5.5, { tolerance: 0.7, run: true, timeoutMs: 40_000 });
      console.log(`delay ${delayMs} ms: walk took ${Date.now() - t0} ms`);
      const settled = await (async () => { await page.waitForTimeout(1500); return pose(page); })();
      drift = Math.hypot(settled.x - 0, settled.z + 5.5);
      try { await aimAt(page, [0, 1.7, -8.5], 'w01-depart-whale'); focused = 'w01-depart-whale'; } catch { focused = null; }
    } finally {
      restore();
    }
    results.push({ delayMs, drift: +drift.toFixed(2), focused });
    console.log(JSON.stringify(results[results.length - 1]));
  }
  console.log(JSON.stringify(results));
  for (const r of results) {
    expect(r.drift, `runner delay ${r.delayMs} ms: visitor must still be at the departure`).toBeLessThan(1.0);
    expect(r.focused, `runner delay ${r.delayMs} ms: aim at the whale departure`).toBe('w01-depart-whale');
  }
  expect(errors).toEqual([]);
});

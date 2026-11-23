import { expect, type Page } from '@playwright/test';
import type { PreviewSnapshot } from './previewHost';

export async function openCandidatePreview(page: Page, slot: string, mode: 'candidate' | 'incumbent' = 'candidate'): Promise<PreviewSnapshot> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  const query = mode === 'incumbent' ? `?slot=${slot}&mode=incumbent` : `?slot=${slot}`;
  await page.goto(`/experiments/arena/replacements/_shared/preview.html${query}`);
  await page.waitForFunction(() => Boolean(window.__ARENA_PREVIEW__?.getSnapshot().ready), null, { timeout: 15_000 });
  const snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(errors, `Runtime console/page errors for ${slot} (${mode})`).toEqual([]);
  expect(snap.error).toBeNull();
  expect(snap.ready).toBe(true);
  expect(snap.plinthIntersections, `${slot} plinth intersections`).toBe(0);
  expect(snap.meshes).toBeGreaterThan(12);
  return snap;
}

export async function verifyPreviewLifecycleAndReset(page: Page): Promise<void> {
  const before = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  const remount = await page.evaluate(() => window.__ARENA_PREVIEW__!.remountCycle());
  expect(remount.leakCount, 'ResourceScope leak on unmount').toBe(0);
  expect(remount.resourceCount).toBe(before.resources);

  await page.evaluate(() => window.__ARENA_PREVIEW__!.setReducedMotion(true));
  const reducedSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(reducedSnap.reducedMotion).toBe(true);

  await page.evaluate(() => window.__ARENA_PREVIEW__!.setReducedMotion(false));
  await page.evaluate(() => window.__ARENA_PREVIEW__!.reset());
}

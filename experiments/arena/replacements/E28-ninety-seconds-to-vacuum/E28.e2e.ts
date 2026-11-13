import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E28 renders orbital crisis station, reaches contrasting endings in step mode, and resets cleanly', async ({ page }) => {
  await openCandidatePreview(page, 'E28');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e28-baseline.png') });

  // Ending 1: Switch Power Priority twice -> Evac & O2, step 3 phases -> CREW_EVACUATED_CORE_LOST
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(3);
    window.__ARENA_PREVIEW__!.activateControl(3);
    window.__ARENA_PREVIEW__!.activateControl(3);
  });
  await page.waitForTimeout(500);
  let snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Ending=CREW_EVACUATED_CORE_LOST');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e28-evac.png') });

  // Reset and run Ending 2: Shield & Core + Seal Bulkhead -> STATION_HELD_OUTER_VENTED
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(4);
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(1);
    window.__ARENA_PREVIEW__!.activateControl(3);
    window.__ARENA_PREVIEW__!.activateControl(3);
    window.__ARENA_PREVIEW__!.activateControl(3);
  });
  await page.waitForTimeout(500);
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Ending=STATION_HELD_OUTER_VENTED');

  await verifyPreviewLifecycleAndReset(page);
  const afterReset = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(afterReset.state).toContain('Ending=NONE');
  expect(afterReset.state).toContain('T-90s');
});

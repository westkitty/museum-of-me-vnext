import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E12 renders twin opposing framing cities, strips inferences, dissolves to shared source, and resets cleanly', async ({ page }) => {
  await openCandidatePreview(page, 'E12');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e12-divergent.png') });

  // Shift framing emphasis, pin log, strip unsupported inferences
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(1);
    window.__ARENA_PREVIEW__!.activateControl(2);
  });
  await page.waitForTimeout(450);
  let snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Emphasis=frameA');
  expect(snap.state).toContain('InferencesStripped=true');

  // Dissolve both towers inward to shared immutable source
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(3));
  await page.waitForTimeout(550);
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Dissolved=true');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e12-dissolved.png') });

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('Dissolved=false');
});

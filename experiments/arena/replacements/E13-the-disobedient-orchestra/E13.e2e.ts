import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E13 renders 4-layer suspended choir, tightens drift under bracket cues, and resets cleanly', async ({ page }) => {
  await openCandidatePreview(page, 'E13');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e13-loose-drift.png') });

  // Switch directive to Chorus, engage Strict Bracket Cues, audition Take #2
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(1);
    window.__ARENA_PREVIEW__!.activateControl(2);
  });
  await page.waitForTimeout(500);
  const snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Steering=strict_cues');
  expect(snap.state).toContain('Take=#2');
  expect(snap.state).toContain('Audio=MUTED');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e13-strict-cues.png') });

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('Steering=loose');
  expect(resetSnap.state).toContain('Take=#1');
});

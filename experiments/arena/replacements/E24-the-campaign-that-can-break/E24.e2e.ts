import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E24 renders 4-region campaign board, fractures on broken reference ID, repairs bridge, and resets cleanly', async ({ page }) => {
  await openCandidatePreview(page, 'E24');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e24-baseline.png') });

  // March to Saltfen, inject synthetic broken ID, verify collapse and blocked march
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(2);
    window.__ARENA_PREVIEW__!.activateControl(0);
  });
  await page.waitForTimeout(450);
  let snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Region=loc_saltfen');
  expect(snap.state).toContain('Schema=FAULT(loc_thornwood_MISSING)');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e24-broken-id.png') });

  // Diagnose & repair ID -> bridge restored and march proceeds to Thornwood -> Last Keep
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(3);
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(1);
    window.__ARENA_PREVIEW__!.activateControl(0);
  });
  await page.waitForTimeout(450);
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Schema=INTACT');
  expect(snap.state).toContain('Region=loc_last_keep');

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('Region=loc_westmarch');
});

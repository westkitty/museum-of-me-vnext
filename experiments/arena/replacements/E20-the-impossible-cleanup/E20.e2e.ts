import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E20 peels back speculative claim shells, refuses partial staging, and reveals 49.5 GB locked cores', async ({
  page,
}) => {
  await openCandidatePreview(page, 'E20');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e20-baseline.png') });

  // Audit 2/4 only and attempt premature Safe Plan -> declined!
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(1);
    window.__ARENA_PREVIEW__!.activateControl(4);
  });
  await page.waitForTimeout(450);
  const partialSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(partialSnap.state).toContain('SafePlan=false');
  expect(partialSnap.state).toContain('Refusals=1');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e20-refused.png') });

  // Complete remaining 2 audits (caches + rollback), then assemble Safe Plan cleanly
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(2);
    window.__ARENA_PREVIEW__!.activateControl(3);
    window.__ARENA_PREVIEW__!.activateControl(4);
  });
  await page.waitForTimeout(600);
  const snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('NetReclaimable=14500MB');
  expect(snap.state).toContain('Protected=49500MB');
  expect(snap.state).toContain('Audited=4/4');
  expect(snap.state).toContain('SafePlan=true');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e20-audited.png') });

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('NetReclaimable=64000MB');
  expect(resetSnap.state).toContain('Refusals=0');
});

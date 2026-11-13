import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E20 shrinks headline reclaimable column under byte-exact constraint audits and resets cleanly', async ({ page }) => {
  await openCandidatePreview(page, 'E20');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e20-baseline.png') });

  // Audit backup + hardlinks, then assemble full safe plan
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(1);
    window.__ARENA_PREVIEW__!.activateControl(4);
  });
  await page.waitForTimeout(500);
  const snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('NetReclaimable=14500MB');
  expect(snap.state).toContain('Protected=49500MB');
  expect(snap.state).toContain('SafePlan=true');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e20-audited.png') });

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('NetReclaimable=64000MB');
});

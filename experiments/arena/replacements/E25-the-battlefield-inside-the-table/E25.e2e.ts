import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E25 renders tactical battletable, flips DEFEAT to VICTORY with 1-square cover shift, and resets cleanly', async ({ page }) => {
  await openCandidatePreview(page, 'E25');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e25-baseline.png') });

  // Run 3 turns in Center Open -> DEFEAT
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(2);
    window.__ARENA_PREVIEW__!.activateControl(2);
    window.__ARENA_PREVIEW__!.activateControl(2);
  });
  await page.waitForTimeout(350);
  let snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Outcome=DEFEAT');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e25-defeat-exposed.png') });

  // Reset, shift 1 square left to West Cover Pillar, and resolve 3 turns -> VICTORY
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(4);
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(2);
    window.__ARENA_PREVIEW__!.activateControl(2);
    window.__ARENA_PREVIEW__!.activateControl(2);
  });
  await page.waitForTimeout(450);
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Sightline=blocked');
  expect(snap.state).toContain('Outcome=VICTORY');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e25-victory-cover.png') });

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('Turn=0/3');
});

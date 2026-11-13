import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E30 renders containment arena, executes causal scar reactions, undoes atomically, and resets cleanly', async ({ page }) => {
  await openCandidatePreview(page, 'E30');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e30-baseline.png') });

  // Cast Cinder on Central Conduit (control 2)
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(2));
  await page.waitForTimeout(850);
  let snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Casts=1');
  expect(snap.state).toContain('ActiveScars=1/3');

  // Switch Spell to Rime (control 0) and cast on existing crater -> Quench reaction
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(2);
  });
  await page.waitForTimeout(850);
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Reactions=1');

  // Switch Spell to Prism (control 0), target West Rim (control 1), cast Prism Spire
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(1);
    window.__ARENA_PREVIEW__!.activateControl(2);
  });
  await page.waitForTimeout(850);
  await page.screenshot({ path: join(DIR, 'artifacts', 'e30-scarred.png') });

  // Undo Last Cast restores Casts=2
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(3));
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Casts=2');

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('Casts=0');
  expect(resetSnap.state).toContain('ActiveScars=0/3');
});

import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E30 renders stepped scar arena, telegraphs bifurcated refraction, refracts across pads, and resets cleanly', async ({ page }) => {
  await openCandidatePreview(page, 'E30');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e30-baseline.png') });

  // Cast 1: Cinder on Central Conduit (crater) -> Cast 2: Rime -> Thermal Quench trench -> Cast 3: Prism -> Resonant Crystal Spire
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(2));
  await page.waitForTimeout(820);
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(2);
  });
  await page.waitForTimeout(820);
  let snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Reactions=1');

  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(2);
  });
  await page.waitForTimeout(820);

  // Arm Cinder onto Resonant Crystal Spire -> predicts bifurcated refraction BEFORE casting!
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(0));
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('PredictedRefract=2');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e30-refract-telegraph.png') });

  // Cast 4: Cinder refracts off Central Spire to scar both West Rim and East Basin
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(2));
  await page.waitForTimeout(1600);
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Refractions=1');
  expect(snap.state).toContain('ActiveScars=3/3');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e30-scarred.png') });

  // Undo Last Cast restores Casts=3, Refractions=0, ActiveScars=1/3
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(3));
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Casts=3');
  expect(snap.state).toContain('Refractions=0');
  expect(snap.state).toContain('ActiveScars=1/3');

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('Casts=0');
  expect(resetSnap.state).toContain('ActiveScars=0/3');
});

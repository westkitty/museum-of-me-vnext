import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E12 renders 3-stratum rhetorical cities, sweeps InDEX lens across identical observations, dissolves cleanly, and resets', async ({
  page,
}) => {
  await openCandidatePreview(page, 'E12');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e12-divergent.png') });

  // Shift framing emphasis, pin 08:09 bypass log, strip unsupported inference spires
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0); // frameA
    window.__ARENA_PREVIEW__!.activateControl(1); // obs_flow
    window.__ARENA_PREVIEW__!.activateControl(1); // obs_seal
    window.__ARENA_PREVIEW__!.activateControl(1); // obs_bypass
    window.__ARENA_PREVIEW__!.activateControl(2); // strip inferences
  });
  await page.waitForTimeout(550);
  let snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Emphasis=frameA');
  expect(snap.state).toContain('Pinned=obs_bypass');
  expect(snap.state).toContain('InferencesStripped=true');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e12-pinned-span.png') });

  // Dissolve both framing colonnades down onto shared immutable bedrock
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(3));
  await page.waitForTimeout(550);
  snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Dissolved=true');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e12-dissolved.png') });

  await verifyPreviewLifecycleAndReset(page);
  const resetSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(resetSnap.state).toContain('Dissolved=false');
  expect(resetSnap.state).toContain('Pinned=all');
});

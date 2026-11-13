import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E26 unfolds diorama into playable platformer cartridge, toggles click-through overlay, and clears goal', async ({ page }) => {
  await openCandidatePreview(page, 'E26');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e26-diorama.png') });

  // Unfold into cartridge + enable WESTCAT overlay + traverse all 5 platforms
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0);
    window.__ARENA_PREVIEW__!.activateControl(1);
    window.__ARENA_PREVIEW__!.activateControl(2);
    window.__ARENA_PREVIEW__!.activateControl(3);
    window.__ARENA_PREVIEW__!.activateControl(2);
    window.__ARENA_PREVIEW__!.activateControl(3);
  });
  await page.waitForTimeout(700);
  const snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Mode=cartridge');
  expect(snap.state).toContain('Overlay=telemetry (click-through)');
  expect(snap.state).toContain('Goal=true');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e26-cartridge.png') });

  // Collapse cleanly back to diorama
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(0));
  await page.waitForTimeout(450);
  const collapsed = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(collapsed.state).toContain('Mode=diorama');

  await verifyPreviewLifecycleAndReset(page);
  const afterReset = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(afterReset.state).toContain('Goal=false');
});

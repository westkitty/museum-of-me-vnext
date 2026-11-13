import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from '../_shared/browserVerify';

const DIR = dirname(fileURLToPath(import.meta.url));

test('E26 transforms coastal diorama into cartridge and enforces opaque vs click-through overlay rule', async ({
  page,
}) => {
  await openCandidatePreview(page, 'E26');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e26-diorama.png') });

  // 1. Fold into cartridge + turn on OPAQUE overlay -> test blocked misclick interception
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(0); // Fold into Cartridge
    window.__ARENA_PREVIEW__!.activateControl(1); // Overlay -> blocking
    window.__ARENA_PREVIEW__!.activateControl(2); // Intercepted on air!
  });
  await page.waitForTimeout(450);
  const blockedSnap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(blockedSnap.state).toContain('Overlay=blocking');
  expect(blockedSnap.state).toContain('MisclicksBlocked=1');
  expect(blockedSnap.state).toContain('Stage=1/5');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e26-blocking-misclick.png') });

  // 2. Toggle to CLICK-THROUGH -> traverse all 5 coastal platforms to Point Beacon
  await page.evaluate(() => {
    window.__ARENA_PREVIEW__!.activateControl(1); // Overlay -> click_through
    window.__ARENA_PREVIEW__!.activateControl(2); // 0 -> 1
    window.__ARENA_PREVIEW__!.activateControl(3); // 1 -> 2
    window.__ARENA_PREVIEW__!.activateControl(2); // 2 -> 3
    window.__ARENA_PREVIEW__!.activateControl(3); // 3 -> 4 goal!
  });
  await page.waitForTimeout(700);
  const snap = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(snap.state).toContain('Mode=cartridge');
  expect(snap.state).toContain('Overlay=click_through');
  expect(snap.state).toContain('Goal=true');
  await page.screenshot({ path: join(DIR, 'artifacts', 'e26-cartridge.png') });

  // 3. Reverse cleanly back to diorama
  await page.evaluate(() => window.__ARENA_PREVIEW__!.activateControl(0));
  await page.waitForTimeout(450);
  const collapsed = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(collapsed.state).toContain('Mode=diorama');

  await verifyPreviewLifecycleAndReset(page);
  const afterReset = await page.evaluate(() => window.__ARENA_PREVIEW__!.getSnapshot());
  expect(afterReset.state).toContain('Goal=false');
  expect(afterReset.state).toContain('MisclicksBlocked=0');
});

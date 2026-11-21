import { test, expect } from '@playwright/test';
import { openCandidatePreview, verifyPreviewLifecycleAndReset } from './browserVerify';

test('shared bay preview harness boots in Chromium WebGL and passes incumbent smoke check', async ({ page }) => {
  const snap = await openCandidatePreview(page, 'E26', 'incumbent');
  expect(snap.slot).toBe('E26');
  expect(snap.mode).toBe('incumbent');
  expect(snap.controls.length).toBeGreaterThan(0);
  await verifyPreviewLifecycleAndReset(page);
});

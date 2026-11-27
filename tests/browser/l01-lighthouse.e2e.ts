import { expect, test, type Page } from '@playwright/test';
import type { L01Snapshot } from '../../src/world/pocket/l01/createL01World';
import {
  bootPreview, evidenceDir, persistentPassportRaw, placeInMuseum, pose, snapshot,
} from './helpers/world-journey';
import { l01Route } from './helpers/routes';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('l01');
const snap = (page: Page) => snapshot<L01Snapshot>(page, 'L01');

async function enterL01(page: Page, v: Visitor, dir = DIR) {
  await placeInMuseum(page, [174.5, 11.5, 152], -Math.PI / 2, 0.16);
  await v.aimAt([176, 13.45, 152], 'lighthouse-lens-l01');
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  const entry = await pose(page);
  await v.enterFromAnchor(/Lighthouse at World.s End/i, 'L01');
  return entry;
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'l01');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  const entry = await enterL01(page, v, dir);
  await l01Route(page, v, dir);
  const back = await pose(page);
  expect(Math.hypot(back.x - entry.x, back.z - entry.z)).toBeLessThan(1);
  expect(back.y).toBeCloseTo(entry.y, 0);
  const accounting = await page.evaluate(() => ({ stamps: window.__museum!.passport.earnedCount, bonus: window.__museum!.passport.hasBonusCompleted(), l01Stamp: window.__museum!.passport.hasStamp('L01') }));
  expect(accounting).toEqual({ stamps: 0, bonus: true, l01Stamp: false });
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('L01 real-time lighthouse beam route, panorama, bonus completion and original-lens return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('l01'));
});


test('L01 Back exits without completion and a repeat visit starts with the beacon dark', async ({ page }) => {
  const errors = await bootPreview(page, 'l01');
  await enterL01(page, keyboardVisitor(page));
  await expect.poll(async () => (await snap(page)).revealed[0], { timeout: 20_000 }).toBe(true);
  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  expect(await page.evaluate(() => window.__museum!.passport.hasBonusCompleted())).toBe(false);
  await enterL01(page, keyboardVisitor(page));
  const fresh = await snap(page);
  expect(fresh.stage).toBe(0);
  expect(fresh.beaconRestored).toBe(false);
  expect(fresh.optionalFound).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('L01 reveals a stationary, supported path without waiting for the sweep', async ({ page }) => {
    const errors = await bootPreview(page, 'l01');
    await enterL01(page, keyboardVisitor(page));
    await expect.poll(async () => (await snap(page)).revealed[0], { timeout: 3_000 }).toBe(true);
    const a = (await snap(page)).beamAngle;
    await page.waitForTimeout(500);
    expect((await snap(page)).beamAngle).toBe(a);
    await page.screenshot({ path: `${DIR}/08-reduced-motion-static-beam.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('L01 continuous touch route: beam-revealed crossings, tide pool, beacon, panorama and unstamped return by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('l01-touch'));
    await expectTouchAffordances(page);
  });
});

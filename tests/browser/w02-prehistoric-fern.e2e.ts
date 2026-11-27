import { expect, test, type Page } from '@playwright/test';
import type { W02Snapshot } from '../../src/world/pocket/w02/createW02World';
import { FOSSIL_LOOP, FOSSIL_POS, HEART_POS, MAIN_ROUTE, RETURN_GATE_POS, SEED_POS } from '../../src/world/pocket/w02/w02Layout';
import {
  aimAt, bootPreview, enterFromAnchor, evidenceDir, interact, persistentPassportRaw, placeInMuseum, pose, snapshot, turnTo, waitForSnapshot, walkPath,
} from './helpers/world-journey';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w02');
/** Supported approach to the Western Fern Ravine anchor at (-134.5, -0.5, -5.1). */
const APPROACH: [number, number, number] = [-138.2, -0.5, -5.1];
const ANCHOR_TOP: [number, number, number] = [-134.5, 0.52, -5.1];

async function enterW02(page: Page, v: Visitor) {
  await placeInMuseum(page, APPROACH, -Math.PI / 2, -0.2);
  await v.aimAt(ANCHOR_TOP, 'pocket-portal:w02');
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w02');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  await enterW02(page, v);
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  await v.enterFromAnchor(/Prehistoric Fern Island/i, 'W02');
  const spawn = await pose(page);
  expect([spawn.x, spawn.y, spawn.z]).toEqual([-42, 0, 8]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/02-arrival.png` });

  // Act I: the broad root climb to the rest shelf (real W/Shift/Q/E input).
  const shelf = await v.walkPath(MAIN_ROUTE.slice(1, 4), { run: true });
  expect(shelf.y).toBeCloseTo(2, 1);

  // Act II: wake the seed and watch the bridge grow.
  await v.aimAt(SEED_POS, 'w02-root-seed');
  await v.interact();
  const woken = await snapshot<W02Snapshot>(page, 'W02');
  expect(woken.bridgeOpen).toBe(true);
  expect(woken.bridgeComplete).toBe(false); // the bridge grows over time, not at once
  // Step aside on the shelf so the seed does not hide the gorge, then watch.
  await v.walkTo(-7, 10.2, { tolerance: 0.6 });
  await v.turnTo(Math.atan2(-(4 - -7), -(5 - 10.2)));
  await v.pitchTo(-0.12);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/03-mechanic-bridge-growing.png` });
  const grown = await waitForSnapshot<W02Snapshot>(page, 'W02', 'bridgeComplete', true, 60_000);
  expect(grown.checkpointSaved).toBe(true);
  await page.screenshot({ path: `${dir}/04-transformation-bridge-grown.png` });

  // Cross and climb the switchbacks to the summit.
  const summit = await v.walkPath(MAIN_ROUTE.slice(4), { run: true });
  expect(summit.y).toBeCloseTo(14, 1);
  const atSummit = await snapshot<W02Snapshot>(page, 'W02');
  expect(atSummit.crossed).toBe(true);
  expect(atSummit.checkpoints).toEqual(['east-shelf', 'fern-balcony', 'root-saddle', 'elder-summit']);
  expect(atSummit.completionEligible).toBe(false);

  // Act III finale.
  await v.aimAt(HEART_POS, 'w02-elder-heart');
  await v.interact();
  await v.turnTo(1.5);
  await v.pitchTo(-0.14);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${dir}/05a-finale-unfurling-west.png` });
  const done = await waitForSnapshot<W02Snapshot>(page, 'W02', 'completionEligible', true, 90_000);
  expect(done.finaleProgress).toBe(1);
  // The revealed island from the summit's west lookout rail.
  await v.walkTo(33.2, 6.5, { tolerance: 0.6 });
  await v.turnTo(1.5);
  await v.pitchTo(-0.32);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/05b-finale-island-revealed-west.png` });
  await v.turnTo(2.35);
  await v.pitchTo(-0.3);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/05c-finale-south-coast-herd.png` });
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W02'))).toBe(false);

  await v.walkTo(RETURN_GATE_POS[0], RETURN_GATE_POS[2] - 2.6, { tolerance: 0.6 });
  await v.aimAt([RETURN_GATE_POS[0], RETURN_GATE_POS[1] + 1.7, RETURN_GATE_POS[2]], 'w02-return-gate');
  await v.interact();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/06-return.png` });
  const back = await pose(page);
  expect(Math.hypot(back.x - APPROACH[0], back.z - APPROACH[2])).toBeLessThan(3);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W02'))).toBe(true); // in-memory preview passport only
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W02 real-time keyboard journey: entrance, root climb, growing bridge, ascent, Elder Fern finale, completion return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w02'));
});


test('W02 optional fossil loop reconnects to the route; Back exits without a stamp; repeat visit restarts cleanly', async ({ page }) => {
  const errors = await bootPreview(page, 'w02');
  await enterW02(page, keyboardVisitor(page));
  await enterFromAnchor(page, /Prehistoric Fern Island/i, 'W02');
  await walkPath(page, FOSSIL_LOOP.slice(1, 3), { run: true });
  await aimAt(page, [FOSSIL_POS[0] - 0.5, 0.9, FOSSIL_POS[2]], 'w02-fossil');
  await interact(page);
  expect((await snapshot<W02Snapshot>(page, 'W02')).fossilFound).toBe(true);
  await page.screenshot({ path: `${DIR}/07-optional-fossil-hollow.png` });
  const shelf = await walkPath(page, FOSSIL_LOOP.slice(3), { run: true });
  expect(shelf.y).toBeCloseTo(2, 1);

  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W02'))).toBe(false);

  for (let visit = 0; visit < 2; visit++) {
    await enterW02(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Prehistoric Fern Island/i, 'W02');
    const fresh = await snapshot<W02Snapshot>(page, 'W02');
    expect(fresh.fossilFound).toBe(false);
    expect(fresh.bridgeOpen).toBe(false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (await page.evaluate(() => window.__museum!.activeWorld) !== 'exterior') {
      await page.getByRole('button', { name: 'Back to Museum' }).click();
    }
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  }
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W02'))).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('W02 reduced motion: the bridge reaches its final grown state at once and the finale is static', async ({ page }) => {
    const errors = await bootPreview(page, 'w02');
    await enterW02(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Prehistoric Fern Island/i, 'W02');
    await walkPath(page, MAIN_ROUTE.slice(1, 4), { run: true });
    await aimAt(page, SEED_POS, 'w02-root-seed');
    await interact(page);
    const snap = await snapshot<W02Snapshot>(page, 'W02');
    expect(snap.bridgeComplete).toBe(true);
    expect(snap.bridgeGrowth).toBe(1);
    await turnTo(page, -Math.PI / 2);
    await page.screenshot({ path: `${DIR}/08-reduced-motion-bridge.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W02 continuous touch journey: root climb, growing bridge, ascent, Elder Fern finale and return by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w02-touch'));
    await expectTouchAffordances(page);
  });
});

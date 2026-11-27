import { expect, test, type Page } from '@playwright/test';
import type { W06Snapshot } from '../../src/world/pocket/w06/createW06World';
import {
  CAIRN_POS, GATE_APPROACH, GATE_POS, GREAT_THERMAL, LANTERN_POS, ORCHARD, PARASOL_POS, PAVILION, ROUTE, SPIRE, SUMMIT,
  TERRACE, UPDRAFT_A,
} from '../../src/world/pocket/w06/w06Layout';
import {
  aimAt, bootPreview, enterFromAnchor, evidenceDir, interact, persistentPassportRaw, placeInMuseum, pose, pitchTo, snapshot, turnTo, waitForSnapshot, waitForSnapshotWhere, walkPath,
} from './helpers/world-journey';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w06');
const PARASOL_AIM: [number, number, number] = [PARASOL_POS[0], 1.3, PARASOL_POS[2]];

/**
 * DIAGNOSTIC (museum side only): stand on the rooftop café deck west of the
 * Flight Pad II console (clear of the pad itself), facing it.
 */
async function enterW06(page: Page, v: Visitor): Promise<void> {
  const target = await page.evaluate(() => {
    const t = window.__museum!.exteriorWorld.rooftop.group.getObjectByName('flight-pad-ii-teleport-interaction')!;
    t.updateWorldMatrix(true, false);
    const p = t.getWorldPosition(t.position.clone());
    return [p.x, p.y, p.z] as [number, number, number];
  });
  await placeInMuseum(page, [target[0] - 3.0, 18.6, target[2]], -Math.PI / 2, -0.1);
  await v.aimAt(target, 'rooftop-flight-pad-ii-teleport');
}

const riseAbove = (page: Page, y: number, timeout = 15_000) =>
  expect.poll(async () => (await pose(page)).y, { timeout, intervals: [100] }).toBeGreaterThan(y);
const settleOn = (page: Page, y: number, timeout = 15_000) =>
  expect.poll(async () => { const p = await pose(page); return Math.abs(p.y - y) < 0.05; }, { timeout, intervals: [100] }).toBe(true);

/** Act I by real input: take the parasol, glide off the meadow lip down to the orchard. */
async function glideToOrchard(page: Page, v: Visitor, shots: string | false = false) {
  await v.walkPath(ROUTE.toParasol.slice(1), { tolerance: 0.4 });
  await v.aimAt(PARASOL_AIM, 'w06-parasol');
  await v.interact();
  expect((await snapshot<W06Snapshot>(page, 'W06')).hasParasol).toBe(true);
  await v.walkPath(ROUTE.toLip, { tolerance: 0.4 });
  await v.turnTo(0);
  if (shots) {
    await v.pitchTo(-0.3);
    await v.holdForward(true);
    await waitForSnapshotWhere(page, 'W06', [{ key: 'gliding', eq: true }], 5_000);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${shots}/03-mechanic-gliding-to-orchard.png` });
    await v.holdForward(false);
  }
  await v.walkPath(ROUTE.glideToOrchard, { tolerance: 0.6 });
  await settleOn(page, ORCHARD.y);
}

async function rideToTerrace(page: Page, v: Visitor, shots: string | false = false) {
  await v.walkPath(ROUTE.intoUpdraftA, { tolerance: 0.5 });
  if (shots) {
    await v.turnTo(0);
    await v.pitchTo(0.04);
    await riseAbove(page, 2.6);
    await page.screenshot({ path: `${shots}/04-transformation-updraft-lift.png` });
  }
  await riseAbove(page, UPDRAFT_A.top);
  await v.walkPath(ROUTE.ontoTerrace, { tolerance: 0.5 });
  await settleOn(page, TERRACE.y);
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w06');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  await enterW06(page, v);
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  const entry = await pose(page);
  await v.enterFromAnchor(/Skyborne Gardens/i, 'W06');
  const spawn = await pose(page);
  expect([spawn.x, spawn.y, spawn.z]).toEqual([0, 0, 24]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/02-arrival.png` });

  await glideToOrchard(page, v, dir);
  await rideToTerrace(page, v, dir);
  await v.walkPath(ROUTE.intoUpdraftB, { tolerance: 0.5 });
  await riseAbove(page, PAVILION.y);
  await v.walkPath(ROUTE.ontoPavilion, { tolerance: 0.5 });
  await settleOn(page, PAVILION.y);
  await v.walkPath([...ROUTE.toPavilionLip, ...ROUTE.glideIntoThermal], { tolerance: 0.7 });
  await riseAbove(page, GREAT_THERMAL.top);
  await v.walkPath(ROUTE.ontoSummit, { tolerance: 0.4 });
  await settleOn(page, SUMMIT.y);
  const atSummit = await snapshot<W06Snapshot>(page, 'W06');
  expect(atSummit.checkpoints).toEqual(['cloud-orchard', 'wind-terrace', 'sky-pavilion', 'summit-garden']);
  expect(atSummit.fallResets).toBe(0);
  expect(atSummit.completionEligible).toBe(false);

  await v.aimAt([CAIRN_POS[0], SUMMIT.y + 1.1, CAIRN_POS[2]], 'w06-cairn');
  await v.interact();
  await waitForSnapshot(page, 'W06', 'finaleStarted', true, 5_000);
  await v.turnTo(0);
  await v.pitchTo(0.32);
  await waitForSnapshotWhere(page, 'W06', [{ key: 'finaleProgress', gte: 0.6 }], 15_000);
  await page.screenshot({ path: `${dir}/05a-finale-great-migration.png` });
  const done = await waitForSnapshot<W06Snapshot>(page, 'W06', 'completionEligible', true, 20_000);
  expect(done.finaleProgress).toBe(1);
  await v.turnTo(Math.PI);
  await v.pitchTo(-0.12);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/05b-finale-golden-gardens.png` });
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W06'))).toBe(false);

  await v.walkTo(GATE_APPROACH[0], GATE_APPROACH[1], { tolerance: 0.4 });
  await v.aimAt([GATE_POS[0], SUMMIT.y + 1.9, GATE_POS[2]], 'w06-return-gate');
  await v.interact();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/06-return.png` });
  const back = await pose(page);
  expect(Math.hypot(back.x - entry.x, back.z - entry.z)).toBeLessThan(1);
  expect(back.y).toBeCloseTo(entry.y, 0);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W06'))).toBe(true); // in-memory preview passport only
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W06 real-time keyboard journey: flight pad console entry, parasol glide, updrafts, Great Thermal, migration, completion return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w06'));
});


test('W06 optional sky lantern on the spire; Back exits without a stamp; repeat visits start fresh', async ({ page }) => {
  const errors = await bootPreview(page, 'w06');
  await enterW06(page, keyboardVisitor(page));
  await enterFromAnchor(page, /Skyborne Gardens/i, 'W06');
  await glideToOrchard(page, keyboardVisitor(page));
  await rideToTerrace(page, keyboardVisitor(page));
  await walkPath(page, ROUTE.intoSpireUpdraft, { tolerance: 0.4 });
  await riseAbove(page, SPIRE.y);
  await walkPath(page, ROUTE.ontoSpire, { tolerance: 0.4 });
  await settleOn(page, SPIRE.y);
  await aimAt(page, [LANTERN_POS[0], SPIRE.y + 1.4, LANTERN_POS[2]], 'w06-lantern');
  await interact(page);
  expect((await snapshot<W06Snapshot>(page, 'W06')).lanternFound).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/07-optional-sky-lantern.png` });
  await walkPath(page, ROUTE.backToTerrace, { tolerance: 0.5 });
  await settleOn(page, TERRACE.y);

  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W06'))).toBe(false);
  for (let visit = 0; visit < 2; visit++) {
    await enterW06(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Skyborne Gardens/i, 'W06');
    const fresh = await snapshot<W06Snapshot>(page, 'W06');
    expect(fresh.hasParasol).toBe(false);
    expect(fresh.lipOpen).toBe(false);
    expect(fresh.lanternFound).toBe(false);
    expect(fresh.checkpoints).toEqual([]);
    await page.getByRole('button', { name: 'Back to Museum' }).click();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  }
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W06'))).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('W06 reduced motion: an updraft places the rider at the hover height at once', async ({ page }) => {
    const errors = await bootPreview(page, 'w06');
    await enterW06(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Skyborne Gardens/i, 'W06');
    await glideToOrchard(page, keyboardVisitor(page));
    await walkPath(page, ROUTE.intoUpdraftA, { tolerance: 0.5 });
    await riseAbove(page, UPDRAFT_A.top, 2_000);
    await turnTo(page, 0);
    await pitchTo(page, -0.1);
    await page.screenshot({ path: `${DIR}/08-reduced-motion-updraft-instant.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W06 continuous touch journey: flight pad entry, parasol glide, updrafts, Great Thermal and migration by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w06-touch'));
    await expectTouchAffordances(page);
  });
});

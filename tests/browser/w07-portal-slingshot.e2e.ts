import { expect, test, type Page } from '@playwright/test';
import type { W07Snapshot } from '../../src/world/pocket/w07/createW07World';
import {
  CORE_POS, GATE_POS, LEDGE_Y, PANEL_A1, PANEL_A2, PANEL_A3, PANEL_B1, PANEL_B2, PANEL_C1, PANEL_C2, PLATE_POS, PROTOTYPE_POS,
  ROUTE, SLINGSHOT_POS,
} from '../../src/world/pocket/w07/w07Layout';
import {
  aimAt, bootPreview, enterFromAnchor, evidenceDir, interact, persistentPassportRaw, pitchTo, placeInMuseum, pose, snapshot, turnTo, waitForSnapshot, waitForSnapshotWhere, walkPath,
} from './helpers/world-journey';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w07');
const snap = (page: Page) => snapshot<W07Snapshot>(page, 'W07');

/**
 * DIAGNOSTIC (museum side only): enter the interior and stand in the Local
 * Systems hall 2.6 m from the test-lab door, facing it.
 */
async function enterW07(page: Page, v: Visitor): Promise<[number, number, number]> {
  await page.evaluate(async () => {
    const app = window.__museum!;
    if (app.activeWorld !== 'interior') {
      await app.worldDirector.prepareInterior();
      for (let i = 0; i < 400 && !app.interiorWorld?.streaming.telemetry.prewarmReady; i++) await new Promise((r) => setTimeout(r, 50));
      if (!(await app.switchToInterior())) throw new Error('interior not entered');
      app.dismissArrival();
    }
  });
  // Hall axis NE: along 45 on the centre line, plus 1 m to the right, facing NE.
  const d = [Math.SQRT1_2, -Math.SQRT1_2], r = [Math.SQRT1_2, Math.SQRT1_2];
  const along = 45, lateral = 1;
  await placeInMuseum(page, [d[0] * along + r[0] * lateral, 10, d[1] * along + r[1] * lateral], -Math.PI / 4, 0);
  const door = await page.evaluate(() => {
    const o = window.__museum!.interiorWorld!.root.getObjectByName('test-lab-door-control')!;
    o.updateWorldMatrix(true, false);
    const p = o.getWorldPosition(o.position.clone());
    return [p.x, p.y + 2.1, p.z] as [number, number, number];
  });
  await v.aimAt(door, 'pocket-portal:w07');
  return door;
}

/** Hold W facing `yaw` until the portal system reports a new transit. */
async function walkInto(page: Page, v: Visitor, yaw: number, timeoutMs = 8_000): Promise<void> {
  const before = (await snap(page)).transits;
  await v.turnTo(yaw, 0.04);
  await v.pitchTo(0);
  await v.holdForward(true);
  try {
    await expect.poll(async () => (await snap(page)).transits, { timeout: timeoutMs, intervals: [50] }).toBeGreaterThan(before);
  } finally {
    await v.holdForward(false);
  }
}
async function fire(page: Page, v: Visitor, target: readonly [number, number, number]) {
  const before = (await snap(page)).shots;
  await v.aimAt(target, 'w07-slingshot');
  await v.interact();
  await expect.poll(async () => (await snap(page)).shots).toBe(before + 1);
}
const settled = (page: Page, y: number, timeout = 10_000) =>
  expect.poll(async () => { const p = await pose(page); return p.grounded && Math.abs(p.y - y) < 0.05; }, { timeout, intervals: [100] }).toBe(true);

async function takeSlingshot(page: Page, v: Visitor) {
  await v.walkPath(ROUTE.toSlingshot.slice(1), { tolerance: 0.4 });
  await v.aimAt([SLINGSHOT_POS[0], 1.0, SLINGSHOT_POS[2]], 'w07-slingshot-stand');
  await v.interact();
  await waitForSnapshot(page, 'W07', 'hasSlingshot', true);
}

async function chamberOne(page: Page, v: Visitor, shot: string | false = false) {
  await v.walkPath(ROUTE.intoChamberOne, { tolerance: 0.5 });
  await fire(page, v, PANEL_A2.centre);
  await fire(page, v, PANEL_A1.centre);
  expect((await snap(page)).linked).toBe(true);
  if (shot) {
    await v.aimAt([3, 1.3, 2], 'w07-slingshot');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${shot}/03-mechanic-linked-portals.png` });
  }
  await v.walkPath(ROUTE.nearA1, { tolerance: 0.4 });
  await walkInto(page, v, Math.PI / 2);
  await waitForSnapshotWhere(page, 'W07', [{ key: 'zone', eq: 'A' }]);
  await expect.poll(async () => (await snap(page)).roomsCleared.includes('A')).toBe(true);
}

async function chamberTwo(page: Page, v: Visitor, shot: string | false = false) {
  await v.walkPath(ROUTE.toChamberTwo, { tolerance: 0.5 });
  await waitForSnapshot(page, 'W07', 'zone', 'B');
  await v.walkPath(ROUTE.toDispenser, { tolerance: 0.4 });
  await fire(page, v, PANEL_B1.centre);
  await fire(page, v, PANEL_B2.centre);
  await v.aimAt([-7.5, 0.4, -8], 'w07-block');
  await v.interact();
  await waitForSnapshot(page, 'W07', 'blockCarried', true);
  await v.walkPath(ROUTE.toB1, { tolerance: 0.4 });
  await walkInto(page, v, Math.PI / 2);
  expect((await snap(page)).blockCarried).toBe(true);
  await v.walkPath(ROUTE.toPlate, { tolerance: 0.3 });
  await v.turnTo(0, 0.04);
  await v.pitchTo(-0.75);
  await page.waitForTimeout(300);
  await v.interact();
  await waitForSnapshot(page, 'W07', 'plateLatched', true);
  if (shot) {
    await v.walkTo(8, -18, { tolerance: 0.4 });
    await v.aimAt([PLATE_POS[0], 0.4, PLATE_POS[2]], 'w07-slingshot');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shot}/04-transformation-plate-latched.png` });
  }
  await v.walkPath(ROUTE.toB2, { tolerance: 0.4 });
  await walkInto(page, v, -Math.PI / 2);
  await v.walkPath(ROUTE.toDoorB, { tolerance: 0.5 });
  await waitForSnapshot(page, 'W07', 'zone', 'C');
}

async function chamberThreeFling(page: Page, v: Visitor, shot: string | false = false) {
  await v.walkPath(ROUTE.toWalkway, { tolerance: 0.4 });
  await fire(page, v, PANEL_C2.centre);
  await v.walkPath(ROUTE.toShaftLip, { tolerance: 0.3 });
  await fire(page, v, PANEL_C1.centre);
  expect((await snap(page)).linked).toBe(true);
  // Walk west off the open drop line; the fall's speed leaves the pylon portal.
  const { flings: before, transits } = await snap(page);
  await v.turnTo(Math.PI / 2, 0.04);
  await v.pitchTo(0);
  await v.holdForward(true);
  try {
    await expect.poll(async () => (await snap(page)).transits, { timeout: 8_000, intervals: [20] }).toBeGreaterThan(transits);
    await v.holdForward(false);
    if (shot) await page.screenshot({ path: `${shot}/04b-fling-across-the-gap.png` });
  } finally {
    await v.holdForward(false);
  }
  expect((await snap(page)).flings).toBe(before + 1);
  await settled(page, LEDGE_Y);
  await waitForSnapshot(page, 'W07', 'ledgeReached', true);
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w07');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  await enterW07(page, v);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  const entry = await pose(page);
  await v.enterFromAnchor(/Portal Slingshot Trials/i, 'W07');
  const spawn = await pose(page);
  expect([spawn.x, spawn.y, spawn.z]).toEqual([0, 0, 26]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/02-arrival.png` });

  await takeSlingshot(page, v);
  await chamberOne(page, v, dir);
  await chamberTwo(page, v, dir);
  await chamberThreeFling(page, v, dir);

  await v.walkPath(ROUTE.toCore, { tolerance: 0.4 });
  await v.aimAt([CORE_POS[0], LEDGE_Y + 1.6, CORE_POS[2]], 'w07-core');
  await v.interact();
  await waitForSnapshot(page, 'W07', 'finaleStarted', true);
  await v.turnTo(Math.PI, 0.05);
  await v.pitchTo(0.25);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${dir}/05a-finale-calibration.png` });
  const done = await waitForSnapshot<W07Snapshot>(page, 'W07', 'completionEligible', true, 20_000);
  expect(done.finaleProgress).toBe(1);
  expect(done.netResets).toBe(0);
  expect(done.roomsCleared).toEqual(['A', 'B', 'C']);
  expect(done.checkpoints).toEqual(['chamber-one-far', 'chamber-two', 'chamber-three', 'ledge']);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W07'))).toBe(false);
  await v.walkPath(ROUTE.toGate, { tolerance: 0.4 });
  await v.aimAt([GATE_POS[0], LEDGE_Y + 1.5, GATE_POS[2]], 'w07-exit');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/05b-finale-exit-portal-open.png` });
  await v.interact();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('interior');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/06-return.png` });
  const back = await pose(page);
  expect(Math.hypot(back.x - entry.x, back.z - entry.z)).toBeLessThan(1);
  expect(back.y).toBeCloseTo(entry.y, 0);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W07'))).toBe(true); // in-memory preview passport only
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W07 real-time keyboard journey: test-lab door entry, three chambers, calibration, completion return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w07'));
});


test('W07 optional prototype through the closet window; Back exits without a stamp; repeat visits start fresh', async ({ page }) => {
  const errors = await bootPreview(page, 'w07');
  await enterW07(page, keyboardVisitor(page));
  await enterFromAnchor(page, /Portal Slingshot Trials/i, 'W07');
  await takeSlingshot(page, keyboardVisitor(page));
  await walkPath(page, ROUTE.intoChamberOne, { tolerance: 0.5 });
  await fire(page, keyboardVisitor(page), PANEL_A1.centre);
  await walkPath(page, ROUTE.toCloset, { tolerance: 0.4 });
  await fire(page, keyboardVisitor(page), PANEL_A3.centre);
  expect((await snap(page)).portals.map((p) => p.panel)).toEqual(['A1', 'A3']);
  await walkPath(page, ROUTE.nearA1, { tolerance: 0.4 });
  await walkInto(page, keyboardVisitor(page), Math.PI / 2);
  await aimAt(page, [PROTOTYPE_POS[0], 1.1, PROTOTYPE_POS[2]], 'w07-prototype');
  await interact(page);
  await waitForSnapshot(page, 'W07', 'optionalFound', true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/07-optional-first-prototype.png` });
  // Back out through A3 to Chamber One's near side.
  await walkInto(page, keyboardVisitor(page), -Math.PI / 2);
  expect((await pose(page)).x).toBeLessThan(-6);

  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('interior');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W07'))).toBe(false);
  for (let visit = 0; visit < 2; visit++) {
    await enterW07(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Portal Slingshot Trials/i, 'W07');
    const fresh = await snap(page);
    expect(fresh.hasSlingshot).toBe(false);
    expect(fresh.portals).toEqual([]);
    expect(fresh.optionalFound).toBe(false);
    expect(fresh.plateLatched).toBe(false);
    expect(fresh.checkpoints).toEqual([]);
    await page.getByRole('button', { name: 'Back to Museum' }).click();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('interior');
  }
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W07'))).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('W07 reduced motion: the fall-and-fling lands on the ledge at once', async ({ page }) => {
    const errors = await bootPreview(page, 'w07');
    await enterW07(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Portal Slingshot Trials/i, 'W07');
    await takeSlingshot(page, keyboardVisitor(page));
    await chamberOne(page, keyboardVisitor(page));
    await chamberTwo(page, keyboardVisitor(page));
    await walkPath(page, ROUTE.toWalkway, { tolerance: 0.4 });
    await fire(page, keyboardVisitor(page), PANEL_C2.centre);
    await walkPath(page, ROUTE.toShaftLip, { tolerance: 0.3 });
    await fire(page, keyboardVisitor(page), PANEL_C1.centre);
    await walkInto(page, keyboardVisitor(page), Math.PI / 2);
    // Resolved at once: on the ledge, with no flight in progress.
    const p = await pose(page);
    expect(p.y).toBeCloseTo(LEDGE_Y, 1);
    expect((await snap(page)).flying).toBe(false);
    await turnTo(page, 0);
    await pitchTo(page, -0.05);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/08-reduced-motion-fling-instant.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W07 continuous touch journey: three portal chambers, aiming, momentum fling and calibration by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w07-touch'));
    await expectTouchAffordances(page);
  });
});

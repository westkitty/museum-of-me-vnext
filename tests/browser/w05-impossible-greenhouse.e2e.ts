import { expect, test, type Page } from '@playwright/test';
import type { W05Snapshot } from '../../src/world/pocket/w05/createW05World';
import {
  CANOPY_MIRROR_POS, CANOPY_Y, DEW_VALVE_POS, GATE_APPROACH, GATE_POS, LILY_PADS, MIRROR_STAND, ORCHID_POS,
  RAFT_TOP, RAFT_VALVE_XZ, ROUTE, SUN_MIRROR_POS,
} from '../../src/world/pocket/w05/w05Layout';
import {
  aimAt, bootPreview, enterFromAnchor, evidenceDir, interact, persistentPassportRaw, placeInMuseum, pose, pitchTo, snapshot, waitForSnapshot, waitForSnapshotWhere, walkPath,
} from './helpers/world-journey';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w05');
const MIRROR_AIM: [number, number, number] = [SUN_MIRROR_POS[0], 0.8, SUN_MIRROR_POS[2]]; // pedestal body: the disc can be edge-on
const VALVE_AIM: [number, number, number] = [RAFT_VALVE_XZ[0], 0.95, RAFT_VALVE_XZ[1]];

const face = (v: Visitor, from: { x: number; z: number }, x: number, z: number) => v.turnTo(Math.atan2(-(x - from.x), -(z - from.z)));

/**
 * DIAGNOSTIC (museum side only): stand inside the rooftop conservatory, south
 * of the exotic flower, facing it. Returns the flower's interaction target position.
 */
async function enterW05(page: Page, v: Visitor): Promise<[number, number, number]> {
  const target = await page.evaluate(() => {
    const t = window.__museum!.exteriorWorld.rooftop.group.getObjectByName('greenhouse-flower-w05-interaction')!;
    t.updateWorldMatrix(true, false);
    const p = t.getWorldPosition(t.position.clone());
    return [p.x, p.y, p.z] as [number, number, number];
  });
  await placeInMuseum(page, [target[0], 18.6, target[2] + 3.6], 0, -0.05);
  await v.aimAt(target, 'rooftop-greenhouse-flower-w05');
  return target;
}

async function growPads(page: Page, v: Visitor) {
  await v.walkPath(ROUTE.toMirror.slice(1), { tolerance: 0.4 });
  await v.aimAt(MIRROR_AIM, 'w05-sun-mirror');
  for (let i = 0; i < LILY_PADS.length; i++) {
    await v.interact();
    await page.waitForTimeout(150);
  }
  return waitForSnapshot<W05Snapshot>(page, 'W05', 'pondComplete', true, 15_000);
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w05');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  await enterW05(page, v);
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  const entry = await pose(page);
  await v.enterFromAnchor(/Impossible Greenhouse/i, 'W05');
  const spawn = await pose(page);
  expect([spawn.x, spawn.y, spawn.z]).toEqual([0, 0, 24]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/02-arrival.png` });

  // Act I: turn the Sun Mirror; watch the first pad grow from the mirror stand.
  await v.walkPath(ROUTE.toMirror.slice(1), { tolerance: 0.4 });
  await v.aimAt(MIRROR_AIM, 'w05-sun-mirror');
  await v.interact();
  await face(v, { x: MIRROR_STAND[0], z: MIRROR_STAND[1] }, LILY_PADS[1][0], LILY_PADS[1][1]);
  await v.pitchTo(-0.32);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${dir}/03-mechanic-light-grows-lily.png` });
  await v.aimAt(MIRROR_AIM, 'w05-sun-mirror');
  await v.interact();
  await v.interact();
  await waitForSnapshot(page, 'W05', 'pondComplete', true, 15_000);
  const deck = await v.walkPath([...ROUTE.toPond, ...ROUTE.acrossPond], { tolerance: 0.45 });
  expect(deck.y).toBeCloseTo(0, 1);

  // Act II: ride the raft as the cistern floods.
  await v.walkPath(ROUTE.toRaft, { tolerance: 0.45 });
  await v.aimAt(VALVE_AIM, 'w05-raft-valve');
  await v.interact();
  await v.turnTo(0);
  await v.pitchTo(0.12);
  await waitForSnapshotWhere(page, 'W05', [{ key: 'raftY', gte: 3.2 }], 10_000);
  await page.screenshot({ path: `${dir}/04-transformation-cistern-floods.png` });
  const raft = await waitForSnapshotWhere<W05Snapshot>(page, 'W05', [{ key: 'raftY', gte: RAFT_TOP }], 15_000);
  expect(raft.raftRiding).toBe(true);
  expect((await pose(page)).y).toBeCloseTo(RAFT_TOP, 1);
  const gallery = await v.walkPath(ROUTE.offRaft, { tolerance: 0.5 });
  expect(gallery.y).toBeCloseTo(6, 1);

  // Act III: the canopy, light and water.
  const canopy = await v.walkPath(ROUTE.toCanopy, { tolerance: 0.5 });
  expect(canopy.y).toBeCloseTo(CANOPY_Y, 1);
  const atCanopy = await snapshot<W05Snapshot>(page, 'W05');
  expect(atCanopy.checkpoints).toEqual(['fern-hall', 'vine-gallery', 'canopy']);
  expect(atCanopy.completionEligible).toBe(false);
  await v.walkPath(ROUTE.toCanopyMirror, { tolerance: 0.4 });
  await v.aimAt([CANOPY_MIRROR_POS[0], CANOPY_Y + 0.8, CANOPY_MIRROR_POS[2]], 'w05-canopy-mirror');
  await v.interact();
  await v.interact();
  expect((await snapshot<W05Snapshot>(page, 'W05')).canopyTarget).toBe('bud');
  expect((await snapshot<W05Snapshot>(page, 'W05')).finaleStarted).toBe(false);
  await v.walkPath(ROUTE.toDewValve, { tolerance: 0.4 });
  await v.aimAt([DEW_VALVE_POS[0], CANOPY_Y + 0.9, DEW_VALVE_POS[2]], 'w05-dew-valve');
  await v.interact();
  await waitForSnapshot(page, 'W05', 'finaleStarted', true, 5_000);
  // Watch the Bloom from part-way down the leaf ramp (leaving the canopy never interrupts it).
  await v.walkPath([[4.4, -55], [0, -52], [0, -44]], { tolerance: 0.5 });
  await v.turnTo(0);
  await v.pitchTo(0.26);
  await waitForSnapshotWhere(page, 'W05', [{ key: 'finaleProgress', gte: 0.6 }], 15_000);
  await page.screenshot({ path: `${dir}/05a-finale-bloom-opening.png` });
  const done = await waitForSnapshot<W05Snapshot>(page, 'W05', 'completionEligible', true, 20_000);
  expect(done.finaleProgress).toBe(1);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/05b-finale-dawn-bloom.png` });
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W05'))).toBe(false);

  await v.walkPath([[0, -52.5], [GATE_APPROACH[0], -54], GATE_APPROACH], { tolerance: 0.4 });
  await v.aimAt([GATE_POS[0], CANOPY_Y + 1.2, GATE_POS[2]], 'w05-return-gate');
  await v.interact();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/06-return.png` });
  const back = await pose(page);
  expect(Math.hypot(back.x - entry.x, back.z - entry.z)).toBeLessThan(1);
  expect(back.y).toBeCloseTo(entry.y, 0);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W05'))).toBe(true); // in-memory preview passport only
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W05 real-time keyboard journey: rooftop flower entry, light grows lilies, flooding cistern, the Bloom, completion return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w05'));
});


test('W05 optional night orchid; Back exits without a stamp; repeat visits start dark and fresh', async ({ page }) => {
  const errors = await bootPreview(page, 'w05');
  await enterW05(page, keyboardVisitor(page));
  await enterFromAnchor(page, /Impossible Greenhouse/i, 'W05');
  await growPads(page, keyboardVisitor(page));
  await walkPath(page, [...ROUTE.toPond, ...ROUTE.acrossPond], { tolerance: 0.45 });
  await walkPath(page, ROUTE.orchid, { tolerance: 0.4 });
  await aimAt(page, [ORCHID_POS[0], 0.35, ORCHID_POS[2]], 'w05-orchid'); // pot body, not the thin stem
  await interact(page);
  expect((await snapshot<W05Snapshot>(page, 'W05')).orchidFound).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/07-optional-night-orchid.png` });

  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W05'))).toBe(false);
  for (let visit = 0; visit < 2; visit++) {
    await enterW05(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Impossible Greenhouse/i, 'W05');
    const fresh = await snapshot<W05Snapshot>(page, 'W05');
    expect(fresh.padsLit).toEqual([false, false, false]);
    expect(fresh.raftY).toBe(0);
    expect(fresh.orchidFound).toBe(false);
    expect(fresh.checkpoints).toEqual([]);
    await page.getByRole('button', { name: 'Back to Museum' }).click();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  }
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W05'))).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('W05 reduced motion: a lit pad and the flooded raft reach their final state at once', async ({ page }) => {
    const errors = await bootPreview(page, 'w05');
    await enterW05(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Impossible Greenhouse/i, 'W05');
    await walkPath(page, ROUTE.toMirror.slice(1), { tolerance: 0.4 });
    await aimAt(page, MIRROR_AIM, 'w05-sun-mirror');
    await interact(page);
    expect((await snapshot<W05Snapshot>(page, 'W05')).padGrowth[0]).toBe(1);
    await face(keyboardVisitor(page), { x: MIRROR_STAND[0], z: MIRROR_STAND[1] }, LILY_PADS[1][0], LILY_PADS[1][1]);
    await pitchTo(page, -0.32);
    await page.screenshot({ path: `${DIR}/08-reduced-motion-pad-instant.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W05 continuous touch journey: light grows lilies, flooding cistern and the Bloom by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w05-touch'));
    await expectTouchAffordances(page);
  });
});

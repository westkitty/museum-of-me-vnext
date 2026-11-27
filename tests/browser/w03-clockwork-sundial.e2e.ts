import { expect, test, type Page } from '@playwright/test';
import type { W03Snapshot } from '../../src/world/pocket/w03/createW03World';
import {
  GATE_APPROACH, LATCH_ROUTE, latchPosition, ROUTE, STAR_CHART_POS, SUN_CAGE, SUN_GATE_POS,
} from '../../src/world/pocket/w03/w03Layout';
import {
  aimAt, bootPreview, enterFromAnchor, evidenceDir, interact, persistentPassportRaw, placeInMuseum, pose, snapshot, turnTo, waitForSnapshot, waitForSnapshotWhere, walkPath,
} from './helpers/world-journey';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w03');
/** Supported approach on the astronomical terrace, facing the bronze gnomon at (-34, 134). */
const APPROACH: [number, number, number] = [-37.4, -0.3, 134];
const GNOMON_TOP: [number, number, number] = [-34, 0.45, 134];

async function enterW03(page: Page, v: Visitor) {
  await placeInMuseum(page, APPROACH, -Math.PI / 2, -0.25);
  await v.aimAt(GNOMON_TOP, 'pocket-portal:w03');
}

const face = (v: Visitor, from: { x: number; z: number }, x: number, z: number) => v.turnTo(Math.atan2(-(x - from.x), -(z - from.z)));

/** Acts I–II by real input: turnstile, lift and shuttle, each crossed only inside its published window. */
async function crossToOrreryLanding(page: Page, v: Visitor, opts: { mechanicShots?: boolean; dir?: string } = {}) {
  const shots = opts.dir ?? DIR;
  await v.walkPath(ROUTE.toArm.slice(1), { run: true });
  if (opts.mechanicShots) {
    // From the plaza edge: the turnstile swings away mid-turn; its lamp shows red.
    await v.turnTo(0);
    await v.pitchTo(-0.22);
    await waitForSnapshotWhere(page, 'W03', [{ key: 'armAligned', eq: false }], 30_000);
    await page.waitForTimeout(1250);
    await page.screenshot({ path: `${shots}/03-mechanic-turnstile-turning.png` });
  }
  await waitForSnapshotWhere(page, 'W03', [{ key: 'armAligned', eq: true }, { key: 'armWindowLeft', gte: 3 }], 40_000);
  await v.walkPath(ROUTE.acrossArm, { run: true });
  await v.walkPath(ROUTE.toLift, { run: true });
  await waitForSnapshotWhere(page, 'W03', [{ key: 'liftPhase', eq: 'bottom' }, { key: 'liftWindowLeft', gte: 2.5 }], 40_000);
  await v.walkTo(ROUTE.ontoLift[0][0], ROUTE.ontoLift[0][1], { tolerance: 0.6 });
  expect((await waitForSnapshot<W03Snapshot>(page, 'W03', 'liftPhase', 'top', 30_000)).riding).toBe('lift');
  expect((await pose(page)).y).toBeCloseTo(5, 1);
  await v.walkPath(ROUTE.offLift, { tolerance: 0.6 });
  await waitForSnapshotWhere(page, 'W03', [{ key: 'shuttleDock', eq: 'A' }, { key: 'shuttleWindowLeft', gte: 2.5 }], 40_000);
  await v.walkTo(ROUTE.ontoShuttle[0][0], ROUTE.ontoShuttle[0][1], { tolerance: 0.5 });
  const riding = await waitForSnapshotWhere<W03Snapshot>(page, 'W03', [{ key: 'shuttleDock', eq: null }], 30_000);
  expect(riding.riding).toBe('shuttle');
  if (opts.mechanicShots) {
    await v.turnTo(0);
    await v.pitchTo(0.02);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shots}/04-transformation-shuttle-to-orrery.png` });
  }
  await waitForSnapshot(page, 'W03', 'shuttleDock', 'B', 30_000);
  await v.walkPath(ROUTE.offShuttle, { tolerance: 0.7 });
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w03');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  await enterW03(page, v);
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  await v.enterFromAnchor(/Clockwork Sundial/i, 'W03');
  const spawn = await pose(page);
  expect([spawn.x, spawn.y, spawn.z]).toEqual([0, 0, 30]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/02-arrival.png` });

  await crossToOrreryLanding(page, v, { mechanicShots: true, dir });
  // The turning crown gear carries the visitor while they cross it to the ramp.
  const crown = await v.walkPath([...ROUTE.ontoGearAndRamp, ...ROUTE.toCage], { run: true, tolerance: 0.7 });
  expect(crown.y).toBeCloseTo(12, 1);
  const atCrown = await snapshot<W03Snapshot>(page, 'W03');
  expect(atCrown.checkpoints).toEqual(['forecast-gallery', 'escapement-gallery', 'orrery-landing', 'sundial-crown']);
  expect(atCrown.completionEligible).toBe(false);

  // Act III: prime each latch; the gnomon's shadow releases them in turn.
  for (const leg of LATCH_ROUTE) {
    await v.walkPath(leg.via, { tolerance: 0.5 });
    const [lx, ly, lz] = latchPosition(leg.latch);
    await v.aimAt([lx, ly + 1.0, lz], `w03-latch-${leg.latch}`);
    await v.interact();
    expect((await snapshot<W03Snapshot>(page, 'W03')).latchesPrimed[leg.latch]).toBe(true);
  }
  // Watch from the crown's south-east lookout: cage ahead, the sun rising north beyond it.
  await v.walkPath([[-14, -46], [-13.6, -43.6]], { tolerance: 0.5 });
  const lookout = await pose(page);
  await face(v, lookout, SUN_CAGE[0] - 2, SUN_CAGE[2] - 6);
  await v.pitchTo(0.22);
  await waitForSnapshot(page, 'W03', 'finaleStarted', true, 40_000);
  await waitForSnapshotWhere(page, 'W03', [{ key: 'finaleProgress', gte: 0.5 }], 20_000);
  await page.screenshot({ path: `${dir}/05a-finale-sunrise-rising.png` });
  const done = await waitForSnapshot<W03Snapshot>(page, 'W03', 'completionEligible', true, 30_000);
  expect(done.finaleProgress).toBe(1);
  await v.pitchTo(0.3);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/05b-finale-dawn.png` });
  await v.walkTo(GATE_APPROACH[0], GATE_APPROACH[1], { tolerance: 0.5 });
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W03'))).toBe(false);

  await v.aimAt([SUN_GATE_POS[0], SUN_GATE_POS[1] + 1.7, SUN_GATE_POS[2]], 'w03-return-gate');
  await v.interact();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/06-return.png` });
  const back = await pose(page);
  expect(Math.hypot(back.x - APPROACH[0], back.z - APPROACH[2])).toBeLessThan(3);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W03'))).toBe(true); // in-memory preview passport only
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W03 real-time keyboard journey: turnstile, lift, shuttle, crown gear, three latches, sunrise, completion return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w03'));
});


test('W03 optional star chart; Back exits without a stamp; repeat visits restart the machine cleanly', async ({ page }) => {
  const errors = await bootPreview(page, 'w03');
  await enterW03(page, keyboardVisitor(page));
  await enterFromAnchor(page, /Clockwork Sundial/i, 'W03');
  await crossToOrreryLanding(page, keyboardVisitor(page));
  await walkPath(page, [[17, -36], [25.6, -36]], { tolerance: 0.5 });
  await aimAt(page, [STAR_CHART_POS[0], STAR_CHART_POS[1] + 1.1, STAR_CHART_POS[2]], 'w03-star-chart');
  await interact(page);
  expect((await snapshot<W03Snapshot>(page, 'W03')).starChartAligned).toBe(true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DIR}/07-optional-star-chart.png` });

  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W03'))).toBe(false);

  for (let visit = 0; visit < 2; visit++) {
    await enterW03(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Clockwork Sundial/i, 'W03');
    const fresh = await snapshot<W03Snapshot>(page, 'W03');
    expect(fresh.t).toBeLessThan(5);
    expect(fresh.checkpoints).toEqual([]);
    expect(fresh.starChartAligned).toBe(false);
    expect(fresh.latchesPrimed).toEqual([false, false, false]);
    await page.getByRole('button', { name: 'Back to Museum' }).click();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  }
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W03'))).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('W03 reduced motion: the turnstile holds aligned and never carries the view round', async ({ page }) => {
    const errors = await bootPreview(page, 'w03');
    await enterW03(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Clockwork Sundial/i, 'W03');
    await page.waitForTimeout(10_000); // longer than the turnstile's hold
    const snap = await snapshot<W03Snapshot>(page, 'W03');
    expect(snap.t).toBeGreaterThan(9);
    expect(snap.armAligned).toBe(true);
    expect(Math.abs(Math.sin(snap.armAngle))).toBeLessThan(1e-9);
    const gallery = await walkPath(page, [...ROUTE.toArm.slice(1), ...ROUTE.acrossArm], { run: true });
    expect(gallery.y).toBeCloseTo(0, 1);
    await turnTo(page, Math.PI);
    await page.screenshot({ path: `${DIR}/08-reduced-motion-turnstile-held.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W03 continuous touch journey: turnstile, lift, shuttle, crown gear, three latches and sunrise by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w03-touch'));
    await expectTouchAffordances(page);
  });
});

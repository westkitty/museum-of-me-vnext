import { expect, test, type Page } from '@playwright/test';
import type { W04Snapshot } from '../../src/world/pocket/w04/createW04World';
import { BSIDE_POS, EQ_CONSOLE_POS, GATE_APPROACH, GATE_POS, MASTER_POS, PAD_POSITIONS, ROUTE } from '../../src/world/pocket/w04/w04Layout';
import {
  aimAt, bootPreview, enterFromAnchor, evidenceDir, interact, persistentPassportRaw, placeInMuseum, pose, snapshot, turnTo, waitForSnapshot, walkPath,
} from './helpers/world-journey';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w04');

/**
 * DIAGNOSTIC (museum side only): prepare and enter the interior, then stand in
 * front of the E19 DexTilt desk once it has streamed in. Returns the
 * desktop display's world position (the W04 anchor).
 */
async function approachE19(page: Page): Promise<[number, number, number]> {
  await page.evaluate(async () => {
    const app = window.__museum!;
    if (app.activeWorld !== 'interior') {
      await app.worldDirector.prepareInterior();
      for (let i = 0; i < 400 && !app.interiorWorld?.streaming.telemetry.prewarmReady; i++) await new Promise((r) => setTimeout(r, 50));
      if (!(await app.switchToInterior())) throw new Error('interior not entered');
      app.dismissArrival();
    }
  });
  await placeInMuseum(page, [51, 0, -10.2], 0, 0);
  const display = await page.waitForFunction(() => {
    const d = window.__museum!.interiorWorld?.root.getObjectByName('dextilt-desktop-display');
    if (!d) return null;
    d.updateWorldMatrix(true, false);
    const p = d.getWorldPosition(d.position.clone());
    return [p.x, p.y, p.z];
  }, undefined, { timeout: 60_000, polling: 200 });
  const at = (await display.jsonValue()) as [number, number, number];
  await placeInMuseum(page, [at[0], 0, at[2] + 2.9], 0, 0);
  return at;
}

async function enterW04(page: Page, v: Visitor): Promise<[number, number, number]> {
  const display = await approachE19(page);
  await v.aimAt(display, 'pocket-portal:w04');
  return display;
}

async function buildBridgeAndCross(page: Page, v: Visitor) {
  await v.walkPath(ROUTE.toPads.slice(1), { tolerance: 0.5 });
  for (let i = 0; i < PAD_POSITIONS.length; i++) {
    const [x, y, z] = PAD_POSITIONS[i];
    await v.aimAt([x, y + 0.65, z], `w04-pad-${i}`);
    await v.interact();
  }
  await waitForSnapshot(page, 'W04', 'bridgeComplete', true, 15_000);
  return v.walkPath([...ROUTE.toBridge, ...ROUTE.acrossBridge], { run: true });
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w04');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  await enterW04(page, v);
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  const entry = await pose(page);
  await v.enterFromAnchor(/Digital Beat World/i, 'W04');
  const spawn = await pose(page);
  expect([spawn.x, spawn.y, spawn.z]).toEqual([0, 0, 24]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/02-arrival.png` });

  // Act I: record beats; capture the bridge mid-rise from the plaza.
  await v.walkPath(ROUTE.toPads.slice(1), { tolerance: 0.5 });
  for (let i = 0; i < PAD_POSITIONS.length; i++) {
    const [x, y, z] = PAD_POSITIONS[i];
    await v.aimAt([x, y + 0.65, z], `w04-pad-${i}`);
    await v.interact();
    if (i === 2) {
      await v.turnTo(Math.atan2(-(0 - -3.6), -(8 - 22.75)));
      await v.pitchTo(-0.1);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${dir}/03-mechanic-beats-raise-bridge.png` });
    }
  }
  await waitForSnapshot(page, 'W04', 'bridgeComplete', true, 15_000);
  const deck = await v.walkPath([...ROUTE.toBridge, ...ROUTE.acrossBridge], { run: true });
  expect(deck.y).toBeCloseTo(0, 1);

  // Act II: cycle the EQ preset to Rise and watch the bars become a stair.
  await v.walkPath(ROUTE.toConsole, { tolerance: 0.5 });
  await v.aimAt([EQ_CONSOLE_POS[0], 0.6, EQ_CONSOLE_POS[2]], 'w04-eq-console');
  await v.interact();
  expect((await snapshot<W04Snapshot>(page, 'W04')).eqPreset).toBe('wave');
  await v.interact();
  expect((await snapshot<W04Snapshot>(page, 'W04')).eqPreset).toBe('rise');
  await v.turnTo(Math.atan2(-(0 - 3), -(-22 - -9)));
  await v.pitchTo(0.1);
  await waitForSnapshot(page, 'W04', 'eqSettled', true, 10_000);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/04-transformation-eq-stair.png` });
  const mezz = await v.walkPath(ROUTE.upStair, { tolerance: 0.6 });
  expect(mezz.y).toBeCloseTo(6, 1);

  // Act III: the Stage and the Drop.
  const stage = await v.walkPath(ROUTE.toStage, { tolerance: 0.6 });
  expect(stage.y).toBeCloseTo(10, 1);
  const atStage = await snapshot<W04Snapshot>(page, 'W04');
  expect(atStage.checkpoints).toEqual(['beat-deck', 'mezzanine', 'stage']);
  expect(atStage.completionEligible).toBe(false);
  await v.aimAt([MASTER_POS[0], MASTER_POS[1] + 0.6, MASTER_POS[2]], 'w04-master');
  await v.interact();
  await v.walkTo(GATE_APPROACH[0], GATE_APPROACH[1] + 1.5, { tolerance: 0.5 });
  await v.turnTo(Math.atan2(-(0 - 4.6), -(-75 - -53.5)));
  await v.pitchTo(0.18);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${dir}/05a-finale-the-drop.png` });
  const done = await waitForSnapshot<W04Snapshot>(page, 'W04', 'completionEligible', true, 20_000);
  expect(done.finaleProgress).toBe(1);
  await v.turnTo(Math.atan2(-(0 - 4.6), -(10 - -53.5)));
  await v.pitchTo(-0.2);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/05b-finale-world-lit.png` });
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W04'))).toBe(false);

  await v.walkTo(GATE_APPROACH[0], GATE_APPROACH[1], { tolerance: 0.5 });
  await v.aimAt([GATE_POS[0], GATE_POS[1] + 1.8, GATE_POS[2]], 'w04-return-gate');
  await v.interact();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('interior');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/06-return.png` });
  const back = await pose(page);
  expect(Math.hypot(back.x - entry.x, back.z - entry.z)).toBeLessThan(1);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W04'))).toBe(true); // in-memory preview passport only
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W04 real-time keyboard journey: E19 entry, beat pads build the bridge, EQ stair, the Drop, completion return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w04'));
});


test('W04 optional B-side; Back exits without a stamp; repeat visits start silent and fresh', async ({ page }) => {
  const errors = await bootPreview(page, 'w04');
  await enterW04(page, keyboardVisitor(page));
  await enterFromAnchor(page, /Digital Beat World/i, 'W04');
  await buildBridgeAndCross(page, keyboardVisitor(page));
  await walkPath(page, ROUTE.bside, { tolerance: 0.5 });
  await aimAt(page, [BSIDE_POS[0], 0.5, BSIDE_POS[2]], 'w04-bside');
  await interact(page);
  expect((await snapshot<W04Snapshot>(page, 'W04')).bsideFound).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/07-optional-b-side.png` });

  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('interior');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W04'))).toBe(false);
  for (let visit = 0; visit < 2; visit++) {
    await enterW04(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Digital Beat World/i, 'W04');
    const fresh = await snapshot<W04Snapshot>(page, 'W04');
    expect(fresh.beatsRecorded).toEqual([false, false, false, false]);
    expect(fresh.eqPreset).toBe('flat');
    expect(fresh.bsideFound).toBe(false);
    await page.getByRole('button', { name: 'Back to Museum' }).click();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('interior');
  }
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W04'))).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('W04 reduced motion: recorded segments and the EQ stair appear in their final state at once', async ({ page }) => {
    const errors = await bootPreview(page, 'w04');
    await enterW04(page, keyboardVisitor(page));
    await enterFromAnchor(page, /Digital Beat World/i, 'W04');
    await walkPath(page, ROUTE.toPads.slice(1), { tolerance: 0.5 });
    const [x, y, z] = PAD_POSITIONS[0];
    await aimAt(page, [x, y + 0.65, z], 'w04-pad-0');
    await interact(page);
    expect((await snapshot<W04Snapshot>(page, 'W04')).bridgeSegmentsUp).toBe(2);
    await turnTo(page, Math.atan2(-(0 - -3.6), -(8 - 22.75)));
    await page.screenshot({ path: `${DIR}/08-reduced-motion-segments-instant.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W04 continuous touch journey: E19 entry, beat pads, EQ stair and the Drop by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w04-touch'));
    await expectTouchAffordances(page);
  });
});

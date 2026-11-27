import { expect, type Page } from '@playwright/test';
import type { L01Snapshot } from '../../../src/world/pocket/l01/createL01World';
import type { W09Snapshot } from '../../../src/world/pocket/w09/createW09World';
import type { W10Snapshot } from '../../../src/world/pocket/w10/createW10World';
import { pose, snapshot } from './world-journey';
import type { Visitor } from './visitor';

/**
 * In-world routes shared by the single-world journeys and the cross-world
 * sessions: each starts on arrival inside the world and ends back in the
 * museum, using only the visitor's input. `dir` names the evidence folder, or
 * false for no screenshots.
 */
type Shots = string | false;
const shooter = (page: Page, dir: Shots) => async (name: string) => {
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
};
const backInMuseum = (page: Page) => expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');

/**
 * Cross W09's meteor cascade as a visitor does. The stones move only while the
 * visitor moves, so one at rest beside the rail can pin a visitor who keeps
 * pushing forward (no movement, so no time, so the stone never moves). When
 * the walk stalls, step back toward the centre of the walkway (time advances
 * and the stone swings away) and try again.
 */
async function crossCascade(page: Page, v: Visitor, x: number, z: number, tolerance: number): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await v.walkTo(x, z, { tolerance, timeoutMs: attempt < 3 ? 20_000 : 90_000 });
      return;
    } catch (error) {
      if (attempt >= 3) throw error;
      const p = await pose(page);
      console.log(JSON.stringify({ w09CascadeStepBack: { at: [+p.x.toFixed(2), +p.z.toFixed(2)], toward: [x, z], attempt } }));
      await v.walkTo(p.x * 0.4, p.z + 2.5, { tolerance: 0.8, timeoutMs: 20_000 });
    }
  }
}

export async function w09Route(page: Page, v: Visitor, dir: Shots): Promise<void> {
  const snap = () => snapshot<W09Snapshot>(page, 'W09');
  const shot = shooter(page, dir);
  await page.waitForTimeout(600);
  await shot('02-arrival');
  const t0 = (await snap()).localTime;
  await page.waitForTimeout(700);
  expect((await snap()).localTime).toBe(t0);
  await v.walkTo(0, 20, { tolerance: 0.5 });
  expect((await snap()).localTime).toBeGreaterThan(t0);
  await v.aimAt([0, 1.65, 19], 'w09-time-dial');
  for (let i = 0; i < 5 && !(await snap()).orreryBridge; i++) await v.interact();
  await expect.poll(async () => (await snap()).orreryBridge).toBe(true);
  await shot('03-mechanic-orrery-bridge');
  await v.walkTo(0, -3, { tolerance: 0.7 });
  for (let i = 0; i < 2; i++) {
    await v.walkTo(i === 0 ? -3.5 : 3.5, -4.5, { tolerance: 0.55 });
    await v.aimAt([i === 0 ? -4 : 4, 1.65, -6], `w09-constellation-${i}`);
    for (let j = 0; j < 25 && !(await snap()).aligned[i]; j++) await v.interact();
    expect((await snap()).aligned[i]).toBe(true);
  }
  await expect.poll(async () => (await snap()).meteorBridge).toBe(true);
  await shot('04-transformation-constellations');
  await v.walkTo(0, -25, { tolerance: 0.7 });
  await crossCascade(page, v, -2.4, -39, 0.8);
  await crossCascade(page, v, 2.4, -46, 0.8);
  await shot('05a-meteor-cascade');
  await crossCascade(page, v, -2.4, -54, 0.8);
  await crossCascade(page, v, 0, -67, 0.7);
  await expect.poll(async () => (await snap()).finaleProgress, { timeout: 15_000 }).toBe(1);
  await v.turnTo(0);
  await v.pitchTo(0.25);
  await shot('05b-final-alignment');
  await v.walkTo(0, -70.5, { tolerance: 0.5 });
  await v.aimAt([0, 6.65, -73], 'w09-exit');
  await v.interact();
  await backInMuseum(page);
  await shot('06-return');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W09'))).toBe(true);
}

export async function w10Route(page: Page, v: Visitor, dir: Shots): Promise<void> {
  const snap = () => snapshot<W10Snapshot>(page, 'W10');
  const shot = shooter(page, dir);
  await page.waitForTimeout(500);
  expect((await snap()).rigStatus).toBe('TEST_ONLY_NOT_APPROVED_DEXTER');
  await shot('02-arrival-plateau');
  await v.walkTo(0, 32, { tolerance: 0.7 });
  await v.interact();
  expect((await snap()).hasGlider).toBe(true);
  await v.walkTo(0, 5, { tolerance: 0.9, timeoutMs: 60_000 });
  await shot('03-mechanic-glide-to-valley');
  await v.walkTo(15, -27.5, { tolerance: 0.8 });
  await v.interact();
  expect((await snap()).climbing).toBe(true);
  await v.holdForward(true);
  await expect.poll(async () => (await snap()).climbing, { timeout: 10_000 }).toBe(false);
  await v.holdForward(false);
  await shot('04-cliff-crest');
  await v.walkTo(12, -42, { tolerance: 0.7 });
  for (let i = 0; i < 3; i++) await v.interact();
  await v.walkTo(18, -42, { tolerance: 0.7 });
  for (let i = 0; i < 3; i++) await v.interact();
  expect((await snap()).blockSteps).toEqual([3, 3]);
  expect((await snap()).shrineOpen).toBe(true);
  await shot('05-shrine-opens');
  await v.walkTo(15, -54, { tolerance: 0.8 });
  await v.walkTo(0, -89, { tolerance: 1, timeoutMs: 80_000 });
  await v.walkTo(0, -99, { tolerance: 0.8 });
  await v.interact();
  await expect.poll(async () => (await snap()).panoramaProgress, { timeout: 15_000 }).toBe(1);
  await v.walkTo(-7, -98, { tolerance: 0.8 });
  await v.turnTo(0);
  await shot('06-final-panorama');
  await v.walkTo(0, -99, { tolerance: 0.8 });
  await v.interact();
  await backInMuseum(page);
  await shot('07-return');
}

export async function l01Route(page: Page, v: Visitor, dir: Shots): Promise<void> {
  const snap = () => snapshot<L01Snapshot>(page, 'L01');
  const shot = shooter(page, dir);
  await shot('02-arrival');
  await expect.poll(async () => (await snap()).revealed[0], { timeout: 20_000 }).toBe(true);
  await shot('03-mechanic-first-light-path');
  await v.walkTo(0, 0, { tolerance: 0.8 });
  await expect.poll(async () => (await snap()).revealed[1], { timeout: 20_000 }).toBe(true);
  await v.walkTo(22, 0, { tolerance: 0.8 });
  await expect.poll(async () => (await snap()).revealed[2], { timeout: 20_000 }).toBe(true);
  await shot('04-transformation-third-light-path');
  await v.walkTo(21, -2.5, { tolerance: 0.55 });
  await v.aimAt([21, 0.06, -3], 'l01-tide-pool');
  await v.interact();
  expect((await snap()).optionalFound).toBe(true);
  await shot('07-optional-tide-pool');
  await v.walkTo(22, -32, { tolerance: 0.7 });
  await v.aimAt([22, 2.2, -35], 'l01-beacon');
  await v.interact();
  await expect.poll(async () => (await snap()).beaconRestored).toBe(true);
  await v.turnTo(0);
  await shot('05a-beacon-lit');
  await expect.poll(async () => (await snap()).panoramaProgress, { timeout: 15_000 }).toBe(1);
  await v.walkTo(22, -38, { tolerance: 0.5 });
  await v.walkTo(18, -39, { tolerance: 0.5 });
  await v.turnTo(Math.atan2(18, 91));
  await shot('05b-coastal-panorama');
  await v.walkTo(22, -38, { tolerance: 0.5 });
  await v.aimAt([22, 1.45, -40], 'l01-exit');
  await v.interact();
  await backInMuseum(page);
  await shot('06-return');
}

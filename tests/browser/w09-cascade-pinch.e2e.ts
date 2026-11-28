import { expect, test, type Page } from '@playwright/test';
import type { W09Snapshot } from '../../src/world/pocket/w09/createW09World';
import { bootPreview, evidenceDir, persistentPassportRaw, placeInMuseum, pose, settle, snapshot, turnTo } from './helpers/world-journey';
import { w09Cascade, w09Finale, w09ToCascade } from './helpers/routes';
import { keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

/**
 * V7 regression for the V6 W09 cascade stall at (-3.65, -33.8).
 *
 * The first meteor stone sweeps x = 3.3·sin(0.42·t) across the 8 m ramp with
 * a collision box 0.95 m either side of its centre; W09's clock t advances only
 * with the visitor's intentional movement. When the stone sits between
 * x = -3.3 and -2.35 the lane between it and the left ramp rail is narrower
 * than the visitor (0.7 m). A visitor walking that lane into the stone is
 * blocked in the corner, does not move, so the clock does not advance and the
 * stone never moves: a softlock the W09 brief forbids ("prevent waiting
 * forever or momentum-dependent softlock").
 *
 * The test reaches the cascade through W09's own route, sets the stone into
 * the narrow-lane phase only by walking (the clock's legitimate input), then
 * pushes straight into the corner and requires the visitor to get past.
 */
const STONE = { z: -35, halfDepth: 0.9, halfWidth: 0.95, amplitude: 3.3, rate: 0.42 } as const;
const LANE_X = -3.6; // hugging the left rail (rail face at x = -4, visitor radius 0.35)
const stoneX = (t: number) => Math.sin(t * STONE.rate) * STONE.amplitude;
const localTime = async (page: Page) => (await snapshot<W09Snapshot>(page, 'W09')).localTime;

async function enterW09(page: Page, v: Visitor) {
  await placeInMuseum(page, [88, 2.5, 100.5], 0, 0); // labelled DIAGNOSTIC museum-side placement, as in the W09 journey
  await v.aimAt([88, 4.5, 96], 'observatory-orrery-w09');
  await v.enterFromAnchor(/Museum Between Seconds/i, 'W09');
}

/**
 * Walk the left lane up and down (the clock only moves while the visitor
 * walks) until the stone will be in the narrow-lane phase when the visitor
 * reaches it, and stop in front of it.
 */
async function lineUpCorner(page: Page, v: Visitor): Promise<number> {
  const front = STONE.z + STONE.halfDepth + 0.35 + 0.6; // stop 0.6 m short of contact
  await v.walkTo(LANE_X, -31, { tolerance: 0.4 });
  for (let i = 0; i < 40; i++) {
    const t = await localTime(page);
    // ~0.6 m of walking to contact adds ~0.5 to t; aim for the middle of the narrow phase.
    const x = stoneX(t + 0.5);
    if (x < -2.7 && x > -3.25) break;
    await v.walkTo(LANE_X, i % 2 === 0 ? front : -31, { tolerance: 0.4 });
  }
  await v.walkTo(LANE_X, front, { tolerance: 0.3 });
  return localTime(page);
}

async function pushIntoCorner(page: Page, v: Visitor, seconds: number) {
  if (v.kind === 'keyboard') await turnTo(page, 0, 0.03); else await v.turnTo(0, 0.03);
  const before = await pose(page);
  const t0 = await localTime(page);
  const trace: { s: number; z: number; t: number; stone: number }[] = [];
  await v.holdForward(true);
  try {
    for (let i = 0; i <= seconds * 2; i++) {
      const p = await pose(page);
      const t = await localTime(page);
      trace.push({ s: i / 2, z: +p.z.toFixed(2), t: +t.toFixed(2), stone: +stoneX(t).toFixed(2) });
      if (p.z < STONE.z - STONE.halfDepth - 1) break;
      await page.waitForTimeout(500);
    }
  } finally {
    await v.holdForward(false);
  }
  return { before, t0, trace, after: await settle(page) };
}

for (const kind of ['keyboard', 'touch'] as const) {
  test.describe(kind, () => {
    if (kind === 'touch') test.use({ hasTouch: true });

    test(`W09 (${kind}): a visitor pushing into the narrow lane beside a meteor stone is not softlocked`, async ({ page }) => {
      test.setTimeout(420_000);
      const dir = evidenceDir(`w09-cascade-pinch-${kind}`);
      const errors = await bootPreview(page, 'w09');
      const v = kind === 'keyboard' ? keyboardVisitor(page) : await touchVisitor(page);
      const passportBefore = await persistentPassportRaw(page);
      await enterW09(page, v);
      await w09ToCascade(page, v, false);

      const tLined = await lineUpCorner(page, v);
      await page.screenshot({ path: `${dir}/01-approach-narrow-lane.png` });
      // Standing still freezes the sky (the accessibility contract): unchanged.
      await page.waitForTimeout(800);
      expect(await localTime(page)).toBe(tLined);

      const push = await pushIntoCorner(page, v, 12);
      console.log(JSON.stringify({ kind, lane: LANE_X, stoneAtLineUp: +stoneX(tLined).toFixed(2), trace: push.trace }));
      await page.screenshot({ path: `${dir}/02-after-push.png` });
      // The stone was in the narrow-lane phase when the visitor reached it...
      expect(push.trace.some((s) => s.stone < -2.35 && s.z > STONE.z)).toBe(true);
      // ...and the visitor still got past it.
      expect(push.after.z, 'visitor must pass the first stone in the left lane').toBeLessThan(STONE.z - STONE.halfDepth - 0.5);

      // Stopping freezes the sky again.
      const tStopped = await localTime(page);
      await page.waitForTimeout(800);
      expect(await localTime(page)).toBe(tStopped);

      // The rest of the world completes as normal: one stamp, persistent passport untouched.
      await w09Cascade(page, v, false);
      await w09Finale(page, v, dir);
      expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W09'))).toBe(true);
      expect(await persistentPassportRaw(page)).toBe(passportBefore);
      expect(errors).toEqual([]);
    });
  });
}

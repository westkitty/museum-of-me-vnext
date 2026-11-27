import { expect, test, type Page } from '@playwright/test';
import type { W10Snapshot } from '../../src/world/pocket/w10/createW10World';
import { bootPreview, evidenceDir, snapshot } from './helpers/world-journey';
import { keyboardVisitor } from './helpers/visitor';
import { APPROACHES, walkToEntrance } from './helpers/natural-approach';

/**
 * W10 third-person camera against the climbing cliff (V6 finishing). The
 * visitor walks the W10 route to the foot of the climb wall, faces it (camera
 * clear behind), then turns its back to the cliff: the ideal boom position is
 * inside the rock, so the boom must shorten and keep the character in view.
 * Everything is ordinary visitor input; the probe only reads camera and player.
 * The W09 stamp is a labelled DIAGNOSTIC in-memory seed (the earned path is
 * covered by worlds-cross-sessions).
 */
const DIR = evidenceDir('w10-camera-boom');

async function boom(page: Page) {
  return page.evaluate(() => {
    const app = window.__museum!;
    const c = app.camera.position;
    const p = app.player.position;
    return { length: +Math.hypot(c.x - p.x, c.y - (p.y + 1.2), c.z - p.z).toFixed(2), yaw: +app.player.yaw.toFixed(2) };
  });
}

test('W10 camera boom stays in front of the climb cliff when the visitor turns their back to it', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await bootPreview(page, 'w10');
  const v = keyboardVisitor(page);
  await page.evaluate(() => window.__museum!.passport.recordExit('W09', true)); // DIAGNOSTIC seed, see above
  await walkToEntrance(v, 'W10');
  await v.enterFromAnchor(APPROACHES.W10.title, 'W10');
  const snap = () => snapshot<W10Snapshot>(page, 'W10');
  await v.walkTo(0, 32, { tolerance: 0.7 });
  await v.interact();
  expect((await snap()).hasGlider).toBe(true);
  await v.walkTo(0, 5, { tolerance: 0.9, timeoutMs: 60_000 });
  await v.walkTo(15, -26.5, { tolerance: 0.6 });

  await v.turnTo(0);
  await page.waitForTimeout(800);
  const facing = await boom(page);
  await page.screenshot({ path: `${DIR}/01-facing-cliff.png` });

  await v.turnTo(Math.PI);
  await page.waitForTimeout(800);
  const backTo = await boom(page);
  await page.screenshot({ path: `${DIR}/02-back-to-cliff.png` });

  await v.turnTo(0);
  await page.waitForTimeout(1500);
  const after = await boom(page);
  console.log(JSON.stringify({ facing, backTo, after }));

  const ideal = Math.hypot(5, 3.3 - 1.2);
  expect(facing.length).toBeCloseTo(ideal, 1);
  expect(backTo.length).toBeLessThan(ideal - 0.5);
  expect(backTo.length).toBeGreaterThanOrEqual(1.1 - 0.01);
  expect(after.length).toBeCloseTo(ideal, 1);
  expect(errors).toEqual([]);
});

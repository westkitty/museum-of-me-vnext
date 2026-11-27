import { expect, test, type Page } from '@playwright/test';
import type { W08Snapshot } from '../../src/world/pocket/w08/createW08World';
import {
  BUBBLE_CRADLE, BUBBLE_TOP_Y, CROWN, EXIT_POS, LENS_HEIGHT, LENSES, NUCLEUS_POS, PAD_DOCK_T2, PRISM_POS, ROUTE, T1, T3,
} from '../../src/world/pocket/w08/w08Layout';
import { RILL_DROPLET_POS } from '../../src/world/exterior/RillDroplet';
import {
  aimAt, bootPreview, evidenceDir, interact, persistentPassportRaw, pitchTo, placeInMuseum, pose, snapshot, turnTo, waitForSnapshot, waitForSnapshotWhere, walkPath, walkTo,
} from './helpers/world-journey';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w08');
const snap = (page: Page) => snapshot<W08Snapshot>(page, 'W08');
const lensCentre = (i: number): [number, number, number] => [LENSES[i].pos[0], LENSES[i].pos[1] + LENS_HEIGHT, LENSES[i].pos[2]];

/** DIAGNOSTIC (museum side only): stand at W08's registry return pose on the rill bank, facing the droplet. */
async function enterW08(page: Page, v: Visitor) {
  await placeInMuseum(page, [-2, 0, 146], Math.PI / 4, 0);
  await v.aimAt(RILL_DROPLET_POS, 'pocket-portal:w08');
  await expect.poll(() => page.evaluate(() => {
    const app = window.__museum!;
    return app.activeWorld === 'exterior' && !app.input.uiCaptured
      && app.interaction.currentFocus?.exhibitId === 'pocket-portal:w08'
      && app.pocketRegistry.canEnter('W08', app.passport).ok;
  }), { timeout: 15_000 }).toBe(true);
}

/** F on the ready, focused droplet, then Enter in the entry dialog. */
async function enterRaindrop(page: Page, v: Visitor) {
  if (v.kind === 'touch') return v.enterFromAnchor(/World Inside a Raindrop/i, 'W08'); // centre tap, tapped Enter
  const dialog = page.getByRole('dialog', { name: /World Inside a Raindrop/i });
  await v.interact();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('pocket:W08');
}
const settled = (page: Page, y: number, timeout = 15_000) =>
  expect.poll(async () => { const p = await pose(page); return p.grounded && Math.abs(p.y - y) < 0.06; }, { timeout, intervals: [100] }).toBe(true);

test('W08 fresh boot accepts one focused F press', async ({ page }) => {
  const errors = await bootPreview(page, 'w08');
  await enterW08(page, keyboardVisitor(page));
  await enterRaindrop(page, keyboardVisitor(page));
  expect(errors).toEqual([]);
});

async function turnLens(page: Page, v: Visitor, i: number, times = 1) {
  for (let k = 0; k < times; k++) {
    const before = (await snap(page)).lensAims[i];
    await v.aimAt(lensCentre(i), `w08-lens-${i + 1}`);
    await v.interact();
    await expect.poll(async () => (await snap(page)).lensAims[i]).toBe((before + 1) % LENSES[i].aims.length);
  }
}

async function actOne(page: Page, v: Visitor, shot: string | false = false) {
  await v.walkPath(ROUTE.toLens1, { tolerance: 0.4 });
  await turnLens(page, v, 0);
  await expect.poll(async () => (await snap(page)).crystals, { timeout: 5_000 }).toEqual(['stair']);
  if (shot) {
    await v.turnTo(1.05);
    await v.pitchTo(0.05);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${shot}/03-mechanic-light-sets-glass-stair.png` });
  }
  await v.walkPath(ROUTE.toStairFoot, { tolerance: 0.4 });
  await v.walkPath(ROUTE.upStair, { tolerance: 0.4 });
  await settled(page, T1.y);
  await expect.poll(async () => (await snap(page)).checkpoints).toEqual(['glass-terrace']);
}

async function actTwo(page: Page, v: Visitor, shot: string | false = false) {
  const reducedMotion = await page.evaluate(() => window.__museum!.preferences.reducedMotion);
  if (reducedMotion) {
    // The pad moves the visitor the instant they board. Do not keep steering
    // back toward the old dock after the crossing has already happened.
    await v.walkPath(ROUTE.toPadT1.slice(0, 1), { tolerance: 0.4 });
    await v.turnTo(0);
    await v.holdForward(true);
    try {
      await expect.poll(async () => (await snap(page)).padCrossings, { timeout: 5_000 }).toBe(1);
    } finally {
      await v.holdForward(false);
    }
  } else {
    await v.walkPath(ROUTE.toPadT1, { tolerance: 0.4 });
  }
  if (shot) {
    await waitForSnapshot(page, 'W08', 'padMoving', true, 5_000);
    await v.turnTo(0.6);
    await v.pitchTo(-0.12);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${shot}/04-transformation-drift-pad-crossing.png` });
  }
  await waitForSnapshotWhere(page, 'W08', [{ key: 'padCrossings', eq: 1 }, { key: 'padMoving', eq: false }], 15_000);
  expect((await snap(page)).padZ).toBe(PAD_DOCK_T2);
  await v.walkPath(ROUTE.offPadT2, { tolerance: 0.4 });
  await v.walkPath(ROUTE.toLens2, { tolerance: 0.4 });
  await turnLens(page, v, 1, 2);
  await expect.poll(async () => (await snap(page)).crystals, { timeout: 5_000 }).toEqual(['stair', 'span']);
  await v.walkPath(ROUTE.toSpanFoot, { tolerance: 0.4 });
  await v.walkPath(ROUTE.upSpan, { tolerance: 0.4 });
  await settled(page, T3.y);
}

async function actThree(page: Page, v: Visitor, shot: string | false = false) {
  await v.walkPath(ROUTE.toLens3, { tolerance: 0.4 });
  await turnLens(page, v, 2);
  await waitForSnapshot(page, 'W08', 'bubble', 'waiting', 5_000);
  await v.walkPath(ROUTE.intoBubble, { tolerance: 0.4 });
  await waitForSnapshot(page, 'W08', 'bubble', 'rising', 5_000);
  if (shot) {
    await v.turnTo(0.9);
    await v.pitchTo(-0.35);
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${shot}/04b-bubble-rising.png` });
  }
  await waitForSnapshot(page, 'W08', 'bubble', 'docked', 20_000);
  expect((await pose(page)).y).toBeCloseTo(BUBBLE_TOP_Y, 1);
  await v.walkPath(ROUTE.ontoCrown, { tolerance: 0.4 });
  await settled(page, CROWN.y);
  await waitForSnapshot(page, 'W08', 'crownReached', true);
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w08');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  await enterW08(page, v);
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  const entry = await pose(page);
  await enterRaindrop(page, v);
  const spawn = await pose(page);
  expect([spawn.x, spawn.y, spawn.z]).toEqual([0, 0, 16]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/02-arrival.png` });

  await actOne(page, v, dir);
  await actTwo(page, v, dir);
  await actThree(page, v, dir);
  const atCrown = await snap(page);
  expect(atCrown.checkpoints).toEqual(['glass-terrace', 'drift-terrace', 'bubble-terrace', 'crown']);
  expect(atCrown.completionEligible).toBe(false);

  await v.walkPath(ROUTE.toNucleus, { tolerance: 0.4 });
  await v.aimAt([NUCLEUS_POS[0], NUCLEUS_POS[1] + 1.4, NUCLEUS_POS[2]], 'w08-nucleus');
  await v.interact();
  await waitForSnapshot(page, 'W08', 'finaleStarted', true);
  // Look outward from the Crown through the drop's skin, down toward the rill.
  await v.walkTo(13.2, -27.6, { tolerance: 0.4 });
  await v.turnTo(-0.72);
  await v.pitchTo(-0.3);
  await page.waitForTimeout(4200);
  await page.screenshot({ path: `${dir}/05a-finale-fall.png` });
  await waitForSnapshotWhere(page, 'W08', [{ key: 'finaleProgress', gte: 0.8 }], 15_000);
  await page.screenshot({ path: `${dir}/05b-finale-splash.png` });
  const done = await waitForSnapshot<W08Snapshot>(page, 'W08', 'completionEligible', true, 20_000);
  expect(done.finaleProgress).toBe(1);
  expect(done.softFalls).toBe(0);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W08'))).toBe(false);
  await v.walkPath(ROUTE.toExit, { tolerance: 0.4 });
  await v.aimAt([EXIT_POS[0], EXIT_POS[1] + 1.5, EXIT_POS[2]], 'w08-exit');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/05c-surface-ring-open.png` });
  await v.interact();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/06-return.png` });
  const back = await pose(page);
  expect(Math.hypot(back.x - entry.x, back.z - entry.z)).toBeLessThan(1);
  expect(back.y).toBeCloseTo(entry.y, 0);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W08'))).toBe(true); // in-memory preview passport only
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W08 real-time keyboard journey: rill droplet entry, three acts, fall and splash, completion return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w08'));
});


test('W08 optional rainbow seed from the far prism; Back exits without a stamp; repeat visits start fresh', async ({ page }) => {
  const errors = await bootPreview(page, 'w08');
  await enterW08(page, keyboardVisitor(page));
  await enterRaindrop(page, keyboardVisitor(page));
  await walkPath(page, ROUTE.toLens1, { tolerance: 0.4 });
  await turnLens(page, keyboardVisitor(page), 0, 2);
  await waitForSnapshot(page, 'W08', 'prismLit', true);
  await walkPath(page, ROUTE.toPrism, { tolerance: 0.4 });
  await aimAt(page, [PRISM_POS[0], 1.65, PRISM_POS[2]], 'w08-rainbow-seed');
  await interact(page);
  await waitForSnapshot(page, 'W08', 'optionalFound', true);
  await turnTo(page, 0.55);
  await pitchTo(page, 0.12);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/07-optional-rainbow-seed.png` });

  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W08'))).toBe(false);
  for (let visit = 0; visit < 2; visit++) {
    await enterW08(page, keyboardVisitor(page));
    await enterRaindrop(page, keyboardVisitor(page));
    const fresh = await snap(page);
    expect(fresh.lensAims).toEqual([0, 0, 0]);
    expect(fresh.crystals).toEqual([]);
    expect(fresh.optionalFound).toBe(false);
    expect(fresh.bubble).toBe('asleep');
    expect(fresh.checkpoints).toEqual([]);
    await page.getByRole('button', { name: 'Back to Museum' }).click();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  }
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W08'))).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('W08 reduced motion: pad and bubble carry at once; the drop falls without motion', async ({ page }) => {
    const errors = await bootPreview(page, 'w08');
    await enterW08(page, keyboardVisitor(page));
    await enterRaindrop(page, keyboardVisitor(page));
    await actOne(page, keyboardVisitor(page));
    await actTwo(page, keyboardVisitor(page));
    await walkPath(page, ROUTE.toLens3, { tolerance: 0.4 });
    await turnLens(page, keyboardVisitor(page), 2);
    await waitForSnapshot(page, 'W08', 'bubble', 'waiting', 5_000);
    await walkPath(page, ROUTE.intoBubble, { tolerance: 0.4 });
    await waitForSnapshot(page, 'W08', 'bubble', 'docked', 4_000);
    await settled(page, BUBBLE_TOP_Y, 3_000);
    await walkPath(page, ROUTE.ontoCrown, { tolerance: 0.4 });
    await walkPath(page, ROUTE.toNucleus, { tolerance: 0.4 });
    await aimAt(page, [NUCLEUS_POS[0], NUCLEUS_POS[1] + 1.4, NUCLEUS_POS[2]], 'w08-nucleus');
    await interact(page);
    await waitForSnapshot(page, 'W08', 'completionEligible', true, 3_000);
    await walkTo(page, 13.2, -27.6, { tolerance: 0.4 });
    await turnTo(page, -0.72);
    await pitchTo(page, -0.3);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/08-reduced-motion-splash-still.png` });
    expect(BUBBLE_CRADLE[1]).toBe(T3.y);
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W08 continuous touch journey: prism lenses, optical stair, drift pad, bubble and splash by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w08-touch'));
    await expectTouchAffordances(page);
  });
});

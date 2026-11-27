import { expect, test, type Page } from '@playwright/test';
import type { W10Snapshot } from '../../src/world/pocket/w10/createW10World';
import {
  aimAt, bootPreview, evidenceDir, interact, persistentPassportRaw, placeInMuseum, pose, snapshot,
} from './helpers/world-journey';
import { w10Route } from './helpers/routes';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w10');
const snap = (page: Page) => snapshot<W10Snapshot>(page, 'W10');

/** DIAGNOSTIC museum-side in-memory stamp to exercise W10 while iterating on its route. */
async function seedPreviewStamp(page: Page) {
  await page.evaluate(() => window.__museum!.passport.recordExit('W09', true));
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W09'))).toBe(true);
}

async function enterPier(page: Page, v: Visitor, dir = DIR) {
  await placeInMuseum(page, [2, -0.5, 197], -Math.PI / 4, 0);
  await expect.poll(() => page.evaluate(() => window.__museum!.exteriorWorld.weaselPierGuide.group.visible)).toBe(true);
  await v.aimAt([4, 0.9, 195], 'pocket-portal:w10-pier');
  await page.screenshot({ path: `${dir}/01-entrance-pier.png` });
  const entry = await pose(page);
  await v.enterFromAnchor(/Breath of the Weasel/i, 'W10');
  return entry;
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w10');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  expect(await page.evaluate(() => window.__museum!.pocketRegistry.canEnter('W10', window.__museum!.passport))).toMatchObject({ reason: 'locked-stamps' });
  await seedPreviewStamp(page);
  const entry = await enterPier(page, v, dir);
  await w10Route(page, v, dir);
  const back = await pose(page);
  expect(Math.hypot(back.x - entry.x, back.z - entry.z)).toBeLessThan(1);
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W10 local preview: third-person wilderness, climb, movable shrine, wind glide and return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w10'));
});


test('W10 rooftop destination is independent of W06 and Back restores first-person control', async ({ page }) => {
  const errors = await bootPreview(page, 'w06,w10');
  await seedPreviewStamp(page);
  // Approach from the south so Flight Pad II does not launch the visitor.
  await placeInMuseum(page, [-2.4, 18.6, 48.3], Math.PI, 0);
  const target = await page.evaluate(() => {
    const o = window.__museum!.exteriorWorld.root.getObjectByName('flight-pad-ii-wilderness-destination')!;
    o.updateWorldMatrix(true, false);
    const p = o.getWorldPosition(o.position.clone());
    return [p.x, p.y, p.z] as [number, number, number];
  });
  await aimAt(page, target, 'pocket-portal:w10-roof');
  await page.screenshot({ path: `${DIR}/08-rooftop-independent-destination.png` });
  await interact(page);
  const dialog = page.getByRole('dialog', { name: /Breath of the Weasel/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('pocket:W10');
  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  expect(await page.evaluate(() => window.__museum!.pocketHost.activeCameraMode)).toBe('first-person');
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W10'))).toBe(false);
  const w06Target = await page.evaluate(() => {
    const o = window.__museum!.exteriorWorld.rooftop.group.getObjectByName('flight-pad-ii-teleport-interaction')!;
    o.updateWorldMatrix(true, false);
    const p = o.getWorldPosition(o.position.clone());
    return [p.x, p.y, p.z] as [number, number, number];
  });
  await placeInMuseum(page, [w06Target[0] - 3, 18.6, w06Target[2]], -Math.PI / 2, -0.1);
  await aimAt(page, w06Target, 'rooftop-flight-pad-ii-teleport');
  await expect.poll(async () => page.evaluate(() => window.__museum!.interaction.currentFocus?.label)).toContain('Skyborne Gardens');
  expect(errors).toEqual([]);
});

test.describe('touch input', () => {
  test.use({ hasTouch: true });

  test('W10 pier entry and glider pickup respond to center tap and touch movement', async ({ page }) => {
    const errors = await bootPreview(page, 'w10');
    await seedPreviewStamp(page);
    await placeInMuseum(page, [2, -0.5, 197], -Math.PI / 4, 0);
    await aimAt(page, [4, 0.9, 195], 'pocket-portal:w10-pier');
    await page.touchscreen.tap(640, 360);
    const dialog = page.getByRole('dialog', { name: /Breath of the Weasel/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Enter', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('pocket:W10');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 550, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 480, id: 1 }] });
    try {
      await expect.poll(async () => (await pose(page)).z, { timeout: 8_000 }).toBeLessThan(33);
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.touchscreen.tap(640, 360);
    expect((await snap(page)).hasGlider).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W10 continuous touch route: third-person plateau, glider, stamina climb, shrine blocks, overlook and return by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w10-touch'));
    await expectTouchAffordances(page);
  });
});

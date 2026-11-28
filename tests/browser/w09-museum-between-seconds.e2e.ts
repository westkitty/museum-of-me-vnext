import { expect, test, type Page } from '@playwright/test';
import type { W09Snapshot } from '../../src/world/pocket/w09/createW09World';
import {
  bootPreview, evidenceDir, persistentPassportRaw, placeInMuseum, snapshot,
} from './helpers/world-journey';
import { w09Route } from './helpers/routes';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';

const DIR = evidenceDir('w09');
const snap = (page: Page) => snapshot<W09Snapshot>(page, 'W09');

async function enterW09(page: Page, v: Visitor, dir = DIR) {
  await placeInMuseum(page, [88, 2.5, 100.5], 0, 0);
  await v.aimAt([88, 4.5, 96], 'observatory-orrery-w09');
  await page.screenshot({ path: `${dir}/01-entrance.png` });
  await v.enterFromAnchor(/Museum Between Seconds/i, 'W09');
}

async function fullJourney(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<void> {
  const errors = await bootPreview(page, 'w09,w10');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  expect(await page.evaluate(() => window.__museum!.pocketRegistry.canEnter('W10', window.__museum!.passport))).toMatchObject({ reason: 'locked-stamps' });
  await enterW09(page, v, dir);
  await w09Route(page, v, dir);
  expect(await page.evaluate(() => window.__museum!.pocketRegistry.canEnter('W10', window.__museum!.passport).ok)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__museum!.exteriorWorld.weaselPierGuide.group.visible)).toBe(true);
  await placeInMuseum(page, [2, -0.5, 197], -Math.PI / 4, 0);
  await v.aimAt([4, 0.9, 195], 'pocket-portal:w10-pier');
  await v.enterFromAnchor(/Breath of the Weasel/i, 'W10');
  await v.pressButton('Back to Museum');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W09 real-time keyboard route: movement clock, alignment, cascade, finale and return', async ({ page }) => {
  await fullJourney(page, async (p) => keyboardVisitor(p), evidenceDir('w09'));
});


test.describe('touch movement', () => {
  test.use({ hasTouch: true });

  test('W09 advances local time from the touch stick and freezes on release', async ({ page }) => {
    const errors = await bootPreview(page, 'w09');
    await enterW09(page, keyboardVisitor(page));
    const initial = (await snap(page)).localTime;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 550, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 480, id: 1 }] });
    try {
      await expect.poll(async () => (await snap(page)).localTime, { timeout: 8_000 }).toBeGreaterThan(initial + 0.5);
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.waitForTimeout(300);
    const stopped = (await snap(page)).localTime;
    await page.waitForTimeout(400);
    expect((await snap(page)).localTime).toBe(stopped);
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('W09 continuous touch route: movement clock, dial, constellations, cascade, finale, earned W10 unlock and return by stick, look drags and taps', async ({ page }) => {
    test.setTimeout(600_000);
    await fullJourney(page, touchVisitor, evidenceDir('w09-touch'));
    await expectTouchAffordances(page);
  });
});

import { expect, test, type Page } from '@playwright/test';
import type { W01StateSnapshot } from '../../src/world/pocket/w01/types';
import {
  aimAt, bootPreview, enterFromAnchor, evidenceDir, interact, persistentPassportRaw,
  placeInMuseum, pose, snapshot, waitForSnapshot, walkTo, type Pose, type WalkOptions,
} from './helpers/world-journey';
import { TouchVisitor } from './helpers/touch-journey';
import { expectTouchAffordances } from './helpers/visitor';

/** The visitor's input: the same journey runs with the keyboard or with touch. */
interface Visitor {
  walkTo(x: number, z: number, opts?: WalkOptions): Promise<Pose>;
  aimAt(target: readonly [number, number, number], id: string): Promise<void>;
  interact(): Promise<void>;
  enterFromAnchor(title: RegExp, pocketId: string): Promise<void>;
}

const keyboard = (page: Page): Visitor => ({
  walkTo: (x, z, opts) => walkTo(page, x, z, opts),
  aimAt: (target, id) => aimAt(page, target, id),
  interact: () => interact(page),
  enterFromAnchor: (title, id) => enterFromAnchor(page, title, id),
});

let DIR = evidenceDir('w01-real-journey');
const REEFS = {
  turtle: { departure: [-7.5, 1.7, -2.5], landing: [-62, -50], env: [-72, 5.5, -54], musician: [-68, 5.8, -60], return: [-60, 5.5, -54] },
  ray: { departure: [7.5, 1.7, -2.5], landing: [62, -48], env: [72, 13.5, -52], musician: [68, 13.8, -58], return: [60, 13.5, -52] },
  whale: { departure: [0, 1.7, -8.5], landing: [0, -100], env: [-6, -8.5, -112], musician: [0, -8.2, -118], return: [6, -8.5, -104] },
} as const;
type Reef = keyof typeof REEFS;

async function useControl(v: Visitor, point: readonly [number, number, number], id: string): Promise<void> {
  await v.aimAt(point, id);
  await v.interact();
}

async function visitReef(page: Page, v: Visitor, reef: Reef, number: number): Promise<void> {
  const spec = REEFS[reef];
  await v.walkTo(spec.departure[0], spec.departure[2] + 3, { tolerance: 0.7, run: true });
  await useControl(v, spec.departure, `w01-depart-${reef}`);
  await waitForSnapshot<W01StateSnapshot>(page, 'W01', 'station', reef, 20_000);
  const landing = await pose(page);
  expect(Math.hypot(landing.x - spec.landing[0], landing.z - spec.landing[1])).toBeLessThan(3);
  await page.screenshot({ path: `${DIR}/0${number}-arrival-${reef}.png` });

  await v.walkTo(spec.env[0] + (reef === 'whale' ? 2.5 : reef === 'ray' ? -2.5 : 2.5), spec.env[2], { tolerance: 0.7 });
  await useControl(v, spec.env, `w01-env-${reef}`);
  await v.walkTo(spec.musician[0], spec.musician[2] + 3, { tolerance: 0.7 });
  await useControl(v, spec.musician, `w01-musician-${reef}`);
  const activated = await snapshot<W01StateSnapshot>(page, 'W01');
  expect(activated.envActions[reef]).toBe(true);
  expect(activated.awakened[reef]).toBe(true);
  await page.screenshot({ path: `${DIR}/0${number}-musician-${reef}.png` });

  await v.walkTo(spec.return[0], spec.return[2] + (reef === 'whale' ? -3 : 3), { tolerance: 0.7 });
  await useControl(v, spec.return, `w01-return-${reef}`);
  await waitForSnapshot<W01StateSnapshot>(page, 'W01', 'station', 'central', 20_000);
}

async function journey(page: Page, makeVisitor: (page: Page) => Promise<Visitor>): Promise<void> {
  const errors = await bootPreview(page, 'w01');
  const v = await makeVisitor(page);
  const passportBefore = await persistentPassportRaw(page);
  await placeInMuseum(page, [53.5, -0.5, 4], -Math.PI / 2, -0.15);
  await v.aimAt([56, 0.5, 4], 'pocket-portal:w01');
  await page.screenshot({ path: `${DIR}/01-lagoon-pearl.png` });
  await v.enterFromAnchor(/Lagoon Depths/i, 'W01');
  expect((await snapshot<W01StateSnapshot>(page, 'W01')).station).toBe('central');
  await page.screenshot({ path: `${DIR}/02-central-arrival.png` });

  await visitReef(page, v, 'turtle', 3);
  await visitReef(page, v, 'ray', 4);
  await visitReef(page, v, 'whale', 5);

  const allAwake = await snapshot<W01StateSnapshot>(page, 'W01');
  expect(Object.values(allAwake.awakened)).toEqual([true, true, true]);
  await v.walkTo(0, -0.5, { tolerance: 0.8 });
  await useControl(v, [0, 1.65, -3.5], 'w01-cathedral-altar');
  await waitForSnapshot<W01StateSnapshot>(page, 'W01', 'cathedralPhase', 'assembled', 20_000);
  await page.screenshot({ path: `${DIR}/06-cathedral-assembled.png` });
  await v.walkTo(0, -45, { tolerance: 1, run: true, timeoutMs: 90_000 });
  await useControl(v, [0, 7.75, -48], 'w01-conductor-podium');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 20_000 }).toBe('exterior');
  await page.screenshot({ path: `${DIR}/07-return-to-lagoon.png` });
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W01'))).toBe(true);
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
}

test('W01 continuous keyboard journey: lagoon pearl, three reefs, cathedral, conductor, museum return', async ({ page }) => {
  test.setTimeout(360_000);
  await journey(page, async (p) => keyboard(p));
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('W01 continuous touch journey: stick, look drags, centre taps and a tapped Enter button only', async ({ page }) => {
    test.setTimeout(480_000);
    DIR = evidenceDir('w01-touch-journey');
    await journey(page, async (p) => TouchVisitor.attach(p));
    // Touch visitors tap the centre dot: no key cap may be drawn (V5 set the
    // attribute but CSS still displayed it; this checks the rendered box).
    await expectTouchAffordances(page);
  });
});

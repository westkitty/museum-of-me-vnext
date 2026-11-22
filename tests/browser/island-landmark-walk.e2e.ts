import { expect, test, type Page } from '@playwright/test';
import { ISLAND_LANDMARKS } from '../../src/world/exterior/IslandLandmarks';

/**
 * ISLAND-01 (world expansion 2026-11-21): every named island landmark is
 * reached on foot from the island loop with the real keyboard (and, for a
 * sample, real touch events), the real PlayerController and the assembled
 * exterior CollisionWorld; the feature is then visible at eye height with no
 * woodland mesh in the way. A teleport only places the visitor at the path
 * approach point (a fixture); the walk in is real.
 */
const WOODLAND = ['perimeter-woodland-trunks', 'perimeter-woodland-canopy-1', 'perimeter-woodland-canopy-2',
  'perimeter-woodland-canopy-3', 'woodland-secondary-canopy', 'woodland-understory', 'woodland-canopy-infill',
  'woodland-forest-belt', 'woodland-forest-belt-trunks'];

type Leg = { id: string; approach: readonly [number, number]; inspection: readonly [number, number]; focus: readonly number[] };
const legs: Leg[] = ISLAND_LANDMARKS.map(({ id, approach, inspection, focus }) => ({ id, approach, inspection, focus }));

async function walkLegs(page: Page, which: readonly Leg[], drive: 'keyboard' | 'touch') {
  return page.evaluate(({ which, drive, woodland }) => {
    const app = window.__museum!;
    const Raycaster = (app.interaction as unknown as { raycaster: { constructor: new () => {
      set(o: unknown, d: unknown): void; far: number;
      intersectObject(o: unknown, r: boolean): Array<{ object: { name: string }; distance: number }>;
    } } }).raycaster.constructor;
    const V3 = app.player.position.constructor as new (x?: number, y?: number, z?: number) => {
      x: number; y: number; z: number; clone(): unknown; sub(v: unknown): { normalize(): unknown; length(): number };
    };
    const caster = new Raycaster();
    const landscape = app.exteriorWorld.islandLandscape.root;
    const out = [];
    for (const leg of which) {
      const [ax, az] = leg.approach, [bx, bz] = leg.inspection;
      app.player.teleport([ax, -0.5, az], Math.atan2(-(bx - ax), -(bz - az)));
      for (let i = 0; i < 4; i++) app.fixedUpdate(1 / 60);
      const budget = Math.ceil(Math.hypot(bx - ax, bz - az) / 3.4 * 60 * 1.8) + 60;
      let ticks = 0, arrived = false;
      for (; ticks < budget; ticks++) {
        const p = app.player.position;
        const dx = bx - p.x, dz = bz - p.z;
        if (Math.hypot(dx, dz) < 0.6) { arrived = true; break; }
        app.player.yaw = Math.atan2(-dx, -dz);
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
      }
      const p = app.player.position;
      const eye = new V3(p.x, p.y + 1.64, p.z);
      const focus = new V3(leg.focus[0], leg.focus[1] + 0.3, leg.focus[2]);
      const dir = (focus as { clone(): { sub(v: unknown): { normalize(): unknown; length(): number } } }).clone().sub(eye);
      const distance = dir.length();
      caster.set(eye, dir.normalize());
      caster.far = distance;
      const blockers = caster.intersectObject(landscape, true)
        .filter((hit) => woodland.includes(hit.object.name)).map((hit) => hit.object.name);
      out.push({ id: leg.id, drive, arrived, ticks, end: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        grounded: app.player.grounded, blockers });
    }
    return out;
  }, { which, drive, woodland: WOODLAND });
}

test('ISLAND-01: every island landmark is walked to with the keyboard and seen clearly (reduced motion on)', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());
  const tiers = ['low', 'high'] as const;
  for (const tier of tiers) {
    await page.evaluate((q) => window.__museum!.setQuality(q), tier);
    await page.keyboard.down('w');
    const results = await walkLegs(page, legs, 'keyboard');
    await page.keyboard.up('w');
    console.info(`[island-01 keyboard walk ${tier}]`, JSON.stringify(results));
    for (const r of results) {
      expect(r.arrived, `${tier} ${r.id} stopped at ${r.end}`).toBe(true);
      expect(r.grounded, `${tier} ${r.id}`).toBe(true);
      expect(r.blockers, `${tier} ${r.id} view`).toEqual([]);
    }
  }
  const state = await page.evaluate(() => ({
    reduced: window.__museum!.preferences.reducedMotion, active: window.__museum!.activeWorld,
    interior: window.__museum!.interiorConstructed,
  }));
  expect(state).toEqual({ reduced: true, active: 'exterior', interior: false });
  expect(errors).toEqual([]);
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('ISLAND-01: landmarks are reached with the real touch move stick', async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Without ?qa=1 so no diagnostics overlay sits over the canvas: touches
    // land on the canvas exactly as a phone visitor's would.
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
    await page.evaluate(() => window.__museum!.stop());
    const cdp = await page.context().newCDPSession(page);
    // Left-half touch held, then dragged 80 px up: the move stick reads full forward.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 700, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 620, id: 1 }] });
    expect(await page.evaluate(() => window.__museum!.input.touchMoveY)).toBeLessThan(-0.99);
    const sample = legs.filter((leg) => ['neolithic-circle', 'pollinator-meadow', 'fern-ravine', 'wings-of-dawn'].includes(leg.id));
    const results = await walkLegs(page, sample, 'touch');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    console.info('[island-01 touch walk]', JSON.stringify(results));
    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.arrived, `${r.id} stopped at ${r.end}`).toBe(true);
      expect(r.blockers, `${r.id} view`).toEqual([]);
    }
    expect(await page.evaluate(() => window.__museum!.input.touchMoveY)).toBe(0);
    expect(errors).toEqual([]);
  });
});

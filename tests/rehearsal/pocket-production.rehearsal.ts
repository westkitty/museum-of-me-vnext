import { expect, test, type Page } from '@playwright/test';
import { aimAt, interact, persistentPassportRaw, placeInMuseum } from '../browser/helpers/world-journey';

/**
 * Production-activation rehearsal: the production bundle with every pocket
 * world promoted through productionWorlds.ts (see playwright.rehearsal.config.ts).
 * Proves lazy loading, canonical registration and real-anchor entry/return
 * without activating anything in the published build.
 */

const WORLD_CHUNK = /\/assets\/(create(W\d\d|L01)World|w01-(bass|drums|other))-[^/]+\.(js|m4a)$/;

async function boot(page: Page, requests: string[]): Promise<void> {
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum) && window.__museum!.pocketRegistry.get('L01')?.readiness === 'verified',
    undefined, { timeout: 120_000 });
  await page.evaluate(() => { const app = window.__museum!; app.dismissArrival(); app.ui.hud.completeArrival(); });
}

async function enterAndReturn(page: Page, requests: string[], spec: {
  id: string; place: [number, number, number]; yaw: number; pitch: number; aim: [number, number, number]; control: string; title: RegExp;
}): Promise<string[]> {
  const before = requests.length;
  await placeInMuseum(page, spec.place, spec.yaw, spec.pitch);
  await aimAt(page, spec.aim, spec.control);
  await interact(page);
  const dialog = page.getByRole('dialog', { name: spec.title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 60_000 }).toBe(`pocket:${spec.id}`);
  await page.waitForTimeout(1500);
  const fetched = requests.slice(before).filter((p) => WORLD_CHUNK.test(p));
  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  return fetched;
}

test('production activation rehearsal: lazy worlds, canonical registry, real entry and return', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  const requests: string[] = [];
  await boot(page, requests);
  await page.waitForTimeout(4000);

  // 1. Nothing of any world is fetched by an ordinary visit.
  expect(requests.filter((p) => WORLD_CHUNK.test(p))).toEqual([]);
  const initialKB = await page.evaluate(() => Math.round(performance.getEntriesByType('resource')
    .reduce((a, r) => a + ((r as PerformanceResourceTiming).transferSize || 0), 0) / 1024));

  // 2. Canonical registry: all eleven verified, canonical titles, W10 still gated, W06 and L01 independent.
  const registry = await page.evaluate(() => {
    const r = window.__museum!.pocketRegistry; const passport = window.__museum!.passport;
    return { worlds: r.list().map((d) => ({ id: d.id, readiness: d.readiness, title: d.title, loader: typeof d.load })),
      w10: r.canEnter('W10', passport), w06: r.canEnter('W06', passport).ok, l01: r.canEnter('L01', passport).ok, earned: passport.earnedCount };
  });
  expect(registry.worlds).toHaveLength(11);
  for (const w of registry.worlds) {
    expect(w.readiness).toBe('verified');
    expect(w.loader).toBe('function');
    expect(w.title).not.toMatch(/preview|test rig/i);
  }
  expect(registry.earned).toBe(0);
  expect(registry.w10.ok).toBe(false);
  expect(registry.w06).toBe(true);
  expect(registry.l01).toBe(true);
  const passportBefore = await persistentPassportRaw(page);

  // 3. L01 through its real lens anchor: only L01's chunk is fetched, on entry.
  const l01 = await enterAndReturn(page, requests, { id: 'L01', place: [174.5, 11.5, 152], yaw: -Math.PI / 2, pitch: 0.16,
    aim: [176, 13.45, 152], control: 'lighthouse-lens-l01', title: /Lighthouse at World.s End/i });
  expect(l01.map((p) => p.replace(/-[\w-]{8}\.(js|m4a)$/, ''))).toEqual(['/assets/createL01World']);

  // 4. W01 through the lagoon pearl: its chunk arrives on entry. Its three stems are later still:
  //    the music session fetches them only when playback loads (never on an ordinary visit, step 1).
  const w01 = await enterAndReturn(page, requests, { id: 'W01', place: [53.5, -0.5, 4], yaw: -Math.PI / 2, pitch: -0.15,
    aim: [56, 0.5, 4], control: 'pocket-portal:w01', title: /Lagoon Depths/i });
  const w01Names = w01.map((p) => p.replace(/-[\w-]{8}\.(js|m4a)$/, ''));
  expect(w01Names).toContain('/assets/createW01World');
  expect(w01Names.filter((n) => !/createW01World|w01-(bass|drums|other)$/.test(n))).toEqual([]);

  // 5. Re-entry reuses the fetched module (no second chunk request); entry and exit never write a stamp.
  const again = await enterAndReturn(page, requests, { id: 'L01', place: [174.5, 11.5, 152], yaw: -Math.PI / 2, pitch: 0.16,
    aim: [176, 13.45, 152], control: 'lighthouse-lens-l01', title: /Lighthouse at World.s End/i });
  expect(again).toEqual([]);
  // The real persistent passport (not the preview's in-memory one) records visits only: no stamp, no bonus.
  expect(passportBefore === null || !/"stamps":\{"/.test(passportBefore)).toBe(true);
  const stored = JSON.parse((await persistentPassportRaw(page)) ?? '{}') as { stamps?: object; bonusCompleted?: object; visitedWorlds?: object };
  expect(stored.stamps).toEqual({});
  expect(stored.bonusCompleted).toEqual({});
  expect(Object.keys(stored.visitedWorlds ?? {}).sort()).toEqual(['L01', 'W01']);
  expect(await page.evaluate(() => window.__museum!.passport.earnedCount)).toBe(0);
  const lazy = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((r) => /create(W\d\d|L01)World|w01-(bass|drums|other)/.test(r.name))
    .map((r) => ({ name: new URL(r.name).pathname.split('/').pop(), kb: Math.round(((r as PerformanceResourceTiming).transferSize || (r as PerformanceResourceTiming).encodedBodySize) / 1024) })));
  console.log(JSON.stringify({ initialTransferKB: initialKB, lazy }));
  expect(errors).toEqual([]);
});

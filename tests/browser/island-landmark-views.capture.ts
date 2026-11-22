import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * ISLAND-01 named-viewpoint capture (world expansion). Real Chromium/WebGL
 * renders of the exterior from eye-height path approaches and fixed overviews
 * in each quality tier, plus mobile portrait. Writes PNGs and a manifest with
 * renderer.info and CPU render timing. Under SwiftShader the timing is NOT
 * hardware performance evidence; it only compares like-for-like captures.
 *
 * Run: ISLAND_EVIDENCE_DIR=<dir> npx playwright test -c playwright.capture.config.ts island-landmark-views
 */
const evidenceFolder = process.env.ISLAND_EVIDENCE_DIR ?? 'test-results/island-landmark-views';
const EYE = -0.5 + 1.64;

type View = readonly [string, readonly [number, number, number], readonly [number, number, number]];
// Approach points are the nearest island-path point to each landmark (IslandSiteLayout PATH_CENTERLINES).
const views: readonly View[] = [
  ['ov-pier-arrival', [0, 2.2, 203], [0, 10, 90]],
  ['ov-west-woodland', [-140, 30, -20], [0, 10, 0]],
  ['ov-high-topdown', [0, 220, 0.1], [0, 0, 0]],
  ['ov-rear-north', [0, 25, -140], [0, 10, 0]],
  ['ap-pollinator-meadow', [-45.1, EYE, 112.9], [-68, 0.3, 118]],
  ['ap-fern-ravine', [-139.6, EYE, -6.9], [-126, 0.3, -2]],
  ['ap-golden-spire', [-104, EYE, -60], [-104, 6, -82]],
  ['ap-neolithic-circle', [-42.3, EYE, -105], [-72, 1, -118]],
  ['ap-wings-of-dawn', [0, EYE, -109.5], [0, 2, -124.5]],
  ['ap-ancient-tree', [45, EYE, -84], [57, 3.5, -84]],
  ['ap-observation-hide', [46.1, EYE, -13.6], [55, 0.7, -14]],
  ['ap-wind-grove', [42.2, EYE, 106.9], [48, 3, 108]],
  ['ap-astronomical-terrace', [-44, EYE, 134], [-34, 0.7, 134]],
  ['walk-west-loop-into-forest', [-133, EYE, -25], [-170, 3, -30]],
  ['walk-northwest-loop-forest', [-84, EYE, -68], [-120, 3, -110]],
  ['walk-southwest-loop-forest', [-100, EYE, 70], [-140, 3, 100]],
];

test('ISLAND-01 named landmark and woodland views in three tiers', async ({ page }) => {
  test.setTimeout(3_000_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await mkdir(evidenceFolder, { recursive: true });
  await page.addStyleTag({ content: '#a11y-root, #ui-root, .cinematic-arrival { display: none !important; }' });
  await page.evaluate(() => window.__museum!.stop());
  const manifest: Record<string, unknown>[] = [];
  const shoot = async (tier: 'low' | 'medium' | 'high', [id, p, t]: View, suffix = ''): Promise<void> => {
    const metrics = await page.evaluate(({ tier: q, p: pos, t: tgt }) => {
      const app = window.__museum!;
      app.setQuality(q);
      const cam = app.renderer.camera;
      cam.position.set(pos[0], pos[1], pos[2]);
      cam.lookAt(tgt[0], tgt[1], tgt[2]);
      const eye: [number, number, number] = [pos[0], pos[1], pos[2]];
      app.sky.follow(cam);
      app.lighting.update(eye);
      app.exteriorWorld.variableUpdate(0.016, eye, 'plaza', false);
      app.arrivalGarden.update(0.016, false);
      app.renderer.render();
      const info = app.renderer.renderer.info;
      const calls = info.render.calls, triangles = info.render.triangles;
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        const s = performance.now();
        app.renderer.render();
        app.renderer.renderer.getContext().finish();
        times.push(performance.now() - s);
      }
      times.sort((a, b) => a - b);
      return { calls, triangles, geometries: info.memory.geometries, textures: info.memory.textures,
        renderMsMedian: +times[1].toFixed(1) };
    }, { tier, p, t });
    const name = `${tier}-${id}${suffix}.png`;
    const png = await page.locator('#museum-canvas').screenshot({ path: join(evidenceFolder, name), timeout: 150_000 });
    manifest.push({ name, tier, id, ...metrics, bytes: png.byteLength,
      sha256: createHash('sha256').update(png).digest('hex') });
  };
  const tiers = (process.env.ISLAND_TIERS ?? 'low,medium,high').split(',') as ('low' | 'medium' | 'high')[];
  for (const tier of tiers) for (const view of views) await shoot(tier, view);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.innerWidth === 390);
  await page.evaluate(() => window.__museum!.renderer.resize());
  for (const view of [views[0], views[5], views[13]]) await shoot('medium', view, '-mobile-portrait');
  await writeFile(join(evidenceFolder, 'manifest.json'), JSON.stringify({ errors, captures: manifest }, null, 1));
  expect(errors).toEqual([]);
});

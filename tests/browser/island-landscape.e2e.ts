import { expect, test } from '@playwright/test';
import { PATH_CENTERLINES } from '../../src/world/exterior/IslandSiteLayout';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const reviewFolder = 'test-results/exterior-review-2026-11-03';

const cameraViews = [
  ['pier-arrival', [0, 2.2, 203], [0, 10, 90]],
  ['front-south', [0, 18, 140], [0, 8, 0]],
  ['east-lagoon', [140, 35, 30], [0, 10, 0]],
  ['west-woodland', [-140, 30, -20], [0, 10, 0]],
  ['high-topdown', [0, 220, 0.1], [0, 0, 0]],
  ['rear-north', [0, 25, -140], [0, 10, 0]],
] as const;

test('P4 island topology supports the route, excludes water/offshore, and keeps interior deferred', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  const result = await page.evaluate(({ route, views }) => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    const required = [
      'night-island-terrain', 'night-island-shoreline', 'night-island-coastal-skirt',
      'night-island-tidal-fringe', 'east-sheltered-lagoon',
      'east-lagoon-bed', 'east-lagoon-basin-wall', 'east-lagoon-rock-bank', 'northwest-spire-garden-clearing', 'single-golden-spire',
      'south-arrival-pier-deck', 'pier-guide-inlays', 'shoreline-rock-scatter',
      'pier-foundation-pylons', 'pier-arrival-compass', 'pier-arrival-north-marker', 'pier-stone-sentinels',
      'pier-amber-sentinel-caps', 'path-ground-light-instances',
      'site-path-1', 'perimeter-woodland-trunks',
      'woodland-secondary-canopy', 'woodland-understory',
    ];
    const present = required.map((name) => Boolean(app.scene.getObjectByName(name)));
    const probes = [
      ['entrance-terrace', 0, 145, true],
      ['pier', 0, 190, true],
      ['west-path', -133, 8, true],
      ['spire-court', -104, -82, true],
      ['lagoon-bank', 138, 0, true],
      ['lagoon-water', 92, 1, false],
      ['east-visible-coast', 185, 0, true],
      ['west-visible-coast', -181, 0, true],
      ['lagoon-shore-shoulder', 131, 30, true],
      ['nearshore-water', 190, 0, false],
      ['offshore', 260, 0, false],
    ] as const;
    const supports = probes.map(([id, x, z]) => ({ id, y: app.exteriorWorld.collision.supportHeight(x, z, 0) }));
    const traversal = [];
    for (const [id, x, z, expectedLand] of probes) {
      if (!expectedLand) continue;
      app.player.teleport([x, 0, z]);
      for (let i = 0; i < 20; i++) app.fixedUpdate(1 / 60);
      traversal.push({ id, y: app.player.position.y, grounded: app.player.grounded });
    }
    const routeSupports = route.flat().map(([x, z]) => ({ x, z, y: app.exteriorWorld.collision.supportHeight(x, z, 0) }));
    const cameraRenders = [];
    for (const [id, position, target] of views) {
      app.renderer.camera.position.set(position[0], position[1], position[2]);
      app.renderer.camera.lookAt(target[0], target[1], target[2]);
      const eye: [number, number, number] = [position[0], position[1], position[2]];
      app.sky.follow(app.renderer.camera);
      app.lighting.update(eye);
      app.exteriorWorld.variableUpdate(0, eye, 'plaza');
      app.arrivalGarden.update(0, app.preferences.reducedMotion);
      app.renderer.render();
      cameraRenders.push({
        id,
        calls: app.renderer.renderer.info.render.calls,
        triangles: app.renderer.renderer.info.render.triangles,
      });
    }
    return {
      present,
      supports,
      interiorConstructed: app.interiorConstructed,
      activeWorld: app.activeWorld,
      floorColliderCount: app.exteriorWorld.collision.size,
      waterGeometry: (app.scene.getObjectByName('night-island-water') as { geometry: { type: string } } | undefined)?.geometry.type,
      traversal,
      routeSupports,
      cameraRenders,
    };
  }, { route: PATH_CENTERLINES, views: cameraViews });
  expect(result.present.every(Boolean)).toBe(true);
  expect(result.floorColliderCount).toBeLessThan(1_000);
  expect(result.waterGeometry).toBe('RingGeometry');
  expect(result.supports.find((probe) => probe.id === 'entrance-terrace')?.y).toBe(0);
  expect(result.supports.filter((probe) => ['pier', 'west-path', 'spire-court', 'lagoon-bank', 'east-visible-coast', 'west-visible-coast', 'lagoon-shore-shoulder'].includes(probe.id)).every((probe) => probe.y === -0.5)).toBe(true);
  expect(result.traversal.every((probe) => probe.grounded && probe.y >= -0.6)).toBe(true);
  expect(result.routeSupports.filter((support) => support.y === null)).toEqual([]);
  expect(result.cameraRenders).toHaveLength(6);
  for (const render of result.cameraRenders) {
    expect(render.calls).toBeGreaterThan(0);
    expect(render.triangles).toBeLessThan(600_000);
  }
  // These are actual frames from the live Three.js renderer, NOT concept art.
  // Keep each image as an independent full-size PNG in a dedicated folder.
  await mkdir(reviewFolder, { recursive: true });
  await page.addStyleTag({ content: '#a11y-root, #ui-root, .cinematic-arrival { display: none !important; }' });
  for (const [index, [id, position, target]] of cameraViews.entries()) {
    await page.evaluate(({ position: p, target: t }) => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.renderer.camera.position.set(p[0], p[1], p[2]);
      app.renderer.camera.lookAt(t[0], t[1], t[2]);
      const eye: [number, number, number] = [p[0], p[1], p[2]];
      app.sky.follow(app.renderer.camera);
      app.lighting.update(eye);
      app.exteriorWorld.variableUpdate(0, eye, 'plaza');
      app.arrivalGarden.update(0, app.preferences.reducedMotion);
      app.renderer.render();
    }, { position, target });
    await page.locator('#museum-canvas').screenshot({
      path: join(reviewFolder, `${String(index + 1).padStart(2, '0')}-${id}.png`),
      timeout: 30_000,
    });
  }
  // One portrait device framing makes pier approach legibility inspectable
  // without claiming a physical tablet/phone performance result.
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMetrics = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.renderer.camera.position.set(0, 2.2, 203);
    app.renderer.camera.lookAt(0, 10, 90);
    app.renderer.camera.updateProjectionMatrix();
    app.sky.follow(app.renderer.camera);
    app.lighting.update([0, 2.2, 203]);
    app.exteriorWorld.variableUpdate(0, [0, 2.2, 203], 'plaza');
    app.arrivalGarden.update(0, app.preferences.reducedMotion);
    app.renderer.render();
    return { width: app.renderer.canvas.width, height: app.renderer.canvas.height };
  });
  await page.locator('#museum-canvas').screenshot({
    path: join(reviewFolder, '07-mobile-pier-arrival.png'), timeout: 30_000,
  });
  await writeFile(join(reviewFolder, 'camera-metrics.json'), JSON.stringify({
    source: 'Playwright Chromium real WebGL frames',
    acceptedDesign: false,
    observations: result.cameraRenders,
    mobile: mobileMetrics,
    requiredReview: ['pier-arrival', 'front-south', 'east-lagoon', 'west-woodland', 'high-topdown', 'rear-north', 'mobile-pier-arrival'],
  }, null, 2));
  expect(result.supports.find((probe) => probe.id === 'lagoon-water')?.y).toBeNull();
  expect(result.supports.find((probe) => probe.id === 'offshore')?.y).toBeNull();
  expect(result.interiorConstructed).toBe(false);
  expect(result.activeWorld).toBe('exterior');
  expect(errors).toEqual([]);
});

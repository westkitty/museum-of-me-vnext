import { expect, test } from '@playwright/test';
import { PATH_CENTERLINES } from '../../src/world/exterior/IslandSiteLayout';

const cameraViews = [
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
      'night-island-terrain', 'night-island-shoreline', 'east-sheltered-lagoon',
      'east-lagoon-rock-bank', 'northwest-spire-garden-clearing', 'single-golden-spire',
      'south-arrival-pier-deck', 'site-path-1', 'perimeter-woodland-trunks',
    ];
    const present = required.map((name) => Boolean(app.scene.getObjectByName(name)));
    const probes = [
      ['entrance-terrace', 0, 145, true],
      ['pier', 0, 190, true],
      ['west-path', -133, 8, true],
      ['spire-court', -104, -82, true],
      ['lagoon-bank', 138, 0, true],
      ['lagoon-water', 92, 1, false],
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
  expect(result.supports.filter((probe) => ['pier', 'west-path', 'spire-court', 'lagoon-bank'].includes(probe.id)).every((probe) => probe.y === -0.5)).toBe(true);
  expect(result.traversal.every((probe) => probe.grounded && probe.y >= -0.6)).toBe(true);
  expect(result.routeSupports.filter((support) => support.y === null)).toEqual([]);
  expect(result.cameraRenders).toHaveLength(5);
  for (const render of result.cameraRenders) {
    expect(render.calls).toBeGreaterThan(0);
    expect(render.triangles).toBeLessThan(600_000);
  }
  await page.addStyleTag({ content: '#a11y-root, #ui-root, .cinematic-arrival { display: none !important; }' });
  for (const [id, position, target] of cameraViews) {
    await page.evaluate(({ position: p, target: t }) => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.renderer.camera.position.set(p[0], p[1], p[2]);
      app.renderer.camera.lookAt(t[0], t[1], t[2]);
      app.renderer.render();
    }, { position, target });
    await page.locator('#museum-canvas').screenshot({ path: `test-results/p4-${id}.png` });
  }
  expect(result.supports.find((probe) => probe.id === 'lagoon-water')?.y).toBeNull();
  expect(result.supports.find((probe) => probe.id === 'offshore')?.y).toBeNull();
  expect(result.interiorConstructed).toBe(false);
  expect(result.activeWorld).toBe('exterior');
  expect(errors).toEqual([]);
});

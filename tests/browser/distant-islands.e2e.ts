import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type * as THREE from 'three';
import {
  DISTANT_ISLAND_LOD_COUNTS,
  SKY_ISLANDS_ANCHOR,
  WILD_ISLAND_ANCHOR,
} from '../../src/world/exterior/ExteriorDistantIslands';
import { LIGHTHOUSE_PENINSULA_CENTER } from '../../src/world/exterior/IslandSiteLayout';
import { CAMERA_FAR } from '../../src/render/RendererHost';
import { SKY_DOME_RADIUS } from '../../src/world/Sky';

const evidenceFolder = 'docs/evidence/island-02d-distant-islands-20261122';
const [LTX, , LTZ] = LIGHTHOUSE_PENINSULA_CENTER;

test('ISLAND-02D: distant Floating Sky Islands & Wild Island silhouette across pier, coastal, lighthouse, and rooftop views', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());

  const coldAudit = await page.evaluate(() => {
    const app = window.__museum!;
    const sky = app.scene.getObjectByName('night-sky-layered-stars') as THREE.Mesh<THREE.SphereGeometry> | undefined;
    return {
      activeWorld: app.activeWorld,
      interiorConstructed: app.interiorConstructed,
      cameraFar: app.renderer.camera.far,
      skyRadius: sky?.geometry.parameters.radius ?? 0,
      hasSkyIslands: Boolean(app.scene.getObjectByName('distant-sky-islands')),
      hasWildIsland: Boolean(app.scene.getObjectByName('distant-wild-island')),
      offIslandSupportSky: app.exteriorWorld.collision.supportHeight(295, -110, 74),
      offIslandSupportWild: app.exteriorWorld.collision.supportHeight(-275, 350, -0.5),
    };
  });

  expect(coldAudit).toEqual({
    activeWorld: 'exterior',
    interiorConstructed: false,
    cameraFar: CAMERA_FAR,
    skyRadius: SKY_DOME_RADIUS,
    hasSkyIslands: true,
    hasWildIsland: true,
    offIslandSupportSky: null,
    offIslandSupportWild: null,
  });

  await mkdir(evidenceFolder, { recursive: true });
  const captures: Array<{
    name: string;
    width: number;
    height: number;
    bytes: number;
    sha256: string;
    calls: number;
    triangles: number;
  }> = [];

  const captureView = async (
    name: string,
    pos: readonly [number, number, number],
    look: readonly [number, number, number],
    tier: 'low' | 'medium' | 'high' = 'medium',
  ) => {
    const renderInfo = await page.evaluate(({ p, t, quality }) => {
      const app = window.__museum!;
      if (app.renderer.quality.tier !== quality) app.setQuality(quality);
      const ui = document.getElementById('ui-root');
      const a11y = document.getElementById('a11y-root');
      const title = document.querySelector<HTMLElement>('.cinematic-arrival');
      if (ui) ui.style.display = 'none';
      if (a11y) a11y.style.display = 'none';
      if (title) title.style.display = 'none';

      app.renderer.camera.position.set(p[0], p[1], p[2]);
      app.renderer.camera.lookAt(t[0], t[1], t[2]);
      app.renderer.camera.updateProjectionMatrix();
      const eye: [number, number, number] = [p[0], p[1], p[2]];
      app.sky.follow(app.renderer.camera);
      app.lighting.update(eye);
      app.exteriorWorld.variableUpdate(0.016, eye, 'plaza', false);
      app.arrivalGarden.update(0.016, false);
      app.renderer.render();
      return {
        calls: app.renderer.renderer.info.render.calls,
        triangles: app.renderer.renderer.info.render.triangles,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
      };
    }, { p: pos, t: look, quality: tier });

    expect(renderInfo.calls).toBeGreaterThan(0);
    expect(renderInfo.triangles).toBeLessThan(600_000);

    const path = join(evidenceFolder, name);
    const png = await page.locator('#museum-canvas').screenshot({ path, timeout: 90_000 });
    expect(png.byteLength).toBeGreaterThan(15_000);
    captures.push({
      name,
      width: renderInfo.viewportW,
      height: renderInfo.viewportH,
      bytes: png.byteLength,
      sha256: createHash('sha256').update(png).digest('hex'),
      calls: renderInfo.calls,
      triangles: renderInfo.triangles,
    });
  };

  // Desktop views across pier, lighthouse gallery, coastal overlooks, and elevated rooftop height
  await captureView('01-pier-sky-islands.png', [0, 1.64, 212], [SKY_ISLANDS_ANCHOR[0], 70, SKY_ISLANDS_ANCHOR[2]], 'medium');
  await captureView('02-pier-wild-island.png', [0, 1.64, 212], [WILD_ISLAND_ANCHOR[0], 14, WILD_ISLAND_ANCHOR[2]], 'medium');
  await captureView('03-lighthouse-sky-islands.png', [LTX - 5.5, 13.14, LTZ - 5.5], [SKY_ISLANDS_ANCHOR[0], 70, SKY_ISLANDS_ANCHOR[2]], 'medium');
  await captureView('04-lighthouse-wild-island.png', [LTX - 5.5, 13.14, LTZ + 5.5], [WILD_ISLAND_ANCHOR[0], 14, WILD_ISLAND_ANCHOR[2]], 'medium');
  await captureView('05-coastal-east-sky-islands.png', [183, 1.64, 8], [SKY_ISLANDS_ANCHOR[0], 70, SKY_ISLANDS_ANCHOR[2]], 'medium');
  await captureView('06-coastal-sw-wild-island.png', [-150, 1.64, 112], [WILD_ISLAND_ANCHOR[0], 14, WILD_ISLAND_ANCHOR[2]], 'medium');
  await captureView('07-rooftop-sky-islands.png', [0, 20.0, 35], [SKY_ISLANDS_ANCHOR[0], 70, SKY_ISLANDS_ANCHOR[2]], 'medium');
  await captureView('08-rooftop-wild-island.png', [0, 20.0, 35], [WILD_ISLAND_ANCHOR[0], 14, WILD_ISLAND_ANCHOR[2]], 'medium');

  // Verify quality-tier LOD switching, GPU memory stability, and reducedMotion drift suppression in WebGL
  const lifecycle = await page.evaluate(() => {
    const app = window.__museum!;
    const collisionBefore = JSON.stringify(app.exteriorWorld.collision);
    const snap = () => {
      const skyGroup = app.scene.getObjectByName('distant-sky-islands')!;
      const wildGroup = app.scene.getObjectByName('distant-wild-island')!;
      const canopies = app.scene.getObjectByName('sky-island-botanical-canopies') as THREE.InstancedMesh;
      const rocklets = app.scene.getObjectByName('sky-island-floating-rocklets') as THREE.InstancedMesh | undefined;
      const pines = app.scene.getObjectByName('wild-island-pine-ridges') as THREE.InstancedMesh;
      return {
        skyNodes: skyGroup.children.filter((c) => c.name.startsWith('sky-island-node-')).length,
        canopies: canopies.count,
        rocklets: rocklets?.count ?? 0,
        pines: pines.count,
        mistLayers: wildGroup.children.filter((c) => c.name.startsWith('wild-island-mist-band-')).length,
        geometries: app.renderer.renderer.info.memory.geometries,
        textures: app.renderer.renderer.info.memory.textures,
        collisionMatches: JSON.stringify(app.exteriorWorld.collision) === collisionBefore,
      };
    };

    const tiers: Record<string, ReturnType<typeof snap>> = {};
    app.setQuality('low');
    app.renderer.render();
    tiers.low1 = snap();

    app.setQuality('medium');
    app.renderer.render();
    tiers.medium = snap();

    app.setQuality('high');
    app.renderer.render();
    tiers.high = snap();

    app.setQuality('low');
    app.renderer.render();
    tiers.low2 = snap();

    // First access to a higher tier can warm other exterior assets. Compare
    // complete repeated cycles after those one-time GPU allocations settle.
    app.setQuality('medium');
    app.renderer.render();
    tiers.medium2 = snap();
    app.setQuality('high');
    app.renderer.render();
    tiers.high2 = snap();
    app.setQuality('low');
    app.renderer.render();
    tiers.low3 = snap();

    const node0 = app.scene.getObjectByName('sky-island-node-0')!;
    app.exteriorWorld.variableUpdate(1.2, [0, 2, 212], 'plaza', false);
    const driftedY = node0.position.y;
    app.exteriorWorld.variableUpdate(0.5, [0, 2, 212], 'plaza', true);
    const restY = node0.position.y;
    app.exteriorWorld.variableUpdate(1.0, [0, 2, 212], 'plaza', true);
    const heldRestY = node0.position.y;

    return { tiers, driftedY, restY, heldRestY };
  });

  expect(lifecycle.tiers.low1).toMatchObject({
    skyNodes: DISTANT_ISLAND_LOD_COUNTS.low.skyIslandCount,
    canopies: DISTANT_ISLAND_LOD_COUNTS.low.skyCanopies,
    rocklets: DISTANT_ISLAND_LOD_COUNTS.low.skyRocklets,
    pines: DISTANT_ISLAND_LOD_COUNTS.low.wildPines,
    mistLayers: DISTANT_ISLAND_LOD_COUNTS.low.wildMistLayers,
    collisionMatches: true,
  });
  expect(lifecycle.tiers.medium).toMatchObject({
    skyNodes: DISTANT_ISLAND_LOD_COUNTS.medium.skyIslandCount,
    canopies: DISTANT_ISLAND_LOD_COUNTS.medium.skyCanopies,
    rocklets: DISTANT_ISLAND_LOD_COUNTS.medium.skyRocklets,
    pines: DISTANT_ISLAND_LOD_COUNTS.medium.wildPines,
    mistLayers: DISTANT_ISLAND_LOD_COUNTS.medium.wildMistLayers,
    collisionMatches: true,
  });
  expect(lifecycle.tiers.high).toMatchObject({
    skyNodes: DISTANT_ISLAND_LOD_COUNTS.high.skyIslandCount,
    canopies: DISTANT_ISLAND_LOD_COUNTS.high.skyCanopies,
    rocklets: DISTANT_ISLAND_LOD_COUNTS.high.skyRocklets,
    pines: DISTANT_ISLAND_LOD_COUNTS.high.wildPines,
    mistLayers: DISTANT_ISLAND_LOD_COUNTS.high.wildMistLayers,
    collisionMatches: true,
  });
  expect(lifecycle.tiers.low2).toEqual(lifecycle.tiers.low3);
  expect(lifecycle.tiers.medium).toEqual(lifecycle.tiers.medium2);
  expect(lifecycle.tiers.high).toEqual(lifecycle.tiers.high2);
  expect(lifecycle.driftedY).not.toBe(lifecycle.restY);
  expect(lifecycle.heldRestY).toBe(lifecycle.restY);

  // Mobile portrait views
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.innerWidth === 390 && window.innerHeight === 844);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__museum!.renderer.resize());
  await captureView('09-mobile-portrait-pier-wild.png', [0, 1.64, 212], [WILD_ISLAND_ANCHOR[0], 14, WILD_ISLAND_ANCHOR[2]], 'medium');
  await captureView('10-mobile-portrait-rooftop-sky.png', [0, 20.0, 35], [SKY_ISLANDS_ANCHOR[0], 70, SKY_ISLANDS_ANCHOR[2]], 'medium');

  await writeFile(
    join(evidenceFolder, 'capture-manifest.json'),
    JSON.stringify({ captures, lifecycle }, null, 2),
  );
  expect(errors).toEqual([]);
});

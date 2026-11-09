import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const evidenceFolder = 'docs/evidence/exterior-omni-v2';

// 30 authored camera views covering canonical, 12 signature features, and required furnishings
const cameraViews: readonly [string, [number, number, number], [number, number, number]][] = [
  // Seven canonical baseline views
  ['01-pier-arrival', [0, 2.2, 203], [0, 10, 90]],
  ['02-front-south', [0, 18, 140], [0, 8, 0]],
  ['03-east-lagoon', [140, 35, 30], [0, 10, 0]],
  ['04-west-woodland', [-140, 30, -20], [0, 10, 0]],
  ['05-high-topdown', [0, 220, 0.1], [0, 0, 0]],
  ['06-rear-north', [0, 25, -140], [0, 10, 0]],

  // 12 Mandatory Signature Features
  ['feat-01-arrival-axis-walkway', [0, 1.8, 168], [0, 0.2, 150]],
  ['feat-01-arrival-axis-detail', [0, 0.8, 155], [0, 0.01, 153]],
  ['feat-02-reflecting-rill', [-2, 1.8, 140], [-8, 0.1, 145]],
  ['feat-03-living-fern-ravine', [-120, 1.7, 4], [-127, 0.5, -2]],
  ['feat-04-pollinator-meadow', [-62, 1.8, 112], [-68, 0.8, 118]],
  ['feat-05-neolithic-stone-circle', [-72, 2.0, -104], [-72, 1.5, -118]],
  ['feat-06-observation-hide-approach', [48, 1.8, -14], [54, 1.2, -14]],
  ['feat-06-observation-hide-lagoon-view', [54.5, 1.6, -14], [75, 0.5, -10]],
  ['feat-07-sculptural-wind-grove', [42, 2.0, 102], [48, 3.5, 108]],
  ['feat-08-ancient-tree-landmark', [30, 2.2, -78], [38, 4.0, -88]],
  ['feat-09-moonlit-lantern-path', [19, 1.8, -63], [32, 0.5, -45]],
  ['feat-10-coastal-tidepool-garden', [132, 1.6, 31], [136, -0.6, 36]],
  ['feat-11-astronomical-terrace', [-34, 2.5, 142], [-34, 0.5, 134]],
  ['feat-12-rear-garden-reveal', [0, 1.8, -105], [0, 3.0, -122]],
  ['feat-12-rear-garden-reverse-vista', [0, 2.2, -126], [0, 8.0, 0]],

  // Complementary required furnishings & views
  ['view-fountain-and-forecourt', [0, 1.8, 155], [0, 1.5, 138]],
  ['view-benches-and-tables', [14, 1.6, 134], [17, 0.5, 139]],
  ['view-animal-statuary-hare', [-60, 1.5, 112], [-62, 0.6, 115]],
  ['view-animal-statuary-otter', [54, 1.5, -6], [56, 0.6, -8]],
  ['view-animal-statuary-owl', [-130, 1.8, -6], [-132, 1.6, -8]],
  ['view-neolithic-stele', [30, 1.6, 130], [32, 1.4, 132]],
  ['view-exterior-looking-in', [0, 1.8, 133], [0, 2.0, 126]],
  ['view-interior-looking-out', [0, 1.8, 126], [0, 1.8, 140]],
];

test('Exterior Omni V2: 12 signature features, streaming boundary, and full visual evidence', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));

  // 1. Structural Invariant: Exterior must have zero interior meshes while outside
  const coldAudit = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();

    // Verify all 12 signature features exist by name in the scene graph
    const requiredSignatures = [
      'arrival-axis-luminous-inlay',
      'sculpted-reflecting-rill',
      'living-fern-ravine',
      'wildflower-pollinator-meadow',
      'neolithic-stone-circle',
      'wildlife-observation-hide',
      'sculptural-wind-grove',
      'ancient-tree-landmark',
      'moonlit-lantern-path',
      'coastal-tidepool-garden',
      'astronomical-seasonal-terrace',
      'rear-garden-monumental-reveal',
      'animal-statuary-group',
      'neolithic-sculpture-group',
      'outdoor-furnishings-group',
    ];

    const signatureChecks = requiredSignatures.map((name) => ({
      name,
      found: Boolean(app.scene.getObjectByName(name)),
    }));

    return {
      activeWorld: app.activeWorld,
      interiorConstructed: app.interiorConstructed,
      interiorWorldPresent: Boolean(app.interiorWorld),
      signatureChecks,
    };
  });

  expect(coldAudit.activeWorld).toBe('exterior');
  expect(coldAudit.interiorConstructed).toBe(false);
  expect(coldAudit.interiorWorldPresent).toBe(false);
  for (const check of coldAudit.signatureChecks) {
    expect(check.found, `Signature feature ${check.name} must exist`).toBe(true);
  }

  // 2. Traversal & Collision Checkpoints for all 12 features
  const traversalAudit = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');

    const checkpoints: [string, number, number][] = [
      ['pier-spawn', 0, 196],
      ['arrival-axis', 0, 156],
      ['reflecting-rill-bridge', -5, 143.4],
      ['terrace-fountain', 0, 142],
      ['astronomical-terrace', -34, 134],
      ['pollinator-meadow', -68, 118],
      ['fern-ravine', -126, -2],
      ['neolithic-circle', -72, -118],
      ['rear-garden-reveal', 0, -120],
      ['ancient-tree', 38, -88],
      ['lantern-path', 27, -54],
      ['observation-hide', 52, -14],
      ['tidepool-garden', 136, 36],
      ['wind-grove', 48, 108],
    ];

    const results = [];
    for (const [id, x, z] of checkpoints) {
      const support = app.exteriorWorld.collision.supportHeight(x, z, 0);
      app.player.teleport([x, 0, z]);
      for (let i = 0; i < 15; i++) app.fixedUpdate(1 / 60);
      results.push({
        id,
        x,
        z,
        support,
        playerY: app.player.position.y,
        grounded: app.player.grounded,
      });
    }

    return results;
  });

  for (const r of traversalAudit) {
    expect(r.support, `Support height at checkpoint ${r.id}`).not.toBeNull();
    expect(r.grounded, `Player must be grounded at checkpoint ${r.id}`).toBe(true);
    expect(r.playerY, `Player Y at checkpoint ${r.id}`).toBeGreaterThanOrEqual(-0.6);
  }

  // 3. Render and capture full-size screenshots for all 30 views
  await mkdir(evidenceFolder, { recursive: true });
  await page.addStyleTag({ content: '#a11y-root, #ui-root, .cinematic-arrival { display: none !important; }' });

  const renderMetrics = [];
  const capturedImages = [];

  for (const [id, position, target] of cameraViews) {
    const metrics = await page.evaluate(({ position: p, target: t }) => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.renderer.camera.position.set(p[0], p[1], p[2]);
      app.renderer.camera.lookAt(t[0], t[1], t[2]);
      const eye: [number, number, number] = [p[0], p[1], p[2]];
      app.sky.follow(app.renderer.camera);
      app.lighting.update(eye);
      app.exteriorWorld.variableUpdate(0.016, eye, 'plaza', false);
      app.arrivalGarden.update(0.016, false);
      app.renderer.render();

      return {
        calls: app.renderer.renderer.info.render.calls,
        triangles: app.renderer.renderer.info.render.triangles,
      };
    }, { position, target });

    expect(metrics.calls).toBeGreaterThan(0);
    expect(metrics.triangles).toBeLessThan(600_000);
    renderMetrics.push({ id, ...metrics });

    const filename = `${id}.png`;
    const filepath = join(evidenceFolder, filename);
    const pngBuffer = await page.locator('#museum-canvas').screenshot({ path: filepath, timeout: 30_000 });
    expect(pngBuffer.byteLength).toBeGreaterThan(20_000);

    capturedImages.push({
      name: filename,
      width: 1280,
      height: 720,
      bytes: pngBuffer.byteLength,
      sha256: createHash('sha256').update(pngBuffer).digest('hex'),
      calls: metrics.calls,
      triangles: metrics.triangles,
    });
  }

  // 4. Mobile Pier Arrival portrait capture
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.innerWidth === 390 && window.innerHeight === 844);
  await page.waitForTimeout(100);

  const mobileMetrics = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.renderer.resize();
    app.renderer.camera.position.set(0, 2.2, 203);
    app.renderer.camera.lookAt(0, 10, 90);
    app.renderer.camera.updateProjectionMatrix();
    app.sky.follow(app.renderer.camera);
    app.lighting.update([0, 2.2, 203]);
    app.exteriorWorld.variableUpdate(0.016, [0, 2.2, 203], 'plaza', false);
    app.arrivalGarden.update(0.016, false);
    app.renderer.render();
    return {
      width: app.renderer.canvas.width,
      height: app.renderer.canvas.height,
      contextLost: app.renderer.isContextLost,
      calls: app.renderer.renderer.info.render.calls,
      triangles: app.renderer.renderer.info.render.triangles,
    };
  });

  expect(mobileMetrics.contextLost).toBe(false);
  const mobilePng = await page.locator('#museum-canvas').screenshot({
    path: join(evidenceFolder, '07-mobile-pier-arrival.png'),
    timeout: 30_000,
  });
  expect(mobilePng.byteLength).toBeGreaterThan(25_000);

  capturedImages.push({
    name: '07-mobile-pier-arrival.png',
    width: 390,
    height: 844,
    bytes: mobilePng.byteLength,
    sha256: createHash('sha256').update(mobilePng).digest('hex'),
    calls: mobileMetrics.calls,
    triangles: mobileMetrics.triangles,
  });

  // 5. Hard Streaming Boundary & Portal Transition Test
  // Teleport to entrance approach and cross threshold
  await page.setViewportSize({ width: 1280, height: 720 });
  const thresholdTest = await page.evaluate(async () => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');

    // Teleport to approach threshold
    app.player.teleport([0, 0, 134]);
    app.worldDirector.update(app.player.position);

    // Prepare interior with active loop so streaming manager prewarms entrance
    app.start();
    await app.worldDirector.prepareInterior();
    for (let i = 0; i < 40; i++) {
      if (app.interiorWorld?.streaming.telemetry.prewarmReady) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    app.stop();
    const interiorReady = app.interiorConstructed;

    // Step across portal plane (z = 127) and commit
    app.player.teleport([0, 0, 127]);
    app.worldDirector.commitToInterior();
    app.worldDirector.update(app.player.position);
    const insideWorld = app.activeWorld;
    const exteriorVisibleWhileInside = app.exteriorWorld.root.visible;
    const interiorVisibleWhileInside = app.interiorWorld ? app.interiorWorld.root.visible : false;

    // Step back outside (z = 134)
    app.player.teleport([0, 0, 134]);
    app.worldDirector.switchToExterior();
    app.worldDirector.update(app.player.position);
    const returnedWorld = app.activeWorld;
    const exteriorVisibleAfterReturn = app.exteriorWorld.root.visible;

    return {
      interiorReady,
      insideWorld,
      exteriorVisibleWhileInside,
      interiorVisibleWhileInside,
      returnedWorld,
      exteriorVisibleAfterReturn,
    };
  });

  expect(thresholdTest.interiorReady).toBe(true);
  expect(thresholdTest.insideWorld).toBe('interior');
  expect(thresholdTest.exteriorVisibleWhileInside).toBe(false);
  expect(thresholdTest.interiorVisibleWhileInside).toBe(true);
  expect(thresholdTest.returnedWorld).toBe('exterior');
  expect(thresholdTest.exteriorVisibleAfterReturn).toBe(true);

  // Write out the evidence manifest
  const manifest = {
    revision: process.env.MUSEUM_BUILD_SHA ?? process.env.GITHUB_SHA ?? 'LOCAL_CANDIDATE',
    createdAt: new Date().toISOString(),
    captureType: 'real Three.js browser render / Playwright Chromium',
    evidenceFolder,
    imageCount: capturedImages.length,
    images: capturedImages,
    traversalCheckpoints: traversalAudit,
    thresholdHandoff: thresholdTest,
  };

  await writeFile(join(evidenceFolder, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  expect(errors).toEqual([]);
});

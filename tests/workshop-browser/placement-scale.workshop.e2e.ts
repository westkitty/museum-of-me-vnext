import { expect, test } from '@playwright/test';

/**
 * Real-runtime proof that 2,000 saved placements load through the actual App
 * loop with a bounded live set, and that a dormant solid placement still blocks
 * movement through the real exterior collision world.
 */
test('2,000 saved placements stay bounded in the real runtime and keep dormant collision', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await page.waitForFunction(() => Boolean(window.__museumWorkshop), null, { timeout: 60_000 });

  const loaded = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    const placements = (window.__museumWorkshop as unknown as { placements: {
      replaceManifest(raw: unknown): { objects: unknown[] };
      objectCount: number; residentCount: number;
    } }).placements;
    const objects = Array.from({ length: 2000 }, (_, index) => ({
      id: `scale-${String(index).padStart(4, '0')}`,
      label: `Scale ${index}`,
      prefab: 'display-plinth',
      anchor: 'floor',
      position: [200 + (index % 50) * 2, 0, 200 + Math.floor(index / 50) * 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      worldId: 'exterior',
      collision: 'solid',
    }));
    const started = performance.now();
    const captured = placements.replaceManifest({ schemaVersion: 2, objects });
    const replaceMs = performance.now() - started;
    return { saved: captured.objects.length, records: placements.objectCount, live: placements.residentCount, replaceMs };
  });
  expect(loaded.saved).toBe(2000);
  expect(loaded.records).toBe(2000);

  // Drive the real App loop briefly with the camera beside the far corner.
  await page.evaluate(() => {
    const app = window.__museum!;
    app.player.teleport([300, 0, 290]);
    app.camera.position.set(300, 2.2, 290);
    app.camera.updateMatrixWorld(true);
    app.start();
  });
  await page.waitForTimeout(1500);
  const settled = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    const placements = (window.__museumWorkshop as unknown as { placements: {
      residentCount: number; getObject(id: string): unknown;
    } }).placements;
    const collision = app.exteriorWorld.collision;
    const dynamic = collision.snapshot().filter((entry) => entry.ownership === 'dynamic' && entry.id.startsWith('wall:scale-'));
    // scale-0000 sits at (200, 0, 200), far from the camera, so it should be dormant.
    const dormantLive = app.scene.getObjectByName('workshop:scale-0000') !== undefined;
    // Probe the outer (-X) face of the corner plinth so no neighbour blocks the push-out.
    const probe = { x: 199.7, y: 0.1, z: 200 };
    const blocked = collision.resolveHorizontal(probe, 0.35, 1.6);
    return { live: placements.residentCount, walls: dynamic.length, dormantLive, blocked,
      pushedX: probe.x, pushedZ: probe.z };
  });
  expect(settled.live).toBeGreaterThan(0);
  expect(settled.live).toBeLessThanOrEqual(384);
  expect(settled.dormantLive).toBe(false);
  expect(settled.walls).toBe(2000);
  expect(settled.blocked).toBe(true);
  // Plinth half-width 0.88 plus visitor radius 0.35: the probe ends outside x = 198.77.
  expect(settled.pushedX).toBeLessThanOrEqual(198.78);
  expect(errors).toEqual([]);
  console.info(`[placement-scale] replace ${loaded.replaceMs.toFixed(0)} ms, live after load ${loaded.live}, live after walk ${settled.live}`);
});

import { expect, test } from '@playwright/test';

test('side-path threshold crossing keeps the island rendered; only the actual entrance swaps worlds', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  const outside = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.setQuality('low');
    app.renderer.renderer.setPixelRatio(0.5);
    app.renderer.renderer.setSize(320, 180, false);

    // Reproduce the observed recording: go around the building, crossing
    // the old global z=128 switching plane without using its doorway.
    const side: Array<{ x: number; z: number; active: string; exterior: boolean; interiorVisible: boolean; started: boolean }> = [];
    for (const [x, z] of [[30, 133], [30, 127], [30, 123], [-30, 126], [0, 110]]) {
      app.player.teleport([x, 0, z]);
      app.variableUpdate(1 / 60);
      side.push({
        x, z, active: app.activeWorld,
        exterior: app.exteriorWorld.root.visible,
        interiorVisible: app.interiorWorld?.root.visible ?? false,
        started: app.interiorImportStarted,
      });
    }
    // Free flight above the entrance arch is also not entering the museum.
    app.player.teleport([0, 12, 127]);
    app.variableUpdate(1 / 60);
    const flight = { active: app.activeWorld, interiorStarted: app.interiorImportStarted };
    return { side, flight };
  });

  for (const point of outside.side) {
    expect(point.active, `side path (${point.x},${point.z})`).toBe('exterior');
    expect(point.exterior).toBe(true);
    expect(point.interiorVisible).toBe(false);
    expect(point.started).toBe(false);
  }
  expect(outside.flight).toEqual({ active: 'exterior', interiorStarted: false });

  // The original centre-doorway journey must still prepare while hiding the
  // interior world, then swap both render and collision worlds atomically.
  await page.evaluate(async () => {
    const app = window.__museum!;
    app.player.teleport([0, 0, 133]);
    app.variableUpdate(1 / 60);
    await app.worldDirector.prepareInterior();
    app.start();
  });
  await page.waitForFunction(() => window.__museum?.interiorWorld?.streaming.telemetry.prewarmReady === true, null, { timeout: 150_000 });
  const result = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    const prepared = {
      active: app.activeWorld,
      exterior: app.exteriorWorld.root.visible,
      interior: app.interiorWorld!.root.visible,
      rootConstructed: app.interiorConstructed,
    };

    // A completed background load may not trigger an off-axis handoff either.
    app.player.teleport([30, 0, 126]);
    app.variableUpdate(1 / 60);
    const bypass = {
      active: app.activeWorld,
      exterior: app.exteriorWorld.root.visible,
      interior: app.interiorWorld!.root.visible,
    };

    app.player.teleport([0, 0, 126]);
    app.variableUpdate(1 / 60);
    const entered = {
      active: app.activeWorld,
      exterior: app.exteriorWorld.root.visible,
      interior: app.interiorWorld!.root.visible,
      collision: app.player.collisionWorld === app.interiorWorld!.collision,
    };

    app.player.teleport([20, 0, 132]);
    app.variableUpdate(1 / 60);
    const falseExit = app.activeWorld;

    app.player.teleport([0, 0, 132]);
    app.variableUpdate(1 / 60);
    const returned = {
      active: app.activeWorld,
      exterior: app.exteriorWorld.root.visible,
      interior: app.interiorWorld!.root.visible,
      collision: app.player.collisionWorld === app.exteriorWorld.collision,
    };

    return { prepared, bypass, entered, falseExit, returned };
  });

  expect(result.prepared).toEqual({
    active: 'exterior', exterior: true, interior: false, rootConstructed: true,
  });
  expect(result.bypass).toEqual({ active: 'exterior', exterior: true, interior: false });
  expect(result.entered).toEqual({ active: 'interior', exterior: false, interior: true, collision: true });
  expect(result.falseExit).toBe('interior');
  expect(result.returned).toEqual({ active: 'exterior', exterior: true, interior: false, collision: true });
  expect(errors).toEqual([]);
});

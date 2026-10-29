import { expect, test } from '@playwright/test';

test('doorway visibility, streamed artwork and embedded rendering lifecycle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), { timeout: 45_000 });

  const portal = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.player.teleport([0, 0, 0], 0);
    app.variableUpdate(1 / 60);
    const northFacing = {
      north: app.museum.zoneGroups.get('north')?.visible,
      south: app.museum.zoneGroups.get('south')?.visible,
      east: app.museum.zoneGroups.get('east')?.visible,
      media: app.museum.zoneGroups.get('media')?.visible,
    };
    app.player.teleport([0, 0, 0], Math.PI / 2);
    app.variableUpdate(1 / 60);
    const eastFacing = {
      east: app.museum.zoneGroups.get('east')?.visible,
      west: app.museum.zoneGroups.get('west')?.visible,
    };
    // The six-wing gallery collection stays in the scene even when invisible.
    const allPresent = ['north','east','south','west','media','infra']
      .every((wing) => Boolean(app.museum.zoneGroups.get(wing)));
    return { northFacing, eastFacing, allPresent };
  });
  expect(portal).toMatchObject({
    northFacing: { north: true, south: false, east: false, media: true },
    eastFacing: { east: true, west: false },
    allPresent: true,
  });

  // A source-authorized raster is created on approach and becomes non-resident
  // when leaving. No arbitrary off-origin images are introduced.
  const sourceBefore = await page.evaluate(() => {
    const app = window.__museum!;
    const pending = (app.sourceArtwork as unknown as {
      pending: Array<{ position: [number, number, number]; material: {
        version: number; map: { uuid: string; isDataTexture?: boolean } | null;
      } }>;
    }).pending;
    if (!pending?.length) throw new Error('curated source raster positions missing');
    app.sourceArtwork.update(10_000, 10_000, 1);
    const first = pending[0];
    const placeholderId = first.material.map?.uuid;
    const shaderVersion = first.material.version;
    const isPreviewTexture = first.material.map?.isDataTexture === true;
    app.sourceArtwork.update(first.position[0], first.position[2], 1);
    return { position: first.position, placeholderId, shaderVersion, isPreviewTexture };
  });
  expect(sourceBefore.position).toHaveLength(3);
  expect(sourceBefore.isPreviewTexture).toBe(true);
  // Wait for this exact authored image rather than the aggregate resident
  // count, which can also be satisfied by an unrelated background image load.
  await expect.poll(() => page.evaluate(() => {
    const entry = (window.__museum!.sourceArtwork as unknown as {
      pending: Array<{ texture: object | null; loading: boolean; material: { map: object | null } }>;
    }).pending[0];
    return entry.texture !== null && !entry.loading && entry.material.map === entry.texture;
  }), { timeout: 15_000 }).toBe(true);
  const loadedVersion = await page.evaluate(() => {
    const app = window.__museum!;
    const entry = (app.sourceArtwork as unknown as {
      pending: Array<{ material: { version: number; map: { uuid: string } | null } }>;
    }).pending[0];
    return { version: entry.material.version, mapId: entry.material.map?.uuid };
  });
  expect(loadedVersion.version).toBe(sourceBefore.shaderVersion);
  expect(loadedVersion.mapId).not.toBe(sourceBefore.placeholderId);
  // Capture eviction and the resulting map in one browser task: pending
  // ImageLoader callbacks may run between separate page.evaluate calls.
  const unloadedVersion = await page.evaluate(() => {
    const artwork = window.__museum!.sourceArtwork as unknown as {
      pending: Array<{ texture: object | null; loading: boolean; material: {
        version: number; map: { uuid: string } | null;
      } }>;
      residentCount: number;
      update(x: number, z: number, dt: number): void;
    };
    artwork.update(10_000, 10_000, 0);
    const entry = artwork.pending[0];
    return {
      version: entry.material.version,
      mapId: entry.material.map?.uuid,
      textureReleased: entry.texture === null && !entry.loading,
      residents: artwork.residentCount,
    };
  });
  expect(unloadedVersion.textureReleased).toBe(true);
  expect(unloadedVersion.residents).toBe(0);
  // Same mapped shader variant throughout load/unload: no material recompile.
  expect(unloadedVersion.version).toBe(sourceBefore.shaderVersion);
  expect(unloadedVersion.mapId).toBe(sourceBefore.placeholderId);

  // Reproduce the reported Linux-CI failure mode deterministically: a late
  // callback or error state can leave a material referencing a detached map
  // while the entry's texture slot is already empty. The next far-field pass
  // must repair that state and retain the original shader variant.
  const orphanRecovery = await page.evaluate(() => {
    const app = window.__museum!;
    const artwork = app.sourceArtwork as unknown as {
      placeholder: { uuid: string };
      pending: Array<{ texture: object | null; loading: boolean; material: {
        version: number;
        map: { uuid: string; clone(): { uuid: string; dispose(): void } } | null;
      } }>;
    };
    const entry = artwork.pending[0];
    const detached = entry.material.map!.clone();
    entry.texture = null;
    entry.loading = false;
    entry.material.map = detached as unknown as typeof entry.material.map;
    app.sourceArtwork.update(10_000, 10_000, 1);
    const result = {
      restored: entry.material.map === artwork.placeholder,
      shaderVersion: entry.material.version,
    };
    detached.dispose();
    return result;
  });
  expect(orphanRecovery.restored).toBe(true);
  expect(orphanRecovery.shaderVersion).toBe(sourceBefore.shaderVersion);

  const richCases = await page.evaluate(() => {
    const app = window.__museum!;
    const first = app.supplementary.group.children[0];
    app.supplementary.update(first.position.x, first.position.z, 1);
    const close = app.supplementary.highResolutionResidentCount;
    app.supplementary.update(10_000, 10_000, 1);
    return { close, after: app.supplementary.highResolutionResidentCount };
  });
  expect(richCases.close).toBeGreaterThan(0);
  expect(richCases.close).toBeLessThanOrEqual(2);
  expect(richCases.after).toBe(0);

  const embedded = await page.evaluate(() => {
    const app = window.__museum!;
    const proof = window as Window & { __museumEmbeddedResume?: {
      running: boolean; paused: boolean; captured: boolean;
    }};
    app.ui.fullWeasel.onClose(() => {
      proof.__museumEmbeddedResume = {
        running: app.loop.isRunning,
        paused: app.streaming.isBackgroundPaused,
        captured: app.input.uiCaptured,
      };
      app.stop(); // Prevent software WebGL starving subsequent assertions.
    });
    app.start();
    app.ui.openFullWeasel();
    return {
      running: app.loop.isRunning,
      paused: app.streaming.isBackgroundPaused,
      open: app.ui.fullWeasel.isOpen,
    };
  });
  expect(embedded).toEqual({ running: false, paused: true, open: true });
  await expect(page.locator('#panel-full-weasel')).toBeVisible();
  await page.evaluate(() => window.__museum!.ui.fullWeasel.close());
  const after = await page.evaluate(() => (
    window as Window & { __museumEmbeddedResume?: unknown }
  ).__museumEmbeddedResume);
  expect(after).toEqual({ running: true, paused: false, captured: false });
  expect(errors).toEqual([]);
});

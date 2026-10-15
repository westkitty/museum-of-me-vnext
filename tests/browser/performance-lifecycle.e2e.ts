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
  const sourcePos = await page.evaluate(() => {
    const app = window.__museum!;
    const pending = (app.sourceArtwork as unknown as {
      pending: Array<{ position: [number, number, number] }>;
    }).pending;
    if (!pending?.length) throw new Error('curated source raster positions missing');
    app.sourceArtwork.update(10_000, 10_000, 1);
    const first = pending[0].position;
    app.sourceArtwork.update(first[0], first[2], 1);
    return first;
  });
  expect(sourcePos).toHaveLength(3);
  await expect.poll(() => page.evaluate(
    () => window.__museum!.sourceArtwork.residentCount,
  ), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.__museum!.sourceArtwork.update(10_000, 10_000, 1));
  expect(await page.evaluate(() => window.__museum!.sourceArtwork.residentCount)).toBe(0);

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

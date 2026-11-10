import { test, expect } from '@playwright/test';

test('capture plinth before evidence for E02, E07, E08, E11', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await expect(page.locator('#museum-canvas')).toBeVisible();

  await page.evaluate(async () => {
    const app = window.__museum!;
    app.stop();
    await app.ensureInteriorLoaded();
    app.exteriorWorld.root.visible = false;
    app.interiorWorld!.root.visible = true;
    app.interiorWorld!.setActive(true);
    app.worldDirector.activeWorld = 'interior';

    // Hide UI/diagnostics for clear screenshots
    const style = document.createElement('style');
    style.innerHTML = '.diag, .hud, .ui-root, #a11y-root { display: none !important; }';
    document.head.appendChild(style);
  });

  const targetBays = [
    // E02: anchor is [16, 0, -33], plinth center at [16, 0, -33].
    // Stand in doorway at x=10.5, z=-33, looking into bay toward x=16, y=0.9, z=-33.
    { id: 'E02', cam: [10.5, 1.7, -33.0], look: [16.0, 0.9, -33.0], zone: 'north' },
    // E07: anchor is [-16, 0, -87], plinth center at [-16, 0, -87].
    // Stand in doorway at x=-10.5, z=-87, looking into bay toward x=-16, y=0.9, z=-87.
    { id: 'E07', cam: [-10.5, 1.7, -87.0], look: [-16.0, 0.9, -87.0], zone: 'north' },
    // E08: anchor is [16, 0, -87], plinth center at [16, 0, -87].
    // Stand in doorway at x=10.5, z=-87, looking into bay toward x=16, y=0.9, z=-87.
    { id: 'E08', cam: [10.5, 1.7, -87.0], look: [16.0, 0.9, -87.0], zone: 'north' },
    // E11: anchor is [-51, 0, 15], plinth center at [-51, 0, 15].
    // Stand in doorway at x=-51, z=9.5, looking into bay toward x=-51, y=0.9, z=15.
    { id: 'E11', cam: [-51.0, 1.7, 9.5], look: [-51.0, 0.9, 15.0], zone: 'west' },
  ];

  for (const { id, cam, look, zone } of targetBays) {
    await page.evaluate(async ({ id, cam, look, zone }) => {
      const app = window.__museum!;
      // Make sure exhibit is loaded, mounted, and active
      const host = app.interiorWorld!.streaming.get(id);
      if (host) {
        if (host.currentState === 'unloaded') await host.preload();
        if (host.currentState === 'loaded') host.mount();
        if (host.currentState === 'mounted') host.activate(0);
        // Step update once
        host.update(1 / 60, cam as [number, number, number], performance.now());
      }
      app.player.teleport(cam as [number, number, number]);
      app.camera.position.set(cam[0], cam[1], cam[2]);
      app.camera.lookAt(look[0], look[1], look[2]);
      app.atmosphere.update(zone as 'north' | 'west' | 'east' | 'south' | 'media' | 'infra' | 'rotunda', 1 / 60, true);
      app.renderer.render();
    }, { id, cam, look, zone });

    await page.screenshot({ path: `docs/evidence/plinth-repairs-20261109/${id}-after.png` });
  }
});

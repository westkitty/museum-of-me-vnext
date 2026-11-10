import { test, expect } from '@playwright/test';

test('capture lead exhibits before evidence for E14, E15, E16, E23, E26', async ({ page }) => {
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
    {
      id: 'E14',
      wing: 'media',
      cam: [-19.940411, 11.7, -29.557063],
      look: [-15.202796, 11.2, -34.294679],
    },
    {
      id: 'E15',
      wing: 'media',
      cam: [-42.284986, 11.7, -32.668333],
      look: [-47.022601, 11.2, -27.930718],
    },
    {
      id: 'E16',
      wing: 'media',
      cam: [-32.668333, 11.7, -42.284986],
      look: [-27.930718, 11.2, -47.022601],
    },
    {
      id: 'E23',
      wing: 'east',
      cam: [87.0, 1.7, -7.3],
      look: [87.0, 1.2, -15.0],
    },
    {
      id: 'E26',
      wing: 'south',
      cam: [9.3, 1.7, 51.0],
      look: [17.0, 1.2, 51.0],
    },
  ];

  for (const { id, cam, look, wing } of targetBays) {
    await page.evaluate(async ({ id, cam, look, wing }) => {
      const app = window.__museum!;
      const host = app.interiorWorld!.streaming.get(id);
      if (host) {
        if (host.currentState === 'unloaded') await host.preload();
        if (host.currentState === 'loaded') host.mount();
        if (host.currentState === 'mounted') host.activate(0);
        host.update(1 / 60, cam as [number, number, number], performance.now());
      }
      app.player.teleport(cam as [number, number, number]);
      app.camera.position.set(cam[0], cam[1], cam[2]);
      app.camera.lookAt(look[0], look[1], look[2]);
      app.atmosphere.update(wing as 'north' | 'west' | 'east' | 'south' | 'media' | 'infra' | 'rotunda', 1 / 60, true);
      app.renderer.render();
    }, { id, cam, look, wing });

    await page.screenshot({ path: `docs/evidence/lead-exhibits-pass4-20261110/${id}-after.png` });
  }
});

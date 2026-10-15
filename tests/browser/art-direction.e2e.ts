import { expect, test } from '@playwright/test';

test('the real playable museum renders shared gallery finishes and transitions all six wings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), { timeout: 30_000 });
  const state = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop(); // Same CI software-WebGL guard as the existing visitor paths.
    app.renderer.render(); // Real WebGL submission, not source-only assertions.

    let mineralMeshes = 0;
    const textures = new Set<string>();
    app.renderer.scene.traverse((node) => {
      const mesh = node as { material?: { map?: { name?: string; uuid?: string } } };
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat?.map?.name !== 'museum-honed-stone-grain') continue;
        mineralMeshes++;
        if (mat.map.uuid) textures.add(mat.map.uuid);
      }
    });

    const relief = app.renderer.scene.getObjectByName('gallery-relief-accents') as { count?: number; instanceMatrix?: { count?: number }; isInstancedMesh?: boolean } | undefined;
    const positions: Array<{ zone: string; fogNear: number; fogFar: number; exposure: number }> = [];
    for (const zone of ['plaza', 'rotunda', 'north', 'east', 'south', 'west', 'media', 'infra', 'sanctuary'] as const) {
      app.atmosphere.update(zone, 1 / 60, true);
      const fog = app.renderer.scene.fog as { near: number; far: number };
      positions.push({
        zone, fogNear: fog.near, fogFar: fog.far,
        exposure: app.renderer.renderer.toneMappingExposure,
      });
    }
    const settings = app.renderer.quality;
    const allRunners = ['north', 'east', 'south', 'west', 'media', 'infra']
      .every((id) => Boolean(app.renderer.scene.getObjectByName(`wing-honed-runner:${id}`)));
    const blindSeals = ['ne', 'se', 'sw']
      .every((face) => Boolean(app.renderer.scene.getObjectByName(`rotunda-archive-seal:${face}`)));
    const result = {
      mineralMeshes, textureCount: textures.size,
      reliefInstances: relief?.count ?? 0, reliefCapacity: relief?.instanceMatrix?.count ?? 0,
      allRunners, blindSeals,
      drawCalls: app.renderer.renderer.info.render.calls,
      triangles: app.renderer.renderer.info.render.triangles,
      instanced: Boolean(relief?.isInstancedMesh), positions,
      contextLost: app.renderer.isContextLost,
      quality: settings.tier,
    };
    // Restore the visitor's actual plaza look before any later browser work.
    app.atmosphere.update('plaza', 1 / 60, true);
    return result;
  });

  // Optional human-review evidence from the actual renderer, never used to
  // manufacture visual sign-off or to replace gameplay regression tests.
  if (process.env.MUSEUM_VISUAL_PROOF === '1') {
    await page.addStyleTag({ content: '.diag, .hud, .ui-root > .qa-capture { display: none !important; }' });
    await page.screenshot({ path: '/tmp/museum-aaa-plaza.png' });
    for (const [name, position, zone, yaw] of [
      ['rotunda', [0, 0, 4], 'rotunda', 0],
      ['north', [0, 0, -38], 'north', 0],
      ['east', [38, 0, 0], 'east', -Math.PI / 2],
      ['south', [0, 0, 38], 'south', Math.PI],
      ['west', [-38, 0, 0], 'west', Math.PI / 2],
      ['media', [-24, 10, -24], 'media', Math.PI / 4],
      ['infra', [24, 10, -24], 'infra', -Math.PI / 4],
    ] as const) {
      await page.evaluate(({ position, zone, yaw }) => {
        const app = window.__museum!;
        app.player.teleport(position, yaw);
        app.player.applyToCamera(app.camera, 1);
        app.atmosphere.update(zone, 1 / 60, true);
        app.sky.follow(app.camera);
        app.renderer.render();
      }, { position, zone, yaw });
      await page.screenshot({ path: `/tmp/museum-aaa-${name}.png` });
    }
  }

  expect(state.contextLost).toBe(false);
  expect(state.mineralMeshes).toBeGreaterThan(30);
  expect(state.textureCount).toBe(1);
  expect(state.instanced).toBe(true);
  // Full 140-location data remains resident, but viewport/portal culling
  // submits only the relevant subset. This preserves the source art without
  // forcing unseen accent instances through every visitor frame.
  expect(state.reliefCapacity).toBe(140);
  expect(state.reliefInstances).toBeGreaterThan(0);
  expect(state.reliefInstances).toBeLessThanOrEqual(state.reliefCapacity);
  expect(state.allRunners).toBe(true);
  expect(state.blindSeals).toBe(true);
  expect(state.drawCalls).toBeGreaterThan(0);
  expect(state.drawCalls).toBeLessThan(2200);
  expect(state.triangles).toBeLessThan(500_000);
  expect(state.positions).toHaveLength(9);
  expect(state.positions.find((item) => item.zone === 'rotunda')!.fogFar).toBeGreaterThan(300);
  expect(state.positions.find((item) => item.zone === 'north')!.fogNear)
    .toBeLessThan(state.positions.find((item) => item.zone === 'rotunda')!.fogNear);
  expect(state.positions.every((item) => item.exposure >= 0.98 && item.exposure <= 1.04)).toBe(true);
  expect(errors).toEqual([]);
});

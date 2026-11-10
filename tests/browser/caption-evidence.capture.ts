import { test, expect } from '@playwright/test';

test('capture caption legibility before evidence for representative bays across all wings', async ({ page }) => {
  test.setTimeout(180_000);

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
    { id: 'E01', wing: 'north' }, // starsilk: StarsilkMaker
    { id: 'E07', wing: 'north' }, // starsilk: TerraformingLaboratory
    { id: 'E08', wing: 'north' }, // archive: RhetoricalIndex
    { id: 'E11', wing: 'west' }, // archive: ContinuitySystems
    { id: 'E15', wing: 'media' }, // media: AgentHarness
    { id: 'E16', wing: 'media' }, // media: MediaLineage
    { id: 'E18', wing: 'west' }, // dex: CivicSupport
    { id: 'E20', wing: 'west' }, // dex: VoiceLab
    { id: 'E26', wing: 'south' }, // games: WestCatSystems
    { id: 'E30', wing: 'south' }, // games: AetherVFX
    { id: 'E32', wing: 'south' }, // games: SmoresKatamari
    { id: 'E34', wing: 'infra' }, // infra: BigMacBackbone
    { id: 'E35', wing: 'infra' }, // infra: SpecialistSystems
  ];

  for (const { id, wing } of targetBays) {
    await page.evaluate(async ({ id, wing }) => {
      const app = window.__museum!;
      const host = app.interiorWorld!.streaming.hosts.get(id);
      if (!host) throw new Error(`Host not found: ${id}`);

      if (host.currentState === 'unloaded') await host.preload();
      if (host.currentState === 'loaded') host.mount();
      if (host.currentState === 'mounted') host.activate(0);

      const mount = host.group.parent;
      if (!mount) throw new Error(`Mount not found for ${id}`);

      // Mount world position & rotation
      const theta = mount.rotation.y;
      const anchorX = mount.position.x;
      const anchorY = mount.position.y;
      const anchorZ = mount.position.z;

      // Stand 4.6m in front of plinth (+Z in mount local space) at eye level 1.7m
      const cam = [
        anchorX + 4.6 * Math.sin(theta),
        anchorY + 1.7,
        anchorZ + 4.6 * Math.cos(theta),
      ] as [number, number, number];

      // Look toward bay center / back wall (-Z in mount local space) at reading height 1.35m
      const look = [
        anchorX - 1.8 * Math.sin(theta),
        anchorY + 1.35,
        anchorZ - 1.8 * Math.cos(theta),
      ] as [number, number, number];

      host.update(1 / 60, cam, performance.now());
      app.player.teleport(cam);
      app.camera.position.set(cam[0], cam[1], cam[2]);
      app.camera.lookAt(look[0], look[1], look[2]);
      app.atmosphere.update(wing as 'north' | 'west' | 'east' | 'south' | 'media' | 'infra' | 'rotunda', 1 / 60, true);
      app.renderer.render();

      return { cam, look };
    }, { id, wing });

    await page.screenshot({ path: `docs/evidence/caption-repairs-pass5-20261110/${id}-after.png` });
  }
});

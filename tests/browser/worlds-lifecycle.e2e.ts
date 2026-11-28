import { expect, test } from '@playwright/test';
import type { PocketWorldId } from '../../src/world/pocket/types';
import { bootPreview } from './helpers/world-journey';

const worlds: readonly PocketWorldId[] = ['W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'L01', 'W10'];

for (const id of worlds) {
  test(`${id} releases its real world instance across ten diagnostic host visits`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await bootPreview(page, id.toLowerCase());
    const rounds = await page.evaluate(async (worldId) => {
      const app = window.__museum!;
      app.stop();
      // W10 requires an earned stamp. This is a lifecycle diagnostic only;
      // the separate W09→W10 journey proves the real unlock path.
      if (worldId === 'W10') app.passport.earnStamp('W09');
      const original = {
        pose: app.player.position.toArray(),
        yaw: app.player.yaw,
        pitch: app.player.pitch,
        fov: app.camera.fov,
      };
      const results = [];
      for (let round = 0; round < 10; round++) {
        const entered = await app.pocketHost.enter(worldId);
        if (!entered) throw new Error(`${worldId} entry failed on round ${round + 1}`);
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
        app.render(0);
        const active = app.activeWorld;
        const exited = app.pocketHost.exit({ viaVhsRewind: false });
        app.render(0);
        results.push({
          active,
          exited,
          returned: app.activeWorld,
          pose: app.player.position.toArray(),
          yaw: app.player.yaw,
          pitch: app.player.pitch,
          fov: app.camera.fov,
          pocketRoots: app.scene.children.filter((child) => child.name.startsWith('pocket-world:')).length,
          geometries: app.renderer.renderer.info.memory.geometries,
          textures: app.renderer.renderer.info.memory.textures,
          uiCaptured: app.input.uiCaptured,
          earnedCount: app.passport.earnedCount,
        });
      }
      return { original, results };
    }, id);

    expect(rounds.results).toHaveLength(10);
    for (const [index, round] of rounds.results.entries()) {
      expect(round.active, `round ${index + 1}`).toBe(`pocket:${id}`);
      expect(round.exited, `round ${index + 1}`).toBe(true);
      expect(round.returned, `round ${index + 1}`).toBe('exterior');
      expect(round.pose, `round ${index + 1}`).toEqual(rounds.original.pose);
      expect(round.yaw, `round ${index + 1}`).toBe(rounds.original.yaw);
      expect(round.pitch, `round ${index + 1}`).toBe(rounds.original.pitch);
      expect(round.fov, `round ${index + 1}`).toBe(rounds.original.fov);
      expect(round.pocketRoots, `round ${index + 1}`).toBe(0);
      expect(round.uiCaptured, `round ${index + 1}`).toBe(false);
      expect(round.earnedCount, `round ${index + 1}`).toBe(id === 'W10' ? 1 : 0);
    }
    // Compare settled cycles so first-use shader and texture warming is not
    // mistaken for leaked resources. Any monotonic growth here is a defect.
    expect(rounds.results[9].geometries).toBeLessThanOrEqual(rounds.results[4].geometries);
    expect(rounds.results[9].textures).toBeLessThanOrEqual(rounds.results[4].textures);
    expect(errors).toEqual([]);
  });
}

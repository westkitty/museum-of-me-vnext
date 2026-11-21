import type { Page } from '@playwright/test';

/**
 * Uses the real keyboard forward action, PlayerController, collision system,
 * world handoff and background preparation; changes only facing between
 * authored walking waypoints. No teleport, noclip, synthetic world commit,
 * permission bypass or click-through UI.
 */
export async function walkToMuseumInterior(
  page: Page, stopIn: 'atrium' | 'south' = 'south',
): Promise<{ world: string; zone: string; x: number; z: number; frames: number }> {
  await page.keyboard.down('w');
  try {
    return await page.evaluate(async ({ stopIn }) => {
      const app = window.__museum!;
      if (!app || app.activeWorld !== 'exterior') throw new Error('Expected exterior start');
      const tick = async (i: number) => {
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
        if (i % 60 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      };
      let frames = 0;
      const aim = async (x: number, z: number, untilInterior = false): Promise<void> => {
        for (let i = 0; i < 2200; i++, frames++) {
          if (untilInterior && app.activeWorld === 'interior') return;
          const dx = x - app.player.position.x;
          const dz = z - app.player.position.z;
          if (!untilInterior && Math.hypot(dx, dz) < 0.45) return;
          app.player.yaw = Math.atan2(-dx, -dz);
          await tick(i);
        }
        throw new Error('Real collision prevented doorway route at ' +
          app.player.position.toArray().map((n) => n.toFixed(2)).join(',') +
          ', target=' + x + ',' + z);
      };

      // The plaza approach enters the northward aperture of the spherical
      // chamber; the central column has real collision on the straight axis.
      for (const [x, z] of [
        [0, 174], [0, 164], [0, 158], [0, 150],
        [0, 145.7], [4.8, 143], [5.2, 138],
        [4.8, 133], [0, 130],
      ]) await aim(x, z);
      // Fast fixed-step replay is not elapsed network/GPU time: preserve the
      // real preparation barrier before attempting the physical seam.
      if (!app.worldDirector.interiorImportStarted) {
        throw new Error('Predictive preparation never started on the approach');
      }
      await app.worldDirector.prepareInterior();
      for (let attempt = 0; attempt < 1200 && !app.interiorWorld?.streaming.telemetry.prewarmReady; attempt++) {
        app.variableUpdate(1 / 60);
        // No normal RAF in this test. Flush the renderer's prewarm frame queue
        // without bypassing streaming or collision.
        app.render(0);
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
      if (!app.interiorWorld?.streaming.telemetry.prewarmReady) {
        throw new Error('Interior entrance never became ready');
      }
      await aim(0, 125, true);
      if (stopIn === 'south') await aim(0, 100);
      return {
        world: app.activeWorld, zone: app.currentZone,
        x: app.player.position.x, z: app.player.position.z, frames,
      };
    }, { stopIn });
  } finally {
    await page.keyboard.up('w');
  }
}

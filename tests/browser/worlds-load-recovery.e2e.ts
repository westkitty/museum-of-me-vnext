import { expect, test } from '@playwright/test';
import { ALL_POCKET_WORLD_IDS } from '../../src/world/pocket/types';
import { bootPreview } from './helpers/world-journey';

for (const id of ALL_POCKET_WORLD_IDS) {
  test(`${id} returns to a usable museum after failed and interrupted loads`, async ({ page }) => {
    const errors = await bootPreview(page, id.toLowerCase());
    const result = await page.evaluate(async (worldId) => {
      const app = window.__museum!;
      app.stop();
      if (worldId === 'W10') app.passport.earnStamp('W09'); // disposable diagnostic unlock
      const original = app.pocketRegistry.get(worldId)!;
      const originalLoad = original.load!;
      const check = () => ({
        world: app.activeWorld,
        roots: app.scene.children.filter((child) => child.name.startsWith('pocket-world:')).length,
        uiCaptured: app.input.uiCaptured,
        earned: app.passport.earnedCount,
      });

      // A rejected lazy loader must unwind the host and leave a normal retry.
      app.pocketRegistry.registerWorld(worldId, {
        readiness: 'verified',
        load: () => Promise.reject(new Error('diagnostic load rejection')),
      });
      const failed = await app.pocketHost.enter(worldId);
      const afterFailure = check();

      // Build the actual world instance, then delay its resolution so an
      // in-flight abort exercises the real factory and scope cleanup.
      app.pocketRegistry.registerWorld(worldId, {
        readiness: 'verified',
        load: async (ctx, signal) => {
          const instance = await originalLoad(ctx, signal);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return instance;
        },
      });
      const pending = app.pocketHost.enter(worldId);
      const aborted = app.pocketHost.abortPendingEntry();
      const enteredAfterAbort = await pending;
      const afterAbort = check();

      app.pocketRegistry.registerWorld(worldId, { readiness: 'verified', load: originalLoad });
      const recovered = await app.pocketHost.enter(worldId);
      const active = app.activeWorld;
      const exited = app.pocketHost.exit({ viaVhsRewind: false });
      const afterRecovery = check();
      return { failed, afterFailure, aborted, enteredAfterAbort, afterAbort, recovered, active, exited, afterRecovery };
    }, id);
    const normal = { world: 'exterior', roots: 0, uiCaptured: false, earned: id === 'W10' ? 1 : 0 };
    expect(result.failed).toBe(false);
    expect(result.afterFailure).toEqual(normal);
    expect(result.aborted).toBe(true);
    expect(result.enteredAfterAbort).toBe(false);
    expect(result.afterAbort).toEqual(normal);
    expect(result.recovered).toBe(true);
    expect(result.active).toBe(`pocket:${id}`);
    expect(result.exited).toBe(true);
    expect(result.afterRecovery).toEqual(normal);
    expect(errors).toEqual([]);
  });
}

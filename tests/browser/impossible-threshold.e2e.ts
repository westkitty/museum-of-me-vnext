import { expect, test } from '@playwright/test';
import { SANCTUARY_CENTER, SANCTUARY_FLOOR_Y } from '../../src/world/layout';

test.describe('P2 Minimum viable impossible threshold and reversible world switching', () => {
  test('real keyboard walking navigates the obsidian sphere, crosses the seam, returns and re-enters', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
    await page.addStyleTag({ content: '#a11y-root, #ui-root, .cinematic-arrival { display: none !important; }' });
    await page.evaluate(() => {
      const app = window.__museum!;
      app.stop();
      app.player.teleport([0, 0, 174], 0);
      app.setQuality('low');
      app.renderer.renderer.setPixelRatio(0.5);
      app.renderer.renderer.setSize(window.innerWidth, window.innerHeight, false);
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
      app.render(0);
    });
    await page.locator('#museum-canvas').screenshot({ path: 'test-results/p7-pier-walk.png' });

    // Genuine keyboard action and collision. Yaw follows deliberate waypoints
    // as a person would turn; no teleporting, noclip or direct world switch.
    await page.keyboard.down('w');
    const journey = await page.evaluate(async () => {
      const app = window.__museum!;
      const samples: Array<{ x: number; z: number; y: number; world: string; grounded: boolean }> = [];
      const record = () => samples.push({
        x: app.player.position.x, z: app.player.position.z,
        y: app.player.position.y, world: app.activeWorld, grounded: app.player.grounded,
      });
      const walk = async (x: number, z: number, untilWorld?: 'exterior' | 'interior'): Promise<void> => {
        for (let frame = 0; frame < 1700; frame++) {
          if (untilWorld && app.activeWorld === untilWorld) return;
          const dx = x - app.player.position.x;
          const dz = z - app.player.position.z;
          if (!untilWorld && Math.hypot(dx, dz) < 0.45) return;
          app.player.yaw = Math.atan2(-dx, -dz);
          app.fixedUpdate(1 / 60);
          app.variableUpdate(1 / 60);
          if (frame % 12 === 0) record();
          if (frame % 60 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        throw new Error('Obsidian entrance route obstructed near ' +
          app.player.position.toArray().map((n) => n.toFixed(2)).join(',') +
          ' targeting ' + x + ',' + z + ' (' + untilWorld + ')');
      };
      const approach = async () => {
        for (const [x, z] of [
          [0, 164], [0, 157.7], [0, 149], [0, 145.7],
          [4.8, 143], [5.2, 138], [4.8, 133], [0, 130],
        ]) await walk(x, z);
        // The deterministic test advances ~minutes of simulated walking in
        // milliseconds of actual wall time. Wait for genuine async streaming/
        // shader prewarm rather than calling a valid seam hold an obstruction.
        if (!app.worldDirector.interiorImportStarted) {
          throw new Error('Predictive preparation never started before the seam');
        }
        await app.worldDirector.prepareInterior();
        for (let attempt = 0; attempt < 1200 && !app.interiorWorld?.streaming.telemetry.prewarmReady; attempt++) {
          app.variableUpdate(1 / 60);
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
        }
        if (!app.interiorWorld?.streaming.telemetry.prewarmReady) {
          throw new Error('Interior entrance failed to prepare before the visitor crossed the seam');
        }
        await walk(0, 125, 'interior');
      };
      const crossOut = async () => {
        await walk(0, 165, 'exterior');
      };
      await approach();
      const firstEntry = { world: app.activeWorld, z: app.player.position.z };
      await crossOut();
      const exteriorAfterReturn = { world: app.activeWorld, z: app.player.position.z };
      for (const [x, z] of [
        [0, 130], [4.8, 133], [5.2, 138],
        [4.8, 143], [0, 145.7], [0, 150.5],
      ]) await walk(x, z);
      const fullyOutside = { world: app.activeWorld, z: app.player.position.z };
      await approach();
      record();
      app.render(0);
      return { firstEntry, exteriorAfterReturn, fullyOutside,
        finalWorld: app.activeWorld, museumBuildCount: app.museumBuildCount,
        samples, illegalTransitions: app.worldDirector.illegalTransitions };
    });
    await page.keyboard.up('w');

    expect(journey.firstEntry.world).toBe('interior');
    expect(journey.firstEntry.z).toBeGreaterThan(158);
    expect(journey.firstEntry.z).toBeLessThan(163);
    expect(journey.exteriorAfterReturn.world).toBe('exterior');
    expect(journey.exteriorAfterReturn.z).toBeGreaterThan(127);
    expect(journey.fullyOutside).toMatchObject({ world: 'exterior' });
    expect(journey.fullyOutside.z).toBeGreaterThan(148);
    expect(journey.finalWorld).toBe('interior');
    expect(journey.museumBuildCount).toBe(1);
    expect(journey.illegalTransitions).toEqual([]);
    expect(journey.samples.some((s) => s.z >= 164 && s.y < -0.4 && s.grounded)).toBe(true);
    expect(journey.samples.some((s) => s.z > 158 && s.z < 164 && s.grounded)).toBe(true);
    expect(journey.samples.some((s) => s.world === 'exterior'
      && s.x > 4 && s.z > 135 && s.z < 141 && s.grounded)).toBe(true);
    await page.locator('#museum-canvas').screenshot({ path: 'test-results/p7-interior-entry.png' });
    expect(errors).toEqual([]);
  });

  test('cold start outside, approach south doorway, predictive prepare, and enter vestibule', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));
    await expect(page.locator('#museum-canvas')).toBeVisible();

    const initialState = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      return {
        activeWorld: app.activeWorld,
        phase: app.worldDirector.phase,
        museumBuildCount: app.museumBuildCount,
        interiorConstructed: app.interiorConstructed,
        currentZone: app.currentZone,
        playerPos: [app.player.position.x, app.player.position.y, app.player.position.z],
      };
    });

    expect(initialState.activeWorld).toBe('exterior');
    expect(initialState.phase).toBe('EXTERIOR_ACTIVE');
    expect(initialState.museumBuildCount).toBe(0);
    expect(initialState.interiorConstructed).toBe(false);
    expect(initialState.currentZone).toBe('plaza');

    // Approach the doorway to z = 133 (within THRESHOLD_PREPARE_Z = 134)
    const prepareTriggerState = await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.player.teleport([0, 0, 133]);
      app.variableUpdate(1 / 60);

      const triggered = app.worldDirector.interiorImportStarted;
      // Await preparation to finish
      await app.worldDirector.prepareInterior();
      app.start();
      return { triggered };
    });

    await page.waitForFunction(() => window.__museum?.worldDirector.phase === 'AT_THRESHOLD');
    const preparedSnapshot = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      return { phase: app.worldDirector.phase, interiorConstructed: app.interiorConstructed,
        activeWorld: app.activeWorld, museumBuildCount: app.museumBuildCount };
    });

    expect(prepareTriggerState.triggered).toBe(true);
    expect(preparedSnapshot.phase).toBe('AT_THRESHOLD');
    expect(preparedSnapshot.interiorConstructed).toBe(true);
    expect(preparedSnapshot.activeWorld).toBe('exterior');
    expect(preparedSnapshot.museumBuildCount).toBe(1);

    // Cross doorway portal plane (z = 128) into vestibule at z = 126
    const crossedState = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.player.teleport([0, 0, 126]);
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
      const transitionCommittedAtMs = app.interiorLoadTelemetry.transitionCommittedAtMs;
      app.render(0);

      return {
        activeWorld: app.activeWorld,
        phase: app.worldDirector.phase,
        exteriorVisible: app.exteriorWorld.root.visible,
        interiorVisible: app.interiorWorld?.root.visible,
        playerPos: [app.player.position.x, app.player.position.y, app.player.position.z],
        grounded: app.player.grounded,
        museumBuildCount: app.museumBuildCount,
        transitionCommittedAtMs,
        firstInteriorFrameAtMs: app.interiorLoadTelemetry.firstInteriorFrameAtMs,
      };
    });

    expect(crossedState.activeWorld).toBe('interior');
    expect(crossedState.phase).toBe('INTERIOR_ACTIVE');
    expect(crossedState.exteriorVisible).toBe(false);
    expect(crossedState.interiorVisible).toBe(true);
    expect(crossedState.playerPos[1]).toBeGreaterThanOrEqual(-0.1);
    expect(crossedState.grounded).toBe(true);
    expect(crossedState.museumBuildCount).toBe(1);
    expect(crossedState.transitionCommittedAtMs).not.toBeNull();
    expect(crossedState.firstInteriorFrameAtMs).toBeGreaterThanOrEqual(crossedState.transitionCommittedAtMs!);

    // Walk further north into the Rotunda (z = 0)
    const rotundaState = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.player.teleport([0, 0, 0]);
      for (let i = 0; i < 10; i++) {
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
      }
      return {
        currentZone: app.currentZone,
        activeWorld: app.activeWorld,
        playerPos: [app.player.position.x, app.player.position.y, app.player.position.z],
      };
    });

    expect(rotundaState.currentZone).toBe('rotunda');
    expect(rotundaState.activeWorld).toBe('interior');
    expect(errors).toEqual([]);
  });

  test('reversible return to exterior and re-entry across threshold', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    // Prepare and enter interior first
    await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      await app.ensureInteriorLoaded();
      app.player.teleport([0, 0, 133]);
      app.variableUpdate(1 / 60);
      app.start();
    });
    await page.waitForFunction(() => window.__museum?.interiorWorld?.streaming.telemetry.prewarmReady === true);
    await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      app.player.teleport([0, 0, 126]);
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
    });

    // Step back south out through the atrium's front door (interior z = 162),
    // which opens outside the exterior doors (z = 128)
    const exitState = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.player.teleport([0, 0, 164]);
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);

      return {
        activeWorld: app.activeWorld,
        phase: app.worldDirector.phase,
        exteriorVisible: app.exteriorWorld.root.visible,
        interiorVisible: app.interiorWorld?.root.visible,
        playerPos: [app.player.position.x, app.player.position.y, app.player.position.z],
        grounded: app.player.grounded,
        museumBuildCount: app.museumBuildCount,
      };
    });

    expect(exitState.activeWorld).toBe('exterior');
    expect(['EXTERIOR_ACTIVE', 'PREPARING_RENDER_RESOURCES']).toContain(exitState.phase);
    expect(exitState.exteriorVisible).toBe(true);
    expect(exitState.interiorVisible).toBe(false);
    expect(exitState.playerPos[1]).toBeCloseTo(0, 1);
    expect(exitState.grounded).toBe(true);
    expect(exitState.museumBuildCount).toBe(1);

    // Step back north through the doorway into vestibule at z = 126
    const reEnterState = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.player.teleport([0, 0, 126]);
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);

      return {
        activeWorld: app.activeWorld,
        phase: app.worldDirector.phase,
        exteriorVisible: app.exteriorWorld.root.visible,
        interiorVisible: app.interiorWorld?.root.visible,
        museumBuildCount: app.museumBuildCount,
      };
    });

    expect(reEnterState.activeWorld).toBe('interior');
    expect(reEnterState.phase).toBe('INTERIOR_ACTIVE');
    expect(reEnterState.exteriorVisible).toBe(false);
    expect(reEnterState.interiorVisible).toBe(true);
    expect(reEnterState.museumBuildCount).toBe(1);
    expect(errors).toEqual([]);
  });

  test('backtracking before load completes preserves exterior position and does not teleport', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    const backtrackResult = await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();

      // Approach doorway to trigger load
      app.player.teleport([0, 0, 133]);
      app.variableUpdate(1 / 60);

      // Immediately backtrack south to plaza at z = 150 before load finishes
      app.player.teleport([0, 0, 150]);

      // Await the background load
      await app.worldDirector.prepareInterior();
      app.variableUpdate(1 / 60);

      return {
        activeWorld: app.activeWorld,
        phase: app.worldDirector.phase,
        interiorConstructed: app.interiorConstructed,
        posAfterLoad: [app.player.position.x, app.player.position.y, app.player.position.z],
        museumBuildCount: app.museumBuildCount,
      };
    });

    expect(backtrackResult.activeWorld).toBe('exterior');
    expect(['AT_THRESHOLD', 'PREPARING_RENDER_RESOURCES']).toContain(backtrackResult.phase);
    expect(backtrackResult.interiorConstructed).toBe(true);
    expect(backtrackResult.posAfterLoad[2]).toBe(150);
    expect(backtrackResult.museumBuildCount).toBe(1);
    expect(errors).toEqual([]);
  });

  test('repeated reversible world switching 15 times remains stable and leak-free', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      await app.ensureInteriorLoaded();
      app.player.teleport([0, 0, 133]);
      app.variableUpdate(1 / 60);
      app.start();
    });
    await page.waitForFunction(() => window.__museum?.interiorWorld?.streaming.telemetry.prewarmReady === true);
    const multiSwitchResult = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      const memoryBefore = { ...app.renderer.renderer.info.memory };

      const results: { iter: number; activeWorld: string; exteriorVisible: boolean; interiorVisible: boolean; interiorState: string }[] = [];

      for (let i = 0; i < 15; i++) {
        // Step inside
        app.player.teleport([0, 0, 126]);
        app.variableUpdate(1 / 60);
        results.push({
          iter: i,
          activeWorld: app.activeWorld,
          exteriorVisible: app.exteriorWorld.root.visible,
          interiorVisible: Boolean(app.interiorWorld?.root.visible),
          interiorState: app.interiorWorld?.runtimeState ?? 'missing',
        });

        // Step outside
        app.player.teleport([0, 0, 164]);
        app.variableUpdate(1 / 60);
        results.push({
          iter: i,
          activeWorld: app.activeWorld,
          exteriorVisible: app.exteriorWorld.root.visible,
          interiorVisible: Boolean(app.interiorWorld?.root.visible),
          interiorState: app.interiorWorld?.runtimeState ?? 'missing',
        });
      }

      return {
        results,
        museumBuildCount: app.museumBuildCount,
        finalWorld: app.activeWorld,
        memoryBefore,
        memoryAfter: { ...app.renderer.renderer.info.memory },
      };
    });

    expect(multiSwitchResult.museumBuildCount).toBe(1);
    expect(multiSwitchResult.finalWorld).toBe('exterior');
    expect(multiSwitchResult.memoryAfter).toEqual(multiSwitchResult.memoryBefore);
    expect(multiSwitchResult.results.filter((item) => item.activeWorld === 'interior')).toHaveLength(15);

    for (const r of multiSwitchResult.results) {
      if (r.activeWorld === 'interior') {
        expect(r.exteriorVisible).toBe(false);
        expect(r.interiorVisible).toBe(true);
        expect(r.interiorState).toBe('active');
      } else {
        expect(r.exteriorVisible).toBe(true);
        expect(r.interiorVisible).toBe(false);
        expect(r.interiorState).toBe('retained');
      }
    }

    // Every phase change in all 30 switches followed the declared state machine.
    expect(await page.evaluate(() => window.__museum!.worldDirector.illegalTransitions)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Dexter Sanctuary traversal and collision integrity preserved across transitions', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      await app.ensureInteriorLoaded();
      app.player.teleport([0, 0, 133]);
      app.variableUpdate(1 / 60);
      app.start();
    });
    await page.waitForFunction(() => window.__museum?.interiorWorld?.streaming.telemetry.prewarmReady === true);
    const sanctuaryTest = await page.evaluate(async ({ targetCenter, targetFloorY }) => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      app.player.teleport([0, 0, 126]);
      app.variableUpdate(1 / 60);

      // Teleport into sanctuary center
      app.player.teleport([targetCenter[0], targetFloorY, targetCenter[2]]);

      for (let i = 0; i < 30; i++) {
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
      }

      const sanctuaryGrounded = app.player.grounded;
      const sanctuaryY = app.player.position.y;
      const sanctuaryZone = app.currentZone;

      // Now travel back to south vestibule and step outside
      app.player.teleport([0, 0, 164]);
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);

      const outsideWorld = app.activeWorld;

      // Re-enter interior and check sanctuary again
      app.player.teleport([0, 0, 126]);
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);

      app.player.teleport([targetCenter[0], targetFloorY, targetCenter[2]]);
      for (let i = 0; i < 30; i++) {
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
      }

      return {
        sanctuaryGrounded,
        sanctuaryY,
        sanctuaryZone,
        outsideWorld,
        reEnteredWorld: app.activeWorld,
        reEnteredSanctuaryGrounded: app.player.grounded,
        reEnteredSanctuaryY: app.player.position.y,
        museumBuildCount: app.museumBuildCount,
      };
    }, { targetCenter: SANCTUARY_CENTER, targetFloorY: SANCTUARY_FLOOR_Y });

    expect(sanctuaryTest.sanctuaryZone).toBe('sanctuary');
    expect(sanctuaryTest.sanctuaryGrounded).toBe(true);
    expect(sanctuaryTest.sanctuaryY).toBeCloseTo(-4.45, 1);
    expect(sanctuaryTest.outsideWorld).toBe('exterior');
    expect(sanctuaryTest.reEnteredWorld).toBe('interior');
    expect(sanctuaryTest.reEnteredSanctuaryGrounded).toBe(true);
    expect(sanctuaryTest.reEnteredSanctuaryY).toBeCloseTo(-4.45, 1);
    expect(sanctuaryTest.museumBuildCount).toBe(1);
    expect(errors).toEqual([]);
  });

  test('error handling and failure recovery preserves exterior safety', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    await page.route('**/src/world/InteriorWorld.ts*', async (route) => {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Simulated stale deployment chunk' });
    });
    const failure = await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      localStorage.setItem('p5-recovery-preservation', 'kept');
      let threw = false;
      try {
        await app.worldDirector.prepareInterior();
      } catch {
        threw = true;
      }
      return {
        threw,
        phase: app.worldDirector.phase,
        world: app.activeWorld,
        failure: app.interiorLoadTelemetry.lastFailure,
      };
    });
    await page.unroute('**/src/world/InteriorWorld.ts*');
    await expect(page.getByRole('button', { name: 'Reload and retry' })).toBeVisible();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'commit' }),
      page.getByRole('button', { name: 'Reload and retry' }).click(),
    ]);
    await page.waitForFunction(() => Boolean(window.__museum));
    const recovery = await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      const preservedStorage = localStorage.getItem('p5-recovery-preservation');
      await app.worldDirector.prepareInterior();
      return { phase: app.worldDirector.phase, constructed: app.interiorConstructed,
        failure: app.interiorLoadTelemetry.lastFailure, preservedStorage };
    });

    expect(failure.threw).toBe(true);
    expect(failure.phase).toBe('PREPARATION_FAILED');
    expect(failure.world).toBe('exterior');
    expect(failure.failure).toMatch(/404|Failed to fetch dynamically imported module/);
    expect(['AT_THRESHOLD', 'PREPARING_RENDER_RESOURCES']).toContain(recovery.phase);
    expect(recovery.constructed).toBe(true);
    expect(recovery.failure).toBe(null);
    expect(recovery.preservedStorage).toBe('kept');
    expect(errors).toEqual([]);
  });
});

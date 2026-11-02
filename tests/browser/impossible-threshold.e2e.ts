import { expect, test } from '@playwright/test';
import { SANCTUARY_CENTER, SANCTUARY_FLOOR_Y } from '../../src/world/layout';

test.describe('P2 Minimum viable impossible threshold and reversible world switching', () => {
  test('real keyboard walking crosses the pier stairs, terrace, threshold and returns outside', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));
    await page.addStyleTag({ content: '#a11y-root, #ui-root, .cinematic-arrival { display: none !important; }' });
    await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      app.player.teleport([0, 0, 174], 0);
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
      app.setQuality('low');
      // SwiftShader's default full-size framebuffer can starve the live input
      // loop during a long traversal. Keep real keyboard and collision paths,
      // while reducing only the test renderer's pixel workload.
      app.renderer.renderer.setPixelRatio(0.5);
      app.renderer.renderer.setSize(window.innerWidth, window.innerHeight, false);
      (window as Window & { __p7RouteSamples?: Array<{ z: number; y: number; grounded: boolean; world: string }> })
        .__p7RouteSamples = [];
      window.setInterval(() => {
        const current = window.__museum;
        if (!current) return;
        (window as Window & { __p7RouteSamples?: Array<{ z: number; y: number; grounded: boolean; world: string }> })
          .__p7RouteSamples?.push({ z: current.player.position.z, y: current.player.position.y,
            grounded: current.player.grounded, world: current.activeWorld });
      }, 100);
      app.start();
      app.render(0);
    });
    await page.locator('#museum-canvas').screenshot({ path: 'test-results/p7-pier-walk.png' });

    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    await page.waitForFunction(() => (window.__museum?.player.position.z ?? Infinity) < 163.5, null, { timeout: 120_000 });
    await page.waitForFunction(() => (window.__museum?.player.position.z ?? Infinity) < 157.5, null, { timeout: 120_000 });
    await page.waitForFunction(() => window.__museum?.activeWorld === 'interior', null, { timeout: 240_000 });
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');
    const entry = await page.evaluate(() => {
      const app = window.__museum;
      const samples = (window as Window & { __p7RouteSamples?: Array<{ z: number; y: number; grounded: boolean; world: string }> })
        .__p7RouteSamples ?? [];
      if (!app) throw new Error('museum missing');
      return { world: app.activeWorld, position: [app.player.position.x, app.player.position.y, app.player.position.z],
        museumBuildCount: app.museumBuildCount, samples };
    });
    expect(entry.world).toBe('interior');
    expect(entry.position[2]).toBeLessThan(128);
    expect(entry.museumBuildCount).toBe(1);
    expect(entry.samples.some((sample) => sample.z >= 164 && sample.y < -0.4 && sample.grounded)).toBe(true);
    expect(entry.samples.some((sample) => sample.z > 158 && sample.z < 164 && sample.grounded)).toBe(true);
    expect(entry.samples.some((sample) => sample.z >= 128 && sample.z <= 158 && Math.abs(sample.y) < 0.1 && sample.grounded)).toBe(true);
    await page.locator('#museum-canvas').screenshot({ path: 'test-results/p7-interior-entry.png' });

    await page.keyboard.down('Shift');
    await page.keyboard.down('s');
    await page.waitForFunction(() => window.__museum?.activeWorld === 'exterior', null, { timeout: 90_000 });
    await page.waitForFunction(() => (window.__museum?.player.position.z ?? -Infinity) > 148, null, { timeout: 90_000 });
    await page.keyboard.up('s');
    await page.keyboard.up('Shift');
    const returned = await page.evaluate(() => ({ world: window.__museum?.activeWorld,
      z: window.__museum?.player.position.z, grounded: window.__museum?.player.grounded,
      museumBuildCount: window.__museum?.museumBuildCount }));
    expect(returned).toMatchObject({ world: 'exterior', grounded: true, museumBuildCount: 1 });
    expect(returned.z).toBeGreaterThan(132);
    await page.locator('#museum-canvas').screenshot({ path: 'test-results/p7-threshold-return.png' });

    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    await page.waitForFunction(() => window.__museum?.activeWorld === 'interior', null, { timeout: 90_000 });
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');
    expect(await page.evaluate(() => ({ world: window.__museum?.activeWorld,
      museumBuildCount: window.__museum?.museumBuildCount }))).toEqual({ world: 'interior', museumBuildCount: 1 });
    await page.evaluate(() => window.__museum?.stop());
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

    // Step back south out through the doorway to z = 132
    const exitState = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.player.teleport([0, 0, 132]);
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
        app.player.teleport([0, 0, 132]);
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
      app.player.teleport([0, 0, 132]);
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

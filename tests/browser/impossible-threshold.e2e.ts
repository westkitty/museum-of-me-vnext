import { expect, test } from '@playwright/test';
import { SANCTUARY_CENTER, SANCTUARY_FLOOR_Y } from '../../src/world/layout';

test.describe('P2 Minimum viable impossible threshold and reversible world switching', () => {
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

      return {
        triggered,
        phase: app.worldDirector.phase,
        interiorConstructed: app.interiorConstructed,
        activeWorld: app.activeWorld,
        museumBuildCount: app.museumBuildCount,
      };
    });

    expect(prepareTriggerState.triggered).toBe(true);
    expect(prepareTriggerState.phase).toBe('AT_THRESHOLD');
    expect(prepareTriggerState.interiorConstructed).toBe(true);
    expect(prepareTriggerState.activeWorld).toBe('exterior');
    expect(prepareTriggerState.museumBuildCount).toBe(1);

    // Cross doorway portal plane (z = 128) into vestibule at z = 126
    const crossedState = await page.evaluate(() => {
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
        playerPos: [app.player.position.x, app.player.position.y, app.player.position.z],
        grounded: app.player.grounded,
        museumBuildCount: app.museumBuildCount,
      };
    });

    expect(crossedState.activeWorld).toBe('interior');
    expect(crossedState.phase).toBe('INTERIOR_ACTIVE');
    expect(crossedState.exteriorVisible).toBe(false);
    expect(crossedState.interiorVisible).toBe(true);
    expect(crossedState.playerPos[1]).toBeGreaterThanOrEqual(-0.1);
    expect(crossedState.grounded).toBe(true);
    expect(crossedState.museumBuildCount).toBe(1);

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
      await app.switchToInterior();
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
    expect(exitState.phase).toBe('EXTERIOR_ACTIVE');
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
    expect(backtrackResult.phase).toBe('AT_THRESHOLD');
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

    const multiSwitchResult = await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();

      await app.ensureInteriorLoaded();

      const results: { iter: number; activeWorld: string; exteriorVisible: boolean; interiorVisible: boolean }[] = [];

      for (let i = 0; i < 15; i++) {
        // Step inside
        app.player.teleport([0, 0, 126]);
        app.variableUpdate(1 / 60);
        results.push({
          iter: i,
          activeWorld: app.activeWorld,
          exteriorVisible: app.exteriorWorld.root.visible,
          interiorVisible: Boolean(app.interiorWorld?.root.visible),
        });

        // Step outside
        app.player.teleport([0, 0, 132]);
        app.variableUpdate(1 / 60);
        results.push({
          iter: i,
          activeWorld: app.activeWorld,
          exteriorVisible: app.exteriorWorld.root.visible,
          interiorVisible: Boolean(app.interiorWorld?.root.visible),
        });
      }

      return {
        results,
        museumBuildCount: app.museumBuildCount,
        finalWorld: app.activeWorld,
      };
    });

    expect(multiSwitchResult.museumBuildCount).toBe(1);
    expect(multiSwitchResult.finalWorld).toBe('exterior');

    for (const r of multiSwitchResult.results) {
      if (r.activeWorld === 'interior') {
        expect(r.exteriorVisible).toBe(false);
        expect(r.interiorVisible).toBe(true);
      } else {
        expect(r.exteriorVisible).toBe(true);
        expect(r.interiorVisible).toBe(false);
      }
    }

    expect(errors).toEqual([]);
  });

  test('Dexter Sanctuary traversal and collision integrity preserved across transitions', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    const sanctuaryTest = await page.evaluate(async ({ targetCenter, targetFloorY }) => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();

      await app.switchToInterior();

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

    const errorRecoveryTest = await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();

      // Temporarily mock ensureInteriorLoaded to reject
      const origEnsure = app.ensureInteriorLoaded.bind(app);
      app.ensureInteriorLoaded = async () => {
        throw new Error('Simulated network timeout fetching interior chunk');
      };

      let threw = false;
      try {
        await app.worldDirector.prepareInterior();
      } catch {
        threw = true;
      }

      const failedPhase = app.worldDirector.phase;
      const failedWorld = app.activeWorld;

      // Restore real method and retry
      app.ensureInteriorLoaded = origEnsure;
      await app.worldDirector.retryInteriorLoad();

      const recoveredPhase = app.worldDirector.phase;
      const recoveredConstructed = app.interiorConstructed;

      return {
        threw,
        failedPhase,
        failedWorld,
        recoveredPhase,
        recoveredConstructed,
      };
    });

    expect(errorRecoveryTest.threw).toBe(true);
    expect(errorRecoveryTest.failedPhase).toBe('PREPARATION_FAILED');
    expect(errorRecoveryTest.failedWorld).toBe('exterior');
    expect(errorRecoveryTest.recoveredPhase).toBe('AT_THRESHOLD');
    expect(errorRecoveryTest.recoveredConstructed).toBe(true);
    expect(errors).toEqual([]);
  });
});

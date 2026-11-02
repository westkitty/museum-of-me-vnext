import { expect, test } from '@playwright/test';

test.describe('P1 Exterior-first cold boot and independent world contexts', () => {
  test('cold boot starts exclusively in exterior without loading or constructing interior', async ({ page }) => {
    const errors: string[] = [];
    const requests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('request', (request) => requests.push(request.url()));

    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));
    await expect(page.locator('#museum-canvas')).toBeVisible();

    // Check cold boot telemetry and state
    const bootState = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      return {
        activeWorld: app.activeWorld,
        interiorConstructed: app.interiorConstructed,
        museumBuildCount: app.museumBuildCount,
        currentZone: app.currentZone,
        hasExteriorWorld: Boolean(app.exteriorWorld),
        hasArrivalGarden: Boolean(app.arrivalGarden),
        hasArrivalBeacons: Boolean(app.exteriorWorld.arrivalBeacons),
        spawnPos: [app.player.position.x, app.player.position.y, app.player.position.z],
      };
    });

    expect(bootState.activeWorld).toBe('exterior');
    expect(bootState.interiorConstructed).toBe(false);
    expect(bootState.museumBuildCount).toBe(0);
    expect(bootState.currentZone).toBe('plaza');
    expect(bootState.hasExteriorWorld).toBe(true);
    expect(bootState.hasArrivalGarden).toBe(true);
    expect(bootState.hasArrivalBeacons).toBe(true);
    expect(bootState.spawnPos[0]).toBeCloseTo(0, 1);
    expect(bootState.spawnPos[2]).toBeGreaterThan(100);

    // Verify chunk isolation: no interior or exhibits chunks were requested during cold startup
    const interiorRequests = requests.filter((url) => /interior|exhibits/i.test(url) && !url.includes('exterior'));
    expect(interiorRequests).toEqual([]);

    expect(errors).toEqual([]);
  });

  test('exterior player movement is physically supported without interior colliders', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    // Walk around on exterior terrace using real physics step
    const moveResult = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();

      const initialPos = [app.player.position.x, app.player.position.y, app.player.position.z];
      // Step player on exterior plaza
      app.player.teleport([10, 0, 135]);
      for (let i = 0; i < 60; i++) {
        app.fixedUpdate(1 / 60);
      }

      return {
        initialPos,
        finalPos: [app.player.position.x, app.player.position.y, app.player.position.z],
        grounded: app.player.grounded,
        museumBuildCount: app.museumBuildCount,
        interiorConstructed: app.interiorConstructed,
      };
    });

    expect(moveResult.finalPos[1]).toBeCloseTo(-0.5, 1);
    expect(moveResult.grounded).toBe(true);
    expect(moveResult.museumBuildCount).toBe(0);
    expect(moveResult.interiorConstructed).toBe(false);
    expect(errors).toEqual([]);
  });

  test('on-demand interior loading constructs interior and exhibits cleanly', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    const beforeState = await page.evaluate(() => ({
      museumBuildCount: window.__museum?.museumBuildCount,
      interiorConstructed: window.__museum?.interiorConstructed,
    }));
    expect(beforeState.museumBuildCount).toBe(0);
    expect(beforeState.interiorConstructed).toBe(false);

    // Call ensureInteriorLoaded()
    const afterState = await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      await app.ensureInteriorLoaded();
      return {
        museumBuildCount: app.museumBuildCount,
        interiorConstructed: app.interiorConstructed,
        hasMuseum: Boolean(app.museum),
        exhibitMountCount: app.museum?.exhibitMounts.size ?? 0,
        hasStreaming: Boolean(app.streaming),
        hasSourceInstallations: Boolean(app.sourceInstallations),
        hasSourceVisitors: Boolean(app.sourceVisitors),
      };
    });

    expect(afterState.museumBuildCount).toBe(1);
    expect(afterState.interiorConstructed).toBe(true);
    expect(afterState.hasMuseum).toBe(true);
    expect(afterState.exhibitMountCount).toBe(35);
    expect(afterState.hasStreaming).toBe(true);
    expect(afterState.hasSourceInstallations).toBe(true);
    expect(afterState.hasSourceVisitors).toBe(true);

    // Idempotency: calling ensureInteriorLoaded() a second time does not re-build Museum
    const reloadedState = await page.evaluate(async () => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      await app.ensureInteriorLoaded();
      return {
        museumBuildCount: app.museumBuildCount,
      };
    });
    expect(reloadedState.museumBuildCount).toBe(1);

    expect(errors).toEqual([]);
  });
});

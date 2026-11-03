import { expect, test } from '@playwright/test';
import { START_POSITION } from '../../src/world/start';
import { LAND_SUPPORT_Y } from '../../src/world/exterior/IslandSiteLayout';
import { THRESHOLD_PREPARE_Z } from '../../src/world/layout';

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
        initialSupportY: app.exteriorWorld.collision.supportHeight(
          app.player.position.x, app.player.position.z, app.player.position.y,
        ),
        entrancePromptHidden: document.querySelector<HTMLElement>('.hud__threshold')?.hidden ?? null,
        interiorImportStarted: app.worldDirector.interiorImportStarted,
        phase: app.worldDirector.phase,
      };
    });

    expect(bootState.activeWorld).toBe('exterior');
    expect(bootState.interiorConstructed).toBe(false);
    expect(bootState.museumBuildCount).toBe(0);
    expect(bootState.currentZone).toBe('plaza');
    expect(bootState.hasExteriorWorld).toBe(true);
    expect(bootState.hasArrivalGarden).toBe(true);
    expect(bootState.hasArrivalBeacons).toBe(true);
    expect(bootState.spawnPos).toEqual([...START_POSITION]);
    expect(bootState.spawnPos[0]).toBeCloseTo(0, 1);
    expect(bootState.spawnPos[1]).toBeCloseTo(LAND_SUPPORT_Y, 3);
    expect(bootState.spawnPos[2]).toBeGreaterThan(170);
    expect(bootState.spawnPos[2]).toBeGreaterThan(THRESHOLD_PREPARE_Z + 30);
    expect(bootState.initialSupportY).toBeCloseTo(LAND_SUPPORT_Y, 3);
    expect(bootState.entrancePromptHidden).toBe(true);
    expect(bootState.interiorImportStarted).toBe(false);
    expect(bootState.phase).toBe('EXTERIOR_ACTIVE');

    // Verify chunk isolation: no interior or exhibits chunks were requested during cold startup
    const interiorRequests = requests.filter((url) => /interior|exhibits/i.test(url) && !url.includes('exterior'));
    expect(interiorRequests).toEqual([]);

    expect(errors).toEqual([]);
  });

  test('pier start stays outside the entrance prompt; approaching shows it and leaving hides it', async ({ page }) => {
    await page.goto('/?qa=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum));

    const result = await page.evaluate(() => {
      const app = window.__museum;
      if (!app) throw new Error('museum missing');
      app.stop();
      const prompt = document.querySelector<HTMLElement>('.hud__threshold');
      if (!prompt) throw new Error('entrance prompt missing');

      app.worldDirector.update(app.player.position);
      const atPier = { hidden: prompt.hidden, importStarted: app.worldDirector.interiorImportStarted };

      // Walking nearer the museum should still reveal the original prompt.
      app.player.teleport([0, 0, 150]);
      app.worldDirector.update(app.player.position);
      const nearEntrance = { hidden: prompt.hidden, importStarted: app.worldDirector.interiorImportStarted };

      app.player.teleport(app.exteriorWorld.spawnPosition);
      app.worldDirector.update(app.player.position);
      const backAtPier = { hidden: prompt.hidden, importStarted: app.worldDirector.interiorImportStarted };
      return { atPier, nearEntrance, backAtPier };
    });

    expect(result.atPier).toEqual({ hidden: true, importStarted: false });
    expect(result.nearEntrance).toEqual({ hidden: false, importStarted: false });
    expect(result.backAtPier).toEqual({ hidden: true, importStarted: false });
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
      // Step player on exterior plaza terrace (y = 0)
      app.player.teleport([10, 0, 135]);
      for (let i = 0; i < 60; i++) {
        app.fixedUpdate(1 / 60);
      }
      const plazaY = app.player.position.y;
      const plazaGrounded = app.player.grounded;

      // Step player on exterior ground beyond plaza stairs (z = 180, y = -0.5)
      app.player.teleport([10, 0, 180]);
      for (let i = 0; i < 60; i++) {
        app.fixedUpdate(1 / 60);
      }
      const groundY = app.player.position.y;
      const groundGrounded = app.player.grounded;

      return {
        initialPos,
        plazaY,
        plazaGrounded,
        groundY,
        groundGrounded,
        museumBuildCount: app.museumBuildCount,
        interiorConstructed: app.interiorConstructed,
      };
    });

    expect(moveResult.plazaY).toBeCloseTo(0, 1);
    expect(moveResult.plazaGrounded).toBe(true);
    expect(moveResult.groundY).toBeCloseTo(-0.5, 1);
    expect(moveResult.groundGrounded).toBe(true);
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

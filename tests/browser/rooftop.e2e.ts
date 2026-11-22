import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  GREENHOUSE_FLOWER_CENTER,
  GREENHOUSE_FLOWER_ID,
  HOT_DOG_STAND_CENTER,
  HOT_DOG_STAND_ID,
  ROOF_DECK_Y,
  ROOF_FLIGHT_PAD_II_CENTER,
  ROOF_FLIGHT_PAD_II_TELEPORT_CENTER,
  ROOF_FLIGHT_PAD_II_TELEPORT_ID,
  ROOF_WAYPOINTS,
} from '../../src/world/exterior/rooftopLayout';

const evidenceFolder = 'docs/evidence/island-03-rooftop-20261122';

test('ISLAND-03: west flank ascent, Glass Greenhouse, Rooftop Cafe, Hot Dog Stand, and Flight Pad II', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());

  // 1. Cold exterior verification: rooftop built, interior deferred.
  const initialAudit = await page.evaluate(() => {
    const app = window.__museum!;
    return {
      activeWorld: app.activeWorld,
      interiorConstructed: app.interiorConstructed,
      hasRooftop: Boolean(app.scene.getObjectByName('exterior-rooftop')),
      hasLowerRamp: Boolean(app.scene.getObjectByName('rooftop-west-lower-ramp')),
      hasGreenhouse: Boolean(app.scene.getObjectByName('rooftop-greenhouse-shell')),
      hasFlower: Boolean(app.scene.getObjectByName('greenhouse-flower-w05-anchor')),
      hasCafeSign: Boolean(app.scene.getObjectByName('rooftop-cafe-sign')),
      hasHotDogStand: Boolean(app.scene.getObjectByName('rooftop-hot-dog-stand')),
      hasFlightPadII: Boolean(app.scene.getObjectByName('rooftop-flight-pad-ii-pad')),
      hasPedestal: Boolean(app.scene.getObjectByName('rooftop-flight-pad-ii-teleport-pedestal')),
    };
  });
  expect(initialAudit).toEqual({
    activeWorld: 'exterior',
    interiorConstructed: false,
    hasRooftop: true,
    hasLowerRamp: true,
    hasGreenhouse: true,
    hasFlower: true,
    hasCafeSign: true,
    hasHotDogStand: true,
    hasFlightPadII: true,
    hasPedestal: true,
  });

  await mkdir(evidenceFolder, { recursive: true });
  const captures: Array<{ name: string; width: number; height: number; bytes: number; sha256: string }> = [];

  const captureView = async (
    name: string,
    pos: readonly [number, number, number],
    look: readonly [number, number, number],
    hideUi = true,
  ) => {
    await page.evaluate(({ pos: p, look: t, hide }) => {
      const app = window.__museum!;
      const ui = document.getElementById('ui-root');
      const a11y = document.getElementById('a11y-root');
      const title = document.querySelector<HTMLElement>('.cinematic-arrival');
      if (ui) ui.style.display = hide ? 'none' : '';
      if (a11y) a11y.style.display = hide ? 'none' : '';
      if (title) title.style.display = 'none';
      app.renderer.camera.position.set(p[0], p[1], p[2]);
      app.renderer.camera.lookAt(t[0], t[1], t[2]);
      const eye: [number, number, number] = [p[0], p[1], p[2]];
      app.sky.follow(app.renderer.camera);
      app.lighting.update(eye);
      app.exteriorWorld.variableUpdate(0.016, eye, 'plaza', app.preferences.reducedMotion);
      app.arrivalGarden.update(0.016, app.preferences.reducedMotion);
      app.renderer.render();
    }, { pos, look, hide: hideUi });
    const path = join(evidenceFolder, name);
    const png = await page.locator('#museum-canvas').screenshot({ path, timeout: 30_000 });
    expect(png.byteLength).toBeGreaterThan(15_000);
    captures.push({
      name,
      width: (await page.viewportSize())?.width ?? 1280,
      height: (await page.viewportSize())?.height ?? 720,
      bytes: png.byteLength,
      sha256: createHash('sha256').update(png).digest('hex'),
    });
  };

  await captureView('west-flank-ramp-approach.png', [-50.5, 2.2, 123.0], [-41.25, 5.5, 86.0]);

  // 2. Real keyboard walk from Path 5 entry up the West Flank to Greenhouse -> Cafe -> Hot Dog Stand -> Flight Pad II Pedestal.
  const walkWaypoints: readonly (readonly [number, number, number])[] = [
    ROOF_WAYPOINTS.path5Entry,
    ROOF_WAYPOINTS.lowerRampFoot,
    [-41.25, 4.5, 84.0],
    ROOF_WAYPOINTS.midLanding,
    [-41.25, 14.05, 22.0],
    ROOF_WAYPOINTS.upperRampTop,
    ROOF_WAYPOINTS.upperBridgeWest,
    ROOF_WAYPOINTS.upperBridgeEast,
    ROOF_WAYPOINTS.westWalkwayMid,
    ROOF_WAYPOINTS.westWalkwaySouth,
    ROOF_WAYPOINTS.greenhouseDoorApproach,
    ROOF_WAYPOINTS.greenhouseDoor,
    ROOF_WAYPOINTS.greenhouseFlowerApproach,
    [-21.5, ROOF_DECK_Y, 13.5],
    [-21.5, ROOF_DECK_Y, 10.0],
    [-21.5, ROOF_DECK_Y, 13.5],
    ROOF_WAYPOINTS.greenhouseDoor,
    ROOF_WAYPOINTS.greenhouseDoorApproach,
    ROOF_WAYPOINTS.promenadeMid,
    ROOF_WAYPOINTS.cafeCenter,
    ROOF_WAYPOINTS.hotDogCounter,
    ROOF_WAYPOINTS.cafeSouthAisle,
    ROOF_WAYPOINTS.flightPadPedestalSpot,
  ];

  await page.evaluate(([x, y, z]) => {
    const app = window.__museum!;
    app.player.teleport([x, y, z]);
    for (let i = 0; i < 6; i++) app.fixedUpdate(1 / 60);
  }, walkWaypoints[0]);

  await page.keyboard.down('w');
  for (let i = 1; i < walkWaypoints.length; i++) {
    const [wx, , wz] = walkWaypoints[i];
    const arrived = await page.evaluate(([targetX, targetZ]) => {
      const app = window.__museum!;
      for (let tick = 0; tick < 1200; tick++) {
        const p = app.player.position;
        const dx = targetX - p.x;
        const dz = targetZ - p.z;
        if (Math.hypot(dx, dz) < 0.45) {
          return { ok: true, y: p.y, grounded: app.player.grounded, ticks: tick };
        }
        app.player.yaw = Math.atan2(-dx, -dz);
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
      }
      return {
        ok: false,
        y: app.player.position.y,
        grounded: app.player.grounded,
        pos: [app.player.position.x, app.player.position.y, app.player.position.z],
      };
    }, [wx, wz]);
    expect(arrived.ok, `failed reaching waypoint ${i} (${wx}, ${wz}): ${JSON.stringify(arrived)}`).toBe(true);
    expect(arrived.grounded).toBe(true);
  }
  await page.keyboard.up('w');

  // 3. Scenic captures of Greenhouse, W05 flower, Cafe + Hot Dog Stand, and Flight Pad II + aim arcs
  await captureView('greenhouse-exterior-and-doorway.png', [-26.0, 20.6, 30.8], [-26.0, 20.8, 12.0]);
  await captureView('greenhouse-w05-flower.png', [-26.0, 20.3, 15.2], [GREENHOUSE_FLOWER_CENTER[0], 20.8, GREENHOUSE_FLOWER_CENTER[2]]);
  await captureView('cafe-terrace-and-hotdog-stand.png', [-19.5, 21.2, 28.2], [4.0, 20.8, 28.6]);
  await captureView('flight-pad-ii-and-arcs.png', [-5.5, 21.4, 47.0], [1.2, 20.3, 55.2]);

  // 4. Verify all 3 dormant interactables via real raycaster + Journal exclusion
  const interactTest = await page.evaluate(({ flowerPos, hotDogPos, pedestalPos, roofDeckY }) => {
    const app = window.__museum!;
    const ui = document.getElementById('ui-root');
    const a11y = document.getElementById('a11y-root');
    const title = document.querySelector<HTMLElement>('.cinematic-arrival');
    if (ui) ui.style.display = '';
    if (a11y) a11y.style.display = '';
    if (title) title.style.display = 'none';

    const probe = (
      playerPos: readonly [number, number, number],
      lookAtPos: readonly [number, number, number],
    ) => {
      app.player.teleport([playerPos[0], playerPos[1], playerPos[2]]);
      for (let i = 0; i < 4; i++) app.fixedUpdate(1 / 60);
      const eye: [number, number, number] = [app.player.position.x, app.player.position.y + 1.64, app.player.position.z];
      app.renderer.camera.position.set(eye[0], eye[1], eye[2]);
      app.renderer.camera.lookAt(lookAtPos[0], lookAtPos[1], lookAtPos[2]);
      app.renderer.camera.updateMatrixWorld();
      app.interaction.update(app.renderer.camera, 0.1);
      const focusBefore = app.interaction.currentFocus;
      const journalBefore = app.journal.visitedCount;
      const activated = app.interaction.activate();
      if (activated) app.recordInteractionVisit();
      app.interaction.update(app.renderer.camera, 0.1);
      const focusAfter = app.interaction.currentFocus;
      const journalAfter = app.journal.visitedCount;
      const subtitle = document.querySelector('.hud__subtitle')?.textContent ?? '';
      return { focusBefore, activated, focusAfter, journalBefore, journalAfter, subtitle, activeWorld: app.activeWorld };
    };

    const flower = probe([-26.0, roofDeckY, 13.5], [flowerPos[0], roofDeckY + 1.8, flowerPos[2]]);
    const hotDog = probe([5.0, roofDeckY, 29.0], [hotDogPos[0], roofDeckY + 1.5, hotDogPos[2]]);
    const pedestal = probe([-3.0, roofDeckY, 51.5], [pedestalPos[0], roofDeckY + 1.1, pedestalPos[2]]);
    return { flower, hotDog, pedestal };
  }, {
    flowerPos: GREENHOUSE_FLOWER_CENTER,
    hotDogPos: HOT_DOG_STAND_CENTER,
    pedestalPos: ROOF_FLIGHT_PAD_II_TELEPORT_CENTER,
    roofDeckY: ROOF_DECK_Y,
  });

  expect(interactTest.flower.focusBefore?.exhibitId).toBe(GREENHOUSE_FLOWER_ID);
  expect(interactTest.flower.activated).toBe(true);
  expect(interactTest.flower.journalAfter).toBe(interactTest.flower.journalBefore);
  expect(interactTest.flower.subtitle).toContain('W05');
  expect(interactTest.flower.activeWorld).toBe('exterior');

  expect(interactTest.hotDog.focusBefore?.exhibitId).toBe(HOT_DOG_STAND_ID);
  expect(interactTest.hotDog.activated).toBe(true);
  expect(interactTest.hotDog.journalAfter).toBe(interactTest.hotDog.journalBefore);
  expect(interactTest.hotDog.subtitle).toContain('ISLAND-04');

  expect(interactTest.pedestal.focusBefore?.exhibitId).toBe(ROOF_FLIGHT_PAD_II_TELEPORT_ID);
  expect(interactTest.pedestal.activated).toBe(true);
  expect(interactTest.pedestal.journalAfter).toBe(interactTest.pedestal.journalBefore);
  expect(interactTest.pedestal.subtitle).toContain('W06');
  expect(interactTest.pedestal.subtitle).toContain('W10');

  // 5. Flight Pad II respects reducedMotion and launches strongly otherwise
  const flightTest = await page.evaluate(([padX, padY, padZ]) => {
    const app = window.__museum!;
    const prevReduced = app.preferences.reducedMotion;

    app.preferences.reducedMotion = true;
    app.player.teleport([padX, padY, padZ]);
    for (let i = 0; i < 30; i++) app.fixedUpdate(1 / 60);
    const reducedFlightMode = app.player.flightMode;

    app.preferences.reducedMotion = false;
    app.player.teleport([padX, padY, padZ]);
    for (let i = 0; i < 45; i++) app.fixedUpdate(1 / 60);
    const activeFlightMode = app.player.flightMode;
    const launchedY = app.player.position.y;

    app.preferences.reducedMotion = prevReduced;
    app.player.teleport([0, padY, 42.0]);
    for (let i = 0; i < 10; i++) app.fixedUpdate(1 / 60);

    return { reducedFlightMode, activeFlightMode, launchedY };
  }, ROOF_FLIGHT_PAD_II_CENTER);

  expect(flightTest.reducedFlightMode).toBe(false);
  expect(flightTest.activeFlightMode).toBe(true);
  expect(flightTest.launchedY).toBeGreaterThan(ROOF_DECK_Y + 4.0);

  // 6. Quality transitions + reducedMotion animation pause
  const qualityCheck = await page.evaluate(() => {
    const app = window.__museum!;
    const supports: Array<number | null> = [];
    for (const tier of ['low', 'medium', 'high', 'low'] as const) {
      app.setQuality(tier);
      supports.push(app.exteriorWorld.collision.supportHeight(0, 29, 18.6));
    }
    const blossom = app.scene.getObjectByName('greenhouse-flower-blossom')!;
    const before = blossom.rotation.y;
    app.exteriorWorld.variableUpdate(0.5, [-26, 20, 12], 'plaza', true);
    const after = blossom.rotation.y;
    return { supports, movedUnderReducedMotion: after !== before };
  });
  expect(qualityCheck.supports).toEqual([18.6, 18.6, 18.6, 18.6]);
  expect(qualityCheck.movedUnderReducedMotion).toBe(false);

  // 7. Mobile portrait capture (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.innerWidth === 390 && window.innerHeight === 844);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__museum!.renderer.resize());
  await captureView('rooftop-mobile-portrait.png', [-14.5, 22.8, 39.5], [1.0, 19.6, 25.0]);

  await writeFile(
    join(evidenceFolder, 'capture-manifest.json'),
    JSON.stringify({ captures }, null, 2),
  );
  expect(errors).toEqual([]);
});

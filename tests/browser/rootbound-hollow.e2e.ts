import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOTBOUND_HOLLOW_PORTAL } from '../../src/world/exterior/IslandSiteLayout';
import {
  ROOTBOUND_CHAMBER_FLOOR_Y,
  ROOTBOUND_RELIC_ID,
  ROOTBOUND_RELIC_POSITION,
} from '../../src/world/exterior/ExteriorRootboundHollow';

const evidenceFolder = 'docs/evidence/island-02c-rootbound-20261122';

test('ISLAND-02C: Rootbound Hollow traversal from western approach, vaulted chamber, and relic discovery', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());

  // 1. Cold exterior verification: Rootbound Hollow built, interior still deferred.
  const coldAudit = await page.evaluate(() => {
    const app = window.__museum!;
    return {
      activeWorld: app.activeWorld,
      interiorConstructed: app.interiorConstructed,
      hasHollow: Boolean(app.scene.getObjectByName('rootbound-hollow')),
      hasPortal: Boolean(app.scene.getObjectByName('rootbound-hollow-portal')),
      hasChamber: Boolean(app.scene.getObjectByName('rootbound-hollow-chamber')),
      hasRelic: Boolean(app.scene.getObjectByName('rootbound-hollow-relic-core')),
      secretsTotal: app.secrets.total,
    };
  });
  expect(coldAudit).toEqual({
    activeWorld: 'exterior',
    interiorConstructed: false,
    hasHollow: true,
    hasPortal: true,
    hasChamber: true,
    hasRelic: true,
    secretsTotal: 10,
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
      if (ui) ui.style.display = hide ? 'none' : '';
      if (a11y) a11y.style.display = hide ? 'none' : '';
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

  // Approach view from [50.5, -84] looking toward Ancient Tree & arched root portal
  await captureView('01-approach-western-view.png', [49.8, 1.25, -84.0], [56.2, 1.1, -87.4]);
  // Arched root threshold looking directly into the glowing tunnel
  await captureView('02-arched-root-threshold.png', [53.2, 1.15, -88.2], [58.5, 0.8, -88.8]);

  // 2. Real keyboard W walk from western approach [50.5, -84] into the Rootbound Hollow chamber
  const waypoints: readonly [number, number, number][] = [
    [50.5, -0.5, -84.0],
    [52.6, -0.5, -86.6],
    [54.1, -0.5, -88.8],
    [ROOTBOUND_HOLLOW_PORTAL[0], -0.37, ROOTBOUND_HOLLOW_PORTAL[1]],
    [56.6, -0.24, -88.8],
    [58.4, ROOTBOUND_CHAMBER_FLOOR_Y, -88.8],
    [61.8, ROOTBOUND_CHAMBER_FLOOR_Y, -88.6],
  ];

  await page.evaluate(([x, y, z]) => {
    const app = window.__museum!;
    app.player.teleport([x, y, z]);
    for (let i = 0; i < 6; i++) app.fixedUpdate(1 / 60);
  }, waypoints[0]);

  await page.keyboard.down('w');
  for (let i = 1; i < waypoints.length; i++) {
    const [wx, , wz] = waypoints[i];
    const arrived = await page.evaluate(([targetX, targetZ]) => {
      const app = window.__museum!;
      for (let tick = 0; tick < 600; tick++) {
        const p = app.player.position;
        const dx = targetX - p.x;
        const dz = targetZ - p.z;
        if (Math.hypot(dx, dz) < 0.42) {
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

  // Inside vaulted chamber view (clean scene without HUD)
  await captureView(
    '03-chamber-interior-relic.png',
    [59.5, ROOTBOUND_CHAMBER_FLOOR_Y + 1.64, -88.6],
    [ROOTBOUND_RELIC_POSITION[0], ROOTBOUND_CHAMBER_FLOOR_Y + 1.25, ROOTBOUND_RELIC_POSITION[2]],
  );

  // 3. Interact with Rootbound Relic and confirm Journal/Secrets stay intact
  const relicResult = await page.evaluate(([rx, ry, rz]) => {
    const app = window.__museum!;
    const ui = document.getElementById('ui-root');
    const a11y = document.getElementById('a11y-root');
    const title = document.querySelector<HTMLElement>('.cinematic-arrival');
    if (ui) ui.style.display = '';
    if (a11y) a11y.style.display = '';
    if (title) title.style.display = 'none';
    app.ui.hud.completeArrival();
    app.dismissArrival();

    app.player.teleport([62.0, ry, -88.6], -Math.PI / 2);
    app.player.pitch = -0.08;
    for (let i = 0; i < 6; i++) {
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
    }
    const eye: [number, number, number] = [app.player.position.x, app.player.position.y + 1.64, app.player.position.z];
    app.renderer.camera.position.set(eye[0], eye[1], eye[2]);
    app.renderer.camera.rotation.order = 'YXZ';
    app.renderer.camera.rotation.set(app.player.pitch, app.player.yaw, 0);
    app.renderer.camera.updateMatrixWorld();
    app.interaction.update(app.renderer.camera, 0.1);

    const focusBefore = app.interaction.currentFocus;
    const journalBefore = app.journal.visitedCount;
    const secretsBefore = app.secrets.foundCount;
    const activated = app.interaction.activate();
    if (activated) app.recordInteractionVisit();
    app.interaction.update(app.renderer.camera, 0.1);
    const focusAfter = app.interaction.currentFocus;
    const journalAfter = app.journal.visitedCount;
    const secretsAfter = app.secrets.foundCount;
    const subtitle = document.querySelector('.hud__subtitle')?.textContent ?? '';

    app.sky.follow(app.renderer.camera);
    app.lighting.update(eye);
    app.exteriorWorld.variableUpdate(0.016, eye, 'plaza', app.preferences.reducedMotion);
    app.renderer.render();
    return {
      playerY: app.player.position.y,
      focusBefore,
      activated,
      focusAfter,
      journalBefore,
      journalAfter,
      secretsBefore,
      secretsAfter,
      subtitle,
      activeWorld: app.activeWorld,
      relicAt: [rx, ry, rz],
    };
  }, ROOTBOUND_RELIC_POSITION);

  expect(relicResult.playerY).toBeCloseTo(ROOTBOUND_CHAMBER_FLOOR_Y, 2);
  expect(relicResult.focusBefore?.exhibitId).toBe(ROOTBOUND_RELIC_ID);
  expect(relicResult.activated).toBe(true);
  expect(relicResult.focusAfter?.label).toContain('discovered');
  expect(relicResult.journalAfter).toBe(relicResult.journalBefore);
  expect(relicResult.secretsAfter).toBe(relicResult.secretsBefore);
  expect(relicResult.subtitle).toContain('Rootbound Hollow');
  expect(relicResult.activeWorld).toBe('exterior');

  const relicPng = await page.locator('#museum-canvas').screenshot({
    path: join(evidenceFolder, '04-relic-closeup-interact.png'),
    timeout: 30_000,
  });
  expect(relicPng.byteLength).toBeGreaterThan(15_000);
  captures.push({
    name: '04-relic-closeup-interact.png',
    width: (await page.viewportSize())?.width ?? 1280,
    height: (await page.viewportSize())?.height ?? 720,
    bytes: relicPng.byteLength,
    sha256: createHash('sha256').update(relicPng).digest('hex'),
  });

  // Exterior mound overview from NW looking SE across the Ancient Tree and vaulted mound
  await captureView('05-exterior-mound-overlook.png', [48.5, 4.8, -96.5], [60.5, 1.4, -86.5]);

  await writeFile(
    join(evidenceFolder, 'capture-manifest.json'),
    JSON.stringify({
      task: 'ISLAND-02C',
      capturedAt: new Date().toISOString(),
      portal: ROOTBOUND_HOLLOW_PORTAL,
      relicPosition: ROOTBOUND_RELIC_POSITION,
      captures,
    }, null, 2),
  );

  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import { historicalEvidenceFolder } from './helpers/historical-evidence';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { LIGHTHOUSE_PENINSULA_CENTER } from '../../src/world/exterior/IslandSiteLayout';
import { LIGHTHOUSE_LENS_ID } from '../../src/world/exterior/ExteriorLighthouse';

const evidenceFolder = historicalEvidenceFolder('docs/evidence/island-02a-lighthouse-20261122');
const [TX, , TZ] = LIGHTHOUSE_PENINSULA_CENTER;

test('ISLAND-02A: lighthouse peninsula approach, climb, gallery, and dormant L01 Fresnel lens', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());

  // 1. Cold exterior verification: lighthouse built, interior still deferred.
  const initialAudit = await page.evaluate(() => {
    const app = window.__museum!;
    return {
      activeWorld: app.activeWorld,
      interiorConstructed: app.interiorConstructed,
      hasTower: Boolean(app.scene.getObjectByName('lighthouse-peninsula-tower')),
      hasLensAnchor: Boolean(app.scene.getObjectByName('lighthouse-lens-l01-anchor')),
      hasTrail: Boolean(app.scene.getObjectByName('lighthouse-approach-trail')),
      hasRamp: Boolean(app.scene.getObjectByName('lighthouse-headland-ramp')),
    };
  });
  expect(initialAudit).toEqual({
    activeWorld: 'exterior',
    interiorConstructed: false,
    hasTower: true,
    hasLensAnchor: true,
    hasTrail: true,
    hasRamp: true,
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

  // Scenic arrival views
  await captureView('pier-view-lighthouse.png', [0, 2.2, 203], [TX, 10, TZ]);
  await captureView('headland-approach.png', [TX - 36, 1.5, TZ], [TX, 9, TZ]);

  // 2. Real keyboard walk from approach ground -> ramp -> doorway -> 8 stair flights -> gallery -> lantern room
  const waypoints: readonly [number, number, number][] = [
    [TX - 30, -0.5, TZ],
    [TX - 13, 1.5, TZ],
    [TX - 8, 1.5, TZ + 3.2],
    [TX - 3.2, 1.5, TZ + 3.2],
    [TX - 3.2, 2.75, TZ - 3.2],
    [TX + 3.2, 4.0, TZ - 3.2],
    [TX + 3.2, 5.25, TZ + 3.2],
    [TX - 3.2, 6.5, TZ + 3.2],
    [TX - 3.2, 7.75, TZ - 3.2],
    [TX + 3.2, 9.0, TZ - 3.2],
    [TX + 3.2, 10.25, TZ + 3.2],
    [TX - 3.2, 11.5, TZ + 3.2],
    [TX - 5.7, 11.5, TZ + 3.2],
    [TX - 5.7, 11.5, TZ],
    [TX - 1.5, 11.5, TZ],
  ];

  await page.evaluate(([x, y, z]) => {
    const app = window.__museum!;
    app.player.teleport([x, y, z]);
    for (let i = 0; i < 6; i++) app.fixedUpdate(1 / 60);
  }, waypoints[0]);

  await page.keyboard.down('w');
  let midClimbReached = false;
  for (let i = 1; i < waypoints.length; i++) {
    const [wx, , wz] = waypoints[i];
    const arrived = await page.evaluate(([targetX, targetZ]) => {
      const app = window.__museum!;
      for (let tick = 0; tick < 600; tick++) {
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
    if (i === 7 && !midClimbReached) {
      midClimbReached = true;
      await captureView('stair-climb.png', [TX - 3.2, 8.1, TZ + 3.2], [TX - 3.2, 9.6, TZ - 3.2]);
    }
  }
  await page.keyboard.up('w');

  // 3. Gallery overlook + Fresnel lens interaction
  await captureView('gallery-overlook.png', [TX - 5.7, 13.1, TZ - 5.7], [0, 12, 0]);

  const lensResult = await page.evaluate(([tx, tz]) => {
    const app = window.__museum!;
    const ui = document.getElementById('ui-root');
    const a11y = document.getElementById('a11y-root');
    const title = document.querySelector<HTMLElement>('.cinematic-arrival');
    if (ui) ui.style.display = '';
    if (a11y) a11y.style.display = '';
    if (title) title.style.display = 'none';
    app.player.teleport([tx - 1.5, 11.5, tz], -Math.PI / 2);
    app.player.pitch = 0.16;
    for (let i = 0; i < 6; i++) {
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
    }
    // Sync camera to player pose and update interaction raycaster
    const eye = [app.player.position.x, app.player.position.y + 1.64, app.player.position.z] as const;
    app.renderer.camera.position.set(eye[0], eye[1], eye[2]);
    app.renderer.camera.rotation.order = 'YXZ';
    app.renderer.camera.rotation.set(app.player.pitch, app.player.yaw, 0);
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
      subtitle,
      activeWorld: app.activeWorld,
    };
  }, [TX, TZ]);

  expect(lensResult.playerY).toBeCloseTo(11.5, 2);
  expect(lensResult.focusBefore?.exhibitId).toBe(LIGHTHOUSE_LENS_ID);
  expect(lensResult.activated).toBe(true);
  expect(lensResult.focusAfter?.label).toContain('dormant');
  expect(lensResult.journalAfter).toBe(lensResult.journalBefore);
  expect(lensResult.subtitle).toContain('L01');
  expect(lensResult.activeWorld).toBe('exterior');

  const lensPng = await page.locator('#museum-canvas').screenshot({
    path: join(evidenceFolder, 'lantern-lens.png'),
    timeout: 30_000,
  });
  captures.push({
    name: 'lantern-lens.png',
    width: 1280,
    height: 720,
    bytes: lensPng.byteLength,
    sha256: createHash('sha256').update(lensPng).digest('hex'),
  });

  // 4. Quality transitions + reducedMotion stability
  const qualityCheck = await page.evaluate(([tx, tz]) => {
    const app = window.__museum!;
    const supports: Array<number | null> = [];
    for (const tier of ['low', 'medium', 'high', 'low'] as const) {
      app.setQuality(tier);
      supports.push(app.exteriorWorld.collision.supportHeight(tx - 1.4, tz, 11.5));
    }
    const turret = app.scene.getObjectByName('lighthouse-fresnel-turret')!;
    const beforeReduced = turret.rotation.y;
    app.exteriorWorld.variableUpdate(0.5, [tx, 13.1, tz], 'plaza', true);
    const afterReduced = turret.rotation.y;
    return { supports, rotatedUnderReducedMotion: afterReduced !== beforeReduced };
  }, [TX, TZ]);
  expect(qualityCheck.supports).toEqual([11.5, 11.5, 11.5, 11.5]);
  expect(qualityCheck.rotatedUnderReducedMotion).toBe(false);

  // 5. Mobile portrait capture
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.innerWidth === 390 && window.innerHeight === 844);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__museum!.renderer.resize());
  await captureView('headland-mobile-portrait.png', [TX - 34, 1.5, TZ + 4], [TX, 10, TZ]);

  await writeFile(
    join(evidenceFolder, 'capture-manifest.json'),
    JSON.stringify({ captures }, null, 2),
  );
  expect(errors).toEqual([]);
});

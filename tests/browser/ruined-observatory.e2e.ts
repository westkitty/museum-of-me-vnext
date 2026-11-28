import { expect, test } from '@playwright/test';
import { historicalEvidenceFolder } from './helpers/historical-evidence';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { OBSERVATORY_CENTER } from '../../src/world/exterior/IslandSiteLayout';
import { OBSERVATORY_FLOOR_Y, OBSERVATORY_ORRERY_ID } from '../../src/world/exterior/ExteriorObservatory';

const evidenceFolder = historicalEvidenceFolder('docs/evidence/island-02b-observatory-20261122');
const [OX, , OZ] = OBSERVATORY_CENTER;

test('ISLAND-02B: southern ruined observatory approach, climb, celestial rotunda, and dormant W09 orrery', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());

  // 1. Cold exterior verification: observatory built, interior still deferred.
  const initialAudit = await page.evaluate(() => {
    const app = window.__museum!;
    return {
      activeWorld: app.activeWorld,
      interiorConstructed: app.interiorConstructed,
      hasObservatory: Boolean(app.scene.getObjectByName('southern-ruined-observatory')),
      hasDomeFragment: Boolean(app.scene.getObjectByName('ruined-observatory-dome-fragment')),
      hasOrreryAnchor: Boolean(app.scene.getObjectByName('observatory-orrery-w09-anchor')),
      hasTelescope: Boolean(app.scene.getObjectByName('observatory-weathered-telescope')),
      hasZodiacFloor: Boolean(app.scene.getObjectByName('observatory-zodiac-floor')),
    };
  });
  expect(initialAudit).toEqual({
    activeWorld: 'exterior',
    interiorConstructed: false,
    hasObservatory: true,
    hasDomeFragment: true,
    hasOrreryAnchor: true,
    hasTelescope: true,
    hasZodiacFloor: true,
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

  // View from Path 1 peering through trees at the ruined dome, and approach hill ramp view
  await captureView('woodland-glimpse.png', [44.5, 1.4, 94], [OX, 6.2, OZ]);
  await captureView('hill-approach-ramp.png', [63, 1.4, 96], [OX, 5.5, OZ]);

  // 2. Real keyboard walk along the winding woodland trail, up the hill ramp, and inside the ruined rotunda
  const waypoints: readonly [number, number, number][] = [
    [44.5, -0.5, 94],
    [54, -0.5, 91],
    [62, -0.5, 95],
    [70, -0.5, 96],
    [OX - 6.5, OBSERVATORY_FLOOR_Y, OZ],
    [OX - 3.0, OBSERVATORY_FLOOR_Y, OZ],
    [OX + 1.8, OBSERVATORY_FLOOR_Y, OZ - 4.2],
    [OX - 2.4, OBSERVATORY_FLOOR_Y, OZ],
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

  // 3. Rotunda view showing broken orrery, telescope, zodiac floor, and open starry sky above broken dome
  await captureView('rotunda-orrery-telescope.png', [OX - 4.2, OBSERVATORY_FLOOR_Y + 2.3, OZ + 5.6], [OX + 1.8, OBSERVATORY_FLOOR_Y + 2.0, OZ - 1.5]);

  // 4. Interact with broken orrery (dormant W09 anchor)
  const orreryResult = await page.evaluate(([ox, oz, fy]) => {
    const app = window.__museum!;
    const ui = document.getElementById('ui-root');
    const a11y = document.getElementById('a11y-root');
    const title = document.querySelector<HTMLElement>('.cinematic-arrival');
    const lock = document.querySelector<HTMLElement>('.hud__lock');
    if (ui) ui.style.display = '';
    if (a11y) a11y.style.display = '';
    if (title) title.style.display = 'none';
    if (lock) lock.style.display = 'none';

    app.player.teleport([ox - 2.4, fy, oz], -Math.PI / 2);
    app.player.pitch = 0.08;
    for (let i = 0; i < 6; i++) {
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
    }
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
  }, [OX, OZ, OBSERVATORY_FLOOR_Y]);

  expect(orreryResult.playerY).toBeCloseTo(OBSERVATORY_FLOOR_Y, 2);
  expect(orreryResult.focusBefore?.exhibitId).toBe(OBSERVATORY_ORRERY_ID);
  expect(orreryResult.activated).toBe(true);
  expect(orreryResult.focusAfter?.label).toContain('dormant');
  expect(orreryResult.journalAfter).toBe(orreryResult.journalBefore);
  expect(orreryResult.subtitle).toContain('W09');
  expect(orreryResult.activeWorld).toBe('exterior');

  const orreryPng = await page.locator('#museum-canvas').screenshot({
    path: join(evidenceFolder, 'orrery-interaction.png'),
    timeout: 30_000,
  });
  captures.push({
    name: 'orrery-interaction.png',
    width: 1280,
    height: 720,
    bytes: orreryPng.byteLength,
    sha256: createHash('sha256').update(orreryPng).digest('hex'),
  });

  // 5. Quality tier & reducedMotion stability
  const qualityCheck = await page.evaluate(([ox, oz, fy]) => {
    const app = window.__museum!;
    const supports: Array<number | null> = [];
    for (const tier of ['low', 'medium', 'high', 'low'] as const) {
      app.setQuality(tier);
      supports.push(app.exteriorWorld.collision.supportHeight(ox - 2.4, oz, fy));
    }
    const ring = app.scene.getObjectByName('observatory-orrery-w09-model')!.children[3];
    const beforeReduced = ring.rotation.y;
    app.exteriorWorld.variableUpdate(0.8, [ox - 2.4, fy + 1.64, oz], 'plaza', true);
    const afterReduced = ring.rotation.y;
    return { supports, rotatedUnderReducedMotion: afterReduced !== beforeReduced };
  }, [OX, OZ, OBSERVATORY_FLOOR_Y]);
  expect(qualityCheck.supports).toEqual([OBSERVATORY_FLOOR_Y, OBSERVATORY_FLOOR_Y, OBSERVATORY_FLOOR_Y, OBSERVATORY_FLOOR_Y]);
  expect(qualityCheck.rotatedUnderReducedMotion).toBe(false);

  // 6. Mobile portrait framing
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.innerWidth === 390 && window.innerHeight === 844);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__museum!.renderer.resize());
  await captureView('observatory-mobile-portrait.png', [63, 1.5, 96], [OX, 5.5, OZ]);

  await writeFile(
    join(evidenceFolder, 'capture-manifest.json'),
    JSON.stringify({ captures }, null, 2),
  );
  expect(errors).toEqual([]);
});

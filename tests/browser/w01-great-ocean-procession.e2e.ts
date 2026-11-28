import { expect, test, type Page } from '@playwright/test';
import { historicalEvidenceFolder } from './helpers/historical-evidence';
import { mkdirSync } from 'node:fs';

const EVIDENCE_DIR = historicalEvidenceFolder('docs/evidence/w01-great-ocean-procession-20261123');

async function bootPreview(page: Page, withQa = true): Promise<void> {
  await page.goto(withQa ? '/?qa=1&preview=w01' : '/?preview=w01', { waitUntil: 'commit' });
  await page.waitForFunction(() =>
    Boolean(window.__museum?.renderer.renderer.info.render.frame)
    && window.__museum!.pocketRegistry.isPlayable('W01', window.__museum!.passport));
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.dismissArrival();
    app.ui.hud.completeArrival();
  });
}

function stepFrames(page: Page, count: number): Promise<void> {
  return page.evaluate((n) => {
    const app = window.__museum!;
    for (let i = 0; i < n; i++) {
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
    }
    app.render(1);
  }, count);
}

test('W01 Great Ocean Procession full browser journey and return evidence', async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  const remoteRequests: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http://127.0.0.1:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      remoteRequests.push(url);
    }
  });

  await bootPreview(page);

  // 1. Stand on supported eastern lagoon bank looking at the W01 dive anchor
  await page.evaluate(() => {
    const app = window.__museum!;
    app.player.restorePose([53.5, -0.5, 4], -Math.PI / 2, -0.15);
    app.player.applyToCamera(app.camera, 1);
    app.camera.updateMatrixWorld();
    app.fixedUpdate(1 / 60);
    app.variableUpdate(1 / 60);
    app.interaction.update(app.camera, 0.1);
    app.render(1);
  });
  await page.screenshot({ path: `${EVIDENCE_DIR}/01-entry-lagoon-bank.png` });

  const beforePose = await page.evaluate(() => {
    const app = window.__museum!;
    return {
      pose: app.player.position.toArray(),
      yaw: app.player.yaw,
      pitch: app.player.pitch,
      geometries: app.renderer.renderer.info.memory.geometries,
      textures: app.renderer.renderer.info.memory.textures,
    };
  });

  // Deliberately activate W01 entry prompt and press Enter
  await page.evaluate(() => {
    const app = window.__museum!;
    app.interaction.activate();
    app.variableUpdate(0.4);
  });
  const dialog = page.getByRole('dialog', { name: /Lagoon Depths/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld)).toBe('pocket:W01');
  // The cumulative development loader exposes handles under __worldPreview.
  await page.evaluate(() => {
    window.__w01 = window.__worldPreview!.W01 as import('../../src/world/pocket/w01/createW01World').W01ControllerHandle;
  });

  // 2. Central Station & real bundled stem verification (muted by default)
  await stepFrames(page, 6);
  const musicCheck = await page.evaluate(async () => {
    const app = window.__museum!;
    const snap = window.__w01!.getSnapshot();
    const stemIds = ['w01-bass', 'w01-drums', 'w01-other'];
    const manifestUrl = '/src/assets/manifest.ts';
    const manifestMod = await import(/* @vite-ignore */ manifestUrl) as typeof import('../../src/assets/manifest');
    const stemStatuses = await Promise.all(stemIds.map(async (id) => {
      const record = manifestMod.getAsset(id);
      if (!record?.url) return { id, status: 0, type: null, source: null };
      const res = await fetch(record.url, { method: 'HEAD' });
      return { id, status: res.status, type: res.headers.get('content-type'), source: record.source };
    }));
    return {
      mode: snap.musicSourceMode,
      masterVolume: app.preferences.masterVolume,
      musicVolume: app.preferences.musicVolume,
      hasVocals: Boolean(manifestMod.getAsset('w01-vocals')),
      stemStatuses,
    };
  });
  expect(musicCheck.mode).toBe('bundled-original');
  expect(musicCheck.masterVolume).toBe(0);
  expect(musicCheck.musicVolume).toBe(0);
  expect(musicCheck.hasVocals).toBe(false);
  expect(musicCheck.stemStatuses).toEqual([
    { id: 'w01-bass', status: 200, type: 'audio/mp4', source: 'original-museum' },
    { id: 'w01-drums', status: 200, type: 'audio/mp4', source: 'original-museum' },
    { id: 'w01-other', status: 200, type: 'audio/mp4', source: 'original-museum' },
  ]);
  await page.screenshot({ path: `${EVIDENCE_DIR}/02-central-station.png` });

  // 3. First current ride (to Turtle Reef) with free-look verification mid-ride
  await page.evaluate(() => {
    window.__w01!.rideCurrent('turtle');
  });
  await stepFrames(page, 140);
  const midRideLook = await page.evaluate(() => {
    const app = window.__museum!;
    const yawBefore = app.player.yaw;
    app.player.applyLook(120, -40, 1, false);
    app.render(1);
    return {
      isGuided: app.player.isGuidedTransport,
      yawChanged: app.player.yaw !== yawBefore,
    };
  });
  expect(midRideLook.isGuided).toBe(true);
  expect(midRideLook.yawChanged).toBe(true);
  await page.screenshot({ path: `${EVIDENCE_DIR}/03-first-current-ride.png` });

  // Complete Turtle Reef ride, perform env + musician activation, capture screenshot
  await stepFrames(page, 220);
  await page.evaluate(() => {
    const app = window.__museum!;
    const w01 = window.__w01!;
    w01.activateReefEnvironment('turtle');
    w01.awakenMusician('turtle');
    app.player.yaw = 0.2;
    app.player.pitch = 0.14;
    app.variableUpdate(1 / 60);
    app.render(1);
  });
  await page.screenshot({ path: `${EVIDENCE_DIR}/04-turtle-reef.png` });

  // Return to Central, ride to Ray Reef, activate, capture screenshot
  await page.evaluate(() => { window.__w01!.rideCurrent('central'); });
  await stepFrames(page, 320);
  await page.evaluate(() => { window.__w01!.rideCurrent('ray'); });
  await stepFrames(page, 360);
  await page.evaluate(() => {
    const app = window.__museum!;
    const w01 = window.__w01!;
    w01.activateReefEnvironment('ray');
    w01.awakenMusician('ray');
    app.player.yaw = -0.2;
    app.player.pitch = 0.16;
    app.variableUpdate(1 / 60);
    app.render(1);
  });
  await page.screenshot({ path: `${EVIDENCE_DIR}/05-ray-reef.png` });

  // Return to Central, ride to Whale Reef, activate, capture screenshot
  await page.evaluate(() => { window.__w01!.rideCurrent('central'); });
  await stepFrames(page, 320);
  await page.evaluate(() => { window.__w01!.rideCurrent('whale'); });
  await stepFrames(page, 380);
  await page.evaluate(() => {
    const app = window.__museum!;
    const w01 = window.__w01!;
    w01.activateReefEnvironment('whale');
    w01.awakenMusician('whale');
    app.player.yaw = 0;
    app.player.pitch = 0.22;
    app.variableUpdate(1 / 60);
    app.render(1);
  });
  await page.screenshot({ path: `${EVIDENCE_DIR}/06-whale-reef.png` });

  // Return to Central Station and trigger Cathedral Assembly
  await page.evaluate(() => { window.__w01!.rideCurrent('central'); });
  await stepFrames(page, 340);
  await page.evaluate(() => {
    const app = window.__museum!;
    app.player.restorePose([0, 0, 5], 0, 0.12);
    window.__w01!.activateCathedral();
  });
  await stepFrames(page, 120);
  await page.screenshot({ path: `${EVIDENCE_DIR}/07-cathedral-assembly.png` });

  // 8. Completed Coral Cathedral
  await stepFrames(page, 160);
  await page.evaluate(() => {
    const app = window.__museum!;
    app.player.restorePose([0, 0, -4], 0, 0.14);
    app.render(1);
  });
  await page.screenshot({ path: `${EVIDENCE_DIR}/08-completed-cathedral.png` });

  // 9. Walk/stand on Final Conductor's Platform, capture screenshot, then conduct finale for stamp
  await page.evaluate(() => {
    const app = window.__museum!;
    app.player.restorePose([0, 6, -44], 0, 0.06);
    app.fixedUpdate(1 / 60);
    app.variableUpdate(1 / 60);
    app.render(1);
  });
  await page.screenshot({ path: `${EVIDENCE_DIR}/09-conductors-platform.png` });

  const afterComplete = await page.evaluate(() => {
    const app = window.__museum!;
    const w01 = window.__w01!;
    const ok = w01.conductFinale();
    return {
      ok,
      world: app.activeWorld,
      hasStamp: app.passport.hasStamp('W01'),
      earnedCount: app.passport.earnedCount,
      pose: app.player.position.toArray(),
      yaw: app.player.yaw,
      pitch: app.player.pitch,
    };
  });
  expect(afterComplete.ok).toBe(true);
  expect(afterComplete.world).toBe('exterior');
  expect(afterComplete.hasStamp).toBe(true);
  expect(afterComplete.earnedCount).toBe(1);
  expect(afterComplete.pose).toEqual(beforePose.pose);
  expect(afterComplete.yaw).toBeCloseTo(beforePose.yaw, 4);
  expect(afterComplete.pitch).toBeCloseTo(beforePose.pitch, 4);
  await page.evaluate(() => {
    const app = window.__museum!;
    app.variableUpdate(1 / 60);
    app.render(1);
    document.getElementById('ui-root')!.style.display = 'none';
    document.getElementById('a11y-root')!.style.display = 'none';
  });
  // The normal loop is stopped in this diagnostic route, so HUD/debug text is
  // one frame stale even though the host and camera have returned. Capture the
  // rendered exterior itself after asserting the real host state above.
  await page.locator('#museum-canvas').screenshot({ path: `${EVIDENCE_DIR}/11-return-to-lagoon.png` });

  // Repeat 9 more entry/exit cycles to verify zero resource/GPU leaks
  for (let i = 0; i < 9; i++) {
    const res = await page.evaluate(async () => {
      const app = window.__museum!;
      if (!await app.pocketHost.enter('W01')) return false;
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
      return app.pocketHost.exit({ viaVhsRewind: false });
    });
    expect(res).toBe(true);
  }

  const afterTen = await page.evaluate(() => {
    const app = window.__museum!;
    return {
      geometries: app.renderer.renderer.info.memory.geometries,
      textures: app.renderer.renderer.info.memory.textures,
      pocketRoots: app.scene.children.filter((c) => c.name.startsWith('pocket-world:')).length,
    };
  });
  expect(afterTen.pocketRoots).toBe(0);
  expect(afterTen.geometries).toBeLessThanOrEqual(beforePose.geometries);
  expect(afterTen.textures).toBeLessThanOrEqual(beforePose.textures);
  expect(remoteRequests).toEqual([]);
});

test.describe('W01 mobile layout & reduced motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('renders mobile touch layout cleanly with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bootPreview(page, false);
    await page.evaluate(async () => {
      const app = window.__museum!;
      app.preferences.reducedMotion = true;
      app.input.touchActive = true;
      await app.pocketHost.enter('W01');
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
      app.render(1);
    });
    await expect(page.getByRole('button', { name: 'Back to Museum' })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE_DIR}/10-mobile-layout.png` });
    await page.getByRole('button', { name: 'Back to Museum' }).tap();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld)).toBe('exterior');
  });
});

declare global {
  interface Window {
    __w01?: import('../../src/world/pocket/w01/createW01World').W01ControllerHandle;
  }
}

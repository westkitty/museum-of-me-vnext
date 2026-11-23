import { expect, test, type Page } from '@playwright/test';

async function bootMuseum(page: Page, path = '/?qa=1'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(path, { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum?.renderer.renderer.info.render.frame));
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.dismissArrival();
    app.ui.hud.completeArrival();
  });
  return errors;
}

test('music and master preferences start muted, respond to keyboard Settings, migrate v3, and persist across reload', async ({ page }) => {
  const errors = await bootMuseum(page);

  await page.keyboard.press('o');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();

  const masterSlider = settings.getByRole('slider', { name: 'Overall volume' });
  const ambienceSlider = settings.getByRole('slider', { name: 'Ambience' });
  const musicSlider = settings.getByRole('slider', { name: 'Music' });

  await expect(masterSlider).toHaveValue('0');
  await expect(ambienceSlider).toHaveValue('0');
  await expect(musicSlider).toHaveValue('0');
  expect(await page.evaluate(() => window.__museum!.audio.isRunning)).toBe(false);

  // Keyboard-operate Music volume slider via ArrowRight (step = 0.05).
  await musicSlider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(musicSlider).toHaveValue('0.15');
  await expect(musicSlider).toHaveAttribute('aria-valuetext', '15%');

  // Raise Overall volume via keyboard -> updates AudioManager buses & unlocks Web Audio cleanly.
  await masterSlider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(masterSlider).toHaveValue('0.1');

  const volumesBeforeReload = await page.evaluate(() => ({
    prefs: window.__museum!.preferences,
    volumes: window.__museum!.audio.getVolumes(),
    hasBuses: Boolean(
      window.__museum!.audio.buses.master
      && window.__museum!.audio.buses.ambience
      && window.__museum!.audio.buses.sfx
      && window.__museum!.audio.buses.music,
    ),
  }));
  expect(volumesBeforeReload.prefs.masterVolume).toBeCloseTo(0.1, 5);
  expect(volumesBeforeReload.prefs.musicVolume).toBeCloseTo(0.15, 5);
  expect(volumesBeforeReload.volumes.master).toBeCloseTo(0.1, 5);
  expect(volumesBeforeReload.volumes.music).toBeCloseTo(0.15, 5);
  expect(volumesBeforeReload.volumes.sfx).toBe(1);
  expect(volumesBeforeReload.hasBuses).toBe(true);

  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();

  // Reload and confirm persistence without auto-starting AudioContext before a gesture.
  await bootMuseum(page);
  const afterReload = await page.evaluate(() => ({
    master: window.__museum!.preferences.masterVolume,
    ambience: window.__museum!.preferences.ambienceVolume,
    music: window.__museum!.preferences.musicVolume,
    version: window.__museum!.preferences.version,
    isRunning: window.__museum!.audio.isRunning,
  }));
  expect(afterReload).toEqual({
    master: 0.1,
    ambience: 0,
    music: 0.15,
    version: 4,
    isRunning: false,
  });

  // Restore default settings and undo restore in SettingsPanel.
  await page.keyboard.press('o');
  await settings.getByRole('button', { name: 'Restore default settings' }).click();
  await expect(settings.locator('p[role="status"]')).toContainText('Settings restored to their defaults.');
  expect(await page.evaluate(() => window.__museum!.preferences.musicVolume)).toBe(0);
  await settings.getByRole('button', { name: 'Undo restore' }).click();
  await expect(settings.getByRole('slider', { name: 'Music' })).toHaveValue('0.15');

  // Verify v3 -> v4 migration preserves v3 master/ambience opt-ins and keeps musicVolume muted at 0.
  await page.evaluate(() => {
    window.localStorage.setItem('museum-of-me:preferences:v2', JSON.stringify({
      version: 3,
      quality: 'high',
      masterVolume: 0.65,
      ambienceVolume: 0.4,
      subtitles: true,
    }));
  });
  await bootMuseum(page);
  const migrated = await page.evaluate(() => ({
    version: window.__museum!.preferences.version,
    master: window.__museum!.preferences.masterVolume,
    ambience: window.__museum!.preferences.ambienceVolume,
    music: window.__museum!.preferences.musicVolume,
    quality: window.__museum!.preferences.quality,
  }));
  expect(migrated).toEqual({
    version: 4,
    master: 0.65,
    ambience: 0.4,
    music: 0,
    quality: 'high',
  });

  expect(errors).toEqual([]);
});

test('silent logical timeline drives progressive stem cues, loop release, HUD subtitles, and DomMirror cleanly with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await bootMuseum(page);

  const result = await page.evaluate(async () => {
    const app = window.__museum!;
    const fixtureUrl = '/tests/fixtures/music-w01-example.ts';
    const mod = await import(/* @vite-ignore */ fixtureUrl) as typeof import('../fixtures/music-w01-example');
    const cleanup = mod.installTestW01AudioFixture(app.audio);
    const compact = mod.buildTestW01CompactCueSheet();

    const session = app.audio.createMusicSession(compact);
    const seenCues: string[] = [];
    session.onCue((e) => seenCues.push(e.cue.id));

    await session.play();
    const initialTiming = session.timingSource;
    const gainsAtStart = {
      bass: session.getStemGain('bass'),
      drums: session.getStemGain('drums'),
      other: session.getStemGain('other'),
    };
    session.scheduleStemGain('drums', 1, { at: 'next-bar', fadeSeconds: 0 });
    session.scheduleStemGain('other', 1, { at: 'next-cue', cueId: 'other-entry-cue', fadeSeconds: 0 });

    const mirrorTextAtStart = document.querySelector('#a11y-root .a11y-live')?.textContent ?? '';
    const statusAtStart = document.querySelector('#a11y-root .a11y-music-status')?.textContent ?? '';

    // Advance via single-loop variableUpdate across drums-entry-cue (2.0s) and other-entry-cue (4.0s).
    for (let i = 0; i < 42; i++) {
      app.variableUpdate(0.1);
    }

    const gainsMid = {
      bass: session.getStemGain('bass'),
      drums: session.getStemGain('drums'),
      other: session.getStemGain('other'),
    };
    const subtitleText = document.querySelector('.hud__subtitle')?.textContent ?? '';
    const subtitleVisible = document.querySelector('.hud__subtitle')?.classList.contains('hud__subtitle--visible') ?? false;
    const mirrorTextMid = document.querySelector('#a11y-root .a11y-live')?.textContent ?? '';

    // Pause, verify update does not advance, then resume and release loop cleanly through natural outro.
    session.pause();
    const pausedPos = session.snapshot().positionSeconds;
    app.variableUpdate(1.0);
    const stillPausedPos = session.snapshot().positionSeconds;
    await session.resume();
    session.setActiveLoopRegion(null);
    for (let i = 0; i < 82; i++) {
      app.variableUpdate(0.1);
    }
    const endedState = session.state;

    session.dispose();
    const statusAfterDispose = document.querySelector('#a11y-root .a11y-music-status')?.getAttribute('hidden');
    cleanup();
    return {
      initialTiming,
      gainsAtStart,
      gainsMid,
      seenCues,
      mirrorTextAtStart,
      statusAtStart,
      subtitleText,
      subtitleVisible,
      mirrorTextMid,
      pausedPos,
      stillPausedPos,
      endedState,
      statusAfterDispose,
      activeSessions: app.audio.activeMusicSessionCount,
    };
  });

  expect(result.initialTiming).toBe('silent-timeline');
  expect(result.gainsAtStart).toEqual({ bass: 1, drums: 0, other: 0 });
  expect(result.gainsMid).toEqual({ bass: 1, drums: 1, other: 1 });
  expect(result.seenCues).toEqual([
    'bass-alone-start',
    'drums-entry-cue',
    'other-entry-cue',
    'ensemble-choreo-cue',
    'loop-seam-bar-5',
    'compact-end',
  ]);
  expect(result.mirrorTextAtStart).toContain('bass introduces the groove alone');
  expect(result.statusAtStart).toContain('Compact Single-Composition Stems Fixture');
  expect(result.subtitleVisible).toBe(true);
  expect(result.subtitleText).toContain('other instruments complete the composition');
  expect(result.mirrorTextMid).toContain('other instruments complete the composition');
  expect(result.stillPausedPos).toBeCloseTo(result.pausedPos, 5);
  expect(result.endedState).toBe('ended');
  expect(result.statusAfterDispose).not.toBeNull();
  expect(result.activeSessions).toBe(0);
  expect(errors).toEqual([]);
});

test('pocket-world music sessions clean up across enter/exit cycles, abort during load, and WebGL context loss', async ({ page }) => {
  const errors = await bootMuseum(page);

  const report = await page.evaluate(async () => {
    const app = window.__museum!;
    const threeUrl = '/node_modules/.vite/deps/three.js';
    const THREE = await import(/* @vite-ignore */ threeUrl) as typeof import('three');
    const fixtureUrl = '/tests/fixtures/music-w01-example.ts';
    const mod = await import(/* @vite-ignore */ fixtureUrl) as typeof import('../fixtures/music-w01-example');
    const cleanup = mod.installTestW01AudioFixture(app.audio);

    // Ensure all 11 canonical pocket worlds start dormant before test fixture binds W05.
    const dormantBefore = app.pocketRegistry.list().every((w) => w.readiness === 'dormant' && !w.load);

    const gallery = mod.buildTestMuseumCrossfadeCueSheets();
    const compact = mod.buildTestW01CompactCueSheet();

    // Raise master + music via Settings applyPreferences path so audio buses & loader engage if running.
    app.ui.applyPreferences({ masterVolume: 0.7, musicVolume: 0.8, ambienceVolume: 0.4 });
    app.audio.start();

    let scopeRef: import('../../src/assets/ResourceScope').ResourceScope | null = null;
    const readScope = () => scopeRef;
    app.pocketRegistry.registerWorld('W05', {
      readiness: 'verified',
      load: async (ctx) => {
        scopeRef = ctx.scope;
        const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 14), new THREE.MeshBasicMaterial());
        floor.position.y = -0.1;
        ctx.root.add(floor);
        ctx.scope.trackObject(ctx.root);
        ctx.collision.addFloor(-7, 7, -7, 7, 0);

        const introSession = ctx.createMusicSession(gallery.atrium);
        const stemsSession = ctx.createMusicSession(compact);
        await introSession.play();
        await app.audio.crossfadeMusic(introSession, stemsSession, 0.4);
        return { spawnPosition: [0, 0, 0], spawnYaw: 0 };
      },
    });

    const cycleStats = [];
    for (let i = 0; i < 4; i++) {
      const entered = await app.pocketHost.enter('W05');
      app.variableUpdate(0.5);
      const activeDuring = app.audio.activeMusicSessionCount;
      app.pocketHost.exit({ viaVhsRewind: false, reason: 'back' });
      const scope = readScope();
      cycleStats.push({
        entered,
        activeDuring,
        activeAfter: app.audio.activeMusicSessionCount,
        cachedAfter: app.audio.assetLoader.cachedBufferCount,
        leasesAfter: app.audio.assetLoader.activeLeaseCount,
        scopeDisposed: scope?.isDisposed ?? false,
        scopeSize: scope?.size ?? -1,
      });
    }

    // Abort mid-load cleanup check.
    app.pocketRegistry.registerWorld('W05', {
      readiness: 'verified',
      load: (ctx, signal) => new Promise((_resolve, reject) => {
        const s = ctx.createMusicSession(gallery.hall);
        void s.play();
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    });
    const pendingEnter = app.pocketHost.enter('W05');
    app.pocketHost.abortPendingEntry();
    const abortedResult = await pendingEnter;
    const afterAbort = {
      abortedResult,
      activeSessions: app.audio.activeMusicSessionCount,
      cachedBuffers: app.audio.assetLoader.cachedBufferCount,
      leases: app.audio.assetLoader.activeLeaseCount,
    };

    // Context loss while pocket world + music session active.
    app.pocketRegistry.registerWorld('W05', {
      readiness: 'verified',
      load: async (ctx) => {
        scopeRef = ctx.scope;
        const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 14), new THREE.MeshBasicMaterial());
        floor.position.y = -0.1;
        ctx.root.add(floor);
        ctx.scope.trackObject(ctx.root);
        ctx.collision.addFloor(-7, 7, -7, 7, 0);
        const s = ctx.createMusicSession(compact);
        await s.play();
        return { spawnPosition: [0, 0, 0], spawnYaw: 0 };
      },
    });
    await app.pocketHost.enter('W05');
    app.renderer.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    const lostScope = readScope();
    const afterContextLoss = {
      world: app.activeWorld,
      activeSessions: app.audio.activeMusicSessionCount,
      cachedBuffers: app.audio.assetLoader.cachedBufferCount,
      leases: app.audio.assetLoader.activeLeaseCount,
      scopeDisposed: lostScope?.isDisposed ?? false,
      scopeSize: lostScope?.size ?? -1,
      illegal: app.worldDirector.illegalTransitions,
    };

    app.pocketRegistry.resetWorld('W05');
    cleanup();
    return { dormantBefore, cycleStats, afterAbort, afterContextLoss };
  });

  expect(report.dormantBefore).toBe(true);
  for (const cycle of report.cycleStats) {
    expect(cycle).toEqual({
      entered: true,
      activeDuring: 2,
      activeAfter: 0,
      cachedAfter: 0,
      leasesAfter: 0,
      scopeDisposed: true,
      scopeSize: 0,
    });
  }
  expect(report.afterAbort).toEqual({
    abortedResult: false,
    activeSessions: 0,
    cachedBuffers: 0,
    leases: 0,
  });
  expect(report.afterContextLoss).toEqual({
    world: 'exterior',
    activeSessions: 0,
    cachedBuffers: 0,
    leases: 0,
    scopeDisposed: true,
    scopeSize: 0,
    illegal: [],
  });
  expect(errors).toEqual([]);
});

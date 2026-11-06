import { expect, test } from '@playwright/test';

test('cold exterior stays lazy; accessible entrance intent records real preparation stages', async ({ page }) => {
  test.setTimeout(300_000);
  const pageErrors: string[] = [];
  let bootMessage: string | null = null;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'info' && message.text().startsWith('[Museum boot]')) bootMessage = message.text();
  });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));

  const cold = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    const longTasks: number[] = [];
    if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      const observer = new PerformanceObserver((list) => {
        const since = (window as Window & { __p5LongTaskStartAt?: number }).__p5LongTaskStartAt ?? Infinity;
        longTasks.push(...list.getEntries()
          .filter((entry) => entry.startTime >= since)
          .map((entry) => entry.duration));
      });
      observer.observe({ type: 'longtask', buffered: true });
      (window as Window & { __p5LongTasks?: number[] }).__p5LongTasks = longTasks;
    }
    return {
      activeWorld: app.activeWorld,
      interiorConstructed: app.interiorConstructed,
      importRequestedAtMs: app.interiorLoadTelemetry.requestedAtMs,
      buildCount: app.museumBuildCount,
    };
  });
  expect(cold).toEqual({ activeWorld: 'exterior', interiorConstructed: false, importRequestedAtMs: null, buildCount: 0 });

  const coldTransfer = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((entry) => entry.name.startsWith(location.origin));
    return {
      navigationTransferBytes: navigation?.transferSize ?? null,
      resourceTransferBytes: resources.reduce((total, entry) => total + entry.transferSize, 0),
      resourceBodyBytes: resources.reduce((total, entry) => total + entry.encodedBodySize, 0),
      resourceCount: resources.length,
      deferredInteriorRequested: resources.some((entry) => /interior/i.test(entry.name)),
    };
  });
  expect(coldTransfer.deferredInteriorRequested).toBe(false);

  // Use the supported low tier for this telemetry journey. The full-size
  // medium framebuffer makes SwiftShader stall long enough to hide state
  // transitions in a serial browser suite; tier behavior has separate tests.
  await page.evaluate(() => window.__museum?.setQuality('low'));

  await page.keyboard.down('w');
  await page.evaluate(() => window.__museum?.start());
  await page.waitForFunction(() => (window.__museum?.firstExteriorInteractiveMs ?? 0) > 0);
  await page.keyboard.up('w');
  const firstInputAtMs = await page.evaluate(() => {
    const app = window.__museum;
    app?.stop();
    return app?.firstExteriorInteractiveMs ?? 0;
  });

  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.player.teleport([0, 0, 148]);
    app.worldDirector.update(app.player.position);
  });
  const enter = page.getByRole('button', { name: 'Enter museum' });
  await expect(enter).toBeVisible();
  await enter.focus();
  await enter.press('Enter');
  await page.evaluate(() => {
    const app = window.__museum;
    (window as Window & { __p5LongTaskStartAt?: number }).__p5LongTaskStartAt = performance.now();
    app?.diagnostics.reset();
    (window as Window & { __p5LongTasks?: number[] }).__p5LongTasks?.splice(0);
    app?.start();
  });

  await page.waitForFunction(() => {
    const app = window.__museum;
    return Boolean(app?.interiorWorld?.streaming.telemetry.prewarmReady)
      && app?.interiorLoadTelemetry.entranceReadyAtMs !== null;
  });
  const ready = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    const interior = app.interiorWorld;
    if (!interior) throw new Error('interior missing after entrance prewarm');
    app.stop();
    const t = app.interiorLoadTelemetry;
    const gl = app.renderer.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      requested: t.requestedAtMs,
      moduleLoaded: t.moduleLoadedAtMs,
      buildStarted: t.buildStartedAtMs,
      buildCompleted: t.buildCompletedAtMs,
      buildStages: t.buildStageMs,
      entranceReady: t.entranceReadyAtMs,
      transitionCommitted: t.transitionCommittedAtMs,
      world: app.activeWorld,
      firstInteriorFrame: t.firstInteriorFrameAtMs,
      museumBuildCount: app.museumBuildCount,
      longTasks: (window as Window & { __p5LongTasks?: number[] }).__p5LongTasks ?? null,
      frameProfile: app.diagnostics.performanceSummary,
      webgl: debug ? {
        vendor: gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      } : null,
      environment: {
        userAgent: navigator.userAgent,
        viewport: [window.innerWidth, window.innerHeight],
        devicePixelRatio: window.devicePixelRatio,
        qualityPreference: app.preferences.quality,
        qualityTier: app.renderer.quality.tier,
        frameCap: app.preferences.frameCap,
        networkProfile: 'local Vite development server; no network shaping',
      },
      gpuWarm: { ...app.renderer.warmTelemetry },
      streamingWarm: {
        totalWarms: interior.streaming.telemetry.totalWarms,
        prewarmWarmed: interior.streaming.telemetry.prewarmWarmed,
        prewarmTotal: interior.streaming.telemetry.prewarmTotal,
        lastWarmMs: interior.streaming.telemetry.lastWarmMs,
      },
      chunkResources: performance.getEntriesByType('resource')
        .filter((entry) => /interior/i.test(entry.name))
        .map((entry) => ({ name: entry.name, duration: entry.duration, transferSize: (entry as PerformanceResourceTiming).transferSize })),
    };
  });

  expect(ready.requested).not.toBeNull();
  expect(ready.moduleLoaded).toBeGreaterThanOrEqual(ready.requested!);
  expect(ready.buildStarted).toBeGreaterThanOrEqual(ready.moduleLoaded!);
  expect(ready.buildCompleted).toBeGreaterThanOrEqual(ready.buildStarted!);
  expect(ready.entranceReady).toBeGreaterThanOrEqual(ready.buildCompleted!);
  expect(Object.keys(ready.buildStages)).toContain('museum.detailing:rotunda');
  expect(Object.keys(ready.buildStages)).toContain('environment.layer:dressing');
  expect(Object.keys(ready.buildStages)).toContain('installation.starsilk-atlas');
  expect(Object.keys(ready.buildStages)).toContain('installation.starsilk-atlas:visual');
  expect(ready.world).toBe('exterior');
  expect(ready.firstInteriorFrame).toBeNull();
  expect(ready.museumBuildCount).toBe(1);
  expect(ready.gpuWarm.objects).toBe(0);
  expect(ready.streamingWarm.prewarmWarmed).toBe(0);

  const firstEntry = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.player.teleport([0, 0, 126]);
    app.fixedUpdate(1 / 60);
    app.variableUpdate(1 / 60);
    const renderStartedAt = performance.now();
    app.render(0);
    return {
      activeWorld: app.activeWorld,
      transitionCommittedAtMs: app.interiorLoadTelemetry.transitionCommittedAtMs,
      firstInteriorFrameAtMs: app.interiorLoadTelemetry.firstInteriorFrameAtMs,
      firstRenderCallMs: performance.now() - renderStartedAt,
    };
  });
  expect(firstEntry.activeWorld).toBe('interior');
  expect(firstEntry.firstInteriorFrameAtMs).toBeGreaterThanOrEqual(firstEntry.transitionCommittedAtMs!);
  expect(ready.frameProfile.samples).toBeGreaterThan(0);
  expect(firstInputAtMs).toBeGreaterThan(0);
  console.info('[P7 cold startup and preparation evidence]', JSON.stringify({
    bootMessage, firstExteriorInputAtMs: firstInputAtMs, coldTransfer,
    gpuPrewarm: 'deferred until interior activation',
    ...ready, firstEntry,
  }));
  expect(pageErrors).toEqual([]);
});

test('low-tier mobile viewport and reduced-motion visitors can request entrance preparation by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    app.setQuality('low');
    app.player.teleport([0, 0, 148]);
    app.worldDirector.update(app.player.position);
  });
  const enter = page.getByRole('button', { name: 'Enter museum' });
  await expect(enter).toBeVisible();
  await enter.focus();
  await enter.press('Enter');
  const state = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    return {
      quality: app.renderer.quality.tier,
      requested: app.interiorImportStarted,
      world: app.activeWorld,
      status: document.querySelector('.hud__threshold p')?.textContent,
      focusedControl: document.activeElement instanceof HTMLButtonElement ? document.activeElement.textContent : null,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });
  expect(state.quality).toBe('low');
  expect(state.requested).toBe(true);
  expect(state.world).toBe('exterior');
  expect(state.status).toMatch(/Loading the museum module|Building the entrance exhibits|ready/);
  expect(state.focusedControl).toBe('Continue outside');
  expect(state.horizontalOverflow).toBe(false);
  expect(state.reducedMotion).toBe(true);
});

test('slow module transfer holds only the doorway seam, reports real state, and allows backtracking', async ({ page }) => {
  const failures: string[] = [];
  page.on('requestfailed', (request) => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()); });
  await page.route('**/src/world/InteriorWorld.ts*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    app.player.teleport([0, 0, 128]);
    app.variableUpdate(1 / 60);
    app.start();
  });
  await page.waitForFunction(() => window.__museum?.interiorImportStarted === true
    && window.__museum.interiorConstructed === false);
  const waiting = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    return {
      world: app.activeWorld,
      phase: app.worldDirector.phase,
      z: app.player.position.z,
      status: document.querySelector('.hud__threshold p')?.textContent ?? '',
      ready: app.interiorWorld?.streaming.telemetry.prewarmReady ?? false,
      hasFakePercent: /\b\d{1,3}%\b/.test(document.querySelector('.hud__threshold')?.textContent ?? ''),
      canContinueOutside: document.querySelector<HTMLButtonElement>('.hud__threshold button:last-child')?.hidden === false,
      committedAt: app.interiorLoadTelemetry.transitionCommittedAtMs,
    };
  });
  expect(waiting.world).toBe('exterior');
  expect(waiting.phase).toBe('PREPARING_INTERIOR');
  expect(waiting.z).toBeGreaterThanOrEqual(128.05);
  expect(waiting.status).toMatch(/Loading|building/i);
  expect(waiting.ready).toBe(false);
  expect(waiting.hasFakePercent).toBe(false);
  expect(waiting.canContinueOutside).toBe(true);
  expect(waiting.committedAt).toBeNull();

  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.player.teleport([0, 0, 150]);
    app.variableUpdate(1 / 60);
  });
  await page.waitForFunction(() => window.__museum?.interiorConstructed === true
    || window.__museum?.worldDirector.phase === 'PREPARATION_FAILED');
  const loadResult = await page.evaluate(() => ({
    constructed: window.__museum?.interiorConstructed,
    failure: window.__museum?.interiorLoadTelemetry.lastFailure,
    phase: window.__museum?.worldDirector.phase,
  }));
  console.info('[P5 delayed import result]', JSON.stringify({ ...loadResult, failures }));
  expect(loadResult.constructed).toBe(true);
  const backedOut = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    return { world: app.activeWorld, z: app.player.position.z, committedAt: app.interiorLoadTelemetry.transitionCommittedAtMs };
  });
  expect(backedOut.world).toBe('exterior');
  expect(backedOut.z).toBe(150);
  expect(backedOut.committedAt).toBeNull();
});

test('context loss during preparation cannot strand the visitor in a committing state', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    app.player.teleport([0, 0, 133]);
    app.variableUpdate(1 / 60);
    app.start();
  });
  await page.waitForFunction(() => window.__museum?.interiorConstructed === true);
  const lost = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.renderer.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    app.player.teleport([0, 0, 126]);
    app.worldDirector.update(app.player.position);
    return { lost: app.renderer.isContextLost, world: app.activeWorld, phase: app.worldDirector.phase,
      entranceReady: app.interiorWorld?.streaming.telemetry.prewarmReady ?? false };
  });
  expect(lost.lost).toBe(true);
  expect(lost.world).toBe('exterior');
  expect(lost.phase).not.toMatch(/COMMITTING/);
  expect(lost.entranceReady).toBe(false);

  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.renderer.canvas.dispatchEvent(new Event('webglcontextrestored'));
  });
  await page.waitForFunction(() => window.__museum?.interiorWorld?.streaming.telemetry.prewarmReady === true);
  const recovered = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    app.player.teleport([0, 0, 126]);
    app.variableUpdate(1 / 60);
    return { world: app.activeWorld, phase: app.worldDirector.phase };
  });
  expect(recovered.world).toBe('interior');
  expect(recovered.phase).toBe('INTERIOR_ACTIVE');
});

test('automatic preparation failure reports feedback without unhandled rejection; explicit retry recovers entry', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const rejections: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('[WorldDirector]')) failures.push(message.text());
  });
  await page.exposeFunction('recordPreparationRejection', (message: string) => rejections.push(message));
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (event) => {
      void (window as unknown as Window & { recordPreparationRejection: (message: string) => Promise<void> })
        .recordPreparationRejection(String(event.reason));
    });
  });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.route('**/src/world/InteriorWorld.ts*', (route) =>
    route.fulfill({ status: 404, contentType: 'text/plain', body: 'Injected predictive import failure' }));
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.setQuality('low');
    app.renderer.renderer.setPixelRatio(0.5);
    app.renderer.renderer.setSize(320, 180, false);
    app.player.teleport([0, 0, 133]);
    app.worldDirector.update(app.player.position);
  });
  await page.waitForFunction(() => window.__museum?.worldDirector.phase === 'PREPARATION_FAILED');
  await expect(page.getByRole('button', { name: 'Reload and retry' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('island remains available');
  const outside = await page.evaluate(() => {
    const app = window.__museum!;
    app.player.teleport([0, 0, 150]);
    app.worldDirector.update(app.player.position);
    return { world: app.activeWorld, phase: app.worldDirector.phase,
      failure: app.interiorLoadTelemetry.lastFailure, visible: app.exteriorWorld.root.visible,
      z: app.player.position.z, constructed: app.interiorConstructed };
  });
  expect(outside).toMatchObject({ world: 'exterior', phase: 'PREPARATION_FAILED', visible: true, z: 150, constructed: false });
  expect(outside.failure).toMatch(/404|Failed to fetch dynamically imported module/);
  // Live keyboard movement still works outside; failure installs no freeze.
  await page.keyboard.down('s');
  const moved = await page.evaluate(() => {
    const app = window.__museum!;
    for (let i = 0; i < 30; i++) app.fixedUpdate(1 / 60);
    return app.player.position.z;
  });
  await page.keyboard.up('s');
  expect(moved).toBeGreaterThan(outside.z);
  expect(failures).toHaveLength(1);
  expect(rejections).toEqual([]);
  expect(errors).toEqual([]);
  await page.unroute('**/src/world/InteriorWorld.ts*');
  await page.evaluate(() => {
    const app = window.__museum!;
    app.player.teleport([0, 0, 133]);
    app.worldDirector.update(app.player.position);
  });
  // Reload is deliberate: browsers may cache a rejected dynamic module import.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'commit' }),
    page.getByRole('button', { name: 'Reload and retry' }).click(),
  ]);
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => {
    const app = window.__museum!;
    app.setQuality('low');
    app.renderer.renderer.setPixelRatio(0.5);
    app.renderer.renderer.setSize(320, 180, false);
    app.player.teleport([0, 0, 133]);
    app.worldDirector.update(app.player.position);
  });
  await page.waitForFunction(() => window.__museum?.interiorWorld?.streaming.telemetry.prewarmReady === true);
  const entered = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.player.teleport([0, 0, 126]);
    app.worldDirector.update(app.player.position);
    return { world: app.activeWorld, failure: app.interiorLoadTelemetry.lastFailure,
      exteriorVisible: app.exteriorWorld.root.visible, interiorVisible: app.interiorWorld?.root.visible };
  });
  expect(entered).toEqual({ world: 'interior', failure: null, exteriorVisible: false, interiorVisible: true });
  expect(rejections).toEqual([]);
  expect(errors).toEqual([]);
});

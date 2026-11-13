import { expect, test } from '@playwright/test';

/**
 * Guards against the stalls that are deterministic enough to test in CI.
 * Frame timing under SwiftShader is noise, but a shader program compiled while
 * drawing a visible frame is not: it is exactly what made the first interior
 * entry hitch for 0.3-0.8 s on a real M1. After start-up, none may happen.
 */
test('entering and touring the museum compiles no shader inside a visible frame', async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => {
    const app = window.__museum!;
    // SwiftShader draws on the CPU: keep the pixel workload small, as the other
    // world-switch tests do, so warm-up frames keep coming.
    app.setQuality('low');
    app.renderer.renderer.setPixelRatio(0.5);
    app.renderer.renderer.setSize(window.innerWidth, window.innerHeight, false);
    app.start();
  });
  await page.waitForTimeout(2_000);

  const result = await page.evaluate(async () => {
    const app = window.__museum!;
    const progress = (step: string) => { (window as Window & { __stabilityStep?: string }).__stabilityStep = step; };
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const director = app.worldDirector as unknown as { entranceIsReady(): boolean; commitToInterior(): boolean; switchToExterior(): boolean; prepareInterior(): Promise<void> };
    const layoutModule = '/src/world/layout.ts';
    const { PLACEMENTS } = await import(/* @vite-ignore */ layoutModule) as typeof import('../../src/world/layout');
    app.player.position.set(0, 0, 60);
    progress('preparing');
    await director.prepareInterior();
    progress('warming');
    for (let i = 0; i < 1800 && !(app.interiorWorldWarmed && director.entranceIsReady()); i++) await wait(100);
    const before = { ...app.renderer.frameTelemetry };
    const south = PLACEMENTS.find((placement) => placement.wing === 'south')!;
    app.player.position.set(...south.doorway);
    await wait(500);
    const committed = director.commitToInterior();
    progress('touring');
    await wait(3_000);
    for (const placement of PLACEMENTS) {
      app.player.position.set(...placement.doorway);
      await wait(600);
    }
    director.switchToExterior();
    app.player.position.set(0, 0, 60);
    await wait(2_000);
    return {
      committed,
      warmed: app.interiorWorldWarmed,
      before,
      after: { ...app.renderer.frameTelemetry },
      visibleLights: app.lighting.activePointLights,
      warm: { ...app.renderer.warmTelemetry },
    };
  });

  expect(result.committed).toBe(true);
  expect(result.warmed).toBe(true);
  expect(result.warm.worldUploaded).toBeGreaterThan(0);
  expect(result.visibleLights).toBe(8);
  expect(result.after.compilesInFrame - result.before.compilesInFrame, 'shaders compiled inside visible frames after start-up').toBe(0);
  expect(errors).toEqual([]);
});

test('outside, the map and HUD name the side of the building, never an interior wing', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  const outside = await page.evaluate(async () => {
    const app = window.__museum!;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // Behind the museum: these X/Z coordinates are inside the North Wing's plan.
    app.player.position.set(0, app.player.position.y, -62);
    await wait(800);
    const hud = document.querySelector('.hud__location')?.textContent ?? '';
    app.ui.map.open();
    await wait(200);
    const map = document.querySelector('.map__layout');
    const text = map?.querySelector('p')?.textContent ?? '';
    const marker = Boolean(map?.querySelector('circle.you'));
    app.ui.map.close();
    return { world: app.activeWorld, label: app.zoneLabel, hud, text, marker };
  });
  expect(outside.world).toBe('exterior');
  expect(outside.label).toBe('Exterior · north side');
  expect(outside.hud).toContain('Exterior · north side');
  expect(outside.hud).not.toMatch(/North Wing|Wing/i);
  expect(outside.text).toContain('outside the museum');
  expect(outside.marker).toBe(false);
});

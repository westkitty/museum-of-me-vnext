import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page): Promise<void> {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum?.renderer.renderer.info.render.frame));
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.dismissArrival();
    app.ui.hud.completeArrival();
  });
}

function fixture(page: Page) {
  return page.evaluateHandle(async () => {
    const url = '/tests/fixtures/pocket-world-browser.ts';
    const mod = await import(/* @vite-ignore */ url) as typeof import('../fixtures/pocket-world-browser');
    return mod.installPocketFixture(window.__museum!);
  });
}

test('pocket host enters, updates, checkpoints, completes and releases ten visits', async ({ page }) => {
  await boot(page);
  const observed = await fixture(page);
  const before = await page.evaluate(() => {
    const app = window.__museum!;
    app.player.yaw = 0.42;
    app.player.pitch = -0.21;
    const opener = document.createElement('button');
    opener.id = 'test-portal-opener';
    document.body.append(opener);
    opener.focus();
    void app.pocketHost.requestEntry('W05');
    app.variableUpdate(0.2);
    return { pose: app.player.position.toArray(), geometry: app.renderer.renderer.info.memory.geometries,
      textures: app.renderer.renderer.info.memory.textures, controlCount: app.interaction.controlCount };
  });
  const dialog = page.getByRole('dialog', { name: 'Impossible Greenhouse' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#test-portal-opener')).toBeFocused();

  await page.evaluate(() => { void window.__museum!.pocketHost.requestEntry('W05'); });
  await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld)).toBe('pocket:W05');
  await expect(page.getByRole('button', { name: 'Open Passport' })).toHaveCount(0);
  expect(await page.evaluate(() => {
    const app = window.__museum!;
    return [app.camera.fov, app.exteriorWorld.root.visible,
      app.scene.getObjectByName('museum-authored-placements')?.visible];
  })).toEqual([55, false, false]);
  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await expect(page.getByRole('button', { name: 'Open Passport (0 of 10 stamps)' })).toBeVisible();
  await expect(page.locator('#test-portal-opener')).toBeFocused();
  await page.getByRole('button', { name: 'Open Passport (0 of 10 stamps)' }).click();
  await expect(page.locator('#panel-passport .passport-slot')).toHaveCount(10);
  await expect(page.locator('#panel-passport').getByText(/Lighthouse at World/)).toBeVisible();
  await page.keyboard.press('Escape');

  const tenVisits = await observed.evaluate(async (probe) => {
    const app = window.__museum!;
    const visited = [];
    for (let index = 1; index < 10; index++) {
      if (!await app.pocketHost.enter('W05')) throw new Error('Entry failed');
      const ctx = probe.context!;
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
      app.render(1);
      app.player.teleport([2, 0, -2], 0.25);
      const saved = ctx.saveCheckpoint();
      app.player.teleport([3, 0, -3]);
      const reset = ctx.resetToCheckpoint();
      const pose = app.player.position.toArray();
      window.dispatchEvent(new Event('test-pocket-event'));
      if (index > 7) {
        ctx.requestComplete();
        ctx.requestComplete();
      } else app.pocketHost.exit({ viaVhsRewind: false });
      const eventsBefore = probe.events;
      window.dispatchEvent(new Event('test-pocket-event'));
      visited.push({ saved, reset, pose, eventUnbound: eventsBefore === probe.events,
        world: app.activeWorld, museumVisible: app.exteriorWorld.root.visible,
        pocketRoots: app.scene.children.filter(o => o.name.startsWith('pocket-world:')).length,
        dom: Boolean(document.getElementById('test-pocket-resource')),
        resources: ctx.scope.size, colliderCount: ctx.collision.size, controls: app.interaction.controlCount });
    }
    return { visited, ticks: probe.ticks, variableTicks: probe.variableTicks,
      aborted: probe.aborted, disposed: probe.disposed, stopped: probe.mediaStopped, freed: probe.resourcesDisposed,
      stamp: app.passport.earnedCount, pose: app.player.position.toArray(), yaw: app.player.yaw, pitch: app.player.pitch,
      restoredFov: app.camera.fov === app.preferences.fieldOfView,
      memory: { ...app.renderer.renderer.info.memory }, illegal: app.worldDirector.illegalTransitions };
  });
  expect(tenVisits.ticks).toBe(9);
  expect(tenVisits.variableTicks).toBe(9);
  expect([tenVisits.aborted, tenVisits.disposed, tenVisits.stopped, tenVisits.freed]).toEqual([10, 10, 10, 30]);
  expect(tenVisits.stamp).toBe(1);
  expect(tenVisits.pose).toEqual(before.pose);
  expect([tenVisits.yaw, tenVisits.pitch]).toEqual([0.42, -0.21]);
  expect(tenVisits.restoredFov).toBe(true);
  expect(tenVisits.illegal).toEqual([]);
  expect(tenVisits.memory.geometries).toBeLessThanOrEqual(before.geometry);
  expect(tenVisits.memory.textures).toBeLessThanOrEqual(before.textures);
  for (const record of tenVisits.visited) {
    expect(record).toEqual({ saved: true, reset: true, pose: [2, 0, -2], eventUnbound: true,
      world: 'exterior', museumVisible: true, pocketRoots: 0, dom: false, resources: 0,
      colliderCount: 0, controls: before.controlCount });
  }
});

test('dormant, empty, offline and interrupted worlds leave the museum usable', async ({ page, context }) => {
  await boot(page);
  expect(await page.evaluate(async () => {
    const app = window.__museum!;
    return { result: await app.pocketHost.enter('W05'), world: app.activeWorld,
      passport: app.passport.unlockedUi, ready: app.pocketRegistry.list().filter(w => w.load).length };
  })).toEqual({ result: false, world: 'exterior', passport: false, ready: 0 });
  await expect(page.getByRole('status').filter({ hasText: /dormant|unavailable|not open/i }).first()).toBeVisible();
  await context.setOffline(true);
  const failures = await page.evaluate(async () => {
    const app = window.__museum!;
    app.pocketRegistry.registerWorld('W05', { readiness: 'verified', load: async (_ctx, signal) => {
      await fetch('/assets/pocket-missing-fixture.glb', { signal, cache: 'no-store' });
      throw new Error('Missing asset');
    } });
    const offline = await app.pocketHost.enter('W05');
    app.pocketRegistry.registerWorld('W05', { readiness: 'verified', load: () => ({ spawnPosition: [0, 0, 0], spawnYaw: 0 }) });
    const empty = await app.pocketHost.enter('W05');
    let signaled = false;
    app.pocketRegistry.registerWorld('W05', { readiness: 'verified', load: (_ctx, signal) => new Promise(() => {
      signal.addEventListener('abort', () => { signaled = true; }, { once: true });
    }) });
    const pending = app.pocketHost.enter('W05');
    window.dispatchEvent(new Event('pagehide'));
    return { offline, empty, aborted: await pending, signaled, world: app.activeWorld, phase: app.worldDirector.phase,
      busy: app.pocketHost.isTransitionBusy, frozen: app.player.isFrozen, captured: app.input.uiCaptured,
      passport: app.passport.unlockedUi, illegal: app.worldDirector.illegalTransitions };
  });
  await context.setOffline(false);
  expect(failures).toEqual({ offline: false, empty: false, aborted: false, signaled: true,
    world: 'exterior', phase: 'EXTERIOR_ACTIVE', busy: false, frozen: false, captured: false, passport: false, illegal: [] });
  await fixture(page);
  const lost = await page.evaluate(async () => {
    const app = window.__museum!;
    if (!await app.pocketHost.enter('W05')) throw new Error('Fixture did not enter before context loss');
    const scope = app.pocketHost.activeScope!;
    app.renderer.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    return { world: app.activeWorld, closed: scope.isDisposed, stamps: app.passport.earnedCount };
  });
  expect(lost).toEqual({ world: 'exterior', closed: true, stamps: 0 });
});

test.describe('touch and reduced motion', () => {
  test.use({ hasTouch: true });
  test('touch entry has a static transition and a direct return control', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    await fixture(page);
    const fov = await page.evaluate(() => {
      const app = window.__museum!;
      void app.pocketHost.requestEntry('W05');
      app.variableUpdate(0.2);
      return [app.camera.fov, app.preferences.fieldOfView];
    });
    expect(fov[0]).toBe(fov[1]);
    await expect(page.locator('.pocket-prompt')).toHaveCSS('backdrop-filter', 'none');
    await expect(page.locator('.pocket-prompt__card')).toHaveCSS('transform', 'none');
    await page.getByRole('dialog', { name: 'Impossible Greenhouse' }).getByRole('button', { name: 'Enter', exact: true }).tap();
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld)).toBe('pocket:W05');
    await page.getByRole('button', { name: 'Back to Museum' }).tap();
    expect(await page.evaluate(() => {
      const app = window.__museum!;
      return [app.activeWorld, app.ui.pocketTransition.isRewindActive];
    })).toEqual(['exterior', false]);
  });
});

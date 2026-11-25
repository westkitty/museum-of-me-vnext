import { expect, test, type Page } from '@playwright/test';

/**
 * Application-level interruption of the real InteriorWorld build. The interior
 * scope is disposed at a chosen point of visitor preparation (the ownership
 * boundary App.ensureInteriorLoaded relies on), then a legitimate second entry
 * must succeed with exactly 17 interactive visitors and no leftovers.
 * Runs against the Vite dev server, where the app and this test share module
 * instances, so the hooks patch the same classes the app uses.
 */
type Point = 'before-first-step' | 'halfway' | 'registration-boundary' | 'after-construction';
const CASES: Array<{ point: Point; composed: boolean }> = [
  { point: 'before-first-step', composed: true },
  { point: 'halfway', composed: true },
  { point: 'registration-boundary', composed: false },
  { point: 'after-construction', composed: false },
];

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  // Same software-GL guard as the other browser suites: stop the render loop
  // (the cooperative build then yields through the event loop).
  await page.evaluate(() => { window.__museum?.stop(); window.__museum?.variableUpdate(1 / 60); });
  return errors;
}

for (const { point, composed } of CASES) {
  test(`interrupting interior preparation at "${point}" leaves nothing behind and re-entry succeeds`, async ({ page }) => {
    test.setTimeout(360_000);
    const errors = await boot(page);

    const interrupted = await page.evaluate(async ({ point, composed }) => {
      const win = window as unknown as Record<string, unknown>;
      const rejections: string[] = [];
      window.addEventListener('unhandledrejection', (event) => rejections.push(String(event.reason)));
      win.__rejections = rejections;
      const app = window.__museum!;
      const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
      const { InteriorWorld } = await load<typeof import('../../src/world/InteriorWorld')>('/src/world/InteriorWorld.ts');
      const { SourceVisitors } = await load<typeof import('../../src/world/SourceVisitors')>('/src/world/SourceVisitors.ts');
      const { EventLoopYieldBudget } = await load<typeof import('../../src/util/yieldToEventLoop')>('/src/util/yieldToEventLoop.ts');
      if (composed) delete (Uint8Array as unknown as { fromBase64?: unknown }).fromBase64; // force the paced procedural path
      const captured: Array<InstanceType<typeof InteriorWorld>> = [];
      const current = () => captured[0] ?? null;
      let disposedAt = '';
      const originalBuild = InteriorWorld.prototype.buildCooperatively;
      InteriorWorld.prototype.buildCooperatively = function (this: InstanceType<typeof InteriorWorld>) {
        captured.push(this); return originalBuild.call(this);
      };
      const originalCheckpoint = EventLoopYieldBudget.prototype.checkpoint;
      let visitorCheckpoints = 0;
      EventLoopYieldBudget.prototype.checkpoint = function (this: InstanceType<typeof EventLoopYieldBudget>) {
        const stages = app.interiorLoadTelemetry.buildStageMs as Record<string, number>;
        if ('source-artwork' in stages && !('source-visitors.kit' in stages)) {
          visitorCheckpoints++;
          const target = point === 'before-first-step' ? 1 : 9;
          if ((point === 'before-first-step' || point === 'halfway') && visitorCheckpoints === target && current()) {
            current()!.dispose(); disposedAt = `checkpoint ${visitorCheckpoints}`;
          }
        }
        return originalCheckpoint.call(this);
      };
      const originalFromKit = SourceVisitors.fromKit;
      SourceVisitors.fromKit = function (...args: Parameters<typeof originalFromKit>) {
        if (point === 'registration-boundary' && current()) { current()!.dispose(); disposedAt = 'before registration'; }
        const built = originalFromKit.apply(SourceVisitors, args);
        if (point === 'after-construction' && current()) { current()!.dispose(); disposedAt = 'after construction'; }
        return built;
      };
      let failure = '';
      try { await app.ensureInteriorLoaded(); } catch (error) { failure = String((error as Error).message ?? error); }
      // Restore every patch before the legitimate second entry.
      InteriorWorld.prototype.buildCooperatively = originalBuild;
      EventLoopYieldBudget.prototype.checkpoint = originalCheckpoint;
      SourceVisitors.fromKit = originalFromKit;
      const scope = (current() as unknown as { scope: { size: number; isDisposed: boolean } } | null)?.scope;
      const controls = (app.interaction as unknown as { controls: Map<{ userData?: { kind?: string } }, unknown> }).controls;
      const visitorControls = [...controls.keys()].filter((key) => key.userData?.kind === 'visitor').length;
      await new Promise((resolve) => setTimeout(resolve, 1500)); // let any abandoned work show itself
      const controlsLater = [...controls.keys()].filter((key) => key.userData?.kind === 'visitor').length;
      return {
        disposedAt, failure, loaded: Boolean(app.interiorWorld), loadingCleared: (app as unknown as { interiorLoadingPromise: unknown }).interiorLoadingPromise === null,
        scopeDisposed: scope?.isDisposed ?? null, scopeSize: scope?.size ?? null, visitorControls, controlsLater,
        rejections: [...(win.__rejections as string[])],
      };
    }, { point, composed });

    expect(interrupted.disposedAt, 'the interruption actually fired').not.toBe('');
    expect(interrupted.loaded).toBe(false);
    expect(interrupted.loadingCleared, 'a later entry may start a fresh build').toBe(true);
    expect(interrupted.scopeDisposed).toBe(true);
    expect(interrupted.scopeSize).toBe(0);
    expect(interrupted.visitorControls, 'no half-built visitor stays interactive').toBe(0);
    expect(interrupted.controlsLater, 'no abandoned work registers visitors later').toBe(0);
    expect(interrupted.rejections, 'no unhandled promise rejection').toEqual([]);

    // A legitimate second entry builds a complete, interactive cast exactly once.
    const reentry = await page.evaluate(async () => {
      const app = window.__museum!;
      await app.ensureInteriorLoaded();
      const visitors = app.sourceVisitors!;
      const controls = (app.interaction as unknown as { controls: Map<{ userData?: { kind?: string } }, unknown> }).controls;
      const start = visitors.positions();
      visitors.update(1 / 60, true, 0, 0);
      const holdsStill = JSON.stringify(visitors.positions()) === JSON.stringify(start);
      return {
        count: visitors.count, instances: visitors.batch.instanceCount,
        visitorControls: [...controls.keys()].filter((key) => key.userData?.kind === 'visitor').length,
        interactive: visitors.snapshot().filter((s) => s.interactive).length,
        groups: app.scene.getObjectsByProperty('name', 'source-visitors').length,
        conversations: visitors.identities().every((v) => (visitors.conversation(v.id)?.lines.length ?? 0) > 0),
        holdsStill,
      };
    });
    expect(reentry).toEqual({ count: 17, instances: 327, visitorControls: 17, interactive: 17, groups: 1, conversations: true, holdsStill: true });
    expect(errors, 'no uncaught page error').toEqual([]);
  });
}

/** Boot, run a complete legitimate interior entry and summarise the cast. */
async function legitimateEntry(page: Page) {
  return page.evaluate(async () => {
    const app = window.__museum!;
    await app.ensureInteriorLoaded();
    const visitors = app.sourceVisitors!;
    const controls = (app.interaction as unknown as { controls: Map<{ userData?: { kind?: string } }, { exhibitId: string }> }).controls;
    const ids = [...controls.values()].map((entry) => entry.exhibitId);
    return {
      count: visitors.count, instances: visitors.batch.instanceCount,
      visitorControls: [...controls.keys()].filter((key) => key.userData?.kind === 'visitor').length,
      supplementaryControls: ids.filter((id) => id.startsWith('supplementary:')).length,
      supplementaryUnique: new Set(ids.filter((id) => id.startsWith('supplementary:'))).size,
      interactive: visitors.snapshot().filter((s) => s.interactive).length,
      interiors: app.scene.getObjectsByProperty('name', 'interior-world').length,
    };
  });
}
const COMPLETE = { count: 17, instances: 327, visitorControls: 17, supplementaryControls: 15, supplementaryUnique: 15, interactive: 17, interiors: 1 };

/**
 * A build that fails after the visitors (an installation or environment stage
 * throwing, or a disposal there) goes through the same InteriorWorld.dispose().
 * Every control the abandoned build registered must go, not only the visitors'.
 */
test('an interior abandoned after the cast and cases are built leaves no control of any kind behind', async ({ page }) => {
  test.setTimeout(360_000);
  const errors = await boot(page);
  const result = await page.evaluate(async () => {
    const app = window.__museum!;
    const rejections: string[] = [];
    window.addEventListener('unhandledrejection', (event) => rejections.push(String(event.reason)));
    const { EventLoopYieldBudget } = await (import(/* @vite-ignore */ '/src/util/yieldToEventLoop.ts' as string) as Promise<typeof import('../../src/util/yieldToEventLoop')>);
    const controls = (app.interaction as unknown as { controls: Map<unknown, { exhibitId: string }> }).controls;
    const before = controls.size;
    const original = EventLoopYieldBudget.prototype.checkpoint;
    let fired = false; let atFailure = 0;
    EventLoopYieldBudget.prototype.checkpoint = function (this: InstanceType<typeof EventLoopYieldBudget>) {
      const stages = app.interiorLoadTelemetry.buildStageMs as Record<string, number>;
      if (!fired && 'supplementary-cases' in stages) {
        fired = true; atFailure = controls.size;
        return Promise.reject(new Error('injected failure after the cases'));
      }
      return original.call(this);
    };
    let failure = '';
    try { await app.ensureInteriorLoaded(); } catch (error) { failure = String((error as Error).message); }
    EventLoopYieldBudget.prototype.checkpoint = original;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { before, atFailure, failure, loaded: Boolean(app.interiorWorld), leftover: [...controls.values()].map((c) => c.exhibitId).slice(before), rejections };
  });
  expect(result.failure).toBe('injected failure after the cases');
  expect(result.atFailure, 'the abandoned build really had registered controls').toBeGreaterThan(result.before + 17);
  expect(result.loaded).toBe(false);
  expect(result.leftover).toEqual([]);
  expect(result.rejections).toEqual([]);
  expect(await legitimateEntry(page)).toEqual(COMPLETE);
  expect(errors).toEqual([]);
});

/**
 * The application itself going away (App.dispose) while the interior is still
 * being prepared. The build in flight is not yet app.interiorWorld, so only the
 * application can stop it: it must never register, attach or schedule anything
 * in the disposed application. A fresh application then enters normally.
 */
for (const when of ['module-load', 'halfway', 'registration-boundary', 'after-construction', 'final-stage'] as const) {
  test(`disposing the application during interior preparation ("${when}") stops the build and a fresh entry succeeds`, async ({ page }) => {
    test.setTimeout(360_000);
    const errors = await boot(page);
    const result = await page.evaluate(async (when) => {
      const app = window.__museum!;
      const rejections: string[] = [];
      window.addEventListener('unhandledrejection', (event) => rejections.push(String(event.reason)));
      const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
      const { InteriorWorld } = await load<typeof import('../../src/world/InteriorWorld')>('/src/world/InteriorWorld.ts');
      const { SourceVisitors } = await load<typeof import('../../src/world/SourceVisitors')>('/src/world/SourceVisitors.ts');
      const { PersistentEnvironment } = await load<typeof import('../../src/world/PersistentEnvironment')>('/src/world/PersistentEnvironment.ts');
      const { EventLoopYieldBudget } = await load<typeof import('../../src/util/yieldToEventLoop')>('/src/util/yieldToEventLoop.ts');
      if (when === 'halfway') delete (Uint8Array as unknown as { fromBase64?: unknown }).fromBase64;
      let disposals = 0;
      const stop = () => { disposals++; app.dispose(); };
      const captured: Array<InstanceType<typeof InteriorWorld>> = [];
      const originalBuild = InteriorWorld.prototype.buildCooperatively;
      InteriorWorld.prototype.buildCooperatively = function (this: InstanceType<typeof InteriorWorld>) { captured.push(this); return originalBuild.call(this); };
      const originalCheckpoint = EventLoopYieldBudget.prototype.checkpoint;
      let steps = 0;
      EventLoopYieldBudget.prototype.checkpoint = function (this: InstanceType<typeof EventLoopYieldBudget>) {
        const stages = app.interiorLoadTelemetry.buildStageMs as Record<string, number>;
        if (when === 'halfway' && 'source-artwork' in stages && !('source-visitors.kit' in stages) && ++steps === 9) stop();
        return originalCheckpoint.call(this);
      };
      const originalFromKit = SourceVisitors.fromKit;
      SourceVisitors.fromKit = function (...args: Parameters<typeof originalFromKit>) {
        if (when === 'registration-boundary') stop();
        const built = originalFromKit.apply(SourceVisitors, args);
        if (when === 'after-construction') stop();
        return built;
      };
      // Nothing after this stage tracks a resource, so the scope alone cannot stop the build.
      const originalEnvironment = PersistentEnvironment.prototype.buildCooperatively;
      PersistentEnvironment.prototype.buildCooperatively = async function (this: InstanceType<typeof PersistentEnvironment>, ...args: Parameters<typeof originalEnvironment>) {
        const group = await originalEnvironment.apply(this, args);
        if (when === 'final-stage') stop();
        return group;
      };
      const pending = app.ensureInteriorLoaded().then(() => 'resolved', (error) => `rejected: ${(error as Error).message}`);
      if (when === 'module-load') stop();
      const outcome = await Promise.race([pending, new Promise<string>((resolve) => setTimeout(() => resolve('hung'), 120_000))]);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const scope = (captured[0] as unknown as { scope: { size: number; isDisposed: boolean } } | undefined)?.scope;
      const internals = app as unknown as { interiorLoadingPromise: unknown; ambientLoadTimer: number | null; interiorWarmPromise: unknown };
      const later = await app.ensureInteriorLoaded().then(() => 'resolved', () => 'rejected');
      return {
        disposals, outcome, later, loaded: Boolean(app.interiorWorld),
        controls: (app.interaction as unknown as { controls: Map<unknown, unknown> }).controls.size,
        attached: app.scene.getObjectsByProperty('name', 'interior-world').length,
        timer: internals.ambientLoadTimer, loading: internals.interiorLoadingPromise,
        scopeDisposed: scope?.isDisposed ?? null, scopeSize: scope?.size ?? null, builds: captured.length, rejections,
      };
    }, when);
    expect(result.disposals).toBe(1);
    expect(result.outcome).toMatch(/^rejected/);
    expect(result.later, 'a disposed application refuses a new interior').toBe('rejected');
    expect(result.loaded).toBe(false);
    expect(result.controls, 'no control is registered into the disposed application').toBe(0);
    expect(result.attached, 'no stale interior is attached to the disposed scene').toBe(0);
    expect(result.timer, 'no ambient timer is scheduled').toBeNull();
    expect(result.loading).toBeNull();
    expect(result.builds).toBe(when === 'module-load' ? 0 : 1);
    if (when !== 'module-load') {
      expect(result.scopeDisposed).toBe(true);
      expect(result.scopeSize).toBe(0);
    }
    expect(result.rejections).toEqual([]);
    expect(errors).toEqual([]);

    await boot(page);
    expect(await legitimateEntry(page)).toEqual(COMPLETE);
  });
}

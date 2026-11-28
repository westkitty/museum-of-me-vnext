import { expect, test, type Page } from '@playwright/test';
import type { PocketWorldId } from '../../src/world/pocket/types';
import { aimAt, bootPreview, evidenceDir, persistentPassportRaw, placeInMuseum } from './helpers/world-journey';
import { keyboardVisitor, type Visitor } from './helpers/visitor';
import { APPROACHES } from './helpers/natural-approach';
import { l01Route, w09Route, w10Route } from './helpers/routes';

/**
 * V7 Workstream H: one long session in a single page, the way a visitor who
 * stays all afternoon uses the museum. Two passes over six worlds of different
 * kinds: W01 (music), W02 (traversal), W03 (moving geometry), W09, W10 and L01.
 *
 * Pass 1 completes W09, W10 (opened by the stamp W09 just earned) and L01 by
 * their own routes, leaves W01, W02 and W03 early, and meets a failed and an
 * interrupted world load through the real entry dialog. Pass 2 re-enters all
 * six and leaves each early. After every return a ledger records renderer
 * resources, pocket roots, music sessions, freezes, UI capture, DOM size and
 * the JS heap after a forced garbage collection.
 *
 * DIAGNOSTIC: the visitor is placed at each entrance's approach point
 * (placeInMuseum) so the session spends its time in the worlds, not on the
 * island paths; the authentic walks are proven by worlds-natural-approach and
 * worlds-museum-approach. Failures are injected by swapping a world's loader in
 * the registry (the preview build has no separate world download to cut);
 * the network-level failure is proven by the rehearsal suite. Entering,
 * leaving, retrying and cancelling all go through the visible dialog and the
 * Back button with real keys.
 */
const DIR = evidenceDir('long-session');

interface Ledger {
  label: string; world: string; geometries: number; textures: number; programs: number; pocketRoots: number;
  music: number; frozen: boolean; uiCaptured: boolean; earned: number; dom: number; heapMB: number;
}

async function ledger(page: Page, label: string, book: Ledger[]): Promise<Ledger> {
  await page.waitForTimeout(1200); // let the return transition settle
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.detach();
  const entry = await page.evaluate((l) => {
    const app = window.__museum!;
    const info = app.renderer.renderer.info;
    return {
      label: l,
      world: String(app.activeWorld),
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      pocketRoots: app.scene.children.filter((c) => c.name.startsWith('pocket-world:')).length,
      music: app.audio.activeMusicSessionCount,
      frozen: app.player.isFrozen,
      uiCaptured: app.input.uiCaptured,
      earned: app.passport.earnedCount,
      dom: document.getElementsByTagName('*').length,
      heapMB: Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1e5) / 10,
    };
  }, label);
  book.push(entry);
  console.log(JSON.stringify(entry));
  return entry;
}

function expectClean(e: Ledger): void {
  expect(e.world, e.label).toBe('exterior');
  expect(e.pocketRoots, `${e.label}: pocket roots`).toBe(0);
  expect(e.music, `${e.label}: music sessions`).toBe(0);
  expect(e.frozen, `${e.label}: frozen`).toBe(false);
  expect(e.uiCaptured, `${e.label}: UI capture`).toBe(false);
}

/** The DIAGNOSTIC placements the per-world journeys already use (position, yaw, pitch). */
const PLACEMENT: Record<'W01' | 'W02' | 'W03' | 'W09' | 'W10' | 'L01', readonly [readonly [number, number, number], number, number]> = {
  W01: [[53.5, -0.5, 4], -Math.PI / 2, -0.15],
  W02: [[-138.2, -0.5, -5.1], -Math.PI / 2, -0.2],
  W03: [[-37.4, -0.3, 134], -Math.PI / 2, -0.25],
  W09: [[88, 2.5, 100.5], 0, 0],
  W10: [[2, -0.5, 197], -Math.PI / 4, 0],
  L01: [[174.5, 11.5, 152], -Math.PI / 2, 0.16],
};

/** DIAGNOSTIC placement at the entrance, then a real aim at it. */
async function atEntrance(page: Page, id: keyof typeof PLACEMENT): Promise<void> {
  const [at, yaw, pitch] = PLACEMENT[id];
  await placeInMuseum(page, at, yaw, pitch);
  await aimAt(page, APPROACHES[id].aim, APPROACHES[id].anchorId);
}

async function enterAndLeave(page: Page, v: Visitor, id: keyof typeof PLACEMENT, stayMs: number): Promise<void> {
  await atEntrance(page, id);
  await v.enterFromAnchor(APPROACHES[id].title, id);
  await page.waitForTimeout(stayMs);
  await v.pressButton('Back to Museum');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
}

/** Swap a world's loader (DIAGNOSTIC fault injection); returns a restore function. */
async function injectLoad(page: Page, id: PocketWorldId, mode: 'reject' | 'slow'): Promise<() => Promise<void>> {
  await page.evaluate(([worldId, how]) => {
    const app = window.__museum!;
    const w = window as unknown as { __v7OriginalLoad?: Record<string, unknown> };
    w.__v7OriginalLoad ??= {};
    const original = app.pocketRegistry.get(worldId as PocketWorldId)!.load!;
    w.__v7OriginalLoad[worldId] = original;
    app.pocketRegistry.registerWorld(worldId as PocketWorldId, {
      readiness: 'verified',
      load: how === 'reject'
        ? () => Promise.reject(new Error('V7 diagnostic load rejection'))
        : async (ctx, signal) => { await new Promise((r) => setTimeout(r, 6000)); return original(ctx, signal); },
    });
  }, [id, mode] as const);
  return () => page.evaluate((worldId) => {
    const app = window.__museum!;
    const original = (window as unknown as { __v7OriginalLoad: Record<string, never> }).__v7OriginalLoad[worldId];
    app.pocketRegistry.registerWorld(worldId as PocketWorldId, { readiness: 'verified', load: original });
  }, id);
}

test('one long session: completions, early exits, a failed and an interrupted load, then every world again', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errors = await bootPreview(page, 'w01,w02,w03,w09,w10,l01');
  const v = keyboardVisitor(page);
  const book: Ledger[] = [];
  const passportBefore = await persistentPassportRaw(page);
  const start = await ledger(page, 'start', book);
  expectClean(start);

  // ── Pass 1 ────────────────────────────────────────────────────────────────
  await enterAndLeave(page, v, 'W01', 4000); // left with its music playing
  expectClean(await ledger(page, 'pass 1: W01 left early', book));
  await enterAndLeave(page, v, 'W02', 3000);
  expectClean(await ledger(page, 'pass 1: W02 left early', book));
  await enterAndLeave(page, v, 'W03', 5000); // its gears and platforms keep moving while the visitor stays
  expectClean(await ledger(page, 'pass 1: W03 left early', book));

  // A failed load through the dialog: nothing opens, the dialog keeps focus, Esc gives control back.
  const restoreW02 = await injectLoad(page, 'W02', 'reject');
  await atEntrance(page, 'W02');
  await v.interact();
  const w02 = page.getByRole('dialog', { name: APPROACHES.W02.title });
  await expect(w02).toBeVisible();
  await w02.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect(w02).toContainText('Passage did not open. You remain safely in the museum.', { timeout: 30_000 });
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(w02).toBeHidden();
  await restoreW02();
  expectClean(await ledger(page, 'pass 1: W02 failed load dismissed', book));

  // An interrupted load: the visitor cancels while the world is still opening; it must not open later.
  const restoreW03 = await injectLoad(page, 'W03', 'slow');
  await atEntrance(page, 'W03');
  await v.interact();
  const w03 = page.getByRole('dialog', { name: APPROACHES.W03.title });
  await expect(w03).toBeVisible();
  await w03.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect(w03.getByRole('button', { name: 'Opening…' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(w03).toBeHidden();
  await page.waitForTimeout(8000); // past the slow loader's resolution
  await restoreW03();
  expectClean(await ledger(page, 'pass 1: W03 interrupted load', book));

  // Completions by each world's own route.
  await atEntrance(page, 'W09');
  await v.enterFromAnchor(APPROACHES.W09.title, 'W09');
  await w09Route(page, v, false);
  expectClean(await ledger(page, 'pass 1: W09 completed', book));
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W09'))).toBe(true);
  await atEntrance(page, 'W10'); // opened by the stamp just earned
  await v.enterFromAnchor(APPROACHES.W10.title, 'W10');
  await w10Route(page, v, false);
  expectClean(await ledger(page, 'pass 1: W10 completed', book));
  await atEntrance(page, 'L01');
  await v.enterFromAnchor(APPROACHES.L01.title, 'L01');
  await l01Route(page, v, false);
  const endPass1 = await ledger(page, 'pass 1: L01 completed', book);
  expectClean(endPass1);
  const earned = endPass1.earned;

  // ── Pass 2: every world again, each left early ───────────────────────────
  for (const id of ['W01', 'W02', 'W03', 'W09', 'W10', 'L01'] as const) {
    await enterAndLeave(page, v, id, 3000);
    const e = await ledger(page, `pass 2: ${id} left early`, book);
    expectClean(e);
    expect(e.earned, `${e.label}: no stamp from an early exit`).toBe(earned);
  }
  await page.screenshot({ path: `${DIR}/end-of-session.png` });

  // Same spot (the L01 lens) at the end of each pass: nothing accumulated.
  await atEntrance(page, 'L01');
  const endPass2 = await ledger(page, 'pass 2: back at the L01 lens', book);
  expect(endPass2.geometries, 'geometries vs end of pass 1').toBeLessThanOrEqual(endPass1.geometries);
  expect(endPass2.textures, 'textures vs end of pass 1').toBeLessThanOrEqual(endPass1.textures);
  expect(endPass2.programs, 'shader programs vs end of pass 1').toBeLessThanOrEqual(endPass1.programs);
  expect(endPass2.dom - endPass1.dom, 'DOM growth (elements)').toBeLessThanOrEqual(20);
  expect(endPass2.heapMB - endPass1.heapMB, 'heap growth after GC (MB)').toBeLessThanOrEqual(5);

  test.info().annotations.push({ type: 'ledger', description: JSON.stringify(book) });
  expect(await persistentPassportRaw(page), 'preview visits never write the persistent passport').toBe(passportBefore);
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from '@playwright/test';
import { persistentPassportRaw, pose } from '../browser/helpers/world-journey';
import { keyboardVisitor } from '../browser/helpers/visitor';
import { APPROACHES, expectAtPierStart, walkBackToPier, walkToEntrance } from '../browser/helpers/natural-approach';
import { w09Route, w10Route } from '../browser/helpers/routes';
import { POCKET_PROMOTION_ORDER } from '../../src/world/pocket/productionWorlds';

/**
 * Production-activation rehearsals of staged release and progression, on the
 * rehearsal build (see playwright.rehearsal.config.ts; never a release
 * artifact). Storage is the fresh Playwright context's own localStorage on
 * 127.0.0.1:4193, so the owner's real passport is never read or written.
 */
const WORLD_CHUNK = /\/assets\/(create(W\d\d|L01)World|w01-(bass|drums|other))-[^/]+\.(js|m4a)$/;

async function boot(page: Page, query: string, requests: string[] = []): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  await page.goto(`/?qa=1${query}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), undefined, { timeout: 120_000 });
  await page.evaluate(() => { const app = window.__museum!; app.dismissArrival(); app.ui.hud.completeArrival(); });
  return errors;
}

const verifiedIds = (page: Page) => page.evaluate(() => window.__museum!.pocketRegistry.list()
  .filter((d) => d.readiness === 'verified').map((d) => d.id));
const backInMuseum = (page: Page) => expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');

test('staged release prefixes activate exactly the promotion-order prefix and nothing is fetched until entry', async ({ page }) => {
  for (const n of [0, 1, 6, 9, 10, 11]) {
    const requests: string[] = [];
    const errors = await boot(page, `&rehearsalPrefix=${n}`, requests);
    if (n > 0) {
      await page.waitForFunction((id) => window.__museum!.pocketRegistry.get(id as never)?.readiness === 'verified',
        POCKET_PROMOTION_ORDER[n - 1], { timeout: 60_000 });
    }
    await page.waitForTimeout(2500);
    expect(await verifiedIds(page), `prefix ${n}`).toEqual(POCKET_PROMOTION_ORDER.slice(0, n));
    const gate = await page.evaluate(() => {
      const app = window.__museum!; const r = app.pocketRegistry;
      return { w06: r.canEnter('W06', app.passport).ok, l01: r.canEnter('L01', app.passport).ok, w10: r.canEnter('W10', app.passport) };
    });
    expect(gate.w06, `prefix ${n}: W06 opens on its own once promoted`).toBe(n >= 6);
    expect(gate.l01, `prefix ${n}: L01 needs no stamp once promoted`).toBe(n >= 10);
    expect(gate.w10.ok, `prefix ${n}: W10 stays shut without an earned stamp`).toBe(false);
    if (n === 11) expect(gate.w10).toMatchObject({ reason: 'locked-stamps' });
    expect(requests.filter((p) => WORLD_CHUNK.test(p)), `prefix ${n}: an ordinary visit fetches no world`).toEqual([]);
    expect(errors).toEqual([]);
  }
});

test('progression on foot in the production build: W10 locked, W09 earned, W10 opened and completed, and both survive a reload', async ({ page }) => {
  test.setTimeout(900_000);
  const requests: string[] = [];
  const errors = await boot(page, '&rehearsalObserve=1', requests);
  await page.waitForFunction(() => window.__museum!.pocketRegistry.get('W10')?.readiness === 'verified', undefined, { timeout: 60_000 });
  const v = keyboardVisitor(page);
  await expectAtPierStart(page);
  expect(await page.evaluate(() => window.__museum!.pocketRegistry.canEnter('W10', window.__museum!.passport)))
    .toMatchObject({ ok: false, reason: 'locked-stamps' });
  expect(await page.evaluate(() => window.__museum!.exteriorWorld.weaselPierGuide.group.visible)).toBe(false);

  await walkToEntrance(v, 'W09');
  await v.enterFromAnchor(/Museum Between Seconds/i, 'W09');
  expect(requests.some((p) => /\/assets\/createW09World-/.test(p)), 'W09 is fetched on first entry').toBe(true);
  await w09Route(page, v, false);
  const afterW09 = JSON.parse((await persistentPassportRaw(page)) ?? '{}') as { stamps?: Record<string, unknown> };
  expect(Object.keys(afterW09.stamps ?? {})).toEqual(['W09']);

  await walkBackToPier(v, 'W09');
  await expect.poll(() => page.evaluate(() => window.__museum!.exteriorWorld.weaselPierGuide.group.visible)).toBe(true);
  await walkToEntrance(v, 'W10');
  await v.enterFromAnchor(APPROACHES.W10.title, 'W10');
  await w10Route(page, v, false);
  const back = await pose(page);
  expect(Math.hypot(back.x - 2, back.z - 197)).toBeLessThan(1.5);
  const afterW10 = JSON.parse((await persistentPassportRaw(page)) ?? '{}') as { stamps?: Record<string, unknown> };

  // A later visit (same browser, same storage): the earned stamps persist, unchanged, and W10 stays open.
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum) && window.__museum!.pocketRegistry.get('W10')?.readiness === 'verified',
    undefined, { timeout: 120_000 });
  const later = await page.evaluate(() => ({
    w09: window.__museum!.passport.hasStamp('W09'),
    w10Open: window.__museum!.pocketRegistry.canEnter('W10', window.__museum!.passport).ok,
    earned: window.__museum!.passport.earnedCount,
  }));
  expect(later.w09).toBe(true);
  expect(later.w10Open).toBe(true);
  expect(later.earned).toBe(Object.keys(afterW10.stamps ?? {}).length);
  console.log(JSON.stringify({ stampsAfterW09: Object.keys(afterW09.stamps ?? {}), stampsAfterW10: Object.keys(afterW10.stamps ?? {}), later }));
  expect(errors).toEqual([]);
});

test('a failed world download leaves the visitor safely in the museum and a second try opens it; an interrupted one stays interrupted', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = await boot(page, '');
  await page.waitForFunction(() => window.__museum!.pocketRegistry.get('W10')?.readiness === 'verified', undefined, { timeout: 60_000 });
  const v = keyboardVisitor(page);
  const state = () => page.evaluate(() => {
    const app = window.__museum!;
    return {
      world: String(app.activeWorld),
      roots: app.scene.children.filter((c) => c.name.startsWith('pocket-world:')).length,
      frozen: app.player.isFrozen,
    };
  });

  // Failed download: the W08 chunk request fails on the network.
  await page.route(/\/assets\/createW08World-[^/]+\.js$/, (route) => route.abort('internetdisconnected'));
  await walkToEntrance(v, 'W08');
  await v.interact();
  const dialog = page.getByRole('dialog', { name: /World Inside a Raindrop/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect(dialog).toContainText('Passage did not open. You remain safely in the museum.', { timeout: 30_000 });
  // Nothing opened; the still-open dialog holds input, as every open dialog does.
  expect(await state()).toEqual({ world: 'exterior', roots: 0, frozen: true });
  // Keyboard focus stays in the dialog, on the retry action, so Esc and Tab still work.
  const focus = await page.evaluate(() => ({ text: document.activeElement instanceof HTMLButtonElement ? document.activeElement.textContent : document.activeElement?.tagName ?? null,
    inDialog: Boolean(document.activeElement?.closest('[role="dialog"]')) }));
  console.log(JSON.stringify({ focusAfterFailedLoad: focus }));
  expect(focus).toEqual({ text: 'Enter', inDialog: true });
  // Closing it hands control straight back: the failed load leaks no capture.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await state()).toEqual({ world: 'exterior', roots: 0, frozen: false });
  expect(await page.evaluate(() => window.__museum!.input.uiCaptured)).toBe(false);
  // The network returns: the visitor tries again from the same spot and the world opens.
  await page.unroute(/\/assets\/createW08World-[^/]+\.js$/);
  await v.interact();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('pocket:W08');
  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await backInMuseum(page);

  // Interrupted download: the visitor changes their mind while the W03 chunk is still arriving.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\/assets\/createW03World-[^/]+\.js$/, async (route) => { await held; await route.continue(); });
  await walkBackToPier(v, 'W08');
  await walkToEntrance(v, 'W03');
  await v.interact();
  const w03 = page.getByRole('dialog', { name: /Clockwork Sundial/i });
  await expect(w03).toBeVisible();
  await w03.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect(w03.getByRole('button', { name: 'Opening…' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(w03).toBeHidden();
  release();
  await page.waitForTimeout(4000); // the late chunk arrives after the visitor left; nothing may open
  expect(await state()).toEqual({ world: 'exterior', roots: 0, frozen: false });
  await page.unroute(/\/assets\/createW03World-[^/]+\.js$/);
  await v.aimAt(APPROACHES.W03.aim, APPROACHES.W03.anchorId);
  await v.enterFromAnchor(/Clockwork Sundial/i, 'W03');
  await page.getByRole('button', { name: 'Back to Museum' }).click();
  await backInMuseum(page);
  expect(await state()).toEqual({ world: 'exterior', roots: 0, frozen: false });
  expect(await page.evaluate(() => window.__museum!.passport.earnedCount)).toBe(0);
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from '@playwright/test';
import { bootPreview, evidenceDir, persistentPassportRaw, pose } from './helpers/world-journey';
import { expectTouchAffordances, keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';
import { APPROACHES, expectAtPierStart, walkBackToPier, walkToEntrance } from './helpers/natural-approach';
import { l01Route, w09Route, w10Route } from './helpers/routes';

/**
 * Long, cross-world visits as a visitor makes them: every visit starts on the
 * arrival pier and every entrance is reached on foot along the island paths
 * (no placement, no teleport, no diagnostic stamp). Worlds are completed or
 * left early only through their own controls and the visible Back button. A
 * ledger after each return records renderer resources, pocket roots, music
 * sessions, freezes, UI capture and stamps.
 */

interface LedgerEntry {
  label: string; world: string; geometries: number; textures: number; programs: number; pocketRoots: number;
  music: number; frozen: boolean; uiCaptured: boolean; earned: number; bonus: boolean; heapMB: number;
}

async function ledger(page: Page, label: string, into: LedgerEntry[]): Promise<LedgerEntry> {
  await page.waitForTimeout(1200); // let the return transition settle
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
      bonus: app.passport.hasBonusCompleted(),
      heapMB: Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1e5) / 10,
    };
  }, label);
  into.push(entry);
  return entry;
}

/** Back in the museum, nothing of the world is left and the visitor is free to walk. */
function expectCleanReturn(entry: LedgerEntry): void {
  expect(entry.world, entry.label).toBe('exterior');
  expect(entry.pocketRoots, entry.label).toBe(0);
  expect(entry.music, `${entry.label}: music sessions`).toBe(0);
  expect(entry.frozen, entry.label).toBe(false);
  expect(entry.uiCaptured, entry.label).toBe(false);
}

/** The world's resources are released: back at the same spot, no more geometry or texture than just before entering. */
function expectReleased(before: LedgerEntry, after: LedgerEntry): void {
  expect(after.geometries, `${after.label}: geometries vs ${before.label}`).toBeLessThanOrEqual(before.geometries);
  expect(after.textures, `${after.label}: textures vs ${before.label}`).toBeLessThanOrEqual(before.textures);
}

const canEnterW10 = (page: Page) => page.evaluate(() => window.__museum!.pocketRegistry.canEnter('W10', window.__museum!.passport));

async function earnedProgression(page: Page, makeVisitor: (page: Page) => Promise<Visitor>, dir: string): Promise<LedgerEntry[]> {
  const book: LedgerEntry[] = [];
  const errors = await bootPreview(page, 'w09,w10,l01');
  const v = await makeVisitor(page);
  await expectAtPierStart(page);
  const passportBefore = await persistentPassportRaw(page);
  expect(await canEnterW10(page)).toMatchObject({ ok: false, reason: 'locked-stamps' });

  // W09, on foot from the pier, completed through its own route.
  await walkToEntrance(v, 'W09');
  await v.enterFromAnchor(APPROACHES.W09.title, 'W09');
  await w09Route(page, v, `${dir}/w09`);
  expectCleanReturn(await ledger(page, 'after W09 completed', book));
  expect(await canEnterW10(page)).toMatchObject({ ok: true });

  // Back down the hill to the pier, where the earned stamp now opens W10.
  await walkBackToPier(v, 'W09');
  await walkToEntrance(v, 'W10');
  await page.screenshot({ path: `${dir}/w10-pier-unlocked-by-earned-stamp.png` });
  await v.enterFromAnchor(APPROACHES.W10.title, 'W10');
  await w10Route(page, v, `${dir}/w10`);
  const afterW10 = await ledger(page, 'after W10 completed', book);
  expectCleanReturn(afterW10);
  const back = await pose(page);
  expect(Math.hypot(back.x - 2, back.z - 197), 'W10 returns the visitor to the pier anchor').toBeLessThan(1.5);
  expect(await page.evaluate(() => window.__museum!.passport.hasStamp('W09'))).toBe(true);

  // L01 twice in a row: the bonus completes, no stamp is ever added.
  await walkToEntrance(v, 'L01');
  const atL01 = await ledger(page, 'at L01 lens', book);
  for (const round of [1, 2]) {
    if (round === 2) await v.aimAt(APPROACHES.L01.aim, APPROACHES.L01.anchorId);
    await v.enterFromAnchor(APPROACHES.L01.title, 'L01');
    await l01Route(page, v, round === 1 ? `${dir}/l01` : false);
    const e = await ledger(page, `after L01 completed (${round})`, book);
    expectCleanReturn(e);
    expect(e.earned, `${e.label}: L01 never stamps`).toBe(afterW10.earned);
    expect(e.bonus).toBe(true);
    expect(await page.evaluate(() => window.__museum!.passport.hasStamp('L01'))).toBe(false);
    expectReleased(atL01, e);
  }

  expect(await persistentPassportRaw(page), 'preview visits never write the persistent passport').toBe(passportBefore);
  expect(errors).toEqual([]);
  return book;
}

test('earned progression on foot (keyboard): W09 completed, W10 opened by that stamp and completed, L01 completed twice without a stamp', async ({ page }) => {
  test.setTimeout(900_000);
  const book = await earnedProgression(page, async (p) => keyboardVisitor(p), evidenceDir('session-keyboard'));
  test.info().annotations.push({ type: 'ledger', description: JSON.stringify(book) });
  console.info('[session-keyboard ledger]', JSON.stringify(book));
});

test('early exits redirect cleanly (keyboard): W08 left at once, W03 left mid-visit, W01 left with its music playing, then W08 again', async ({ page }) => {
  test.setTimeout(900_000);
  const book: LedgerEntry[] = [];
  const errors = await bootPreview(page, 'w08,w03,w01');
  const v = keyboardVisitor(page);
  await expectAtPierStart(page);
  const passportBefore = await persistentPassportRaw(page);

  await walkToEntrance(v, 'W08');
  const atW08 = await ledger(page, 'at W08 entrance', book);
  await v.enterFromAnchor(APPROACHES.W08.title, 'W08');
  await v.pressButton('Back to Museum');
  const firstW08 = await ledger(page, 'W08 left at once', book);
  expectCleanReturn(firstW08);
  expectReleased(atW08, firstW08);

  await walkBackToPier(v, 'W08');
  await walkToEntrance(v, 'W03');
  const atW03 = await ledger(page, 'at W03 entrance', book);
  await v.enterFromAnchor(APPROACHES.W03.title, 'W03');
  const inside = await pose(page);
  await v.walkTo(inside.x, inside.z - 4, { tolerance: 0.8 });
  await v.pressButton('Back to Museum');
  const leftW03 = await ledger(page, 'W03 left mid-visit', book);
  expectCleanReturn(leftW03);
  expectReleased(atW03, leftW03);

  await walkBackToPier(v, 'W03');
  await walkToEntrance(v, 'W01');
  const atW01 = await ledger(page, 'at W01 entrance', book);
  await v.enterFromAnchor(APPROACHES.W01.title, 'W01');
  await expect.poll(() => page.evaluate(() => window.__museum!.audio.activeMusicSessionCount), { timeout: 20_000 })
    .toBeGreaterThan(0);
  await page.waitForTimeout(2500);
  await v.pressButton('Back to Museum');
  await expect.poll(() => page.evaluate(() => window.__museum!.audio.activeMusicSessionCount), { timeout: 10_000 }).toBe(0);
  const leftW01 = await ledger(page, 'W01 left with music playing', book);
  expectCleanReturn(leftW01);
  expectReleased(atW01, leftW01);

  await walkBackToPier(v, 'W01');
  await walkToEntrance(v, 'W08');
  const atW08Again = await ledger(page, 'at W08 entrance again', book);
  await v.enterFromAnchor(APPROACHES.W08.title, 'W08');
  await v.pressButton('Back to Museum');
  const secondW08 = await ledger(page, 'W08 again', book);
  expectCleanReturn(secondW08);
  expectReleased(atW08Again, secondW08);

  for (const e of book) expect(e.earned, `${e.label}: an early exit never stamps`).toBe(0);
  expect(await page.evaluate(() => ({ w08: window.__museum!.passport.hasStamp('W08'), w03: window.__museum!.passport.hasStamp('W03'), w01: window.__museum!.passport.hasStamp('W01') })))
    .toEqual({ w08: false, w03: false, w01: false });
  expect(await persistentPassportRaw(page)).toBe(passportBefore);
  expect(errors).toEqual([]);
  console.info('[session-early-exit ledger]', JSON.stringify(book));
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('earned progression on foot (touch): W09 completed, W10 opened by that stamp and completed, L01 completed twice without a stamp', async ({ page }) => {
    test.setTimeout(1_500_000);
    const book = await earnedProgression(page, touchVisitor, evidenceDir('session-touch'));
    await expectTouchAffordances(page);
    console.info('[session-touch ledger]', JSON.stringify(book));
  });
});

import { expect, test } from '@playwright/test';
import { bootPreview, evidenceDir, persistentPassportRaw } from './helpers/world-journey';
import { keyboardVisitor, touchVisitor, type Visitor } from './helpers/visitor';
import { expectAtPierStart } from './helpers/natural-approach';
import { MUSEUM_APPROACHES, walkToMuseumEntrance, type MuseumApproachId } from './helpers/museum-approach';

/**
 * V7 Workstream D: the interior (W04, W07) and rooftop (W05, W06, W10 roof)
 * entrances are reached on foot from the arrival pier. The visitor walks in
 * through the front door and along the museum's authored passages, or up the
 * West Flank Ascent ramps onto the roof, with the real keyboard (or touch),
 * controller and collision world. No placement, no teleport, no direct world
 * switch: the visitor stands where every visit starts. Entering, then Back,
 * proves the anchor works from there and returns the visitor to the museum.
 */
const DIR = evidenceDir('museum-approach');
const ids: MuseumApproachId[] = ['W04', 'W07', 'W05', 'W06', 'W10_ROOF'];

async function journey(page: import('@playwright/test').Page, v: Visitor, id: MuseumApproachId, errors: string[]): Promise<void> {
  const a = MUSEUM_APPROACHES[id];
  await expectAtPierStart(page);
  const before = await persistentPassportRaw(page);
  const started = Date.now();
  await walkToMuseumEntrance(page, v, id);
  test.info().annotations.push({ type: 'walk', description: `${id} (${v.kind}): ${((Date.now() - started) / 1000).toFixed(0)} s on foot` });
  await page.screenshot({ path: `${DIR}/${id.toLowerCase()}-${v.kind}-entrance.png` });
  await v.enterFromAnchor(a.title, a.id);
  await v.pressButton('Back to Museum');
  const home = a.indoor ? 'interior' : 'exterior';
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe(home);
  expect(await persistentPassportRaw(page)).toBe(before);
  expect(errors).toEqual([]);
}

const previewFor = (id: MuseumApproachId) => (id === 'W10_ROOF' ? 'w09,w10' : id.toLowerCase());

for (const id of ids) {
  test(`${id} entrance is reached on foot from the arrival pier (keyboard)`, async ({ page }) => {
    test.setTimeout(480_000);
    const errors = await bootPreview(page, previewFor(id));
    if (id === 'W10_ROOF') {
      // W10 is stamp-locked; the earned unlock is proven by the cross-world session. DIAGNOSTIC stamp here.
      await page.evaluate(() => window.__museum!.passport.recordExit('W09', true));
    }
    await journey(page, keyboardVisitor(page), id, errors);
  });
}

test.describe('touch input', () => {
  test.use({ hasTouch: true });
  for (const id of ['W04', 'W05'] as const) {
    test(`${id} entrance is reached on foot from the arrival pier (touch)`, async ({ page }) => {
      test.setTimeout(600_000);
      const errors = await bootPreview(page, previewFor(id));
      await journey(page, await touchVisitor(page), id, errors);
    });
  }
});

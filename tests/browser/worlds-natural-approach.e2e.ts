import { expect, test } from '@playwright/test';
import { bootPreview, evidenceDir, persistentPassportRaw } from './helpers/world-journey';
import { keyboardVisitor } from './helpers/visitor';
import { APPROACHES, expectAtPierStart, walkToEntrance, type ApproachId } from './helpers/natural-approach';

/**
 * Every ground-level world entrance is reached on foot from the arrival pier
 * along the island's authored paths, with the real keyboard, controller and
 * collision world. No placement, no teleport: the visitor stands where every
 * visit starts. Entering, then Back, proves the anchor works from there.
 */
const DIR = evidenceDir('natural-approach');
const ids: ApproachId[] = ['W10', 'W08', 'W09', 'L01', 'W01', 'W03', 'W02'];

for (const id of ids) {
  test(`${id} entrance is reached on foot from the arrival pier`, async ({ page }) => {
    test.setTimeout(360_000);
    const errors = await bootPreview(page, id.toLowerCase() === 'w10' ? 'w09,w10' : id.toLowerCase());
    if (id === 'W10') {
      // W10 is stamp-locked; the earned unlock is proven by the cross-world session. DIAGNOSTIC stamp here.
      await page.evaluate(() => window.__museum!.passport.recordExit('W09', true));
    }
    await expectAtPierStart(page);
    const v = keyboardVisitor(page);
    const before = await persistentPassportRaw(page);
    const started = Date.now();
    await walkToEntrance(v, id);
    test.info().annotations.push({ type: 'walk', description: `${id}: ${((Date.now() - started) / 1000).toFixed(0)} s on foot` });
    await page.screenshot({ path: `${DIR}/${id.toLowerCase()}-entrance.png` });
    await v.enterFromAnchor(APPROACHES[id].title, id);
    await v.pressButton('Back to Museum');
    await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
    expect(await persistentPassportRaw(page)).toBe(before);
    expect(errors).toEqual([]);
  });
}

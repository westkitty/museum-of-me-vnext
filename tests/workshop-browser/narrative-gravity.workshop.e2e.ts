import { expect, test } from '@playwright/test';

type Vec = [number, number, number];
interface Builder {
  refresh(): void;
  placements: { setRecord(record: unknown): unknown; getRecord(id: string): { position: Vec } | null };
}

test('Narrative Gravity reads E03 and E13 as NO CHANGE, then clears a live sightline blocker only on approval, undoably', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await page.waitForFunction(() => Boolean(window.__museumWorkshop), null, { timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window.__museum as unknown as { museum?: unknown }).museum), null, { timeout: 90_000 });

  const panel = page.locator('.museum-workshop');
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  const status = panel.locator('[data-workshop="gravity-status"]');
  for (const exhibit of ['E03', 'E13']) {
    await panel.locator('[data-workshop="gravity-exhibit"]').selectOption(exhibit);
    await panel.locator('[data-workshop="gravity-run"]').click();
    await expect(status).toHaveAttribute('data-gravity-verdict', 'NO CHANGE');
    await expect(status).toContainText(`${exhibit}: NO CHANGE`);
    await expect(panel.locator('[data-gravity-suggestion]')).toHaveCount(0);
    await expect(panel.locator('[data-gravity-preserved]')).toContainText(`${exhibit} hero object`);
  }

  // A tall sign saved validly in the E03 bay, then dragged live into the visitor's view of the hero.
  const spots = await page.evaluate(async () => {
    const load = (url: string) => import(/* @vite-ignore */ url);
    const layout = await load('/src/world/layout.ts') as typeof import('../../src/world/layout');
    const conservation = await load('/src/workshop/conservation.ts') as typeof import('../../src/workshop/conservation');
    const bay = layout.PLACEMENTS.find((item) => item.exhibitId === 'E03')!;
    const record = (position: Vec) => ({ id: 'view-plinth', label: 'View sign', prefab: 'sign-post', anchor: 'floor', position,
      rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'interior' });
    let valid: Vec | null = null;
    for (let x = bay.bounds.c[0] - bay.bounds.h[0] + 1; x <= bay.bounds.c[0] + bay.bounds.h[0] - 1 && !valid; x += 0.5) {
      for (let z = bay.bounds.c[2] - bay.bounds.h[2] + 1; z <= bay.bounds.c[2] + bay.bounds.h[2] - 1 && !valid; z += 0.5) {
        const p: Vec = [x, bay.anchor[1], z];
        if (conservation.validateWorkshopManifestForMuseum({ schemaVersion: 2, objects: [record(p)] }, []).ok) valid = p;
      }
    }
    const blocking: Vec = [(bay.visitorSpot[0] + bay.anchor[0]) / 2, bay.anchor[1], (bay.visitorSpot[2] + bay.anchor[2]) / 2];
    return { valid, blocking, record: valid ? record(valid) : null };
  });
  expect(spots.valid).not.toBeNull();
  await page.evaluate((record) => {
    const builder = window.__museumWorkshop as unknown as Builder;
    builder.placements.setRecord(record);
    builder.refresh();
  }, spots.record);
  await panel.locator('[data-workshop="outliner"]').getByRole('button', { name: /View sign/ }).click();
  for (const [field, value] of [['px', spots.blocking[0]], ['pz', spots.blocking[2]]] as const) {
    await panel.locator(`[data-workshop="${field}"]`).fill(String(value));
    await panel.locator(`[data-workshop="${field}"]`).blur();
  }
  const position = () => page.evaluate(() => (window.__museumWorkshop as unknown as Builder).placements.getRecord('view-plinth')?.position);
  await expect.poll(async () => (await position())?.[0]).toBeCloseTo(spots.blocking[0], 2);

  await panel.locator('[data-workshop="gravity-exhibit"]').selectOption('E03');
  await panel.locator('[data-workshop="gravity-run"]').click();
  await expect(status).toHaveAttribute('data-gravity-verdict', 'SUGGESTIONS');
  const row = panel.locator('[data-gravity-suggestion="view-plinth"]');
  await expect(row).toContainText('Clears the sightline to E03');

  // Preview changes nothing.
  await row.locator('[data-gravity-action="preview"]').click();
  expect((await position())![0]).toBeCloseTo(spots.blocking[0], 2);

  await row.locator('[data-gravity-action="approve"]').click();
  await expect(status).toHaveAttribute('data-gravity-verdict', 'NO CHANGE');
  const moved = (await position())!;
  expect(Math.hypot(moved[0] - spots.blocking[0], moved[2] - spots.blocking[2])).toBeGreaterThan(0.4);
  expect(moved[1]).toBeCloseTo(spots.blocking[1], 4);

  // One undo restores the blocker exactly.
  await panel.locator('[data-workshop="undo"]').click();
  await expect.poll(async () => (await position())?.[2]).toBeCloseTo(spots.blocking[2], 2);
  expect((await position())![0]).toBeCloseTo(spots.blocking[0], 2);
  expect(errors).toEqual([]);
});

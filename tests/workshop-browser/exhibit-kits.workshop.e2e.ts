import { expect, test } from '@playwright/test';

type Vec = [number, number, number];
interface Builder {
  placements: {
    captureManifest(): { objects: { id: string; position: Vec }[]; kits?: { id: string; position: Vec; members: { slot: string; id: string }[] }[] };
    replaceManifest(manifest: unknown): unknown;
    objectCount: number;
    residentCount: number;
  };
}

test('Exhibit Kits move as a parent, duplicate, reset, delete and undo through the real Workshop', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await page.waitForFunction(() => Boolean(window.__museumWorkshop), null, { timeout: 60_000 });

  // Place the Archive Research Station at a known open exterior spot using the real kit module.
  await page.evaluate(async () => {
    const load = (url: string) => import(/* @vite-ignore */ url);
    const kits = await load('/src/workshop/ExhibitKits.ts') as typeof import('../../src/workshop/ExhibitKits');
    const builder = window.__museumWorkshop as unknown as Builder;
    const { manifest } = kits.placeKit(builder.placements.captureManifest() as never, 'archive-research-station',
      { position: [250, 0, 250], rotationY: 0, worldId: 'exterior' });
    builder.placements.replaceManifest(manifest);
  });
  const state = () => page.evaluate(() => {
    const builder = window.__museumWorkshop as unknown as Builder;
    const manifest = builder.placements.captureManifest();
    return { kits: manifest.kits ?? [], objects: manifest.objects, count: builder.placements.objectCount, resident: builder.placements.residentCount };
  });
  const position = (s: Awaited<ReturnType<typeof state>>, id: string) => s.objects.find((item) => item.id === id)?.position;
  const initial = await state();
  expect(initial.kits).toHaveLength(1);
  expect(initial.count).toBe(5);

  const panel = page.locator('.museum-workshop');
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await expect(panel).toBeVisible();
  // The kit was placed from outside the panel; redraw the panel as any Workshop action would.
  await page.evaluate(() => (window.__museumWorkshop as unknown as { refresh(): void }).refresh());
  await panel.locator('[data-workshop="outliner"]').getByRole('button', { name: /Reader chair/ }).click();
  await expect(panel.locator('[data-workshop="kit-status"]')).toContainText('"chair" part of Archive Research Station (5 parts)');
  await expect(panel.locator('[data-workshop="kit-status"]')).toContainText('No parts changed from the kit.');

  // Editing one part with "Move as kit" on moves every part by the same amount.
  const chairX = position(initial, 'archive-research-station-chair')![0];
  await panel.locator('[data-workshop="px"]').fill(String(chairX + 2));
  await panel.locator('[data-workshop="px"]').blur();
  await expect.poll(async () => (await state()).kits[0].position[0]).toBeCloseTo(252, 3);
  const moved = await state();
  for (const item of initial.objects) {
    expect(position(moved, item.id)![0]).toBeCloseTo(item.position[0] + 2, 3);
    expect(position(moved, item.id)![2]).toBeCloseTo(item.position[2], 3);
  }
  await expect(panel.locator('[data-workshop="kit-status"]')).toContainText('No parts changed from the kit.');

  // With it off, the same edit becomes an override of that part only; Reset restores it.
  await panel.locator('[data-workshop="kit-move-together"]').uncheck();
  await panel.locator('[data-workshop="px"]').fill(String(chairX + 2.5));
  await panel.locator('[data-workshop="px"]').blur();
  await expect(panel.locator('[data-workshop="kit-status"]')).toContainText('Changed from the kit: chair.');
  expect(position(await state(), 'archive-research-station-desk')).toEqual(position(moved, 'archive-research-station-desk'));
  await panel.locator('[data-workshop="kit-reset"]').click();
  await expect(panel.locator('[data-workshop="kit-status"]')).toContainText('No parts changed from the kit.');

  // Duplicate creates a second kit of ordinary placements; undo removes it again.
  await panel.locator('[data-workshop="kit-duplicate"]').click();
  await expect.poll(async () => (await state()).kits.length).toBe(2);
  expect((await state()).count).toBe(10);
  await panel.locator('[data-workshop="undo"]').click();
  await expect.poll(async () => (await state()).count).toBe(5);

  // Delete releases every part; undo restores the kit.
  await panel.locator('[data-workshop="outliner"]').getByRole('button', { name: /Research desk/ }).click();
  await panel.locator('[data-workshop="kit-delete"]').click();
  await expect.poll(async () => (await state()).count).toBe(0);
  expect((await state()).resident).toBe(0);
  expect((await state()).kits).toHaveLength(0);
  await panel.locator('[data-workshop="undo"]').click();
  await expect.poll(async () => (await state()).kits.length).toBe(1);
  expect((await state()).count).toBe(5);
  expect(errors).toEqual([]);
});

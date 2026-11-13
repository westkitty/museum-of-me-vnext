import { expect, test } from '@playwright/test';

type Vec = [number, number, number];

test('Check island paths reports clear paths, then flags a solid object placed on a path', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await page.waitForFunction(() => Boolean(window.__museumWorkshop), null, { timeout: 60_000 });

  const panel = page.locator('.museum-workshop');
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await expect(panel).toBeVisible();
  await panel.locator('[data-workshop="island-paths-scan"]').click();
  await expect(panel.locator('[data-workshop="island-paths-status"]')).toContainText(/All \d+ island paths are clear/);

  // A solid plinth on the first path's second centreline point.
  const point = await page.evaluate(async () => {
    const load = (url: string) => import(/* @vite-ignore */ url);
    const layout = await load('/src/world/exterior/IslandSiteLayout.ts') as typeof import('../../src/world/exterior/IslandSiteLayout');
    const [x, z] = layout.PATH_CENTERLINES[0][1];
    return [x, -0.46, z] as Vec;
  });
  await page.evaluate((position) => {
    const builder = window.__museumWorkshop as unknown as { placements: { setRecord(record: unknown): unknown } };
    builder.placements.setRecord({ id: 'path-blocker', label: 'Path blocker', prefab: 'display-plinth', anchor: 'floor',
      position, rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'exterior', collision: 'solid' });
  }, point);

  await panel.locator('[data-workshop="island-paths-scan"]').click();
  await expect(panel.locator('[data-workshop="island-paths-status"]')).toContainText('island paths are obstructed');
  await expect(panel.locator('[data-island-path="1"]')).toContainText('Path 1:');
  expect(errors).toEqual([]);
});

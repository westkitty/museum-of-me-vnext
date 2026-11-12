import { expect, test } from '@playwright/test';

type Vec = [number, number, number];

test('Clear Walkways detects an obstruction, previews a move, applies it only on approval, and undoes it', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await page.waitForFunction(() => Boolean(window.__museumWorkshop), null, { timeout: 60_000 });

  // Find a conservation-valid point that intrudes on a protected walkway, using the real modules.
  const point = await page.evaluate(async () => {
    // Vite serves source modules by URL; the type-only annotations are erased before injection.
    const load = (url: string) => import(/* @vite-ignore */ url);
    const walkways = await load('/src/workshop/ClearWalkways.ts') as typeof import('../../src/workshop/ClearWalkways');
    const sceneIndex = await load('/src/workshop/SceneIndex.ts') as typeof import('../../src/workshop/SceneIndex');
    const conservation = await load('/src/workshop/conservation.ts') as typeof import('../../src/workshop/conservation');
    const index = sceneIndex.buildMuseumSceneIndex({ schemaVersion: 2, objects: [] });
    for (const walkway of walkways.protectedWalkways(index).filter((w) => w.world === 'interior' && w.kind !== 'route')) {
      const a = walkway.path[0], b = walkway.path[walkway.path.length - 1];
      for (let t = 0; t <= 1; t += 0.25) {
        for (const lateral of [0.6, -0.6, 0.9, -0.9]) {
          const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
          const p: Vec = [a[0] + dx * t + (-dz / len) * lateral, a[1] + (b[1] - a[1]) * t, a[2] + dz * t + (dx / len) * lateral];
          if (len === 1 && dx === 0) p[0] = a[0] + lateral;
          // Saved positions are canonicalised to 4 decimals.
          for (let k = 0; k < 3; k++) p[k] = Math.round(p[k] * 10_000) / 10_000;
          const box = { min: [p[0] - 0.5, p[1], p[2] - 0.5] as Vec, max: [p[0] + 0.5, p[1] + 1.2, p[2] + 0.5] as Vec };
          if (walkways.walkwayIntrusion(walkway, box) <= 0) continue;
          const record = { id: 'walkway-blocker', label: 'Walkway blocker', prefab: 'display-plinth', anchor: 'floor',
            position: p, rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'interior', collision: 'solid' };
          if (conservation.validateWorkshopManifestForMuseum({ schemaVersion: 2, objects: [record] }, []).ok) return p;
        }
      }
    }
    return null;
  });
  expect(point).not.toBeNull();

  await page.evaluate((position) => {
    const builder = window.__museumWorkshop as unknown as { placements: { setRecord(record: unknown): unknown } };
    builder.placements.setRecord({ id: 'walkway-blocker', label: 'Walkway blocker', prefab: 'display-plinth', anchor: 'floor',
      position, rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'interior', collision: 'solid' });
  }, point as Vec);

  const panel = page.locator('.museum-workshop');
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await expect(panel).toBeVisible();
  await panel.locator('[data-workshop="walkways-scan"]').click();
  await expect(panel.locator('[data-workshop="walkways-status"]')).toContainText('FAIL');
  const row = panel.locator('[data-walkway-finding="walkway-blocker"]');
  await expect(row).toContainText('Walkway blocker');

  // Preview shows a ghost and does not move the object.
  await row.locator('[data-walkway-action="preview"]').click();
  const previewed = await page.evaluate(() => {
    const app = window.__museum!;
    const builder = window.__museumWorkshop as unknown as { placements: { getRecord(id: string): { position: Vec } | null } };
    return { ghost: Boolean(app.scene.getObjectByName('workshop-walkway-ghost')),
      position: builder.placements.getRecord('walkway-blocker')?.position };
  });
  expect(previewed.ghost).toBe(true);
  expect(previewed.position).toEqual(point);

  await row.locator('[data-walkway-action="approve"]').click();
  const moved = await page.evaluate(() => (window.__museumWorkshop as unknown as {
    placements: { getRecord(id: string): { position: Vec } | null } }).placements.getRecord('walkway-blocker')?.position);
  expect(moved).not.toEqual(point);
  await expect(panel.locator('[data-walkway-finding="walkway-blocker"]')).toHaveCount(0);
  await expect(panel.locator('[data-workshop="walkways-status"]')).toContainText('PASS');

  await panel.locator('[data-workshop="undo"]').click();
  const restored = await page.evaluate(() => (window.__museumWorkshop as unknown as {
    placements: { getRecord(id: string): { position: Vec } | null } }).placements.getRecord('walkway-blocker')?.position);
  expect(restored).toEqual(point);
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';

test('asset search summons a real local GLB and finishes an existing wall without moving it', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  const workshop = page.locator('.museum-workshop');
  const buildMode = page.getByRole('button', { name: 'Enter Build Mode' });
  await expect(buildMode).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await expect(workshop).toBeAttached({ timeout: 60_000 });
  await buildMode.click();
  await expect(workshop).toBeVisible();

  const search = workshop.locator('[data-workshop="asset-search"]');
  await search.fill('telescope');
  const items = workshop.locator('[data-workshop="asset-results"] button');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Telescope');
  await items.first().click();
  await expect(workshop.locator('[data-workshop="selection-title"]')).toHaveText('Telescope');
  await expect(workshop.locator('[data-workshop="outliner"]')).toContainText('Telescope');

  // The placeholder must be replaced by a real parsed GLTF scene.
  await page.waitForFunction(() => {
    const root = window.__museum?.scene.getObjectByName('workshop:catalog-model-01');
    return Boolean(root?.children.length && root.children[0].type === 'Group');
  }, null, { timeout: 60_000 });

  const texture = workshop.locator('[data-workshop="texture"]');
  await texture.selectOption('stone-paver');
  await expect(texture).toHaveValue('stone-paver');
  await workshop.locator('[data-workshop="undo"]').click();
  await expect(texture).toHaveValue('none');
  await workshop.locator('[data-workshop="redo"]').click();
  await expect(texture).toHaveValue('stone-paver');

  // Exercise surface selection through the actual camera raycaster. The
  // exterior vestibule has a guaranteed authored backdrop at z=122.
  await page.evaluate(() => {
    const app = window.__museum!;
    const workshopController = window.__museumWorkshop as unknown as { select: (id: string | null) => void };
    workshopController.select(null); // detach the preceding transform gizmo
    app.camera.position.set(0, 4, 137);
    app.camera.lookAt(0, 4, 122);
    app.camera.updateMatrixWorld(true);
  });
  await page.mouse.click(640, 360);
  await expect(workshop.locator('[data-workshop="selection-meta"]')).toContainText('paint-only');
  const color = workshop.locator('[data-workshop="paint"]');
  await color.fill('#f03b79');
  const surfaceState = await page.evaluate(() => {
    const controller = window.__museumWorkshop as unknown as { selectedSurfaceId: string | null };
    return { selected: controller.selectedSurfaceId,
      loaded: Boolean(window.__museum?.exteriorWorld.root.visible) };
  });
  expect(surfaceState.selected).toMatch(/^exterior:/);
  expect(surfaceState.loaded).toBe(true);
  await expect(workshop.locator('[data-workshop="outliner"]')).toContainText('Painted mesh');
  expect(errors).toEqual([]);
});

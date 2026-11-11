import { expect, test } from '@playwright/test';

test('Sims-style wall drawing creates a selectable, paintable wall with undo and redo', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    // Draw outside the protected museum footprint so conservation passes.
    app.player.teleport([250, 0, 250]);
  });
  const panel = page.locator('.museum-workshop');
  await expect(panel).toBeAttached({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await expect(panel).toBeVisible();
  const draw = panel.locator('[data-workshop="draw-wall"]');
  await draw.click();
  await expect(draw).toHaveText('Cancel wall draw');

  // The same canvas is the authoring surface. No second 3D viewport is made.
  await page.mouse.click(560, 360);
  await page.mouse.click(700, 360);
  await expect(draw).toHaveText('Draw wall');
  await expect(panel.locator('[data-workshop="selection-title"]')).toHaveText('Partition wall');
  await expect(panel.locator('[data-workshop="outliner"]')).toContainText('Partition wall');

  const source = await page.evaluate(() => {
    const root = window.__museum?.scene.getObjectByName('workshop:partition-wall-01');
    return root ? { x: root.scale.x, y: root.position.y, children: root.children.length } : null;
  });
  expect(source).not.toBeNull();
  expect(source!.x).toBeGreaterThan(0.25);
  expect(source!.children).toBeGreaterThan(0);

  await panel.locator('[data-workshop="paint"]').fill('#22aa88');
  await expect(panel.locator('[data-workshop="paint"]')).toHaveValue('#22aa88');
  await panel.locator('[data-workshop="undo"]').click();
  await panel.locator('[data-workshop="undo"]').click();
  await expect(panel.locator('[data-workshop="outliner"]')).not.toContainText('Partition wall');
  await panel.locator('[data-workshop="redo"]').click();
  await expect(panel.locator('[data-workshop="outliner"]')).toContainText('Partition wall');

  // The floor and roof are equally real selectable meshes, not fake palette entries.
  await panel.locator('[data-workshop="palette"]').getByRole('button', { name: 'Floor slab' }).click();
  await expect(panel.locator('[data-workshop="selection-title"]')).toHaveText('Floor slab');
  await panel.locator('[data-workshop="palette"]').getByRole('button', { name: 'Roof panel' }).click();
  await expect(panel.locator('[data-workshop="selection-title"]')).toHaveText('Roof panel');
  expect(errors).toEqual([]);
});

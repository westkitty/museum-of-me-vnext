import { expect, test } from '@playwright/test';

test('two-click Room tool creates four individually editable walls and one floor as one undoable action', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.player.teleport([250, 0, 250]);
    app.camera.position.set(250, 12, 260);
    app.camera.lookAt(250, 0, 250);
    app.camera.updateMatrixWorld(true);
  });

  const panel = page.locator('.museum-workshop');
  await expect(panel).toBeAttached({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await expect(panel).toBeVisible();

  const draw = panel.locator('[data-workshop="draw-room"]');
  await panel.locator('[data-workshop="room-roof"]').check();
  await draw.click();
  await expect(draw).toHaveText('Cancel room draw');

  // The same canvas is used for room construction and the visitor world.
  await page.mouse.click(555, 325);
  await page.mouse.click(735, 420);
  await expect(draw).toHaveText('Draw room');
  await expect(panel.locator('[data-workshop="selection-title"]')).toHaveText('Room floor');
  const outliner = panel.locator('[data-workshop="outliner"]');
  await expect(outliner.getByRole('button', { name: /Room wall/ })).toHaveCount(4);
  await expect(outliner).toContainText('Room floor');
  await expect(outliner).toContainText('Room roof');

  const constructed = await page.evaluate(() => {
    const scene = window.__museum!.scene;
    return {
      walls: [1, 2, 3, 4].map((n) =>
        scene.getObjectByName('workshop:partition-wall-' + String(n).padStart(2, '0'))?.children.length ?? 0),
      floor: scene.getObjectByName('workshop:floor-slab-01')?.children.length ?? 0,
      roof: scene.getObjectByName('workshop:roof-panel-01')?.children.length ?? 0,
    };
  });
  expect(constructed.walls).toEqual([1, 1, 1, 1]);
  expect(constructed.floor).toBe(1);
  expect(constructed.roof).toBe(1);

  // A single undo must remove all six components, not leave orphan sections.
  await panel.locator('[data-workshop="undo"]').click();
  await expect(outliner).not.toContainText('Room wall');
  await expect(outliner).not.toContainText('Room floor');
  await expect(outliner).not.toContainText('Room roof');
  await panel.locator('[data-workshop="redo"]').click();
  await expect(outliner.getByRole('button', { name: /Room wall/ })).toHaveCount(4);
  await expect(outliner).toContainText('Room floor');
  await expect(outliner).toContainText('Room roof');

  // The walls remain individual source-authorable surfaces for openings and paint.
  await outliner.getByRole('button', { name: /Room wall 1/ }).click();
  await expect(panel.locator('[data-workshop="selection-title"]')).toHaveText('Room wall 1');
  await panel.locator('[data-workshop="opening"]').selectOption('door');
  await expect(panel.locator('[data-workshop="opening"]')).toHaveValue('door');
  const openings = await page.evaluate(() =>
    window.__museum!.scene.getObjectByName('workshop:partition-wall-01')?.children.length);
  expect(openings).toBe(3);
  expect(errors).toEqual([]);
});

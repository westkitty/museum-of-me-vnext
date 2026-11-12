import { expect, test } from '@playwright/test';

test('authored sculpture interaction toggles its own emissive material in the real visitor runtime', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum && window.__museumWorkshop), null, { timeout: 60_000 });
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.player.teleport([250, 0, 250]);
    app.camera.position.set(250, 2.2, 258);
    app.camera.lookAt(250, 1, 250);
    app.camera.updateMatrixWorld(true);
  });
  const panel = page.locator('.museum-workshop');
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await expect(panel).toBeVisible();
  await panel.locator('[data-workshop="palette"]').getByRole('button', { name: 'Sculpture sphere' }).click();
  await expect(panel.locator('[data-workshop="selection-title"]')).toHaveText('Sculpture sphere');

  await panel.locator('[data-workshop="event"]').selectOption('toggle-glow');
  await panel.locator('[data-workshop="event-color"]').fill('#ff3355');
  await panel.locator('[data-workshop="event-message"]').fill('The sculpture awakens.');
  await panel.locator('[data-workshop="event-message"]').press('Tab');

  const saved = await page.evaluate(() => {
    const builder = window.__museumWorkshop as unknown as {
      placements: { captureManifest(): { objects: Array<{
        event?: string; eventColor?: string; eventMessage?: string;
      }> } };
    };
    return builder.placements.captureManifest().objects.find((x) => x.event === 'toggle-glow') ?? null;
  });
  expect(saved).toMatchObject({
    event: 'toggle-glow', eventColor: '#ff3355', eventMessage: 'The sculpture awakens.',
  });

  await panel.locator('[data-workshop="exit"]').click();
  const tested = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    const object = app.scene.getObjectByName('workshop:sculpture-sphere-01');
    if (!object) return { failed: 'object absent' };
    const mesh = object.children[0] as import('three').Mesh;
    const material = mesh.material as import('three').MeshStandardMaterial;
    const original = material.emissive.getHexString();
    app.camera.position.set(object.position.x, object.position.y + 0.1, object.position.z + 2.4);
    app.camera.lookAt(object.position.x, object.position.y, object.position.z);
    app.camera.updateMatrixWorld(true);
    app.interaction.update(app.camera, 1);
    const focus = app.interaction.currentFocus?.label ?? null;
    const first = app.interaction.activate();
    const activatedColor = (mesh.material as import('three').MeshStandardMaterial).emissive.getHexString();
    const second = app.interaction.activate();
    const restoredColor = (mesh.material as import('three').MeshStandardMaterial).emissive.getHexString();
    return { original, focus, first, second, activatedColor, restoredColor };
  });
  expect(tested).toMatchObject({
    focus: 'Activate Sculpture sphere', first: true, second: true,
    activatedColor: 'ff3355',
  });
  expect((tested as { restoredColor?: string }).restoredColor).toBe((tested as { original?: string }).original);
  expect(errors).toEqual([]);
});

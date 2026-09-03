import { expect, test } from '@playwright/test';

async function stopSoftwareRenderLoop(page: import('@playwright/test').Page): Promise<void> {
  // The CI runner has no representative GPU. As with the production browser
  // suite, prove the real WebGL scene and Workshop have booted, then stop the
  // continuous renderer so Playwright DOM/protocol commands are not starved by
  // software WebGL. Workshop authoring commands themselves are event-driven.
  await page.evaluate(() => window.__museum?.stop());
}

test('Museum Workshop authors safe objects and persists through the dev-only save bridge', async ({ page, request }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });

  const buildMode = page.getByRole('button', { name: 'Enter Build Mode' });
  const lockPrompt = page.getByRole('button', { name: 'Enter the museum and capture mouse look' });
  const workshop = page.locator('.museum-workshop');
  await expect(buildMode).toBeVisible({ timeout: 60_000 });
  await expect(lockPrompt).toBeVisible();
  // The Build Mode affordance is installed before the dynamic Workshop module
  // attaches its root, so startup may legitimately have zero matching nodes.
  await expect(workshop).toHaveCount(0);
  await stopSoftwareRenderLoop(page);
  await expect(workshop).toBeAttached({ timeout: 60_000 });

  await page.evaluate(() => {
    const app = window.__museum!;
    const shrub = app.scene.getObjectByName('authorable:arrival-garden-shrub-01')!;
    app.player.teleport([shrub.position.x, 0, shrub.position.z + 3.2]);
    app.player.yaw = Math.atan2(-shrub.position.x + app.player.position.x, -shrub.position.z + app.player.position.z);
    app.player.pitch = 0;
    app.player.applyToCamera(app.camera, 1);
    app.camera.updateMatrixWorld(true);
  });
  await page.keyboard.press('F');
  await expect(workshop).toBeVisible({ timeout: 30_000 });
  await expect(workshop.locator('[data-workshop="selection-title"]')).toHaveText('Arrival garden shrub 1');
  await expect(workshop.locator('[data-workshop="keymap"]')).toContainText('Select/Edit object');
  await page.mouse.click(640, 360);
  await expect(workshop.locator('[data-workshop="selection-title"]')).toHaveText('Arrival garden shrub 1');
  await workshop.locator('[data-workshop="px"]').fill('30');
  await workshop.locator('[data-workshop="px"]').blur();
  await workshop.locator('[data-workshop="pz"]').fill('42');
  await workshop.locator('[data-workshop="pz"]').blur();
  await expect(workshop.locator('[data-workshop="px"]')).toHaveValue('30.000');
  await page.keyboard.press('F8');
  await expect(workshop).toBeHidden();

  await buildMode.click();
  await expect(workshop).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Exit Build Mode' })).toBeVisible();
  await expect(lockPrompt).toBeHidden();
  await expect(workshop.getByRole('heading', { name: 'Museum Workshop' })).toBeVisible();
  await expect(workshop.getByText('DEVELOPMENT ONLY')).toBeVisible();

  const keymap = workshop.locator('[data-workshop="keymap"]');
  await expect(keymap).toBeVisible();
  await expect(keymap.locator('kbd')).toHaveCount(12);
  await expect(keymap).toContainText('duplicate');
  await expect(keymap).toContainText('save');
  const keymapBox = await keymap.boundingBox();
  expect(keymapBox).not.toBeNull();
  expect(keymapBox!.x).toBeGreaterThanOrEqual(0);
  expect(keymapBox!.y).toBeGreaterThanOrEqual(0);
  expect(keymapBox!.x + keymapBox!.width).toBeLessThanOrEqual(1280);
  expect(keymapBox!.y + keymapBox!.height).toBeLessThanOrEqual(720);

  await workshop.locator('[data-workshop="palette"]').getByRole('button', { name: 'Display plinth', exact: true }).click();
  const outliner = workshop.locator('[data-workshop="outliner"]');
  await expect(outliner.getByRole('button', { name: /Display plinth/ })).toHaveCount(1);

  const px = workshop.locator('[data-workshop="px"]');
  await px.fill('12.5');
  await px.blur();
  await expect(px).toHaveValue('12.500');

  const ry = workshop.locator('[data-workshop="ry"]');
  await ry.fill('30');
  await ry.blur();
  await expect(ry).toHaveValue('30.00');

  await workshop.getByRole('button', { name: 'Duplicate' }).click();
  await expect(outliner.getByRole('button')).toHaveCount(12);

  await workshop.getByRole('button', { name: 'Undo' }).click();
  await expect(outliner.getByRole('button')).toHaveCount(11);
  await workshop.getByRole('button', { name: 'Redo' }).click();
  await expect(outliner.getByRole('button')).toHaveCount(12);

  // Prove the editor hands control ownership back to the museum before the
  // reload proof. Keeping the software render loop stopped makes this a bounded
  // semantic/input test rather than a fake performance benchmark.
  await page.keyboard.press('F8');
  await expect(workshop).toBeHidden();
  await expect(page.getByRole('button', { name: 'Enter Build Mode' })).toBeVisible();
  await expect(lockPrompt).toBeVisible();
  await lockPrompt.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('F8');
  await expect(workshop).toBeVisible();
  await expect(lockPrompt).toBeHidden();

  // A foreign browser origin must not be able to use a locally running Vite
  // server as a repository write primitive, even though the TCP peer is local.
  const rejectedWrite = await request.post('/__museum-workshop/save', {
    headers: {
      Origin: 'https://not-the-museum.invalid',
      'Content-Type': 'application/json',
    },
    data: { schemaVersion: 1, objects: [] },
  });
  expect(rejectedWrite.status()).toBe(403);

  const saveResponse = page.waitForResponse((response) =>
    response.url().endsWith('/__museum-workshop/save') && response.request().method() === 'POST');
  await workshop.getByRole('button', { name: 'Save to build' }).click();
  expect((await saveResponse).status()).toBe(200);

  // Read the atomically-written source directly. Full-page reload is owned by
  // the standalone verifier below; under SwiftShader it can close the browser
  // session while Vite rebuilds the imported WebGL scene.
  const persistedResponse = await request.get('/data/workshop-placements.json');
  expect(persistedResponse.status()).toBe(200);
  const persisted = await persistedResponse.json() as {
    objects: { id: string; rotation: number[] }[];
    sceneOverrides: { id: string; position: number[] }[];
  };
  expect(persisted.objects).toHaveLength(2);
  expect(persisted.objects.find((item) => item.id === 'display-plinth-01')?.rotation[1]).toBeCloseTo(Math.PI / 6, 4);
  expect(persisted.sceneOverrides.find((item) => item.id === 'arrival-garden-shrub-01')?.position).toEqual([30, 0, 42]);
});

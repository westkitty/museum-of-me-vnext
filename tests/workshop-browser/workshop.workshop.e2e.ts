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
  await page.goto('/?edit=1');

  const buildMode = page.getByRole('button', { name: 'Enter Build Mode' });
  const lockPrompt = page.getByRole('button', { name: 'Enter the museum and capture mouse look' });
  const workshop = page.locator('.museum-workshop');
  await expect(buildMode).toBeVisible({ timeout: 60_000 });
  await expect(lockPrompt).toBeVisible();
  await expect(workshop).toBeHidden();
  await stopSoftwareRenderLoop(page);
  await expect(workshop).toBeAttached({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => ({
    captured: Boolean(window.__museum?.input.uiCaptured),
    frozen: Boolean(window.__museum?.player.isFrozen),
  }))).toEqual({ captured: false, frozen: false });

  await buildMode.click();
  await expect(workshop).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Exit Build Mode' })).toBeVisible();
  await expect(lockPrompt).toBeHidden();
  await expect.poll(() => page.evaluate(() => ({
    captured: Boolean(window.__museum?.input.uiCaptured),
    frozen: Boolean(window.__museum?.player.isFrozen),
    transformEnabled: Boolean((window.__museumWorkshop as unknown as { transform?: { enabled?: boolean } } | undefined)?.transform?.enabled),
  }))).toEqual({ captured: true, frozen: true, transformEnabled: true });
  await expect(workshop.getByRole('heading', { name: 'Museum Workshop' })).toBeVisible();
  await expect(workshop.getByText('DEVELOPMENT ONLY')).toBeVisible();

  const keymap = workshop.locator('[data-workshop="keymap"]');
  await expect(keymap).toBeVisible();
  await expect(keymap.locator('kbd')).toHaveCount(11);
  await expect(keymap).toContainText('duplicate');
  await expect(keymap).toContainText('save');
  const keymapBox = await keymap.boundingBox();
  expect(keymapBox).not.toBeNull();
  expect(keymapBox!.x).toBeGreaterThanOrEqual(0);
  expect(keymapBox!.y).toBeGreaterThanOrEqual(0);
  expect(keymapBox!.x + keymapBox!.width).toBeLessThanOrEqual(1280);
  expect(keymapBox!.y + keymapBox!.height).toBeLessThanOrEqual(720);

  await workshop.getByRole('button', { name: 'Display plinth' }).click();
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
  await expect(outliner.getByRole('button')).toHaveCount(2);

  await workshop.getByRole('button', { name: 'Undo' }).click();
  await expect(outliner.getByRole('button')).toHaveCount(1);
  await workshop.getByRole('button', { name: 'Redo' }).click();
  await expect(outliner.getByRole('button')).toHaveCount(2);

  // Prove the editor hands control ownership back to the museum before the
  // reload proof. Keeping the software render loop stopped makes this a bounded
  // semantic/input test rather than a fake performance benchmark.
  await page.keyboard.press('F8');
  await expect(workshop).toBeHidden();
  const frozenAfterClose = await page.evaluate(() => Boolean(window.__museum?.player.isFrozen));
  expect(frozenAfterClose).toBe(false);
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

  // The source JSON is imported by the dev runtime, so Vite may refresh after
  // the atomic write. A reload is deliberate proof that the saved source is
  // now authoritative rather than merely live mutable scene state. Do not run
  // another protocol-heavy page.evaluate after reload: software WebGL on CI is
  // already proven above and can starve the protocol while the scene rebuilds.
  await page.reload();
  const reloadedWorkshop = page.locator('.museum-workshop');
  try {
    const reloadedBuildMode = page.getByRole('button', { name: 'Enter Build Mode' });
    await expect(reloadedBuildMode).toBeVisible({ timeout: 60_000 });
    await expect(reloadedWorkshop).toBeHidden();
    await stopSoftwareRenderLoop(page);
    await expect(reloadedWorkshop).toBeAttached({ timeout: 60_000 });
    await reloadedBuildMode.click();
    await expect(reloadedWorkshop).toBeVisible({ timeout: 30_000 });
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\nBrowser errors: ${browserErrors.join(' | ')}`);
  }
  await expect(reloadedWorkshop.locator('[data-workshop="outliner"]').getByRole('button')).toHaveCount(2);
  // Keep the post-reload assertion DOM-only: the standalone proof below owns
  // the runtime scene inspection after building from this authored source.
  await reloadedWorkshop.locator('[data-workshop="outliner"]').getByRole('button', { name: /Display plinth/ }).first().click();
  await expect(reloadedWorkshop.locator('[data-workshop="ry"]')).toHaveValue('30.00');
});

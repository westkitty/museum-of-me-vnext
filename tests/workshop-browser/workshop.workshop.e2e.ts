import { expect, test } from '@playwright/test';

test('Museum Workshop authors safe objects and persists through the dev-only save bridge', async ({ page }) => {
  await page.goto('/?edit=1');

  const workshop = page.locator('.museum-workshop');
  await expect(workshop).toBeVisible({ timeout: 30_000 });
  await expect(workshop.getByRole('heading', { name: 'Museum Workshop' })).toBeVisible();
  await expect(workshop.getByText('DEVELOPMENT ONLY')).toBeVisible();

  await workshop.getByRole('button', { name: 'Display plinth' }).click();
  const outliner = workshop.locator('[data-workshop="outliner"]');
  await expect(outliner.getByRole('button', { name: /Display plinth/ })).toHaveCount(1);

  const px = workshop.locator('[data-workshop="px"]');
  await px.fill('12.5');
  await px.blur();
  await expect(px).toHaveValue('12.500');

  await workshop.getByRole('button', { name: 'Duplicate' }).click();
  await expect(outliner.getByRole('button')).toHaveCount(2);

  await workshop.getByRole('button', { name: 'Undo' }).click();
  await expect(outliner.getByRole('button')).toHaveCount(1);
  await workshop.getByRole('button', { name: 'Redo' }).click();
  await expect(outliner.getByRole('button')).toHaveCount(2);

  const saveResponse = page.waitForResponse((response) =>
    response.url().endsWith('/__museum-workshop/save') && response.request().method() === 'POST');
  await workshop.getByRole('button', { name: 'Save to build' }).click();
  expect((await saveResponse).status()).toBe(200);

  // The source JSON is imported by the dev runtime, so Vite may refresh after
  // the atomic write. A reload is deliberate proof that the saved source is
  // now authoritative rather than merely live mutable scene state.
  await page.reload();
  const reloadedWorkshop = page.locator('.museum-workshop');
  await expect(reloadedWorkshop).toBeVisible({ timeout: 30_000 });
  await expect(reloadedWorkshop.locator('[data-workshop="outliner"]').getByRole('button')).toHaveCount(2);

  await page.keyboard.press('F8');
  await expect(reloadedWorkshop).toBeHidden();
  const frozenAfterClose = await page.evaluate(() => Boolean(window.__museum?.player.isFrozen));
  expect(frozenAfterClose).toBe(false);

  await page.keyboard.press('F8');
  await expect(reloadedWorkshop).toBeVisible();
});

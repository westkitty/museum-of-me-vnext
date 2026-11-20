import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test('touch visitors can open museum tools and start walking guidance', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  // The welcome is non-modal: the museum tools are available at once.
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  const tools = page.getByRole('button', { name: 'Museum', exact: true });
  await expect(tools).toBeVisible();
  await page.evaluate(() => window.__museum!.stop());

  await tools.tap();
  const menu = page.getByRole('dialog', { name: 'Museum', exact: true });
  await expect(menu).toBeVisible();
  for (const name of ['Map', 'Journal', 'Guide to the entrance', 'Visit Thread', 'Settings']) {
    await expect(menu.getByRole('button', { name, exact: true })).toBeVisible();
  }

  await menu.getByRole('button', { name: 'Map', exact: true }).tap();
  await expect(menu).toBeHidden();
  const map = page.getByRole('dialog', { name: 'Museum map' });
  await expect(map).toBeVisible();
  await map.getByRole('button', { name: /Close/ }).tap();
  await expect(map).toBeHidden();
  expect(await page.evaluate(() => window.__museum!.input.uiCaptured)).toBe(false);

  await tools.tap();
  await menu.getByRole('button', { name: 'Guide to the entrance' }).tap();
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => {
    const museum = window.__museum!;
    museum.variableUpdate(1 / 60);
    return {
      visible: museum.wayfinding.group.visible,
      free: !museum.input.uiCaptured,
      stored: museum.journal.guideTarget,
    };
  })).toEqual({ visible: true, free: true, stored: undefined });
});

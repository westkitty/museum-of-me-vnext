import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function bootMuseum(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__museum));
  await expect(page.locator('#museum-canvas')).toBeVisible();
  return errors;
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

test('boots at the exterior arrival and keyboard movement reaches the real controller', async ({ page }, testInfo) => {
  const errors = await bootMuseum(page);

  const zone = await page.evaluate(() => window.__museum?.currentZone);
  expect(zone).toBe('plaza');
  await expect(page.getByRole('button', { name: 'Enter the museum and capture mouse look' })).toBeVisible();

  const before = await page.evaluate(() => {
    const p = window.__museum?.player.position;
    return p ? [p.x, p.y, p.z] : null;
  });
  expect(before).not.toBeNull();

  await page.keyboard.down('w');
  await page.waitForTimeout(450);
  await page.keyboard.up('w');
  await page.waitForTimeout(100);

  const after = await page.evaluate(() => {
    const p = window.__museum?.player.position;
    return p ? [p.x, p.y, p.z] : null;
  });
  expect(after).not.toBeNull();
  const moved = Math.hypot(
    (after?.[0] ?? 0) - (before?.[0] ?? 0),
    (after?.[2] ?? 0) - (before?.[2] ?? 0),
  );
  expect(moved).toBeGreaterThan(0.5);

  await capture(page, testInfo, 'arrival');
  expect(errors).toEqual([]);
});

test('operates the visual map and reduced-motion setting with the keyboard', async ({ page }, testInfo) => {
  const errors = await bootMuseum(page);

  await page.keyboard.press('m');
  await expect(page.getByRole('dialog', { name: 'Museum map' })).toBeVisible();

  const visualBay = page.locator('.map__plan .bay[role="button"]').first();
  await visualBay.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel-map .panel__note')).toContainText('Wayfinding to');
  await capture(page, testInfo, 'map-wayfinding');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Museum map' })).toBeHidden();

  await page.keyboard.press('o');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  const reducedMotion = page.getByRole('checkbox', { name: 'Reduced motion' });
  await reducedMotion.focus();
  await page.keyboard.press('Space');
  await expect(reducedMotion).toBeChecked();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.motion)).toBe('reduced');
  await capture(page, testInfo, 'settings-reduced-motion');

  expect(errors).toEqual([]);
});

test('exposes the complete accessible collection without requiring pointer lock', async ({ page }) => {
  const errors = await bootMuseum(page);

  await page.keyboard.press('h');
  const mirror = page.locator('#a11y-root');
  await expect(mirror.locator('.skip')).toBeFocused();
  await expect(mirror).toContainText('W A S D or the arrow keys — walk');
  await expect(mirror).toContainText('Q and E — turn');
  await expect(mirror).toContainText('F or Enter — interact');
  await expect(mirror).toContainText('Starsilk Universe');
  await expect(mirror).toContainText('BigMac Backbone');

  expect(errors).toEqual([]);
});

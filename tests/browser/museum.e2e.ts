import { expect, test, type Page } from '@playwright/test';

async function bootMuseum(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await expect(page.locator('#museum-canvas')).toBeVisible();

  // The CI runner has no real GPU. Prove that the real WebGL application boots,
  // then stop its render loop so browser semantics can be tested without making
  // software rendering compete with Playwright's own protocol commands.
  await page.evaluate(() => window.__museum?.stop());
  return errors;
}

test('boots at the exterior arrival and keyboard input reaches the real controller', async ({ page }) => {
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
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum app missing');
    for (let i = 0; i < 30; i++) app.player.fixedUpdate(1 / 60);
  });
  await page.keyboard.up('w');

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

  expect(errors).toEqual([]);
});

test('operates the visual map and reduced-motion setting with the keyboard', async ({ page }) => {
  const errors = await bootMuseum(page);

  await page.keyboard.press('m');
  await expect(page.getByRole('dialog', { name: 'Museum map' })).toBeVisible();

  const visualBay = page.locator('.map__plan .bay[role="button"]').first();
  await visualBay.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel-map .panel__note')).toContainText('Wayfinding to');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Museum map' })).toBeHidden();

  await page.keyboard.press('o');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  const reducedMotion = page.getByRole('checkbox', { name: 'Reduced motion' });
  await reducedMotion.focus();
  await page.keyboard.press('Space');
  await expect(reducedMotion).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('reduced');

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

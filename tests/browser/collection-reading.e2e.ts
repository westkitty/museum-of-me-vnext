import { expect, test } from '@playwright/test';

test('the readable collection and exhibit links work without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...options: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return Reflect.apply(original, this, [type, ...options]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.getByRole('heading', { name: 'Museum of Me collection' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('The 3D museum could not start');
  await expect(page.locator('.collection-page__index li')).toHaveCount(35);

  await page.getByRole('link', { name: 'Heliocide Observatory', exact: true }).click();
  await expect(page).toHaveURL(/\?exhibit=E08$/);
  await expect(page).toHaveTitle('Heliocide Observatory · Museum of Me');
  await expect(page.getByRole('heading', { name: 'In this room' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Guide me there in 3D' })).toHaveAttribute('href', /\?guide=E08$/);
  expect(await page.evaluate(() => window.__museum)).toBeUndefined();
});

test('the welcome links to the collection and a shared record can set a walking guide', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  await page.evaluate(() => window.__museum?.stop());
  await intro.getByRole('link', { name: 'Browse the collection' }).click();
  await expect(page.getByRole('heading', { name: 'Museum of Me collection' })).toBeVisible();
  expect(await page.evaluate(() => window.__museum)).toBeUndefined();
  await page.getByRole('link', { name: 'Heliocide Observatory', exact: true }).click();
  await page.getByRole('link', { name: 'Guide me there in 3D' }).click();
  await page.waitForFunction(() => window.__museum?.ui.map.currentTarget === 'E08', null, { timeout: 30_000 });
  await page.evaluate(() => window.__museum?.stop());
});

test('project searches guide to the correct exhibit and can be saved and recalled in Study Lab', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  await page.evaluate(() => {
    window.__museum?.stop();
    window.__museum?.ui.command.open();
  });
  const command = page.getByRole('combobox', { name: 'Search commands, exhibits, and projects' });
  await command.fill('Large Language Launcher');
  await command.press('Enter');
  expect(await page.evaluate(() => window.__museum?.ui.map.currentTarget)).toBe('E34');

  await page.evaluate(() => window.__museum?.ui.study.open());
  const study = page.getByRole('searchbox', { name: 'Search the collection' });
  const query = 'Large Language Launcher';
  await study.fill(query);
  await page.getByRole('textbox', { name: 'Saved search name' }).fill('Launcher');
  await page.getByRole('button', { name: 'Save search' }).click();
  const results = page.getByRole('region', { name: 'Collection search results' });
  const launcher = results.getByRole('button', { name: /Large Language Launcher.*BigMac Backbone/ });
  await expect(launcher).toBeVisible();
  await study.fill('unmatchablecollectionword');
  await study.press('Enter');
  await expect(results.getByRole('status')).toContainText('No results');
  await page.getByRole('button', { name: 'Launcher', exact: true }).click();
  await expect(study).toHaveValue(query);
  await launcher.click();
  await expect(page.getByRole('heading', { name: 'BigMac Backbone / AndrewOS Control Plane' })).toBeVisible();
});

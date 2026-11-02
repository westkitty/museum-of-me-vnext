import { expect, test } from '@playwright/test';

test('developer flight and sky clock work in the real museum, with night reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1&qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  // Software-rendered CI is slow. Stop the real loop after construction, then
  // exercise actual UI events and deterministic fixed-step player updates.
  await page.evaluate(() => window.__museum?.stop());

  const tools = page.getByRole('complementary', { name: 'Developer flight and sky controls' });
  await expect(tools).toBeVisible();
  const toggle = tools.getByRole('button', { name: 'ENABLE FREE FLIGHT (V)' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__museum?.player.developerFlightMode)).toBe(true);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const startY = await page.evaluate(() => window.__museum?.player.position.y ?? 0);
  await page.keyboard.down('Space');
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    for (let i = 0; i < 12; i++) app.player.fixedUpdate(1 / 60);
  });
  await page.keyboard.up('Space');
  const highY = await page.evaluate(() => window.__museum?.player.position.y ?? 0);
  expect(highY).toBeGreaterThan(startY + 1.0);

  await page.keyboard.down('Control');
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    for (let i = 0; i < 12; i++) app.player.fixedUpdate(1 / 60);
  });
  await page.keyboard.up('Control');
  const lowY = await page.evaluate(() => window.__museum?.player.position.y ?? 0);
  expect(lowY).toBeLessThan(highY - 1.0);

  const slider = tools.getByRole('slider', { name: 'Sky time of day' });
  await slider.evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = '12';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(tools.locator('output')).toHaveText('12:00');
  const day = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    const material = app.sky.mesh.material as { uniforms: { daylight: { value: number } } };
    return { daylight: material.uniforms.daylight.value, horizon: app.sky.horizon.getHex() };
  });
  expect(day.daylight).toBe(1);
  expect(day.horizon).not.toBe(0x17304b);

  await tools.getByRole('button', { name: 'RESTORE CANONICAL NIGHT' }).click();
  const night = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    const material = app.sky.mesh.material as { uniforms: { daylight: { value: number } } };
    return { daylight: material.uniforms.daylight.value, horizon: app.sky.horizon.getHex() };
  });
  expect(night).toEqual({ daylight: 0, horizon: 0x17304b });
  await tools.getByRole('button', { name: 'EXIT FREE FLIGHT (V)' }).click();
  expect(await page.evaluate(() => window.__museum?.player.developerFlightMode)).toBe(false);
  expect(errors).toEqual([]);
});

test('developer tools are absent from the ordinary museum and QA entry', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await expect(page.getByRole('complementary', { name: 'Developer flight and sky controls' })).toHaveCount(0);
  expect(await page.evaluate(() => window.__museum?.player.developerFlightMode)).toBe(false);
});

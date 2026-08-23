import { expect, test, type Page } from '@playwright/test';

async function bootMuseum(page: Page, path = '/'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await expect(page.locator('#museum-canvas')).toBeVisible();

  if (path.includes('qa=1')) {
    const diagnostics = page.locator('.diag');
    await expect(diagnostics).toBeVisible();
    await expect(diagnostics).toContainText('pointer');
    await expect(diagnostics).toContainText('exhibit');
    await expect(page.getByRole('complementary', { name: 'Human QA evidence recorder' })).toBeVisible();
  }

  // The CI runner has no real GPU. Prove that the real WebGL application boots,
  // then stop its render loop so browser semantics can be tested without making
  // software rendering compete with Playwright's own protocol commands.
  await page.evaluate(() => window.__museum?.stop());
  return errors;
}

test('boots at the exterior arrival and keyboard input reaches the real controller', async ({ page }) => {
  const errors = await bootMuseum(page, '/?qa=1');

  const zone = await page.evaluate(() => window.__museum?.currentZone);
  expect(zone).toBe('plaza');
  await expect(page.getByRole('button', { name: 'Enter the museum and capture mouse look' })).toBeVisible();

  const qaToggle = page.getByRole('button', { name: 'QA evidence' });
  await qaToggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Manual evidence only. Mark what you actually observe; telemetry supports the record but does not decide visual, audio, pointer-lock, or performance acceptance.')).toBeVisible();
  await page.locator('#qa-check-0').selectOption('pass');
  await expect(page.getByText('1 passed · 0 needs work · 8 pending')).toBeVisible();
  await page.getByRole('button', { name: 'Capture telemetry snapshot' }).click();
  await expect(page.locator('.qa-capture pre')).toContainText('zone=Arrival Plaza');
  await page.getByRole('button', { name: 'Generate Markdown report' }).click();
  const report = page.getByRole('textbox', { name: 'Generated human QA Markdown report' });
  await expect(report).toHaveValue(/Museum of Me vNext — Human QA Evidence/);
  await expect(report).toHaveValue(/PASS.*Garden and facade composition/s);

  // Report generation intentionally selects its text for easy human copying.
  // Blur that QA-only control before proving the ordinary global movement path.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

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

test('opens the local Full Weasel artifact and restores Museum input on Escape', async ({ page }) => {
  const errors = await bootMuseum(page);
  const embeddedRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/embedded/full-weasel/')) embeddedRequests.push(request.url());
  });

  await expect(page.locator('#panel-full-weasel')).toBeHidden();
  expect(embeddedRequests).toEqual([]);

  await page.evaluate(() => window.__museum?.ui.openFullWeasel());
  const panel = page.locator('#panel-full-weasel');
  await expect(panel).toBeVisible();
  const frame = page.frameLocator('.full-weasel__frame');
  await expect(frame.locator('#root')).toBeVisible();
  expect(embeddedRequests.some((url) => url.endsWith('/embedded/full-weasel/index.html'))).toBe(true);
  await expect.poll(() => page.evaluate(() => ({
    captured: window.__museum?.input.uiCaptured,
    frozen: window.__museum?.player.isFrozen,
  }))).toEqual({ captured: true, frozen: true });

  await frame.locator('body').press('Escape');
  await expect(panel).toBeHidden();
  await expect.poll(() => page.evaluate(() => ({
    captured: window.__museum?.input.uiCaptured,
    frozen: window.__museum?.player.isFrozen,
  }))).toEqual({ captured: false, frozen: false });
  expect(errors).toEqual([]);
});

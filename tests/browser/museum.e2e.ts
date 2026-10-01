import { expect, test, type Page } from '@playwright/test';

async function bootMuseum(page: Page, path = '/'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(path, { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await expect(page.locator('#museum-canvas')).toBeVisible();

  // The CI runner has no real GPU. Prove that the real WebGL application boots,
  // then stop its render loop before any browser-semantic assertions so software
  // rendering cannot starve Playwright's protocol commands.
  await page.evaluate(() => window.__museum?.stop());

  if (path.includes('qa=1')) {
    const diagnostics = page.locator('.diag');
    await expect(diagnostics).toBeVisible();
    await expect(diagnostics).toContainText('pointer');
    await expect(diagnostics).toContainText('exhibit');
    await expect(page.getByRole('complementary', { name: 'Human QA evidence recorder' })).toBeVisible();
  }

  return errors;
}

test('boots at the exterior arrival and keyboard input reaches the real controller', async ({ page }) => {
  const errors = await bootMuseum(page, '/?qa=1');

  const zone = await page.evaluate(() => window.__museum?.currentZone);
  expect(zone).toBe('plaza');
  const entryPrompt = page.getByRole('button', { name: 'Enter the museum and capture mouse look' });
  await expect(entryPrompt).toBeVisible();
  // The authored entrance plate carries the visible arrival copy; the semantic
  // instructions stay in the accessibility tree without painting a second,
  // competing column of text over the artwork.
  await expect(entryPrompt).toHaveAttribute('aria-describedby', 'entry-prompt-copy');
  const entryCopy = page.locator('#entry-prompt-copy');
  await expect(entryCopy).toContainText('WASD or arrow keys move');
  await expect(entryCopy).toContainText('Page Up/Page Down look vertically');
  const copyBounds = await entryCopy.boundingBox();
  expect(copyBounds?.width).toBeLessThanOrEqual(1);
  expect(copyBounds?.height).toBeLessThanOrEqual(1);
  expect(await entryPrompt.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toBe('none');
  // When the plate is suppressed, the clipped copy must come back as the
  // visible affordance instead of leaving an empty full-screen button.
  await page.evaluate(() => { document.documentElement.dataset.transparency = 'reduced'; });
  const reducedBounds = await entryCopy.boundingBox();
  expect(reducedBounds?.width ?? 0).toBeGreaterThan(100);
  await page.evaluate(() => { delete document.documentElement.dataset.transparency; });

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
  await expect(page.getByText('Sound', { exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Overall volume' })).toHaveValue('0');
  await expect(page.getByRole('slider', { name: 'Ambience' })).toHaveValue('0');
  expect(await page.evaluate(() => window.__museum?.audio.isRunning)).toBe(false);
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
  await expect(mirror).toContainText('73 current project identities');
  await expect(mirror).toContainText('T — Visit Thread');
  await expect(mirror).toContainText('Starsilk Universe');
  await expect(mirror).toContainText('BigMac Backbone');

  expect(errors).toEqual([]);
});

test('admits DexGPT only after entry, then guides through the existing wayfinding path', async ({ page }) => {
  const errors = await bootMuseum(page);

  await page.keyboard.press('Control+k');
  const command = page.getByRole('dialog', { name: 'Command palette' });
  await expect(command).toBeVisible();
  await expect(command).not.toContainText('Talk to DexGPT');
  await page.keyboard.press('Escape');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  // Enter through the actual south doorway using the same keyboard input and
  // collision path as a visitor. The stopped render loop means the test must
  // advance the real fixed and variable updates itself.
  await page.keyboard.down('w');
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum app missing');
    for (let i = 0; i < 700; i++) {
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
    }
  });
  await page.keyboard.up('w');
  expect(await page.evaluate(() => window.__museum?.currentZone)).not.toBe('plaza');

  await page.keyboard.press('Control+k');
  expect(await page.evaluate(() => window.__museum?.currentZone)).toBe('south');
  await expect(command).toContainText('Talk to DexGPT');
  await command.getByRole('button', { name: 'Talk to DexGPT — Local museum guide' }).click();

  const guide = page.getByRole('dialog', { name: 'DexGPT' });
  await expect(guide).toBeVisible();
  const query = guide.locator('#dexgpt-guide-query');
  await query.fill('The Full Weasel');
  await query.press('Enter');
  await expect(guide).toContainText('finished birthday rhythm game');
  await expect.poll(() => page.evaluate(() => ({
    captured: window.__museum?.input.uiCaptured,
    frozen: window.__museum?.player.isFrozen,
  }))).toEqual({ captured: true, frozen: true });

  await guide.getByRole('button', { name: 'Guide me to The Full Weasel' }).click();
  await expect(guide).toBeHidden();
  expect(await page.evaluate(() => window.__museum?.wayfinding.currentTarget)).toBe('E27');
  await expect.poll(() => page.evaluate(() => ({
    captured: window.__museum?.input.uiCaptured,
    frozen: window.__museum?.player.isFrozen,
  }))).toEqual({ captured: false, frozen: false });

  // Regression: DexGPT is a first-class modal surface and must be disposed with
  // the UILayer rather than leaving its DOM/listeners behind indefinitely.
  await page.evaluate(() => window.__museum?.ui.dispose());
  await expect(page.locator('#panel-dexgpt-guide')).toHaveCount(0);
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

test('builds a Visit Thread through the production UI and connects it to real wayfinding', async ({ page }) => {
  const errors = await bootMuseum(page);

  await page.keyboard.press('t');
  const panel = page.locator('#panel-visit-thread');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Choose a thread through the museum');

  await panel.getByRole('radio', { name: /Systems/ }).click();
  await panel.getByRole('radio', { name: /Quick · 3 stops/ }).click();
  await panel.getByLabel('Optional topic').fill('continuity architecture');
  await expect(panel.locator('.thread-preview__list li')).toHaveCount(3);
  await expect(panel).toContainText('This is a dry run');

  await panel.getByRole('button', { name: 'Build thread and guide me' }).click();
  const routeCount = await page.evaluate(() => window.__museum?.visitThread.active?.stopIds.length ?? 0);
  expect(routeCount).toBe(3);
  const current = await page.evaluate(() => window.__museum?.visitThread.currentStopId ?? null);
  expect(current).not.toBeNull();
  expect(await page.evaluate(() => window.__museum?.wayfinding.currentTarget ?? null)).toBe(current);
  await expect(panel.locator('.thread-stop')).toHaveCount(3);
  await expect(panel.locator('.thread-stop[data-state="current"]')).toHaveCount(1);
  await expect(panel.locator('.thread-reason').first()).toContainText('continuity architecture');
  await expect(page.locator('.hud__thread')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  const map = page.locator('#panel-map');
  await expect(map).toBeVisible();
  await expect(map.locator('.map__thread-note')).toContainText('Visit Thread');
  expect(await map.locator('.thread-marker').count()).toBeGreaterThan(0);

  expect(errors).toEqual([]);
});

test('keeps Visit Thread and Journal controls usable at a narrow touch-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await bootMuseum(page);

  await page.keyboard.press('t');
  const panel = page.locator('#panel-visit-thread');
  await expect(panel).toBeVisible();
  const box = await panel.locator('.panel__body').boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBe(390);
  const primary = panel.getByRole('button', { name: 'Build thread and guide me' });
  expect((await primary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.keyboard.press('Escape');
  await page.keyboard.press('j');
  const journal = page.locator('#panel-journal');
  await expect(journal).toBeVisible();
  const journalBox = await journal.locator('.panel__body').boundingBox();
  expect(Math.round(journalBox!.width)).toBe(390);

  expect(errors).toEqual([]);
});


test('replays a recent Command Palette action even when the current search no longer matches it', async ({ page }) => {
  const errors = await bootMuseum(page);

  await page.keyboard.press('Control+k');
  const command = page.locator('#panel-command');
  await expect(command).toBeVisible();
  await command.getByRole('button', { name: 'Open map — Wayfinding' }).click();
  await expect(page.locator('#panel-map')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+k');
  await command.locator('#command-search').fill('definitely-no-current-match');
  await expect(command).toContainText('No command or collection item matches');
  const recentMap = command.getByRole('button', { name: 'Open map', exact: true });
  await expect(recentMap).toBeVisible();
  await recentMap.click();
  await expect(page.locator('#panel-map')).toBeVisible();

  expect(errors).toEqual([]);
});

test('searches and filters the local Journal against exhibit, project, bookmark, and note state', async ({ page }) => {
  const errors = await bootMuseum(page);
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum app missing');
    app.journal.markVisited('E22');
    app.journal.setNote('E22', 'Factory provenance and real Phaser preview.');
    app.journal.markVisited('E34');
    app.journal.toggleBookmark('E34');
  });

  await page.keyboard.press('j');
  const journal = page.locator('#panel-journal');
  await expect(journal).toBeVisible();
  const search = journal.getByRole('searchbox', { name: 'Find in this visit' });
  await search.fill('2D Game Factory');
  await expect(journal.getByRole('status')).toContainText('1 entry shown');
  await expect(journal).toContainText('Creative Tools Studio');
  await expect(journal).not.toContainText('BigMac Backbone / AndrewOS Control Plane');

  await search.fill('');
  await journal.getByRole('button', { name: 'With notes' }).click();
  await expect(journal.getByRole('status')).toContainText('1 entry shown');
  await expect(journal.locator('.journal-note')).toHaveValue('Factory provenance and real Phaser preview.');

  await journal.getByRole('button', { name: 'Bookmarked' }).click();
  await expect(journal.getByRole('status')).toContainText('1 entry shown');
  await expect(journal).toContainText('BigMac Backbone / AndrewOS Control Plane');

  expect(errors).toEqual([]);
});

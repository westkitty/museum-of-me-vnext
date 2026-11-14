import { expect, test } from '@playwright/test';

/**
 * Secrets are found by walking somewhere or examining a small object; a find
 * shows a card with the running count, appears in the Journal, and survives a
 * reload. The render loop is stopped (software GL) and updates are driven here.
 */
test('finding secrets shows a card, counts in the Journal, and is remembered', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => {
    localStorage.removeItem('museum-of-me:secrets');
    window.__museum!.secretsLog.clear();
    window.__museum!.stop();
  });

  // An area secret: the end of the pier.
  const pier = await page.evaluate(() => {
    const app = window.__museum!;
    app.player.teleport([0, -0.5, 214], Math.PI);
    app.variableUpdate(1 / 60);
    return { found: app.secrets.foundCount, total: app.secrets.total };
  });
  expect(pier).toEqual({ found: 1, total: 10 });
  await expect(page.locator('.hud__secret')).toContainText('The end of the pier');
  await expect(page.locator('.hud__secret')).toContainText('1 of 10 secrets');

  // An object secret, through the same interaction surface as the exhibits.
  const stone = await page.evaluate(() => {
    const app = window.__museum!;
    app.player.teleport([42.8, -0.5, -84], Math.atan2(1.6, 1.6));
    app.player.pitch = -0.55;
    app.variableUpdate(1 / 60);
    app.render(1);
    app.interaction.update(app.renderer.camera, 1);
    const focus = app.interaction.currentFocus?.exhibitId ?? null;
    const activated = app.interaction.activate();
    return { focus, activated, found: app.secrets.foundCount, exhibitJournalTouched: app.journal.all().some((entry) => entry.exhibitId.startsWith('secret:')) };
  });
  expect(stone).toEqual({ focus: 'secret:tree-roots', activated: true, found: 2, exhibitJournalTouched: false });

  await page.evaluate(() => window.__museum!.ui.journal.open());
  await expect(page.locator('.journal-secrets h3')).toHaveText('Secrets · 2 of 10 found');
  await expect(page.locator('.journal-secrets__found')).toHaveCount(2);
  await expect(page.locator('.journal-secrets__hidden')).toHaveCount(8);

  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  expect(await page.evaluate(() => window.__museum!.secrets.foundCount)).toBe(2);
  expect(errors).toEqual([]);
});

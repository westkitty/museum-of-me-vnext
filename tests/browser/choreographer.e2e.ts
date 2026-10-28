import { expect, test } from '@playwright/test';

test('development choreographer mounts accessibly, shares the app loop and tears down cleanly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?choreo=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  const intro = page.getByRole('dialog', { name: 'Welcome to the Museum of Me' });
  const enter = intro.getByRole('button', { name: 'Enter the museum' });
  await expect(enter).toBeEnabled({ timeout: 20_000 });
  await page.evaluate(() => window.__museum!.stop());
  await enter.click();
  const launcher = page.getByRole('button', { name: 'Visitor Choreographer', exact: true });
  await launcher.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Visitor Choreographer', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Visitor Choreographer', exact: true })).toBeVisible();
  await expect(panel).toContainText('not runtime telemetry');
  await expect(panel.locator('[data-visitor-id]')).toHaveCount(17);
  await expect(panel.locator('[data-evidence-id]')).toHaveCount(17);
  await expect(panel.locator('.choreo-map__structural').first()).toHaveCSS('stroke', 'rgb(232, 198, 90)');
  await expect(panel.locator('.choreo-map__visitor:not(.choreo-map__visitor--staff)').first()).toHaveCSS('fill', 'rgb(232, 198, 90)');
  await expect(panel).toBeFocused();
  expect(await page.evaluate(() => ({ frozen: window.__museum!.player.isFrozen, captured: window.__museum!.input.uiCaptured, modal: window.__museum!.ui.anyPanelOpen }))).toEqual({ frozen: true, captured: true, modal: true });

  // Retain real DOM node references: playback must update the existing projection and report.
  await panel.evaluate(element => {
    (window as unknown as { choreoNodes: Element[] }).choreoNodes = [element.querySelector('svg')!, element.querySelector('[data-visitor-id]')!, element.querySelector('li')!];
  });
  const startPosition = await panel.locator('[data-visitor-id]').first().evaluate(node => [node.getAttribute('cx'), node.getAttribute('cy')]);
  await panel.getByRole('button', { name: 'Play', exact: true }).click();
  await page.evaluate(() => window.__museum!.variableUpdate(0.5));
  await expect(panel.locator('[data-time]')).toHaveText('0.5s');
  expect(await panel.locator('[data-visitor-id]').first().evaluate(node => [node.getAttribute('cx'), node.getAttribute('cy')])).not.toEqual(startPosition);
  await panel.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.evaluate(() => window.__museum!.variableUpdate(0.5));
  await expect(panel.locator('[data-time]')).toHaveText('0.5s');
  await panel.getByRole('slider', { name: 'Simulation time:' }).fill('42');
  await expect(panel.locator('[data-time]')).toHaveText('42.0s');
  await panel.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(panel.locator('[data-time]')).toHaveText('0.0s');
  await panel.getByRole('combobox', { name: 'Floor' }).selectOption('1');
  await expect(panel.locator('[data-visitor-id][display=inline]')).toHaveCount(0);
  await panel.getByRole('checkbox', { name: 'Show all levels' }).check();
  await expect(panel.locator('[data-visitor-id][display=inline]')).toHaveCount(17);
  await panel.getByRole('checkbox', { name: 'Show routes' }).uncheck();
  await expect(panel.locator('[data-route-id][display=inline]')).toHaveCount(0);
  expect(await panel.evaluate(element => {
    const nodes = (window as unknown as { choreoNodes: Element[] }).choreoNodes;
    return nodes[0] === element.querySelector('svg') && nodes[1] === element.querySelector('[data-visitor-id]') && nodes[2] === element.querySelector('li');
  })).toBe(true);

  // Last focusable wraps to the original Panel close control, then back.
  const close = panel.getByRole('button', { name: 'Close (Esc)' });
  await panel.getByRole('checkbox', { name: 'Show routes' }).focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(panel.getByRole('checkbox', { name: 'Show routes' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(launcher).toBeFocused();
  expect(await page.evaluate(() => ({ frozen: window.__museum!.player.isFrozen, captured: window.__museum!.input.uiCaptured }))).toEqual({ frozen: false, captured: false });

  await launcher.click();
  await expect(panel).toBeFocused();
  await page.keyboard.press('m');
  const map = page.locator('#panel-map');
  await expect(map).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(map).toBeHidden();
  await expect(panel).toBeFocused();
  expect(await page.evaluate(() => ({ frozen: window.__museum!.player.isFrozen, captured: window.__museum!.input.uiCaptured }))).toEqual({ frozen: true, captured: true });
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(launcher).toBeFocused();
  expect(await page.evaluate(() => ({ frozen: window.__museum!.player.isFrozen, captured: window.__museum!.input.uiCaptured }))).toEqual({ frozen: false, captured: false });

  await launcher.click();
  // A concurrent existing owner acquired during preview must survive its close.
  await page.evaluate(() => { window.__museum!.player.setFrozen(true); window.__museum!.input.uiCaptured = true; });
  await close.click();
  await expect(launcher).toBeFocused();
  expect(await page.evaluate(() => ({ frozen: window.__museum!.player.isFrozen, captured: window.__museum!.input.uiCaptured }))).toEqual({ frozen: true, captured: true });
  await page.evaluate(() => { window.__museum!.player.setFrozen(false); window.__museum!.input.uiCaptured = false; });
  await launcher.click();
  await page.evaluate(() => window.__museum!.dispose());
  await expect(launcher).toHaveCount(0);
  await expect(page.locator('#panel-choreo')).toHaveCount(0);
  expect(await page.evaluate(() => window.__museum!.ui.anyPanelOpen)).toBe(false);
  expect(errors).toEqual([]);
});

test('ordinary development visitor entry excludes the choreographer', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());
  await expect(page.locator('#panel-choreo')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Visitor Choreographer', exact: true })).toHaveCount(0);
});

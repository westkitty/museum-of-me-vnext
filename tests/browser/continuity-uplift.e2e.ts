import { expect, test, type Page } from '@playwright/test';

/**
 * Continuity uplift, 2026-11-20: repairs D01, D02, D04, D05 and the interface
 * improvements, exercised in the real application. Rendering is stopped after
 * boot (as in museum.e2e.ts) and frames are stepped explicitly so software
 * WebGL cannot starve the protocol.
 */

async function boot(page: Page, path = '/?qa=1'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(path, { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  await page.evaluate(() => { window.__museum?.stop(); window.__museum?.variableUpdate(1 / 60); });
  return errors;
}

async function frames(page: Page, count: number): Promise<void> {
  await page.evaluate((n) => {
    const app = window.__museum!;
    for (let i = 0; i < n; i++) { app.fixedUpdate(1 / 60); app.variableUpdate(1 / 60); }
  }, count);
}

async function enterInterior(page: Page): Promise<void> {
  // Walk through the real doorway: the world handoff waits for the entrance
  // to be prepared, exactly as for a visitor.
  await page.evaluate(() => window.__museum!.player.teleport([0, 0, 133], 0));
  await page.keyboard.down('w');
  for (let i = 0; i < 80; i++) {
    const world = await page.evaluate(async () => {
      const app = window.__museum!;
      if (app.interiorImportStarted && !app.interiorConstructed) await app.ensureInteriorLoaded().catch(() => undefined);
      for (let n = 0; n < 6; n++) { app.fixedUpdate(1 / 60); app.variableUpdate(1 / 60); }
      await new Promise((resolve) => setTimeout(resolve, 50));
      return app.activeWorld;
    });
    if (world === 'interior') break;
  }
  await page.keyboard.up('w');
  expect(await page.evaluate(() => window.__museum!.activeWorld)).toBe('interior');
  // Stand in the south hall, as after walking on from the vestibule.
  await page.evaluate(() => window.__museum!.player.teleport([0, 0, 100], 0));
  await frames(page, 3);
}

test('D01/D05: one welcome card, and its Enter button fits a short landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await boot(page, '/');
  await expect(page.locator('.cinematic-arrival')).toBeVisible();
  expect(await page.evaluate(() => (document.querySelector('.hud__lock') as HTMLElement).hidden)).toBe(true);
  await page.evaluate(() => window.__museum?.start());
  const enter = page.getByRole('button', { name: 'Enter the museum', exact: true });
  await expect(enter).toBeEnabled({ timeout: 30_000 });
  const box = await enter.boundingBox();
  expect(box && box.y + box.height <= 390).toBe(true);
  await enter.click();
  await page.evaluate(() => window.__museum?.stop());
  await expect(page.locator('.cinematic-arrival')).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector('.hud')?.classList.contains('hud--cinematic'))).toBe(false);
});

test('D02/D04: hints clear the corner button; Escape leaves the contents and keys move the visitor again', async ({ page }) => {
  await boot(page);
  // ?qa=1 has no cinematic dialog; complete the one-time entry directly
  // (headless pointer lock is not part of what is being proven here).
  await page.evaluate(() => window.__museum!.ui.hud.completeArrival());
  await frames(page, 2);
  const overlap = await page.evaluate(() => {
    const hints = document.querySelector('.hud__hints')!.getBoundingClientRect();
    const button = document.querySelector('.hud__resume-look')!.getBoundingClientRect();
    return !(hints.bottom <= button.top || hints.right <= button.left || hints.left >= button.right);
  });
  expect(overlap).toBe(false);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'Back to the museum (Escape)' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  const before = await page.evaluate(() => window.__museum!.player.position.z);
  await page.keyboard.down('w');
  await frames(page, 30);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => window.__museum!.player.position.z);
  expect(before - after).toBeGreaterThan(0.5);
  await expect(page.locator('.a11y-floor').first()).toContainText(/floor/);
});

test('I1/I4/I5: map shows both grand stairs; HUD names the floor; arrival names the exhibit', async ({ page }) => {
  await boot(page);
  await enterInterior(page);
  await expect(page.locator('.hud__location span')).toContainText('Ground floor');
  await page.keyboard.press('m');
  await expect(page.locator('.map__stair')).toHaveCount(2);
  await expect(page.locator('.map__plan text', { hasText: 'Stairs up' })).toHaveCount(2);
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.__museum!.player.teleport([12, 10, -1], 0));
  await frames(page, 3);
  await expect(page.locator('.hud__location span')).toContainText('Upper floor');
  await page.keyboard.press('m');
  await expect(page.locator('.map__plan text', { hasText: 'Stairs down' })).toHaveCount(2);
  await page.keyboard.press('Escape');

  // Guide to E14 and stand at its doorway: the floor line completes.
  await page.evaluate(() => window.__museum!.ui.guideToExhibit('E14'));
  await frames(page, 2);
  await expect(page.locator('.hud__subtitle')).toContainText('Follow the floor lights to');
  await page.evaluate(() => window.__museum!.player.teleport([-21.14, 10, -28.38], 0));
  await frames(page, 3);
  const message = await page.locator('.hud__subtitle').textContent();
  expect(message).toMatch(/^You have arrived at E14 · /);
});

test('I12–I14: exhibit reading shows location, related rooms and lifecycle stages', async ({ page }) => {
  await boot(page);
  await enterInterior(page);
  await page.evaluate(() => window.__museum!.ui.deep.openFor('E10'));
  const panel = page.locator('#panel-deep');
  await expect(panel.locator('.exhibit-reading__where')).toContainText(/ground floor: about \d+ m on foot from here/);
  await expect(panel.locator('.stage-chip').first()).toBeVisible();
  await expect(panel.locator('.stage-chip--superseded').first()).toBeVisible();
  const related = panel.locator('.exhibit-reading__related-link');
  if (await related.count()) {
    const label = await related.first().textContent();
    await related.first().click();
    await expect(panel).toContainText(label!.split(' · ')[1]);
  }
});

test('I15/I16/I19/I20: DexGPT context question, settings restore with undo, touch menu parity', async ({ page }) => {
  await boot(page);
  await enterInterior(page);
  await page.evaluate(() => window.__museum!.player.teleport([12, 10, -1], 0));
  await frames(page, 2);
  await page.evaluate(() => window.__museum!.ui.openDexGPTGuide());
  const ask = page.getByRole('button', { name: 'How do I get downstairs?' });
  await expect(ask).toBeVisible();
  await ask.click();
  await expect(page.locator('.guide-answer')).toContainText('east end is nearer');
  await page.keyboard.press('Escape');

  await page.keyboard.press('o');
  await page.locator('#panel-settings input[aria-label="Field of view"]').evaluate((input: HTMLInputElement) => {
    input.value = '80';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Restore default settings' }).click();
  expect(await page.evaluate(() => window.__museum!.preferences.fieldOfView)).toBe(65);
  await page.getByRole('button', { name: 'Undo restore' }).click();
  expect(await page.evaluate(() => window.__museum!.preferences.fieldOfView)).toBe(80);
  await page.keyboard.press('Escape');

  await page.evaluate(() => { const app = window.__museum!; app.input.touchActive = true; app.ui.hud.setTouchMode(true); app.ui.hud.completeArrival(); });
  await frames(page, 1);
  await page.locator('.hud__visitor-menu').click();
  for (const label of ['Read every exhibit (text)', 'Curator Desk', 'Settings', 'Map']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

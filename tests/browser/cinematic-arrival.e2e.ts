import { expect, test } from '@playwright/test';

test('first visitor title is a non-modal welcome with no Enter button; walking dismisses it', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  const intro = page.getByRole('region', { name: 'Welcome to the Museum of Me' });
  await expect(intro).toBeVisible();
  // Admission is the ticket kiosk: the welcome has no "Enter the museum" button.
  await expect(page.getByRole('button', { name: /Enter the museum/ })).toHaveCount(0);
  await expect(intro).toContainText('take a ticket at the kiosk');
  await page.evaluate(() => window.__museum?.stop());
  const state = await page.evaluate(() => ({
    zone: window.__museum?.currentZone,
    frozen: window.__museum?.player.isFrozen,
    captured: window.__museum?.input.uiCaptured,
    ticket: window.__museum?.ticket,
  }));
  // The visitor can walk at once; nothing is held behind the title.
  expect(state).toEqual({ zone: 'plaza', frozen: false, captured: false, ticket: null });
  await page.keyboard.down('w');
  await page.evaluate(() => {
    const app = window.__museum!;
    for (let i = 0; i < 40; i++) { app.fixedUpdate(1 / 60); app.variableUpdate(1 / 60); }
  });
  await page.keyboard.up('w');
  await expect(intro).toHaveCount(0);
  expect(await page.evaluate(() => window.__museum?.arrivalEntered)).toBe(true);
});

test('admission is by ticket: the doorway holds the visitor until the kiosk issues one', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.ticket = null; // QA sessions start holding one
    app.player.teleport([0, 0, 132], 0);
  });
  await page.keyboard.down('w');
  await page.evaluate(() => {
    const app = window.__museum!;
    for (let i = 0; i < 200; i++) { app.fixedUpdate(1 / 60); app.variableUpdate(1 / 60); }
  });
  await page.keyboard.up('w');
  const held = await page.evaluate(() => ({
    world: window.__museum!.activeWorld,
    z: window.__museum!.player.position.z,
    message: document.querySelector('.hud__threshold p')?.textContent,
  }));
  expect(held.world).toBe('exterior');
  expect(held.z).toBeGreaterThan(128);
  expect(held.message).toContain('Take one from the kiosk');
  await page.getByRole('button', { name: 'Take a ticket' }).click();
  const ticket = await page.evaluate(() => ({ ticket: window.__museum!.ticket, started: window.__museum!.interiorImportStarted }));
  expect(ticket.ticket?.number).toMatch(/^\d{4}$/);
  expect(ticket.started).toBe(true);
});

test('QA and Workshop paths bypass the visitor title dwell', async ({ page }) => {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__museum?.arrivalReady)).toBe(true);
});

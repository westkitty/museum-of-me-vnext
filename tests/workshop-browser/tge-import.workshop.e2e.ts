import { expect, test } from '@playwright/test';

test('imports a pinned candidate into the actual Builder and inspects bounds', async ({ page }) => {
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  const workshop = page.locator('.museum-workshop');
  const buildMode = page.getByRole('button', { name: 'Enter Build Mode' });
  await expect(buildMode).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await expect(workshop).toBeAttached({ timeout: 60_000 });
  await buildMode.click();
  await expect(workshop).toBeVisible();
  await workshop.getByRole('button', { name: 'Inspect current scene data' }).click();
  await expect(workshop.locator('[data-workshop="scene-index-summary"]')).toContainText('35 exhibits');
  await workshop.getByLabel('Scene index exhibit').selectOption('E03');
  await expect(workshop.locator('[data-workshop="scene-index-detail"]')).toContainText('E03 · north');
  await expect(workshop.locator('[data-workshop="scene-index-summary"]')).toContainText('colliders');
  await expect(workshop.locator('[data-workshop="scene-index-unavailable"]')).toContainText('masked-floor exact geometry');
  await workshop.getByRole('button', { name: 'Scan authored route obstructions' }).click();
  await expect(workshop.locator('[data-workshop="clearance-status"]')).toContainText('WARNING');
  await expect(workshop.locator('[data-workshop="clearance-status"]')).toContainText('real traversal');
  await page.evaluate(() => window.__museum!.exteriorWorld.collision.setDynamicWall('clearance-fixture', {
    kind: 'wall', minX: -1, maxX: 1, minY: -1, maxY: 3, minZ: 159, maxZ: 161,
  }));
  await workshop.getByRole('button', { name: 'Scan authored route obstructions' }).click();
  await expect(workshop.locator('[data-workshop="clearance-results"]')).toContainText('clearance-fixture');
  await page.evaluate(() => window.__museum!.exteriorWorld.collision.setDynamicWall('clearance-fixture', null));
  // Hold the installation-status reply until the import has finished, so a stale
  // "Not installed" reply arrives last; it must not overwrite the import result.
  let importDone!: () => void;
  const imported = new Promise<void>((resolve) => { importDone = resolve; });
  await page.route('**/__museum-workshop/tge-status*', async (route) => {
    await imported;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  // A cold thumbnail cache on a slow network: each thumbnail can take seconds (the
  // server fetches it from the pinned source). Browsing must never hold more than
  // two browser connections, so the import, its status check and the model
  // download are not starved (Chrome allows six per host).
  let thumbnailsInFlight = 0;
  let maxThumbnailsInFlight = 0;
  const isThumbnail = (url: string) => url.includes('/__museum-workshop/tge-thumbnail');
  page.on('request', (value) => {
    if (isThumbnail(value.url())) maxThumbnailsInFlight = Math.max(maxThumbnailsInFlight, ++thumbnailsInFlight);
  });
  const settled = (value: import('@playwright/test').Request) => { if (isThumbnail(value.url())) thumbnailsInFlight--; };
  page.on('requestfinished', settled);
  page.on('requestfailed', settled);
  await page.route('**/__museum-workshop/tge-thumbnail*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.continue().catch(() => undefined);
  });
  await workshop.getByRole('button', { name: 'Browse source catalog' }).click();
  await workshop.getByLabel('Search source candidates').fill('blaster-kit/blaster-a');
  const item = workshop.locator('[data-source-id="blaster-kit/blaster-a"]');
  await expect(item).toBeEnabled({ timeout: 30_000 });
  expect(maxThumbnailsInFlight).toBeGreaterThan(0);
  expect(maxThumbnailsInFlight).toBeLessThanOrEqual(2);
  await item.click();
  const response = page.waitForResponse((value) => value.url().endsWith('/__museum-workshop/tge-import'));
  await workshop.getByRole('button', { name: /Import and place selected model|Place cached model/ }).click();
  expect((await response).status()).toBe(200);
  await expect(workshop.locator('[data-workshop="source-inspector"]')).toContainText('bounds', { timeout: 60_000 });
  importDone();
  await page.waitForResponse((value) => value.url().includes('/__museum-workshop/tge-status'));
  await page.waitForTimeout(300);
  await expect(workshop.locator('[data-workshop="source-inspector"]')).toContainText('bounds');
  await page.unroute('**/__museum-workshop/tge-status*');
  await expect(workshop.locator('[data-workshop="selection-title"]')).toHaveText('Blaster a');
  await page.waitForFunction(() => {
    const root = window.__museum?.scene.getObjectByName('workshop:catalog-model-01');
    return Boolean(root?.children.length && root.children[0].type === 'Group');
  }, null, { timeout: 60_000 });
  await item.click();
  await expect(workshop.locator('[data-workshop="source-inspector"]')).toContainText('Installed locally');
  await expect(workshop.getByRole('button', { name: 'Place cached model' })).toBeEnabled();
  // Interior handoff requires the existing frame-driven prewarm to finish.
  await page.evaluate(() => window.__museum?.start());
  await expect.poll(() => page.evaluate(() => window.__museum?.streaming?.telemetry.prewarmReady), { timeout: 80_000 }).toBe(true);
  await workshop.locator('[data-workshop="world-interior"]').click();
  await expect.poll(() => page.evaluate(() => window.__museum?.activeWorld), { timeout: 60_000 }).toBe('interior');
  await page.evaluate(() => (window.__museum as unknown as { workshopUpdate: () => void }).workshopUpdate());
  expect(await page.evaluate(() => window.__museum?.scene.getObjectByName('workshop:catalog-model-01')?.children[0]?.type)).toBe('Mesh');
  await workshop.locator('[data-workshop="world-exterior"]').click();
  await expect.poll(() => page.evaluate(() => window.__museum?.activeWorld), { timeout: 60_000 }).toBe('exterior');
  await page.evaluate(() => (window.__museum as unknown as { workshopUpdate: () => void }).workshopUpdate());
  await page.waitForFunction(() => window.__museum?.scene.getObjectByName('workshop:catalog-model-01')?.children[0]?.type === 'Group', null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
});

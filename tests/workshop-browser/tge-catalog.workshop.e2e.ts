import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serializeWorkshopManifest, validateWorkshopManifest } from '../../src/workshop/schema';

const placementFile = resolve(process.cwd(), 'data/workshop-placements.json');
// Read as data: Playwright's Node loader requires JSON import attributes.
const report = JSON.parse(readFileSync(resolve(process.cwd(), 'src/workshop/catalog-data/tge-verification.json'), 'utf8')) as {
  verified: string[]; rejected: { id: string; status: string; detail?: string }[];
};
let placementBeforeTest: Buffer | null = null;
let exactTestSave: string | null = null;

// Same ownership rule as the main Workshop journey: only restore bytes this test wrote.
test.beforeEach(async ({ page }) => {
  placementBeforeTest = await readFile(placementFile);
  exactTestSave = null;
  const source = validateWorkshopManifest(JSON.parse(placementBeforeTest.toString('utf8')) as unknown);
  if (!source.ok || !source.value || source.value.objects.length !== 0 || (source.value.sceneOverrides?.length ?? 0) !== 0) {
    throw new Error('Catalog browser test requires an empty placement fixture; refusing to overwrite authored placements.');
  }
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().endsWith('/__museum-workshop/save')) return;
    try {
      const parsed = validateWorkshopManifest(request.postDataJSON() as unknown);
      if (parsed.ok && parsed.value) exactTestSave = serializeWorkshopManifest(parsed.value);
    } catch { /* never authorizes restoration */ }
  });
});

test.afterEach(async () => {
  if (placementBeforeTest === null) return;
  const current = await readFile(placementFile);
  if (current.equals(placementBeforeTest)) return;
  if (exactTestSave === null || current.toString('utf8') !== exactTestSave) {
    throw new Error('Workshop placement source changed unexpectedly; preserving it rather than overwriting other work.');
  }
  await writeFile(placementFile, placementBeforeTest);
});

async function openBuilder(page: import('@playwright/test').Page) {
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  const workshop = page.locator('.museum-workshop');
  const buildMode = page.getByRole('button', { name: 'Enter Build Mode' });
  await expect(buildMode).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await expect(workshop).toBeAttached({ timeout: 60_000 });
  await buildMode.click();
  await expect(workshop).toBeVisible();
  return workshop;
}

test('filters the full pinned catalog, refuses unsupported models, and saves and reloads an imported placement', async ({ page, request }) => {
  const rejected = report.rejected.filter((entry) => entry.status !== 'fetch-failed');
  const target = report.verified.includes('food-kit/mortar') ? 'food-kit/mortar' : report.verified.find((id) => !id.startsWith('blaster-kit/'))!;
  expect(target).toBeTruthy();
  const workshop = await openBuilder(page);
  await workshop.getByRole('button', { name: 'Browse source catalog' }).click();
  const count = workshop.locator('[data-workshop="source-count"]');
  await expect(count).toContainText('1883 source candidates');
  const status = workshop.getByLabel('Import status');
  await status.selectOption('importable');
  await expect(count).toContainText(`${report.verified.length} source candidates`);
  await status.selectOption('unsupported');
  await expect(count).toContainText(`${rejected.length} source candidates`);
  await status.selectOption('unchecked');
  await expect(count).toContainText(`${1883 - report.verified.length - rejected.length} source candidates`);
  await status.selectOption('');

  if (rejected.length) {
    const bad = rejected[0]!;
    await workshop.getByLabel('Search source candidates').fill(bad.id);
    const tile = workshop.locator(`[data-source-id="${bad.id}"]`);
    await expect(tile).toHaveAttribute('data-source-availability', 'unsupported');
    await expect(tile).toContainText('Not importable');
    await expect(tile).toBeEnabled({ timeout: 30_000 });
    await tile.click();
    await expect(workshop.locator('[data-workshop="source-inspector"]')).toContainText('Not importable');
    await expect(workshop.locator('[data-workshop="source-inspector"]')).toContainText(bad.detail ?? bad.status);
    await expect(workshop.getByRole('button', { name: 'Import and place selected model' })).toBeDisabled();
  }

  await workshop.getByLabel('Search source candidates').fill(target);
  const item = workshop.locator(`[data-source-id="${target}"]`);
  await expect(item).toHaveAttribute('data-source-availability', 'importable');
  await expect(item).toBeEnabled({ timeout: 30_000 });
  await item.click();
  const imported = page.waitForResponse((value) => value.url().endsWith('/__museum-workshop/tge-import'));
  await workshop.getByRole('button', { name: /Import and place selected model|Place cached model/ }).click();
  const importResponse = await imported;
  expect(importResponse.status()).toBe(200);
  const { assetId } = await importResponse.json() as { assetId: string };
  expect(assetId).toMatch(/^workshop-models\/[a-f0-9]{64}\.glb$/);
  await expect(workshop.locator('[data-workshop="source-inspector"]')).toContainText('bounds', { timeout: 60_000 });
  await page.waitForFunction(() => {
    const root = window.__museum?.scene.getObjectByName('workshop:catalog-model-01');
    return Boolean(root?.children.length && root.children[0].type === 'Group');
  }, null, { timeout: 60_000 });
  await workshop.locator('[data-workshop="px"]').fill('30');
  await workshop.locator('[data-workshop="px"]').blur();
  await workshop.locator('[data-workshop="pz"]').fill('42');
  await workshop.locator('[data-workshop="pz"]').blur();
  await expect(workshop.locator('[data-workshop="px"]')).toHaveValue('30.000');

  const saveResponse = page.waitForResponse((response) =>
    response.url().endsWith('/__museum-workshop/save') && response.request().method() === 'POST');
  await workshop.getByRole('button', { name: 'Save to build' }).click();
  expect((await saveResponse).status()).toBe(200);
  const persisted = await (await request.get('/data/workshop-placements.json')).json() as {
    objects: { id: string; assetId?: string; position: number[] }[];
  };
  expect(persisted.objects).toHaveLength(1);
  expect(persisted.objects[0]).toMatchObject({ id: 'catalog-model-01', assetId });
  expect(persisted.objects[0]!.position[0]).toBeCloseTo(30, 3);

  // Reload: the saved source must recreate the imported placement from local, verified bytes.
  await openBuilder(page);
  await page.waitForFunction(() => {
    const root = window.__museum?.scene.getObjectByName('workshop:catalog-model-01');
    return Boolean(root && Math.abs(root.position.x - 30) < 1e-3 && Math.abs(root.position.z - 42) < 1e-3
      && root.children.length && root.children[0].type === 'Group');
  }, null, { timeout: 60_000 });
  const reloaded = await page.evaluate(() => {
    const root = window.__museum!.scene.getObjectByName('workshop:catalog-model-01')!;
    let meshes = 0;
    root.traverse((node) => { if ((node as { isMesh?: boolean }).isMesh) meshes++; });
    return { meshes };
  });
  expect(reloaded.meshes).toBeGreaterThan(0);
  await page.evaluate(() => window.__museum?.stop());
});

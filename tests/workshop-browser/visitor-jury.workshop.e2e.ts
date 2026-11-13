import { expect, test } from '@playwright/test';

type Vec = [number, number, number];
type Builder = { placements: { captureManifest(): unknown; replaceManifest(raw: unknown, options?: { history?: boolean }): unknown } };

test('Virtual Visitor Jury walks the live museum, names a placed blocker, feeds Museum Health, and changes nothing', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await page.waitForFunction(() => Boolean(window.__museumWorkshop), null, { timeout: 60_000 });

  const panel = page.locator('.museum-workshop');
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-workshop="jury-status"]')).toHaveText('Not tested.');

  // Unmodified museum: every exhibit, both stairs and the Sanctuary are walked and pass.
  await panel.locator('[data-workshop="jury-run"]').click();
  await expect(panel.locator('[data-workshop="jury-status"]')).toContainText('PASS: 35 exhibits (35 PASS)');
  await expect(panel.locator('[data-jury-exhibit]')).toHaveCount(35);
  await expect(panel.locator('[data-jury-exhibit][data-jury-status="PASS"]')).toHaveCount(35);
  for (const id of ['stair:grand-stair-sw', 'stair:grand-stair-se', 'sanctuary', 'canonical', 'hall:media', 'hall:infra']) {
    await expect(panel.locator(`[data-jury-route="${id}"]`)).toHaveAttribute('data-jury-status', 'PASS');
  }
  // Outside: the arrival, the pier and all five island paths (rerouted around the museum) are walked in the live exterior world.
  await expect(panel.locator('[data-workshop="jury-exterior-status"]')).toContainText('exterior routes all walked without a break');
  for (const id of ['exterior:arrival', 'exterior:pier', ...[1, 2, 3, 4, 5].map((k) => `exterior:path-${k}`)]) {
    await expect(panel.locator(`[data-jury-route="${id}"]`)).toHaveAttribute('data-jury-status', 'PASS');
  }
  await expect(panel.locator('[data-jury-route^="exterior:"]')).toHaveCount(7);
  await panel.locator('[data-workshop="health-run"]').click();
  await expect(panel.locator('[data-health-check="visitor-jury"]')).toHaveAttribute('data-health-status', 'PASS');
  await expect(panel.locator('[data-health-check="exterior-jury"]')).toHaveAttribute('data-health-status', 'PASS');

  // A solid wall across the E03 bay approach. Conservation forbids placements in an exhibit's
  // read zone, so it is injected through the schema-only history-restore path to prove the
  // jury detects a live collider; the Builder's normal placement flow would have refused it.
  const blocker = await page.evaluate(async () => {
    const load = (url: string) => import(/* @vite-ignore */ url);
    const sceneIndex = await load('/src/workshop/SceneIndex.ts') as typeof import('../../src/workshop/SceneIndex');
    const index = sceneIndex.buildMuseumSceneIndex({ schemaVersion: 2, objects: [] });
    const exhibit = index.exhibits.find((item) => item.id === 'E03')!;
    const hall = index.route.find((point) => point.label === `${exhibit.wing}: outside E03`)!.position;
    const p: Vec = [0, 1, 2].map((k) => Math.round(((hall[k] + exhibit.visitorSpot[k]) / 2) * 10_000) / 10_000) as Vec;
    const alongX = Math.abs(exhibit.visitorSpot[0] - hall[0]) > Math.abs(exhibit.visitorSpot[2] - hall[2]);
    return { position: p, scale: (alongX ? [0.4, 1.5, 5] : [5, 1.5, 0.4]) as Vec };
  });
  await page.evaluate(({ position, scale }) => {
    const builder = window.__museumWorkshop as unknown as Builder;
    const current = builder.placements.captureManifest() as { objects: unknown[] };
    builder.placements.replaceManifest({ ...current, objects: [...current.objects, { id: 'jury-blocker', label: 'Jury blocker',
      prefab: 'display-plinth', anchor: 'floor', position, rotation: [0, 0, 0], scale, worldId: 'interior', collision: 'solid' }] },
    { history: true });
  }, blocker);
  const before = await page.evaluate(() => JSON.stringify((window.__museumWorkshop as unknown as Builder).placements.captureManifest()));

  // The stale jury result is not reused for the changed manifest.
  await panel.locator('[data-workshop="health-run"]').click();
  await expect(panel.locator('[data-health-check="visitor-jury"]')).toHaveAttribute('data-health-status', 'NOT TESTED');

  await panel.locator('[data-workshop="jury-run"]').click();
  await expect(panel.locator('[data-workshop="jury-status"]')).toContainText('FAIL');
  const e03 = panel.locator('[data-jury-exhibit="E03"]');
  await expect(e03).toHaveAttribute('data-jury-status', 'FAIL');
  await expect(e03).toContainText('reached FAIL');
  // Stopped behind the wall, the visitor also cannot see the hero from where they stand.
  await expect(e03).toContainText('hero FAIL');
  await expect(e03).toContainText('return PASS');
  await expect(e03.locator('[data-jury-subject="jury-blocker"]').first()).toContainText('Jury blocker');
  await expect(panel.locator('[data-jury-exhibit][data-jury-status="PASS"]')).toHaveCount(34);

  await panel.locator('[data-workshop="health-run"]').click();
  const health = panel.locator('[data-health-check="visitor-jury"]');
  await expect(health).toHaveAttribute('data-health-status', 'FAIL');
  await expect(health.locator('[data-health-subject="jury-blocker"]')).toContainText('Jury blocker');

  const after = await page.evaluate(() => JSON.stringify((window.__museumWorkshop as unknown as Builder).placements.captureManifest()));
  expect(after).toBe(before);
  expect(errors).toEqual([]);
});

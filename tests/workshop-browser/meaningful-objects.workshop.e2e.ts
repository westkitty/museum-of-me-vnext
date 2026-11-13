import { expect, test } from '@playwright/test';

type Vec = [number, number, number];

test('a Meaningful Object drives the real E07 installation through its own control path, and a misplaced binding is reported', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await page.waitForFunction(() => Boolean(window.__museumWorkshop), null, { timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window.__museum as unknown as { sourceInstallations?: unknown }).sourceInstallations), null, { timeout: 90_000 });

  // A conservation-valid spot in the E07 bay, found with the real modules.
  const spot = await page.evaluate(async () => {
    const load = (url: string) => import(/* @vite-ignore */ url);
    const layout = await load('/src/world/layout.ts') as typeof import('../../src/world/layout');
    const placement = await load('/src/world/installationPlacement.ts') as typeof import('../../src/world/installationPlacement');
    const conservation = await load('/src/workshop/conservation.ts') as typeof import('../../src/workshop/conservation');
    const bay = layout.PLACEMENTS.find((item) => item.exhibitId === 'E07')!;
    const anchor = placement.INSTALLATION_PLACEMENT_BY_ID.get('drakken-sandbox')!.position;
    const points: Vec[] = [];
    for (let x = bay.bounds.c[0] - bay.bounds.h[0] + 1; x <= bay.bounds.c[0] + bay.bounds.h[0] - 1; x += 0.5) {
      for (let z = bay.bounds.c[2] - bay.bounds.h[2] + 1; z <= bay.bounds.c[2] + bay.bounds.h[2] - 1; z += 0.5) points.push([x, anchor[1], z]);
    }
    points.sort((a, b) => Math.hypot(a[0] - anchor[0], a[2] - anchor[2]) - Math.hypot(b[0] - anchor[0], b[2] - anchor[2]));
    return points.find((p) => Math.hypot(p[0] - anchor[0], p[2] - anchor[2]) <= 8 && conservation.validateWorkshopManifestForMuseum({ schemaVersion: 2,
      objects: [{ id: 'strain-lever', label: 'Strain lever', prefab: 'sign-post', anchor: 'floor', position: p, rotation: [0, 0, 0], scale: [1, 1, 1],
        worldId: 'interior', meaning: 'e07-strain-3' }] }, []).ok) ?? null;
  });
  expect(spot).not.toBeNull();

  await page.evaluate((position) => {
    const builder = window.__museumWorkshop as unknown as { placements: { setRecord(record: unknown): unknown } };
    builder.placements.setRecord({ id: 'strain-lever', label: 'Strain lever', prefab: 'sign-post', anchor: 'floor', position,
      rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'interior' });
  }, spot as Vec);

  // Bind through the real inspector.
  const panel = page.locator('.museum-workshop');
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await page.evaluate(() => (window.__museumWorkshop as unknown as { refresh(): void }).refresh());
  await panel.locator('[data-workshop="outliner"]').getByRole('button', { name: /Strain lever/ }).click();
  await panel.locator('[data-workshop="meaning"]').selectOption('e07-strain-3');
  await expect.poll(() => page.evaluate(() => (window.__museumWorkshop as unknown as {
    placements: { getRecord(id: string): { meaning?: string } | null } }).placements.getRecord('strain-lever')?.meaning)).toBe('e07-strain-3');

  // Activating the object changes the installation exactly as the visitor's "3" key would.
  const result = await page.evaluate(async () => {
    const app = window.__museum as unknown as {
      sourceInstallations: { status(id: string): string; reset(id: string): void };
      interaction: { controls: Map<unknown, { exhibitId: string; activate(): void; label(): string }> };
    };
    const load = (url: string) => import(/* @vite-ignore */ url);
    const state = await load('/src/content/installationState.ts') as typeof import('../../src/content/installationState');
    app.sourceInstallations.reset('drakken-sandbox');
    const before = app.sourceInstallations.status('drakken-sandbox');
    const control = [...app.interaction.controls.values()].find((item) => item.exhibitId === 'workshop:strain-lever')!;
    control.activate();
    const after = app.sourceInstallations.status('drakken-sandbox');
    const expected = state.describeInstallationState('drakken-sandbox',
      state.applyInstallationKey('drakken-sandbox', state.defaultStateFor('drakken-sandbox'), 'Digit3').state);
    return { before, after, expected, label: control.label() };
  });
  expect(result.label).toContain('Select strain 3');
  expect(result.after).not.toBe(result.before);
  expect(result.after).toContain(result.expected);

  // Moving the bound object out of the E07 bay makes the binding meaningless: Museum Health
  // reports a conservation FAIL naming it (and the same rule blocks saving).
  await panel.locator('[data-workshop="px"]').fill(String((spot as Vec)[0] + 40));
  await panel.locator('[data-workshop="px"]').blur();
  await panel.locator('[data-workshop="health-run"]').click();
  const conservation = panel.locator('[data-health-check="conservation"]');
  await expect(conservation).toHaveAttribute('data-health-status', 'FAIL');
  await expect(conservation).toContainText('must stand in the E07 bay');
  await expect(conservation.locator('[data-health-subject="strain-lever"]')).toBeVisible();
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';

interface Builder {
  placements: {
    captureManifest(): { objects: { id: string; prefab: string }[]; curator?: { decisions: { kind: string; objectId: string; outcome: string }[] } };
    objectCount: number;
  };
}

test('Auto-Curate suggests, previews, and changes the museum only on approval; rejection is remembered and undo restores', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?edit=1', { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => window.__museum?.stop());
  await page.waitForFunction(() => Boolean(window.__museumWorkshop), null, { timeout: 60_000 });
  const manifest = () => page.evaluate(() => JSON.stringify((window.__museumWorkshop as unknown as Builder).placements.captureManifest()));
  const parsed = async () => JSON.parse(await manifest()) as ReturnType<Builder['placements']['captureManifest']>;
  const original = await manifest();

  const panel = page.locator('.museum-workshop');
  await page.getByRole('button', { name: 'Enter Build Mode' }).click();
  await expect(panel).toBeVisible();
  await panel.locator('[data-workshop="curate-mode"]').selectOption('furnish');
  await panel.locator('[data-workshop="curate-density"]').selectOption('rich');
  await panel.locator('[data-workshop="curate-scope"]').selectOption('north');
  await panel.locator('[data-workshop="curate-run"]').click();
  const rows = panel.locator('[data-curate-suggestion]');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  expect(count).toBeGreaterThan(1);
  await expect(panel.locator('[data-workshop="curate-status"]')).toContainText('Nothing changes until you approve');

  // Preview draws a ghost and changes nothing.
  const first = rows.first();
  const firstId = (await first.getAttribute('data-curate-suggestion'))!;
  await first.locator('[data-curate-action="preview"]').click();
  expect(await page.evaluate(() => Boolean(window.__museum!.scene.getObjectByName('workshop-walkway-ghost')))).toBe(true);
  expect(await manifest()).toBe(original);

  // Approve adds exactly that bench, remembers the approval, and the suggestion is not offered again.
  await first.locator('[data-curate-action="approve"]').click();
  await expect(panel.locator(`[data-curate-suggestion="${firstId}"]`)).toHaveCount(0);
  const approved = await parsed();
  expect(approved.objects.filter((record) => record.id === firstId)).toEqual([expect.objectContaining({ prefab: 'museum-bench' })]);
  expect(approved.curator?.decisions).toEqual([expect.objectContaining({ kind: 'furnish-add', objectId: firstId, outcome: 'approved' })]);

  // Reject is remembered and the suggestion is reported as skipped, not re-proposed.
  const next = rows.first();
  const nextId = (await next.getAttribute('data-curate-suggestion'))!;
  await next.locator('[data-curate-action="reject"]').click();
  await expect(panel.locator(`[data-curate-suggestion="${nextId}"]`)).toHaveCount(0);
  await expect(panel.locator(`[data-curate-skipped="${nextId}"]`)).toContainText('rejected by the curator');
  expect((await parsed()).objects.some((record) => record.id === nextId)).toBe(false);

  // Each decision is its own undoable step.
  await panel.locator('[data-workshop="undo"]').click();
  await panel.locator('[data-workshop="undo"]').click();
  await expect.poll(manifest).toBe(original);
  expect(errors).toEqual([]);
});

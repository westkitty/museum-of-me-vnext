import { expect, test } from '@playwright/test';

test('top-down workbench: grounded source, both levels, search and overlays', async ({ page }) => {
  const errors: string[] = [];
  const remote: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {
    if (new URL(r.url()).origin !== 'http://127.0.0.1:4173') remote.push(r.url());
  });
  await page.goto('/workbench/');
  const proof = await page.evaluate(() => (window as Window & { MuseumWorkbenchProof?: {
    source: { sha: string }; exhibitCount: number; projectCount: number;
    wingCount: number; visitorIdentityCount: number;
    legacyInstallationCount: number; supplementaryCount: number;
  }}).MuseumWorkbenchProof);
  expect(proof).toMatchObject({
    source: { sha: '6278d2c8fea5b27466bc4840170b3d25e611e3c1' },
    exhibitCount: 35, projectCount: 73, wingCount: 6,
    legacyInstallationCount: 14, supplementaryCount: 15, visitorIdentityCount: 17,
  });
  await expect(page.locator('#planGeometry [data-id]')).toHaveCount(29);
  await page.locator('#floor1').click();
  await expect(page.locator('#planGeometry [data-id]')).toHaveCount(6);
  await page.locator('#floor0').click();
  await page.locator('#search').fill('Selfsame');
  await expect(page.locator('#exhibitList button')).toHaveCount(1);
  await page.locator('#exhibitList button').first().click();
  await expect(page.locator('#inspectorContent h3')).toHaveText('Selfsame: Continuity & Authority Systems');
  await page.locator('#proposalNotes').fill('Draft proposal only; not implementation.');
  const note = await page.evaluate(() => JSON.parse(localStorage.getItem('museum-of-me-topdown-proposals-v1') ?? '{}').notes?.E11);
  expect(note).toBe('Draft proposal only; not implementation.');
  await page.locator('#toggleSources').click();
  await expect(page.locator('#planOverlays [data-source]')).toHaveCount(13);
  await page.locator('#floor1').click();
  await expect(page.locator('#planOverlays [data-source]')).toHaveCount(1);
  await page.locator('#floor0').click();
  await page.locator('#toggleRoutes').click();
  await expect(page.locator('#planOverlays polyline.route')).toHaveCount(17);
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
});

test('top-down workbench: calibrated pan, ruler, pin, exports, undo and source-pin rejection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/workbench/');
  const svg = page.locator('#mapSvg');
  await expect(page.locator('#planGeometry [data-id]')).toHaveCount(29);
  const b = await svg.boundingBox();
  if (!b) throw Error('map has no visible bounds');
  const before = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  const x = b.x + b.width * 0.50, y = b.y + b.height * 0.58;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 150, y, { steps: 5 });
  await page.mouse.up();
  const after = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  expect(after[0] - before[0]).toBeCloseTo(-150 * before[2] / b.width, 1);
  await page.locator('#fit').click();
  await page.locator('#toolMeasure').click();
  await page.mouse.click(b.x + b.width * 0.39, b.y + b.height * 0.55);
  await page.mouse.click(b.x + b.width * 0.66, b.y + b.height * 0.64);
  await expect(page.locator('#planOverlays .measure-path')).toHaveCount(1);
  await expect(page.locator('#statusMessage')).toContainText('not a walking route');
  await page.locator('#toolPin').click();
  await page.mouse.click(b.x + b.width * 0.5 + 130, b.y + b.height * 0.6);
  await expect(page.locator('#pinTitle')).toHaveCount(1);
  await page.locator('#pinTitle').fill('Review this alcove');
  await page.locator('#pinBody').fill('Proposed interpretation area');
  const jsonEvent = page.waitForEvent('download');
  await page.locator('#exportPlan').click();
  const jsonDownload = await jsonEvent;
  const stream = await jsonDownload.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const plan = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(plan.format).toBe('museum-of-me-topdown-plan');
  expect(plan.planningOnly).toBe(true);
  expect(plan.pins[0].title).toBe('Review this alcove');
  const svgEvent = page.waitForEvent('download');
  await page.locator('#exportSvg').click();
  expect((await svgEvent).suggestedFilename()).toContain('Topdown.svg');
  await page.locator('#deletePin').click();
  await expect(page.locator('#planOverlays [data-pin]')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#planOverlays [data-pin]')).toHaveCount(1);
  await page.locator('#importFile').setInputFiles({
    name: 'wrong-revision.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...plan, source: { ...plan.source, sha: '00000000' } })),
  });
  await expect(page.locator('#statusMessage')).toContainText('import refused');
  await expect(page.locator('#planOverlays [data-pin]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

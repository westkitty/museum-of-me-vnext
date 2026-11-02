import { expect, test } from '@playwright/test';

test('optional 3D workbench loads real museum geometry while preserving the 2D plan', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {
    if (new URL(r.url()).origin !== new URL(baseURL!).origin) externalRequests.push(r.url());
  });
  await page.goto('/workbench/');
  await expect(page.locator('#planGeometry [data-id]')).toHaveCount(29);
  await expect(page.locator('#viewer3d')).toHaveAttribute('src', 'about:blank');
  await expect(page.locator('#view2d')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#view3d').click();
  await expect(page.locator('#view3d')).toHaveAttribute('aria-pressed', 'true');
  const viewer = page.frameLocator('#viewer3d');
  await expect(viewer.locator('#viewerStatus')).toContainText('Actual 3D museum geometry ready', { timeout: 90_000 });

  const proof = await viewer.locator('body').evaluate(() =>
    (window as Window & { Museum3DProof?: {
      sceneSource: string; threeRevision: string; realMuseumRoot: boolean;
      exhibitAnchors: number; authoredVisitorRoutes: number; zoneCount: number;
    } }).Museum3DProof,
  );
  expect(proof).toMatchObject({
    sceneSource: 'Museum.build()', threeRevision: '185', realMuseumRoot: true,
    exhibitAnchors: 35, authoredVisitorRoutes: 17,
  });
  expect(proof?.zoneCount).toBeGreaterThanOrEqual(7);

  await page.locator('#open3dCollection').click();
  await expect(page.locator('#collectionPane')).toBeVisible();
  await page.locator('#search').fill('Selfsame');
  await page.locator('#exhibitList button').first().click();
  await expect(page.locator('#inspectorContent h3')).toHaveText('Selfsame: Continuity & Authority Systems');
  await expect.poll(() => viewer.locator('body').evaluate(() =>
    (window as unknown as Window & { Museum3DProof: {
      getState(): { selected: string | null };
    } }).Museum3DProof.getState().selected,
  )).toBe('E11');

  // The survey defaults to model-first with its secondary controls folded.
  await viewer.locator('#toggleTools').click();
  await expect(viewer.locator('#detailControls')).toBeVisible();
  await viewer.locator('#floor').selectOption('upper');
  await expect.poll(() => viewer.locator('body').evaluate(() =>
    (window as unknown as Window & { Museum3DProof: {
      getState(): { floor: string };
    } }).Museum3DProof.getState().floor,
  )).toBe('upper');
  await viewer.locator('#wing').selectOption('infra');
  await viewer.locator('#cutaway').click();
  await expect(viewer.locator('#cutaway')).toHaveAttribute('aria-pressed', 'false');
  await viewer.locator('#reset').click();
  await expect(viewer.locator('#floor')).toHaveValue('both');
  await expect(viewer.locator('#wing')).toHaveValue('all');

  await page.locator('#proposalNotes').fill('Two-dimensional planning is still the authority.');
  await page.locator('#view2d').click();
  await expect(page.locator('#view2d')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#planGeometry [data-id]')).toHaveCount(29);
  const note = await page.evaluate(() => JSON.parse(localStorage.getItem('museum-of-me-topdown-proposals-v1') ?? '{}').notes?.E11);
  expect(note).toBe('Two-dimensional planning is still the authority.');
  await expect(page.locator('#viewer3d')).toHaveAttribute('src', 'about:blank');
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('3D workbench displays existing planning pins and survives repeated toggles', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/workbench/');
  await page.evaluate(() => {
    localStorage.setItem('museum-of-me-topdown-proposals-v1', JSON.stringify({
      version: 1, sourceSha: '6278d2c8fea5b27466bc4840170b3d25e611e3c1',
      notes: {}, statuses: {}, moves: { E24: [3, 22] },
      pins: [{ id: 'pin-legacy', floor: 0, position: [5, 7], title: 'Legacy two-dimensional pin', body: 'Keep me.' }],
    }));
  });
  await page.reload();
  await expect(page.locator('#planOverlays [data-pin]')).toHaveCount(1);
  await page.locator('#view3d').click();
  const viewer = page.frameLocator('#viewer3d');
  await expect(viewer.locator('#viewerStatus')).toContainText('Actual 3D museum geometry ready', { timeout: 90_000 });
  await expect.poll(() => viewer.locator('body').evaluate(() =>
    (window as unknown as Window & { Museum3DProof: {
      getState(): { pinCount: number };
    } }).Museum3DProof.getState().pinCount,
  )).toBe(1);
  await viewer.locator('#toggleTools').click();
  await expect(viewer.locator('#layers')).toBeVisible();
  await viewer.locator('#annotations').uncheck();
  await viewer.locator('#annotations').check();
  await page.locator('#view2d').click();
  await expect(page.locator('#planOverlays [data-pin]')).toHaveCount(1);
  await page.locator('#view3d').click();
  await expect(viewer.locator('#viewerStatus')).toContainText('Actual 3D museum geometry ready', { timeout: 90_000 });
  await expect.poll(() => viewer.locator('body').evaluate(() =>
    (window as unknown as Window & { Museum3DProof: {
      getState(): { pinCount: number };
    } }).Museum3DProof.getState().pinCount,
  )).toBe(1);
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('museum-of-me-topdown-proposals-v1') ?? '{}'));
  expect(retained.pins[0].body).toBe('Keep me.');
  expect(retained.moves.E24).toEqual([3, 22]);
  expect(errors).toEqual([]);
});

test('3D room picking and physical surface pinning update the original inspector and JSON', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/workbench/');
  await page.locator('#view3d').click();
  const viewer = page.frameLocator('#viewer3d');
  await expect(viewer.locator('#viewerStatus')).toContainText('Actual 3D museum geometry ready', { timeout: 90_000 });

  const projection = async () => viewer.locator('body').evaluate(() => {
    const proof = (window as unknown as Window & { Museum3DProof: {
      screenForRoom(id: string): { x: number; y: number } | null;
    } }).Museum3DProof;
    return proof.screenForRoom('E24');
  });

  const start = await projection();
  expect(start).not.toBeNull();
  await viewer.locator('#scene canvas').click({ position: start! });
  await expect(page.locator('#exhibitList button[aria-current="true"]')).toContainText('E24');
  const surface = await projection();
  expect(surface).not.toBeNull();

  await page.locator('#toolPin').click();
  await viewer.locator('#scene canvas').click({ position: surface! });
  await expect(page.locator('#pinTitle')).toHaveCount(1);
  await page.locator('#pinTitle').fill('A physical architectural annotation');
  await page.locator('#pinBody').fill('Attached to the existing museum surface, without modifying it.');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('museum-of-me-topdown-proposals-v1') ?? '{}'));
  expect(saved.version).toBe(1);
  expect(saved.pins).toHaveLength(1);
  expect(saved.pins[0].title).toBe('A physical architectural annotation');
  expect(saved.pins[0].position).toHaveLength(2);
  expect(saved.pins[0].y).toEqual(expect.any(Number));
  await expect(page.locator('#inspectorContent')).toContainText('Height (Y)');

  await page.locator('#view2d').click();
  await expect(page.locator('#planOverlays [data-pin]')).toHaveCount(1);
  // The clicked physical surface may be on the upper level. Preserve its
  // actual floor in the original 2D plan instead of assuming ground.
  await expect(page.locator('#planGeometry [data-id]')).toHaveCount(saved.pins[0].floor === 1 ? 6 : 29);
  expect(errors).toEqual([]);
});

test('Full Island shows actual exterior world while fold-down UI preserves 71%+ model focus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/workbench/');
  await page.locator('#view3d').click();
  const viewer = page.frameLocator('#viewer3d');
  await expect(viewer.locator('#viewerStatus')).toContainText('Actual 3D museum geometry ready', { timeout: 90_000 });
  await expect(page.locator('#workbenchApp')).toHaveClass(/mode-3d/);
  await expect(page.locator('#collectionPane')).not.toHaveClass(/open/);
  await expect(page.locator('#detailsPane')).not.toHaveClass(/open/);
  await expect(viewer.locator('#detailControls')).toBeHidden();
  await expect(viewer.locator('#layers')).toBeHidden();

  await viewer.locator('#islandView').click();
  await expect(viewer.locator('#islandView')).toHaveAttribute('aria-pressed', 'true');
  const island = await viewer.locator('body').evaluate(() => {
    const proof = (window as Window & { Museum3DProof?: {
      sceneSource: string; islandSource: string; nightSource: string;
      getState(): Record<string, unknown>;
    } }).Museum3DProof!;
    return { sceneSource: proof.sceneSource, islandSource: proof.islandSource,
      nightSource: proof.nightSource, ...proof.getState() };
  });
  expect(island).toMatchObject({
    sceneSource: 'Museum.build()', islandSource: 'ArrivalGarden.build() + IslandLandscape.build()', nightSource: 'Sky',
    view: 'island', floor: 'both', wing: 'all', cutaway: false,
    islandTerrain: true, islandWater: true, islandPaths: true, islandSpire: true,
    nightSkyVisible: true, exteriorBeaconsVisible: true,
  });

  await page.locator('#open3dCollection').click();
  await expect(page.locator('#collectionPane')).toBeVisible();
  const desktop = await page.locator('#collectionPane').evaluate(pane =>
    ({ width: pane.getBoundingClientRect().width, viewport: window.innerWidth }));
  expect(desktop.width).toBeLessThanOrEqual(desktop.viewport * 0.29 + 1);
  await page.locator('#open3dInspector').click();
  await expect(page.locator('#detailsPane')).toBeVisible();
  await expect(page.locator('#collectionPane')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#detailsPane')).not.toBeVisible();
  await viewer.locator('#toggleTools').click();
  await expect(viewer.locator('#detailControls')).toBeVisible();
  await expect(viewer.locator('#layers')).toBeVisible();
  await viewer.locator('#toggleTools').click();
  await expect(viewer.locator('#detailControls')).toBeHidden();
  await viewer.locator('#museumView').click();
  await expect.poll(() => viewer.locator('body').evaluate(() =>
    (window as unknown as Window & { Museum3DProof: { getState(): { view: string; nightSkyVisible: boolean } } })
      .Museum3DProof.getState())).toMatchObject({ view: 'museum', nightSkyVisible: false });
  await page.locator('#view2d').click();
  await expect(page.locator('#workbenchApp')).not.toHaveClass(/mode-3d/);
  await expect(page.locator('#planGeometry [data-id]')).toHaveCount(29);
  expect(errors).toEqual([]);
});

test('narrow 3D interface folds beneath a 29-percent viewport-height drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/workbench/');
  await page.locator('#view3d').click();
  const viewer = page.frameLocator('#viewer3d');
  await expect(viewer.locator('#viewerStatus')).toContainText('Actual 3D museum geometry ready', { timeout: 90_000 });
  await page.locator('#open3dInspector').click();
  await expect(page.locator('#detailsPane')).toBeVisible();
  const size = await page.locator('#detailsPane').evaluate(pane =>
    ({ height: pane.getBoundingClientRect().height, viewport: window.innerHeight }));
  expect(size.height).toBeLessThanOrEqual(size.viewport * .29 + 2);
  await page.locator('#close3dPanels').click();
  await expect(page.locator('#detailsPane')).not.toBeVisible();
  await viewer.locator('#islandView').click();
  await expect.poll(() => viewer.locator('body').evaluate(() =>
    (window as unknown as Window & { Museum3DProof: { getState(): { view: string; islandWater: boolean } } })
      .Museum3DProof.getState())).toMatchObject({ view: 'island', islandWater: true });
  const framing = await viewer.locator('body').evaluate(() =>
    (window as unknown as Window & { Museum3DProof: { islandFraming(): { maxX: number; maxY: number } | null } })
      .Museum3DProof.islandFraming());
  expect(framing).not.toBeNull();
  expect(framing!.maxX).toBeLessThan(0.9);
  expect(framing!.maxY).toBeLessThan(0.9);
});

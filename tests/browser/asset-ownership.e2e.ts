import { expect, test } from '@playwright/test';

test('real concurrent GLB consumers survive independent unloads and release WebGL resources', async ({ page }) => {
  const errors: string[] = [];
  let transfers = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.resourceType() === 'fetch' && /quaternius-men-casual\.glb(?:\?|$)/.test(request.url())) transfers++;
  });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  const result = await page.evaluate(async () => {
    const app = window.__museum!;
    app.stop();
    app.setQuality('low');
    app.exteriorWorld.root.visible = false;
    const scopeModule = '/src/assets/ResourceScope.ts';
    const assetModule = '/src/assets/quaterniusAssets.ts';
    const { ResourceScope } = await import(/* @vite-ignore */ scopeModule) as typeof import('../../src/assets/ResourceScope');
    const { registerQuaterniusAssets, QUATERNIUS_ASSET_IDS } = await import(/* @vite-ignore */ assetModule) as typeof import('../../src/assets/quaterniusAssets');
    registerQuaterniusAssets();
    app.renderer.renderer.setSize(160, 90, false);
    app.camera.position.set(0, 1, 5);
    app.camera.lookAt(0, 1, 0);
    const render = () => app.renderer.renderer.render(app.scene, app.camera);
    render();
    const baseline = { ...app.renderer.renderer.info.memory };
    const rounds = [];
    for (const unloadFirst of [0, 1]) {
      const scopes = [new ResourceScope('browser-a'), new ResourceScope('browser-b')];
      const assets = await Promise.all(scopes.map((scope) => app.assets.load(QUATERNIUS_ASSET_IDS.menCasual, scope)));
      const rigs = assets.map((asset) => {
        const meshes: import('three').SkinnedMesh[] = [];
        asset.object.traverse((node) => {
          const mesh = node as import('three').SkinnedMesh;
          if (mesh.isSkinnedMesh) meshes.push(mesh);
        });
        return meshes;
      });
      for (const asset of assets) app.scene.add(asset.object);
      render();
      const loaded = { ...app.renderer.renderer.info.memory };
      const independentObjects = assets[0].object !== assets[1].object;
      const independentSkeletons = rigs[0][0].skeleton !== rigs[1][0].skeleton
        && rigs[0][0].skeleton.bones[0] !== rigs[1][0].skeleton.bones[0];
      const hasWalk = assets.every((asset) => asset.animations.some((clip) => clip.name === 'Walk'));
      scopes[unloadFirst].dispose();
      render();
      const survivor = { ...app.renderer.renderer.info.memory };
      const remaining = assets[1 - unloadFirst].object.parent === app.scene;
      scopes[1 - unloadFirst].dispose();
      render();
      rounds.push({ independentObjects, independentSkeletons, hasWalk, remaining, loaded, survivor,
        released: { ...app.renderer.renderer.info.memory }, sizes: scopes.map((scope) => scope.size) });
    }
    return { baseline, rounds };
  });
  for (const round of result.rounds) {
    expect(round.independentObjects && round.independentSkeletons && round.hasWalk && round.remaining).toBe(true);
    expect(round.loaded.geometries).toBeGreaterThan(result.baseline.geometries);
    expect(round.survivor.geometries).toBe(round.loaded.geometries);
    expect(round.survivor.textures).toBeLessThanOrEqual(round.loaded.textures);
    expect(round.released).toEqual(result.baseline);
    expect(round.sizes).toEqual([0, 0]);
  }
  // Two lifecycle rounds, one request each; concurrent consumers share transfers.
  expect(transfers).toBe(2);
  expect(errors).toEqual([]);
  console.info('[real GLB ownership lifecycle]', JSON.stringify(result));
});

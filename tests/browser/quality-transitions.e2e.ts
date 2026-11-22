import { expect, test } from '@playwright/test';

test('App quality transitions replace landscape detail without collision or resource accumulation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  const result = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    const world = app.exteriorWorld;
    const physical = JSON.stringify(world.collision);
    const pier = world.root.getObjectByName('south-arrival-pier-deck');
    const shell = world.museumShell;
    const memory = () => ({ ...app.renderer.renderer.info.memory });
    const snapshot = () => {
      const batches: Record<string, { count: number; bytes: number; vertices: number }> = {};
      world.islandLandscape.root.traverse((object) => {
        const mesh = object as import('three').InstancedMesh;
        if (!mesh.isInstancedMesh) return;
        batches[mesh.name] = { count: mesh.count, bytes: mesh.instanceMatrix.array.byteLength,
          vertices: mesh.geometry.getAttribute('position').count };
      });
      let objects = 0;
      world.root.traverse(() => objects++);
      return { batches, objects, memory: memory(), scope: world.scope.size };
    };
    const render = () => {
      // Fixed overview and small framebuffer keep SwiftShader bounded. This is
      // real WebGL allocation/release evidence, not physical-device FPS proof.
      app.renderer.renderer.setSize(320, 180, false);
      app.camera.position.set(-250, 220, 300);
      app.camera.lookAt(0, 0, 0);
      app.renderer.renderer.render(app.scene, app.camera);
    };
    app.setQuality('high');
    render();
    let oldHighGeometryDisposals = 0;
    const oldHigh = world.root.getObjectByName('woodland-forest-belt') as import('three').InstancedMesh;
    oldHigh.geometry.addEventListener('dispose', () => oldHighGeometryDisposals++);
    const rounds = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      const tiers = [];
      for (const tier of ['low', 'medium', 'high'] as const) {
        app.setQuality(tier);
        render();
        tiers.push({ tier, ...snapshot(), physicalUnchanged: JSON.stringify(world.collision) === physical,
          pierUnchanged: world.root.getObjectByName('south-arrival-pier-deck') === pier,
          shellUnchanged: world.museumShell === shell,
          wildlife: ['island-butterflies', 'coastal-bird-flocks', 'lagoon-fish-school'].map((name) =>
            (world.root.getObjectByName(name) as import('three').InstancedMesh).count),
        });
      }
      rounds.push(tiers);
    }
    return { rounds, oldHighGeometryDisposals, interiorBuilt: app.interiorConstructed };
  });
  for (const tiers of result.rounds) {
    for (const [index, tier] of tiers.entries()) {
      expect(tier.batches['perimeter-woodland-trunks'].count).toBe(176);
      // ISLAND-01b: perimeter trees are one quality-independent, collision-backed
      // set (was 68/112/176 with colliders registered only for the build tier).
      // 893/1463/2103 before uplift2(A) cleared ground for the relocated ancient tree;
      // 888/1457/2093 before ISLAND-01 put every crown on a trunk and cleared landmarks.
      // 845/1447/2067 before ISLAND-01b clumped trunks, let them stand 7 m from
      // paths, and gave low tier an extra crown on ~40 % of trunks (1239/1532/2181).
      // ISLAND-02A cleared 9 trunks along the southeast lighthouse trail/headland.
      // ISLAND-02B cleared 18 trunks on the southern ruined observatory knoll/trail.
      expect(tier.batches['woodland-forest-belt'].count).toBe([1204, 1489, 2114][index]);
      // ISLAND-01 trunks are one quality-independent, collision-backed set.
      expect(tier.batches['woodland-forest-belt-trunks'].count).toBe(863);
      expect(tier.batches['island-wildflower-glades'].count).toBe([64, 144, 240][index]);
      expect(tier.wildlife).toEqual([[12, 6, 8], [30, 12, 18], [48, 18, 32]][index]);
      expect(tier.physicalUnchanged && tier.pierUnchanged && tier.shellUnchanged).toBe(true);
    }
  }
  expect(result.rounds[1]).toEqual(result.rounds[0]);
  expect(result.rounds[2]).toEqual(result.rounds[0]);
  expect(result.rounds[0][0].batches['woodland-forest-belt'].bytes)
    .toBeLessThan(result.rounds[0][2].batches['woodland-forest-belt'].bytes);
  expect(result.oldHighGeometryDisposals).toBe(1);
  expect(result.interiorBuilt).toBe(false);
  expect(errors).toEqual([]);
  console.info('[live landscape quality lifecycle]', JSON.stringify(result));
});

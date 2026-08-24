import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Wayfinding } from '../src/world/Wayfinding';
import { AmbientVisitors } from '../src/world/AmbientVisitors';
import { Sky } from '../src/world/Sky';
import { FlightPadAtmosphere } from '../src/world/FlightPadAtmosphere';
import { ResourceScope } from '../src/assets/ResourceScope';
import type { LoadedAsset } from '../src/assets/AssetManager';
import { QUATERNIUS_ASSET_IDS } from '../src/assets/quaterniusAssets';
import { QUALITY } from '../src/render/QualityTiers';
import { PLACEMENT_BY_EXHIBIT, type Vec3 } from '../src/world/layout';
import { START_POSITION } from '../src/world/start';

function visitorAsset(id: string): LoadedAsset {
  const object = new THREE.Group();
  object.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.7, 0.25), new THREE.MeshStandardMaterial()));
  return {
    id,
    object,
    animations: id === QUATERNIUS_ASSET_IDS.posedSitting
      ? []
      : [new THREE.AnimationClip('Walk', 1, [])],
    bytes: 0,
    loadMs: 0,
  };
}

function visitorLoader(fail = false): { load: (id: string, _scope: ResourceScope) => Promise<LoadedAsset> } {
  return {
    load: async (id, scope) => {
      if (fail) throw new Error(`missing governed visitor asset: ${id}`);
      const asset = visitorAsset(id);
      scope.trackObject(asset.object);
      return asset;
    },
  };
}

describe('wayfinding', () => {
  it('shows nothing until a target is chosen', () => {
    const scope = new ResourceScope('t');
    const w = new Wayfinding(scope);
    expect(w.group.visible).toBe(false);
    expect(w.currentTarget).toBeNull();
    scope.dispose();
  });

  it('points from the exterior start toward the chosen exhibit', () => {
    const scope = new ResourceScope('t');
    const w = new Wayfinding(scope);
    w.setTarget('E01');
    w.update(1 / 60, START_POSITION, false);
    expect(w.group.visible).toBe(true);

    for (const marker of w.group.children) {
      expect(marker.position.y).toBeCloseTo(START_POSITION[1] + 0.06, 3);
      expect(marker.position.z, 'marker is behind the visitor').toBeLessThan(START_POSITION[2]);
    }
    scope.dispose();
  });

  it('clears itself on arrival rather than nagging', () => {
    const scope = new ResourceScope('t');
    const w = new Wayfinding(scope);
    w.setTarget('E19');
    const placement = PLACEMENT_BY_EXHIBIT.get('E19')!;
    const atDoor: Vec3 = [placement.doorway[0], placement.doorway[1], placement.doorway[2]];
    w.update(1 / 60, atDoor, false);
    expect(w.currentTarget, 'wayfinding did not clear on arrival').toBeNull();
    expect(w.group.visible).toBe(false);
    scope.dispose();
  });

  it('holds still under reduced motion but still points', () => {
    const scope = new ResourceScope('t');
    const w = new Wayfinding(scope);
    w.setTarget('E24');
    w.update(1 / 60, START_POSITION, true);
    const first = w.group.children.map((c) => c.position.clone());
    for (let i = 0; i < 30; i++) w.update(1 / 60, START_POSITION, true);
    w.group.children.forEach((c, i) => {
      expect(c.position.distanceTo(first[i])).toBeLessThan(1e-6);
    });
    scope.dispose();
  });
});

describe('ambient visitors', () => {
  it('is removed entirely on the low quality tier', () => {
    expect(QUALITY.low.ambientVisitors).toBe(0);
    const scope = new ResourceScope('t');
    const v = new AmbientVisitors(scope, QUALITY.low.ambientVisitors);
    expect(v.count).toBe(0);
    expect(v.group.children).toHaveLength(0);
    scope.dispose();
  });

  it('stays within the plan\'s 4 to 8 range on higher tiers', () => {
    for (const tier of ['medium', 'high'] as const) {
      const n = QUALITY[tier].ambientVisitors;
      expect(n, tier).toBeGreaterThanOrEqual(4);
      expect(n, tier).toBeLessThanOrEqual(8);
    }
  });

  it('loads governed visitors, walks authored paths, and holds still under reduced motion', async () => {
    const scope = new ResourceScope('t');
    const v = new AmbientVisitors(scope, 6);
    await v.setPopulation(visitorLoader(), 6);
    expect(v.count).toBe(6);
    expect(v.ready).toBe(true);
    expect(v.group.children).toHaveLength(6);

    const before = v.group.children.map((c) => c.position.clone());
    for (let i = 0; i < 60; i++) v.update(1 / 60, true);
    v.group.children.forEach((c, i) => {
      expect(c.position.distanceTo(before[i]), 'moved under reduced motion').toBeLessThan(1e-6);
    });

    for (let i = 0; i < 120; i++) v.update(1 / 60, false);
    const moved = v.group.children.some((c, i) => c.position.distanceTo(before[i]) > 0.5);
    expect(moved, 'nobody moved with motion enabled').toBe(true);
    v.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('does not silently replace missing governed visitors with primitives', async () => {
    const scope = new ResourceScope('t');
    const v = new AmbientVisitors(scope, 8);
    await expect(v.setPopulation(visitorLoader(true), 8)).rejects.toThrow(/missing governed visitor asset/);
    expect(v.group.children).toHaveLength(0);
    expect(v.loadError?.message).toMatch(/missing governed visitor asset/);
    expect(v.group.userData.loadError).toMatch(/missing governed visitor asset/);
    v.dispose();
    scope.dispose();
  });

  it('reuses governed prototypes when quality changes rebuild the bounded crowd', async () => {
    const scope = new ResourceScope('t');
    const requested: string[] = [];
    const loader = {
      load: async (id: string, assetScope: ResourceScope) => {
        requested.push(id);
        const asset = visitorAsset(id);
        assetScope.trackObject(asset.object);
        return asset;
      },
    };
    const v = new AmbientVisitors(scope, 6);
    await v.setPopulation(loader, 6);
    await v.setPopulation(loader, 4);
    expect(requested).toHaveLength(3);
    expect(v.group.children).toHaveLength(4);
    v.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});

describe('sky', () => {
  it('follows the camera so it never shows an edge', () => {
    const scope = new ResourceScope('t');
    const sky = new Sky(scope);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(120, 3, -240);
    sky.follow(camera);
    expect(sky.mesh.position.toArray()).toEqual([120, 3, -240]);
    expect(sky.mesh.name).toBe('night-sky-layered-stars-blood-band');
    expect(sky.mesh.frustumCulled).toBe(false);
    const material = sky.mesh.material as THREE.ShaderMaterial;
    expect(material.fragmentShader).toContain('starLayer');
    expect(material.fragmentShader).toContain('bandNormal');
    expect(material.fragmentShader).not.toContain('ringAngle');
    expect(material.uniforms.parallax.value.toArray()).toEqual([0.09, -0.18]);
    scope.dispose();
  });
});

describe('flight pad atmosphere', () => {
  it('rises in the existing loop, reduces its density by quality, and freezes for reduced motion', () => {
    const scope = new ResourceScope('flight-pad-atmosphere');
    const dust = new FlightPadAtmosphere(scope);
    const first = dust.group.children[0];
    const startY = first.position.y;
    dust.update(1, 1, false);
    expect(first.position.y).toBeGreaterThan(startY);
    dust.update(0, 0.4, false);
    expect(dust.group.children.filter((mote) => mote.visible)).toHaveLength(11);
    const frozenY = first.position.y;
    dust.update(1, 0.4, true);
    expect(first.position.y).toBeCloseTo(frozenY, 8);
    dust.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});

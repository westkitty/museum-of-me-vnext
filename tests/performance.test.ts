import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Museum } from '../src/world/Museum';
import { Lighting } from '../src/render/Lighting';
import { ResourceScope } from '../src/assets/ResourceScope';
import { QUALITY } from '../src/render/QualityTiers';
import { mergeStatic, NO_MERGE } from '../src/world/MergeStatic';
import { SPAWN_POSITION, PLACEMENT_BY_EXHIBIT } from '../src/world/layout';

/**
 * Runtime regression gates. These assert bounded scene-graph/light behavior
 * and stable per-frame state; they are not device-FPS claims. Paired whole-scene
 * draw-submission measurements and their environment limits live in the dated
 * quality-uplift report.
 */

describe('static geometry merging', () => {
  it('collapses the architecture into far fewer meshes', () => {
    const scope = new ResourceScope('t');
    const museum = new Museum(scope);
    const built = museum.build();
    const { before, after, merged } = built.merge;

    expect(merged, 'nothing was merged').toBeGreaterThan(200);
    expect(after, `merge left ${after} meshes from ${before}`).toBeLessThan(before / 3);
    scope.dispose();
  });

  it('never merges an exhibit mount or anything marked no-merge', () => {
    const scope = new ResourceScope('t');
    const museum = new Museum(scope);
    const built = museum.build();

    // Every exhibit mount must survive as its own group.
    expect(built.exhibitMounts.size).toBe(35);
    for (const [id, mount] of built.exhibitMounts) {
      expect(mount.parent, `${id} mount was removed`).not.toBeNull();
      expect(mount.name).toBe(`exhibit:${id}`);
    }
    scope.dispose();
  });

  it('respects the no-merge flag', () => {
    const scope = new ResourceScope('t');
    const root = new THREE.Group();
    const material = scope.track(new THREE.MeshStandardMaterial());
    const keep = new THREE.Mesh(scope.track(new THREE.BoxGeometry()), material);
    keep.userData[NO_MERGE] = true;
    keep.name = 'keep-me';
    root.add(keep);
    for (let i = 0; i < 5; i++) {
      root.add(new THREE.Mesh(scope.track(new THREE.BoxGeometry()), material));
    }
    mergeStatic(root, scope);
    expect(root.getObjectByName('keep-me'), 'a no-merge mesh was merged away').toBeTruthy();
    scope.dispose();
  });

  it('leaves collision untouched', () => {
    const scope = new ResourceScope('t');
    const museum = new Museum(scope);
    const built = museum.build();
    // Collision is recorded during construction, before any merge, so the
    // building's walls cannot move as a result of a rendering optimisation.
    expect(built.collision.size).toBeGreaterThan(900);
    const support = built.collision.supportHeight(SPAWN_POSITION[0], SPAWN_POSITION[2], 2, 3);
    expect(support).not.toBeNull();
    scope.dispose();
  });
});

describe('light budget', () => {
  it('caps simultaneous point lights regardless of where the visitor stands', () => {
    const scope = new ResourceScope('t');
    const lighting = new Lighting(scope, QUALITY.high);

    const spots: [number, number, number][] = [
      [0, 1.6, 150],
      [0, 1.6, 80],
      [0, 1.6, 0],
      [0, 1.6, -40],
      [0, 11.6, 12],
      [-42, -3.4, -42],
    ];
    for (const spot of spots) {
      lighting.update(spot);
      expect(
        lighting.activePointLights,
        `too many lights at ${spot.join(',')}`,
      ).toBeLessThanOrEqual(8);
    }
    lighting.dispose();
    scope.dispose();
  });

  it('lights the room the visitor is actually in', () => {
    const scope = new ResourceScope('t');
    const lighting = new Lighting(scope, QUALITY.high);
    // A bay is dark until streaming says its exhibit is resident.
    const placement = PLACEMENT_BY_EXHIBIT.get('E01')!;
    const eye: [number, number, number] = [placement.anchor[0], placement.anchor[1] + 1.6, placement.anchor[2]];

    lighting.update(eye);
    const dark = lighting.bayLights.get('E01')!.visible;
    expect(dark, 'a bay lit itself before its exhibit streamed in').toBe(false);

    lighting.setBayLight('E01', true);
    lighting.update(eye);
    expect(lighting.bayLights.get('E01')!.visible, 'the bay stayed dark with its exhibit resident').toBe(true);
    lighting.dispose();
    scope.dispose();
  });

  it('keeps only one shadow-casting light, and none on the low tier', () => {
    for (const tier of [QUALITY.low, QUALITY.medium, QUALITY.high]) {
      const scope = new ResourceScope('t');
      const lighting = new Lighting(scope, tier);
      let casters = 0;
      lighting.group.traverse((n) => {
        if ((n as THREE.Light).isLight && (n as THREE.Light).castShadow) casters++;
      });
      expect(casters, `${tier.tier} shadow casters`).toBeLessThanOrEqual(tier.shadows ? 1 : 0);
      lighting.dispose();
      scope.dispose();
    }
  });
});

describe('light director frame reuse', () => {
  it('leaves the same lights visible no matter which frame came before', () => {
    // Lighting reuses one array of { light, d } entries across frames instead
    // of allocating a fresh one every frame. If a stale entry could ever be
    // written back, the visible set would depend on the visitor's route rather
    // than on where they are standing. This walks an unrelated position in
    // between and requires the result to be identical.
    const scope = new ResourceScope('t');
    const lighting = new Lighting(scope, QUALITY.high);
    const eye: [number, number, number] = [0, 1.6, 0];

    const visibleAt = (spot: [number, number, number]): string => {
      lighting.update(spot);
      return lighting.managed.map((light, index) => (light.visible ? index : -1)).filter((i) => i >= 0).join(',');
    };

    const direct = visibleAt(eye);
    // A long detour that empties the pool of entries near the original eye.
    visibleAt([0, -4, -70]);
    visibleAt([80, 12, 40]);
    expect(visibleAt(eye)).toBe(direct);

    lighting.dispose();
    scope.dispose();
  });
});

describe('frame budget ownership', () => {
  it('keeps the shell material count under the interning ceiling', () => {
    const scope = new ResourceScope('t');
    const built = new Museum(scope).build();

    // The shell builds its palette per zone: 164 material instances for 90
    // distinct values before the bake. Interning is what lets the merge see
    // through that, so both numbers are pinned together.
    expect(built.bake.interned, 'the shell interned nothing').toBeGreaterThan(50);
    expect(built.bake.merge.merged, 'the shell merged nothing after interning').toBeGreaterThan(50);

    const materials = new Set<THREE.Material>();
    let meshes = 0;
    built.root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes++;
      for (const m of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) materials.add(m);
    });
    expect(meshes, 'the shell did not shrink').toBeLessThan(160);
    expect(materials.size, 'the shell kept duplicate materials').toBeLessThan(120);
    scope.dispose();
  });

  it('keeps transmissive materials out of the static Museum shell', () => {
    // Three.js re-renders the visible opaque list when any visible material
    // requests transmission. A controlled same-artifact experiment measured
    // the Blood Ring's 0.03 override at 996 vs 520 Rotunda calls (45 samples,
    // Chromium/SwiftShader); see `validation/metrics/runtime-profile*.json`.
    // This is not representative-device FPS, and the subtle visual change still
    // needs human approval. This traversal protects only Museum.build()'s static
    // shell; `tests/environment.test.ts` separately pins the Sky material.
    const scope = new ResourceScope('t');
    const built = new Museum(scope).build();

    const transmissive: string[] = [];
    built.root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of list) {
        const value = (material as { transmission?: number }).transmission;
        if (typeof value === 'number' && value > 0) {
          transmissive.push(`${material.type} on ${mesh.name || mesh.type}: transmission=${value}`);
        }
      }
    });

    expect(transmissive).toEqual([]);
    scope.dispose();
  });
});

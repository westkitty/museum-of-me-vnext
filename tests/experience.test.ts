import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Wayfinding } from '../src/world/Wayfinding';
import { AmbientVisitors } from '../src/world/AmbientVisitors';
import { Sky } from '../src/world/Sky';
import { ResourceScope } from '../src/assets/ResourceScope';
import { QUALITY } from '../src/render/QualityTiers';
import { PLACEMENT_BY_EXHIBIT, SPAWN_POSITION, type Vec3 } from '../src/world/layout';

describe('wayfinding', () => {
  it('shows nothing until a target is chosen', () => {
    const scope = new ResourceScope('t');
    const w = new Wayfinding(scope);
    expect(w.group.visible).toBe(false);
    expect(w.currentTarget).toBeNull();
    scope.dispose();
  });

  it('points from the entrance toward the chosen exhibit', () => {
    const scope = new ResourceScope('t');
    const w = new Wayfinding(scope);
    w.setTarget('E01');
    w.update(1 / 60, SPAWN_POSITION, false);
    expect(w.group.visible).toBe(true);

    // Every marker sits ahead of the visitor, on the floor, pointing north.
    for (const marker of w.group.children) {
      expect(marker.position.y).toBeCloseTo(SPAWN_POSITION[1] + 0.06, 3);
      expect(marker.position.z, 'marker is behind the visitor').toBeLessThan(SPAWN_POSITION[2]);
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
    w.update(1 / 60, SPAWN_POSITION, true);
    const first = w.group.children.map((c) => c.position.clone());
    for (let i = 0; i < 30; i++) w.update(1 / 60, SPAWN_POSITION, true);
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

  it('walks authored paths and holds still under reduced motion', () => {
    const scope = new ResourceScope('t');
    const v = new AmbientVisitors(scope, 6);
    expect(v.count).toBe(6);

    const before = v.group.children.map((c) => c.position.clone());
    for (let i = 0; i < 60; i++) v.update(1 / 60, true);
    v.group.children.forEach((c, i) => {
      expect(c.position.distanceTo(before[i]), 'moved under reduced motion').toBeLessThan(1e-6);
    });

    for (let i = 0; i < 120; i++) v.update(1 / 60, false);
    const moved = v.group.children.some((c, i) => c.position.distanceTo(before[i]) > 0.5);
    expect(moved, 'nobody moved with motion enabled').toBe(true);
    scope.dispose();
  });

  it('shares one geometry and a small material set across the crowd', () => {
    const scope = new ResourceScope('t');
    const v = new AmbientVisitors(scope, 8);
    const geometries = new Set<unknown>();
    const materials = new Set<unknown>();
    v.group.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      materials.add(mesh.material);
    });
    expect(geometries.size, 'a crowd should not cost a crowd of geometries').toBeLessThanOrEqual(2);
    expect(materials.size).toBeLessThanOrEqual(4);
    scope.dispose();
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
    expect(sky.mesh.frustumCulled).toBe(false);
    scope.dispose();
  });
});

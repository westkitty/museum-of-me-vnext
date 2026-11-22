import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { IslandLandscape } from '../src/world/exterior/IslandLandscape';
import {
  CANOPY_UNDERSIDE_MIN, ISLAND_LANDMARKS, landmarkGroundExcluded,
} from '../src/world/exterior/IslandLandmarks';

/**
 * ISLAND-01 (world expansion 2026-11-21): woodland trunk/canopy repair and
 * landmark visibility. Baseline at main 78b5996: every one of the 888/1457/2093
 * forest-belt crowns was trunkless with its underside below 2.2 m, and eye-height
 * sightlines from the island loop to the pollinator meadow, hare statue,
 * neolithic circle and Wings of Dawn crossed 2/1/4/1 crowns.
 */
const GROUND = -0.5;
const EYE_Y = GROUND + 1.64;
const TIERS = ['low', 'medium', 'high'] as const;
const CANOPY = /^(woodland-forest-belt|perimeter-woodland-canopy-\d|woodland-secondary-canopy|woodland-canopy-infill)$/;

interface Sphere { name: string; c: THREE.Vector3; r: number; bottom: number }

function foliage(root: THREE.Object3D, pattern: RegExp): Sphere[] {
  const out: Sphere[] = [];
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  root.traverse((object) => {
    const mesh = object as THREE.InstancedMesh;
    if (!mesh.isInstancedMesh || !pattern.test(mesh.name)) return;
    mesh.geometry.computeBoundingSphere();
    const r = mesh.geometry.boundingSphere!.radius;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      out.push({ name: mesh.name, c: p.clone(), r: r * Math.min(s.x, s.y, s.z), bottom: p.y - r * s.y - GROUND });
    }
  });
  return out;
}

describe('ISLAND-01 woodland canopy and landmark visibility', () => {
  it('lists only existing named features, each standing on supported, unobstructed ground', () => {
    const world = new ExteriorWorld('low');
    for (const landmark of ISLAND_LANDMARKS) {
      expect(world.root.getObjectByName(landmark.featureName), landmark.id).toBeTruthy();
      for (const [x, z] of [landmark.approach, landmark.inspection]) {
        const support = world.collision.supportHeight(x, z, GROUND);
        expect(support, `${landmark.id} support at ${x},${z}`).not.toBeNull();
        expect(Math.abs(support! - GROUND), landmark.id).toBeLessThan(0.56);
      }
    }
    world.dispose();
  });

  it('keeps a walkable, collider-free corridor from the path to every inspection spot (full exterior collision)', () => {
    for (const tier of TIERS) {
      const world = new ExteriorWorld(tier);
      for (const landmark of ISLAND_LANDMARKS) {
        const [ax, az] = landmark.approach, [bx, bz] = landmark.inspection;
        const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
        let feet = GROUND;
        for (let i = 0; i <= steps; i++) {
          const x = ax + ((bx - ax) * i) / steps, z = az + ((bz - az) * i) / steps;
          const support = world.collision.supportHeight(x, z, feet);
          expect(support, `${tier} ${landmark.id} unsupported at ${x.toFixed(1)},${z.toFixed(1)}`).not.toBeNull();
          feet = support!;
          const pos = { x, y: feet, z };
          const touched = world.collision.resolveHorizontal(pos, 0.35, 1.78);
          expect(touched, `${tier} ${landmark.id} blocked at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
        }
      }
      world.dispose();
    }
  });

  for (const tier of TIERS) {
    it(`raises every crown above eye height and clears every landmark sightline on ${tier}`, () => {
      const scope = new ResourceScope(`island-01-${tier}`);
      const collision = new CollisionWorld();
      const root = new IslandLandscape(scope, collision, tier).build();
      const crowns = foliage(root, CANOPY);
      expect(crowns.length).toBeGreaterThan(900);
      for (const crown of crowns) {
        expect(crown.bottom, `${crown.name} underside`).toBeGreaterThanOrEqual(CANOPY_UNDERSIDE_MIN - 0.01);
      }
      // Understory stays knee-to-waist high, never an eye-level wall.
      for (const shrub of foliage(root, /^woodland-understory$/)) {
        expect(shrub.c.y + shrub.r - GROUND).toBeLessThan(1.4);
        expect(landmarkGroundExcluded(shrub.c.x, shrub.c.z)).toBe(false);
      }
      const all = [...crowns, ...foliage(root, /^woodland-understory$/)];
      for (const landmark of ISLAND_LANDMARKS) {
        const a = new THREE.Vector3(landmark.approach[0], EYE_Y, landmark.approach[1]);
        const b = new THREE.Vector3(landmark.focus[0], landmark.focus[1] + 0.5, landmark.focus[2]);
        const segment = new THREE.Line3(a, b);
        const closest = new THREE.Vector3();
        const blockers = all.filter((s) => segment.closestPointToPoint(s.c, true, closest).distanceTo(s.c) < s.r);
        expect(blockers.map((s) => s.name), `${tier} ${landmark.id} sightline`).toEqual([]);
      }
      scope.dispose();
      expect(scope.size).toBe(0);
    });
  }

  it('gives every forest-belt crown cluster a visible, collision-backed trunk identical on every tier', () => {
    const results = TIERS.map((tier) => {
      const scope = new ResourceScope(`belt-trunks-${tier}`);
      const collision = new CollisionWorld();
      const root = new IslandLandscape(scope, collision, tier).build();
      const trunks = root.getObjectByName('woodland-forest-belt-trunks') as THREE.InstancedMesh;
      const belt = root.getObjectByName('woodland-forest-belt') as THREE.InstancedMesh;
      const perimeter = root.getObjectByName('perimeter-woodland-trunks') as THREE.InstancedMesh;
      const matrices = Array.from(trunks.instanceMatrix.array.slice(0, trunks.count * 16));
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), top = new THREE.Vector3();
      for (let i = 0; i < trunks.count; i++) {
        trunks.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        top.set(0, 1, 0).applyMatrix4(m);
        expect(p.y).toBeCloseTo(GROUND, 5);
        // Visible exposed trunk reaches into the crown underside.
        expect(top.y - GROUND).toBeGreaterThan(CANOPY_UNDERSIDE_MIN);
        expect(landmarkGroundExcluded(p.x, p.z, 0.6)).toBe(false);
        // A collider stands on each visible trunk base.
        const pos = { x: p.x, y: GROUND, z: p.z };
        expect(collision.resolveHorizontal(pos, 0.1, 1.7)).toBe(true);
      }
      const size = collision.size;
      scope.dispose();
      return { tier, count: trunks.count, matrices, crowns: belt.count, colliders: size - perimeter.count, castShadow: trunks.castShadow };
    });
    expect(results[0].count).toBeGreaterThan(800);
    for (const r of results) {
      expect(r.count).toBe(results[0].count);
      expect(r.matrices).toEqual(results[0].matrices);
      expect(r.colliders).toBe(results[0].colliders);
      expect(r.crowns).toBeGreaterThanOrEqual(r.count);
      expect(r.castShadow).toBe(false);
    }
    expect(results[1].crowns).toBeGreaterThan(results[0].crowns * 1.6);
    expect(results[2].crowns).toBeGreaterThan(results[0].crowns * 2.3);
  });
});

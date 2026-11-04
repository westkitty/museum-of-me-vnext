import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { IslandLandscape } from '../src/world/exterior/IslandLandscape';
import { PATH_CENTERLINES, isSiteLand } from '../src/world/exterior/IslandSiteLayout';

function distanceToPath(x: number, z: number): number {
  let nearest = Infinity;
  for (const points of PATH_CENTERLINES) for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return nearest;
}

describe('S5 shoreline-belt forest visual coverage', () => {
  for (const [tier, min, max] of [
    ['low', 425, 460], ['medium', 715, 750], ['high', 1025, 1070],
  ] as const) {
    it(`fills distinct forest areas on ${tier} without new physical support or forbidden placements`, () => {
      const scope = new ResourceScope(`forest-belt-${tier}`);
      const collision = new CollisionWorld();
      const root = new IslandLandscape(scope, collision, tier).build();
      const belt = root.getObjectByName('woodland-forest-belt') as THREE.InstancedMesh;
      const existingTrunks = root.getObjectByName('perimeter-woodland-trunks') as THREE.InstancedMesh;
      const shrubs = root.getObjectByName('woodland-understory') as THREE.InstancedMesh;
      const rocks = root.getObjectByName('shoreline-rock-scatter') as THREE.InstancedMesh;
      expect(belt).toBeInstanceOf(THREE.InstancedMesh);
      expect(belt.userData.visualRole).toBe('island-masked-woodland-distribution');
      // Low-end devices should pay one-quarter of the forest-belt geometry cost.
      expect(belt.geometry.getAttribute('position').count).toBe(tier === 'low' ? 60 : 240);
      expect(belt.count).toBeGreaterThan(min);
      expect(belt.count).toBeLessThan(max);
      // Compared with the actual S5 site-masked output, not raw attempts.
      const s5Visible = tier === 'low' ? 213 : tier === 'medium' ? 358 : 513;
      expect(belt.count).toBeGreaterThanOrEqual(s5Visible * 2);
      expect(belt.instanceColor).toBeTruthy();
      expect(belt.castShadow).toBe(false);
      expect(belt.receiveShadow).toBe(false);
      expect(existingTrunks.count).toBe(tier === 'low' ? 68 : tier === 'medium' ? 112 : 176);
      expect(shrubs.count).toBeGreaterThan(tier === 'low' ? 60 : tier === 'medium' ? 135 : 235);
      expect(shrubs.count).toBeLessThanOrEqual(existingTrunks.count * (tier === 'low' ? 2 : tier === 'medium' ? 4 : 6));
      expect(rocks.count).toBeGreaterThan(tier === 'low' ? 32 : tier === 'medium' ? 65 : 100);
      expect(rocks.count).toBeLessThanOrEqual(tier === 'low' ? 48 : tier === 'medium' ? 96 : 144);
      const positions = new THREE.Vector3();
      const matrix = new THREE.Matrix4();
      const quadrants = [0, 0, 0, 0];
      for (let i = 0; i < belt.count; i++) {
        belt.getMatrixAt(i, matrix);
        positions.setFromMatrixPosition(matrix);
        const x = positions.x, z = positions.z;
        quadrants[(x >= 0 ? 2 : 0) + (z >= 0 ? 1 : 0)]++;
        expect(isSiteLand(x, z)).toBe(true);
        for (const [dx, dz] of [[6.4, 0], [-6.4, 0], [0, 6.4], [0, -6.4]]) {
          expect(isSiteLand(x + dx, z + dz)).toBe(true);
        }
        expect(distanceToPath(x, z)).toBeGreaterThanOrEqual(10.49);
        expect(Math.abs(x) < 55 && Math.abs(z) < 118).toBe(false);
        expect(Math.hypot(x, z - 128)).toBeGreaterThanOrEqual(59.99);
        expect(x > 39 && x < 147 && z > -67 && z < 68).toBe(false);
        expect(Math.hypot(x + 104, z + 82)).toBeGreaterThanOrEqual(37.99);
        expect(z > 155 && Math.abs(x) < 26).toBe(false);
      }
      expect(Math.min(...quadrants)).toBeGreaterThan(30);
      const otherScope = new ResourceScope(`forest-belt-repeat-${tier}`);
      const otherCollision = new CollisionWorld();
      const repeat = new IslandLandscape(otherScope, otherCollision, tier).build()
        .getObjectByName('woodland-forest-belt') as THREE.InstancedMesh;
      expect(repeat.count).toBe(belt.count);
      expect(Array.from(repeat.instanceMatrix.array.slice(0, repeat.count * 16)))
        .toEqual(Array.from(belt.instanceMatrix.array.slice(0, belt.count * 16)));
      expect(otherCollision.size).toBe(collision.size);
      scope.dispose();
      otherScope.dispose();
      expect(scope.size).toBe(0);
      expect(otherScope.size).toBe(0);
    });
  }
});

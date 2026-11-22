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
  // uplift2(A): the relocated ancient tree's 11 m clearing removes ~13 low-tier crowns.
  // ISLAND-01 (2026-11-21): crowns now stand on collision-backed trunks laid on
  // one quality-independent grid; landmark clearings/walk-in corridors remove
  // 43 trunk sites (888 -> 845 on low). Medium/high add overhead crowns on the
  // same trunks (845/1447/2067, previously 888/1457/2093).
  // ISLAND-01b: trunks clump into stands and may stand 7 m from paths (890
  // trunks); low adds an overhead crown to ~40 % of them (1239/1532/2181).
  // ISLAND-02A: clearing the southeast lighthouse trail and rocky headland
  // removes 9 trunks (890 -> 881; crowns 1228/1518/2156).
  // ISLAND-02B: clearing the southern wooded ruined observatory knoll and trail
  // removes 18 trunks (881 -> 863; crowns 1204/1489/2114).
  for (const [tier, min, max] of [
    ['low', 1190, 1220], ['medium', 1475, 1505], ['high', 2100, 2130],
  ] as const) {
    it(`fills distinct forest areas on ${tier} without new floor support or forbidden placements`, () => {
      const scope = new ResourceScope(`forest-belt-${tier}`);
      const collision = new CollisionWorld();
      const root = new IslandLandscape(scope, collision, tier).build();
      const belt = root.getObjectByName('woodland-forest-belt') as THREE.InstancedMesh;
      const existingTrunks = root.getObjectByName('perimeter-woodland-trunks') as THREE.InstancedMesh;
      const shrubs = root.getObjectByName('woodland-understory') as THREE.InstancedMesh;
      const rocks = root.getObjectByName('shoreline-rock-scatter') as THREE.InstancedMesh;
      const flowers = root.getObjectByName('island-wildflower-glades') as THREE.InstancedMesh;
      expect(belt).toBeInstanceOf(THREE.InstancedMesh);
      expect(belt.userData.visualRole).toBe('island-masked-woodland-distribution');
      // Low-end devices should pay one-quarter of the forest-belt geometry cost.
      expect(belt.geometry.getAttribute('position').count).toBe(tier === 'high' ? 240 : 60);
      expect(belt.count).toBeGreaterThan(min);
      expect(belt.count).toBeLessThan(max);
      // Compared with the actual S5 site-masked output, not raw attempts.
      const lastRelease = tier === 'low' ? 438 : tier === 'medium' ? 725 : 1040;
      // The S5c doubling holds outside the ISLAND-01 landmark clearings, which
      // take at most 5 % of the crowns.
      expect(belt.count).toBeGreaterThanOrEqual(Math.floor(lastRelease * 2 * 0.95));
      expect(belt.instanceColor).toBeTruthy();
      expect(belt.castShadow).toBe(false);
      expect(belt.receiveShadow).toBe(false);
      // ISLAND-01b: one quality-independent, collision-backed perimeter tree set.
      expect(existingTrunks.count).toBe(176);
      expect(shrubs.count).toBeGreaterThan(tier === 'low' ? 60 : tier === 'medium' ? 135 : 235);
      expect(shrubs.count).toBeLessThanOrEqual(existingTrunks.count * (tier === 'low' ? 4 : tier === 'medium' ? 8 : 12));
      expect(rocks.count).toBeGreaterThan(tier === 'low' ? 32 : tier === 'medium' ? 65 : 100);
      expect(rocks.count).toBeLessThanOrEqual(tier === 'low' ? 96 : tier === 'medium' ? 192 : 288);
      expect(flowers.count).toBeGreaterThan(tier === 'low' ? 40 : tier === 'medium' ? 100 : 170);
      expect(flowers.count).toBeLessThanOrEqual(tier === 'low' ? 64 : tier === 'medium' ? 144 : 240);
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
        expect(distanceToPath(x, z)).toBeGreaterThanOrEqual(6.99);
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

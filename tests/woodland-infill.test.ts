import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { IslandLandscape } from '../src/world/exterior/IslandLandscape';
import { PATH_CENTERLINES, isSiteLand } from '../src/world/exterior/IslandSiteLayout';

function distanceToPath(x: number, z: number): number {
  let nearest = Infinity;
  for (const path of PATH_CENTERLINES) for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz)));
  }
  return nearest;
}

describe('woodland infill from the real exterior visual review', () => {
  for (const [quality, maxPerTree] of [['low', 2], ['medium', 3], ['high', 4]] as const) {
    it(`preserves the ${quality} tier trunk/collider positions while adding offshore-safe visual canopies`, () => {
      const scope = new ResourceScope(`woodland-infill-${quality}`);
      const collision = new CollisionWorld();
      const root = new IslandLandscape(scope, collision, quality).build();
      const trunks = root.getObjectByName('perimeter-woodland-trunks') as THREE.InstancedMesh;
      const infill = root.getObjectByName('woodland-canopy-infill') as THREE.InstancedMesh;
      expect(infill).toBeInstanceOf(THREE.InstancedMesh);
      expect(infill.userData.visualRole).toBe('dense-layered-woodland-canopy');
      expect(infill.count).toBeGreaterThan(20);
      expect(infill.count).toBeLessThanOrEqual(trunks.count * maxPerTree);
      expect(infill.instanceColor).toBeTruthy();
      expect(infill.castShadow).toBe(false);
      expect(infill.receiveShadow).toBe(false);
      const matrix = new THREE.Matrix4();
      const v = new THREE.Vector3();
      for (let i = 0; i < infill.count; i++) {
        infill.getMatrixAt(i, matrix);
        v.setFromMatrixPosition(matrix);
        expect(isSiteLand(v.x, v.z)).toBe(true);
        expect(distanceToPath(v.x, v.z)).toBeGreaterThanOrEqual(5.5);
        expect(Math.abs(v.x) < 50 && Math.abs(v.z) < 112).toBe(false);
        expect(Math.hypot(v.x, v.z - 128)).toBeGreaterThanOrEqual(54);
        expect(Math.hypot(v.x + 104, v.z + 82)).toBeGreaterThanOrEqual(33);
      }
      const originalCollisionCount = collision.size;
      const scope2 = new ResourceScope(`woodland-infill-repeat-${quality}`);
      const collision2 = new CollisionWorld();
      const otherRoot = new IslandLandscape(scope2, collision2, quality).build();
      const repeat = otherRoot.getObjectByName('woodland-canopy-infill') as THREE.InstancedMesh;
      expect(collision2.size).toBe(originalCollisionCount);
      expect(repeat.count).toBe(infill.count);
      expect(Array.from(repeat.instanceMatrix.array.slice(0, repeat.count * 16)))
        .toEqual(Array.from(infill.instanceMatrix.array.slice(0, infill.count * 16)));
      scope.dispose();
      scope2.dispose();
      expect(scope.size).toBe(0);
      expect(scope2.size).toBe(0);
    });
  }
});

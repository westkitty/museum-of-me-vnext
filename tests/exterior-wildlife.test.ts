import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { ExteriorWildlife, WILDLIFE_COUNTS } from '../src/world/exterior/ExteriorWildlife';
import { isLagoon } from '../src/world/exterior/IslandSiteLayout';

describe('living island wildlife', () => {
  for (const tier of ['low', 'medium', 'high'] as const) {
    it(`uses deterministic three-draw populations, no colliders, and clean disposal on ${tier}`, () => {
      const a = new ResourceScope(`wildlife-a-${tier}`);
      const b = new ResourceScope(`wildlife-b-${tier}`);
      const first = new ExteriorWildlife(a, tier);
      const second = new ExteriorWildlife(b, tier);
      const names = ['island-butterflies', 'coastal-bird-flocks', 'lagoon-fish-school'] as const;
      const expected = WILDLIFE_COUNTS[tier];
      for (const [i, name] of names.entries()) {
        const mesh = first.root.getObjectByName(name) as THREE.InstancedMesh;
        const repeat = second.root.getObjectByName(name) as THREE.InstancedMesh;
        expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
        expect(mesh.count).toBe([expected.butterflies, expected.birds, expected.fish][i]);
        expect(mesh.instanceMatrix.array).toEqual(repeat.instanceMatrix.array);
        expect(mesh.castShadow).toBe(false);
        expect(mesh.receiveShadow).toBe(false);
      }
      expect(first.root.children).toHaveLength(3);
      const fish = first.root.getObjectByName('lagoon-fish-school') as THREE.InstancedMesh;
      const scratch = new THREE.Matrix4();
      const location = new THREE.Vector3();
      for (let i = 0; i < fish.count; i++) {
        fish.getMatrixAt(i, scratch);
        location.setFromMatrixPosition(scratch);
        expect(isLagoon(location.x, location.z)).toBe(true);
        expect(location.y).toBeLessThan(-1.02);
      }
      const before = Array.from(fish.instanceMatrix.array);
      first.update(0.1, [75, 2, 30], false);
      expect(Array.from(fish.instanceMatrix.array)).not.toEqual(before);
      for (let i = 0; i < fish.count; i++) {
        fish.getMatrixAt(i, scratch);
        location.setFromMatrixPosition(scratch);
        expect(isLagoon(location.x, location.z)).toBe(true);
      }
      const frozen = Array.from(fish.instanceMatrix.array);
      first.update(1, [75, 2, 30], true);
      expect(Array.from(fish.instanceMatrix.array)).toEqual(frozen);
      first.update(1, [999, 2, 999], false);
      expect(Array.from(fish.instanceMatrix.array)).toEqual(frozen);
      a.dispose();
      b.dispose();
      expect(a.size).toBe(0);
      expect(b.size).toBe(0);
    });
  }
});

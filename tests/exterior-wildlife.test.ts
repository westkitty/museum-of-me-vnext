import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { ExteriorWildlife, WILDLIFE_COUNTS } from '../src/world/exterior/ExteriorWildlife';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { isLagoon, LAGOON_OUTLINE } from '../src/world/exterior/IslandSiteLayout';

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
  it('stays fully under the actual inset lagoon surface throughout motion', () => {
    const scope = new ResourceScope('wildlife-lagoon-boundary');
    const wildlife = new ExteriorWildlife(scope, 'high');
    const fish = wildlife.root.getObjectByName('lagoon-fish-school') as THREE.InstancedMesh;

    const centerX = LAGOON_OUTLINE.reduce((sum, [x]) => sum + x, 0) / LAGOON_OUTLINE.length;
    const centerZ = LAGOON_OUTLINE.reduce((sum, [, z]) => sum + z, 0) / LAGOON_OUTLINE.length;
    // This is the visibly filled water polygon, not the broader lagoon basin.
    const waterline = LAGOON_OUTLINE.map(([x, z]) => [
      x + (centerX - x) * 0.034, z + (centerZ - z) * 0.034,
    ] as const);
    const containsWater = (x: number, z: number): boolean => {
      let inside = false;
      for (let i = 0, j = waterline.length - 1; i < waterline.length; j = i++) {
        const [xi, zi] = waterline[i];
        const [xj, zj] = waterline[j];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      return inside;
    };
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const vertices = fish.geometry.getAttribute('position');
    const assertBodiesSubmerged = (step: number): void => {
      for (let i = 0; i < fish.count; i++) {
        fish.getMatrixAt(i, matrix);
        for (let v = 0; v < vertices.count; v++) {
          position.fromBufferAttribute(vertices, v).applyMatrix4(matrix);
          if (!containsWater(position.x, position.z)) {
            throw new Error(`fish ${i} vertex ${v} outside filled lagoon at step ${step}`);
          }
        }
      }
    };
    try {
      assertBodiesSubmerged(0);
      for (let step = 1; step <= 1000; step++) {
        wildlife.update(0.05, [75, 2, 30], false);
        if (step % 8 === 0) assertBodiesSubmerged(step);
      }
    } finally {
      scope.dispose();
    }
  });
  it('reconciles live graphics quality with the existing exterior settings path', () => {
    const world = new ExteriorWorld('high');
    const count = (name: string): number =>
      (world.root.getObjectByName(name) as THREE.InstancedMesh).count;
    const expectTier = (tier: keyof typeof WILDLIFE_COUNTS): void => {
      const expected = WILDLIFE_COUNTS[tier];
      expect(count('island-butterflies')).toBe(expected.butterflies);
      expect(count('coastal-bird-flocks')).toBe(expected.birds);
      expect(count('lagoon-fish-school')).toBe(expected.fish);
    };
    try {
      expectTier('high');
      world.setWaterQuality('low');
      expectTier('low');
      world.setWaterQuality('medium');
      expectTier('medium');
      world.setWaterQuality('high');
      expectTier('high');
    } finally {
      world.dispose();
    }
    expect(world.scope.size).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import {
  DEXTER_ASSET_CONTRACT, DEXTER_POSES, chooseDexterPose, createTestOnlyDexterRig, validateDexterAsset,
  type DexterAssetDescription,
} from '../src/world/pocket/w10/dexterCharacter';

const still = { grounded: true, climbing: false, hasGlider: false, speed: 0, verticalSpeed: 0 };
/** A description that meets the contract. It describes no real asset. */
const meets: DexterAssetDescription = {
  bytes: 1_200_000, triangles: 12_000, bones: 40, maxTextureSize: 1024,
  clips: [...DEXTER_POSES], size: [0.45, 0.9, 1.25], minY: 0, facesNegativeZ: true,
};

describe('W10 Dexter character seam', () => {
  it('chooses one pose per movement state, climbing first', () => {
    expect(chooseDexterPose(still)).toBe('idle');
    expect(chooseDexterPose({ ...still, speed: 2 })).toBe('walk');
    expect(chooseDexterPose({ ...still, speed: 6 })).toBe('run');
    expect(chooseDexterPose({ ...still, grounded: false })).toBe('fall');
    expect(chooseDexterPose({ ...still, grounded: false, hasGlider: true })).toBe('glide');
    expect(chooseDexterPose({ ...still, grounded: false, climbing: true, hasGlider: true })).toBe('climb');
  });

  it('accepts a description that meets the technical contract', () => {
    expect(validateDexterAsset(meets)).toEqual([]);
  });

  it('names every technical problem in a candidate', () => {
    const problems = validateDexterAsset({
      bytes: 5 * 1024 * 1024, triangles: 90_000, bones: 120, maxTextureSize: 4096,
      clips: ['idle', 'walk'], size: [1.3, 2.4, 0.5], minY: 0.4, facesNegativeZ: false,
    });
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining('MB; the limit'), expect.stringContaining('triangles'), expect.stringContaining('bones'),
      expect.stringContaining('4096px'), expect.stringContaining('height 2.40'), expect.stringContaining('from the ground'),
      expect.stringContaining('along X'), expect.stringContaining('face -Z'),
      'missing animation clip "run"', 'missing animation clip "glide"', 'missing animation clip "climb"', 'missing animation clip "fall"',
    ]));
  });

  it('the temporary rig is labelled test-only, fits the contract scale and frees everything it made', () => {
    const scope = new ResourceScope('w10-dexter-test');
    const rig = createTestOnlyDexterRig(scope);
    expect(rig.status).toBe('TEST_ONLY_NOT_APPROVED_DEXTER');
    expect(rig.object.name).toMatch(/TEST-ONLY RIG — NOT APPROVED DEXTER/);
    const box = new THREE.Box3().setFromObject(rig.object);
    const size = box.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThanOrEqual(DEXTER_ASSET_CONTRACT.heightM[0]);
    expect(size.y).toBeLessThanOrEqual(DEXTER_ASSET_CONTRACT.heightM[1]);
    expect(Math.abs(box.min.y)).toBeLessThan(0.03);
    expect(box.max.z - 0).toBeGreaterThan(0); // tail behind (+Z)
    expect(box.min.z).toBeLessThan(-0.6); // nose ahead (-Z)
    const parent = new THREE.Group(); parent.add(rig.object);
    rig.update(new THREE.Vector3(1, 2, 3), 0.5, 'walk', 1 / 60, false);
    expect(rig.object.position.toArray()).toEqual([1, 2, 3]);
    expect(rig.object.rotation.y).toBe(0.5);
    rig.dispose();
    expect(rig.object.parent).toBeNull();
    expect(scope.size).toBeGreaterThan(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});

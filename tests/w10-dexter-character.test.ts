import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import {
  DEXTER_ASSET_CONTRACT, DEXTER_POSES, chooseDexterPose, createTestOnlyDexterRig, describeDexterAsset, selectDexterCharacter,
  validateDexterAsset,
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

  it('reads a loaded scene into the contract description (V7): the rig fails only on its missing clips', () => {
    const scope = new ResourceScope('w10-dexter-describe');
    const rig = createTestOnlyDexterRig(scope);
    const d = describeDexterAsset(rig.object, [], 0, true);
    expect(d.triangles).toBeGreaterThan(0);
    expect(d.bones).toBe(0);
    expect(d.maxTextureSize).toBe(0);
    expect(validateDexterAsset(d)).toEqual(DEXTER_POSES.map((p) => `missing animation clip "${p}"`));
    // Textures, bones and clips are read from what is actually loaded.
    const big = new THREE.DataTexture(new Uint8Array(4), 4096, 4096);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 1.2), new THREE.MeshStandardMaterial({ map: big }));
    mesh.position.y = 0.4;
    const root = new THREE.Group(); root.add(mesh, new THREE.Bone(), new THREE.Bone());
    const read = describeDexterAsset(root, DEXTER_POSES.map((p) => new THREE.AnimationClip(p, 1, [])), 1000, true);
    expect(read).toMatchObject({ triangles: 12, bones: 2, maxTextureSize: 4096, clips: [...DEXTER_POSES] });
    expect(read.minY).toBeCloseTo(0, 5);
    expect(validateDexterAsset(read)).toEqual(['a 4096px texture; the limit is 2048px']);
    rig.dispose(); scope.dispose();
  });

  it('the seam keeps the identity gate closed: only an approved, conforming candidate replaces the test-only rig (V7)', () => {
    const scope = new ResourceScope('w10-dexter-select');
    // A synthetic stand-in for the seam's plumbing only: an empty group, no geometry, no likeness, not an asset.
    const fixture = (status: 'TEST_ONLY_NOT_APPROVED_DEXTER' | 'OWNER_APPROVED_DEXTER') => {
      let disposed = 0;
      const character = { object: new THREE.Group(), status, update: () => undefined, dispose: () => { disposed++; } };
      return { character, disposed: () => disposed };
    };

    const none = selectDexterCharacter(scope);
    expect(none.character.status).toBe('TEST_ONLY_NOT_APPROVED_DEXTER');
    expect(none.rejected).toEqual([]);

    const unapproved = fixture('OWNER_APPROVED_DEXTER');
    const a = selectDexterCharacter(scope, { character: unapproved.character, description: meets });
    expect(a.character.status).toBe('TEST_ONLY_NOT_APPROVED_DEXTER');
    expect(a.rejected).toEqual(['no owner approval with provenance']);
    expect(unapproved.disposed()).toBe(1);

    const blankProvenance = fixture('OWNER_APPROVED_DEXTER');
    expect(selectDexterCharacter(scope, { character: blankProvenance.character, description: meets, approval: { status: 'OWNER_APPROVED_DEXTER', provenance: ' ' } }).rejected)
      .toEqual(['no owner approval with provenance']);

    const selfLabelledTest = fixture('TEST_ONLY_NOT_APPROVED_DEXTER');
    const b = selectDexterCharacter(scope, { character: selfLabelledTest.character, description: meets, approval: { status: 'OWNER_APPROVED_DEXTER', provenance: 'unit-test fixture, not an asset' } });
    expect(b.rejected).toEqual(['character reports TEST_ONLY_NOT_APPROVED_DEXTER']);
    expect(b.character).not.toBe(selfLabelledTest.character);

    const nonconforming = fixture('OWNER_APPROVED_DEXTER');
    const c = selectDexterCharacter(scope, {
      character: nonconforming.character, description: { ...meets, triangles: 90_000, clips: ['idle'] },
      approval: { status: 'OWNER_APPROVED_DEXTER', provenance: 'unit-test fixture, not an asset' },
    });
    expect(c.character.status).toBe('TEST_ONLY_NOT_APPROVED_DEXTER');
    expect(c.rejected).toEqual(expect.arrayContaining([expect.stringContaining('triangles'), 'missing animation clip "walk"']));
    expect(nonconforming.disposed()).toBe(1);

    const accepted = fixture('OWNER_APPROVED_DEXTER');
    const d = selectDexterCharacter(scope, { character: accepted.character, description: meets, approval: { status: 'OWNER_APPROVED_DEXTER', provenance: 'unit-test fixture, not an asset' } });
    expect(d.character).toBe(accepted.character);
    expect(d.rejected).toEqual([]);
    expect(accepted.disposed()).toBe(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('W10 builds its character only through the seam, and today that is the labelled test-only rig', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../src/world/pocket/w10/createW10World.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/selectDexterCharacter\(scope\)/);
    expect(source).not.toMatch(/createTestOnlyDexterRig\(/);
  });
});

import * as THREE from 'three';
import type { ResourceScope } from '../../../assets/ResourceScope';

/**
 * W10's character seam. The world drives a `DexterCharacter` and never builds
 * one itself, so an owner-approved Dexter model can replace the temporary rig
 * without touching W10's mechanics, collision or camera.
 *
 * Nothing here is, or stands in for, Dexter's likeness: the only implementation
 * is the clearly labelled test-only rig. No generic dog or stock animal may be
 * substituted (owner decision, docs/plans/W10_DEXTER_MODEL_HANDOFF.md).
 */

export type DexterRigStatus = 'TEST_ONLY_NOT_APPROVED_DEXTER' | 'OWNER_APPROVED_DEXTER';
export type DexterPose = 'idle' | 'walk' | 'run' | 'glide' | 'climb' | 'fall';
export const DEXTER_POSES: readonly DexterPose[] = ['idle', 'walk', 'run', 'glide', 'climb', 'fall'];

export interface DexterMotion {
  readonly grounded: boolean;
  readonly climbing: boolean;
  readonly hasGlider: boolean;
  /** Horizontal speed, m/s. */
  readonly speed: number;
  /** Vertical speed, m/s (negative is falling). */
  readonly verticalSpeed: number;
}

export interface DexterCharacter {
  readonly object: THREE.Object3D;
  readonly status: DexterRigStatus;
  /** Place and animate the character for this frame. */
  update(position: THREE.Vector3, yaw: number, pose: DexterPose, dt: number, reducedMotion: boolean): void;
  dispose(): void;
}

/** Thresholds shared by every implementation, so a real model animates exactly where the test rig would. */
export const WALK_SPEED_MIN = 0.25;
export const RUN_SPEED_MIN = 4.2;

export function chooseDexterPose(m: DexterMotion): DexterPose {
  if (m.climbing) return 'climb';
  if (!m.grounded) return m.hasGlider ? 'glide' : 'fall';
  if (m.speed >= RUN_SPEED_MIN) return 'run';
  if (m.speed >= WALK_SPEED_MIN) return 'walk';
  return 'idle';
}

/**
 * Technical contract an approved Dexter asset must meet before it is wired in.
 * Scale and limits follow W10's current collision capsule, camera framing and
 * the museum's lazy-world budget; the likeness, markings, palette and
 * personality are the owner's (see the handoff document).
 */
export const DEXTER_ASSET_CONTRACT = Object.freeze({
  format: 'glTF 2.0 binary (.glb), embedded textures',
  axes: 'Y up, facing -Z, metres',
  origin: 'on the ground plane, under the body centre',
  /** Overall bounding box: the test rig is 0.93 m tall and 1.28 m nose to tail. */
  heightM: [0.6, 1.1] as const,
  lengthM: [0.9, 1.6] as const,
  maxTriangles: 30_000,
  maxBones: 64,
  maxTextureSize: 2048,
  maxBytes: 3 * 1024 * 1024,
  requiredClips: DEXTER_POSES,
  /** Optional: the glider attaches here when present; otherwise above the body centre. */
  optionalNodes: ['glider_mount'] as const,
});

/** What the loader reads from a candidate file, without trusting it. */
export interface DexterAssetDescription {
  readonly bytes: number;
  readonly triangles: number;
  readonly bones: number;
  readonly maxTextureSize: number;
  readonly clips: readonly string[];
  /** Bounding box size [x, y, z] in metres, as authored (no rescale). */
  readonly size: readonly [number, number, number];
  /** Bounding box minimum y: 0 when the origin sits on the ground. */
  readonly minY: number;
  /** Which way the nose points: the larger |z| extent at the head end is -Z. */
  readonly facesNegativeZ: boolean;
}

/** Every reason the candidate cannot be wired in yet; empty means it meets the technical contract. */
export function validateDexterAsset(d: DexterAssetDescription): string[] {
  const c = DEXTER_ASSET_CONTRACT;
  const problems: string[] = [];
  const [x, y, z] = d.size;
  if (d.bytes > c.maxBytes) problems.push(`file is ${(d.bytes / 1048576).toFixed(2)} MB; the limit is ${c.maxBytes / 1048576} MB`);
  if (d.triangles > c.maxTriangles) problems.push(`${d.triangles} triangles; the limit is ${c.maxTriangles}`);
  if (d.bones > c.maxBones) problems.push(`${d.bones} bones; the limit is ${c.maxBones}`);
  if (d.maxTextureSize > c.maxTextureSize) problems.push(`a ${d.maxTextureSize}px texture; the limit is ${c.maxTextureSize}px`);
  if (y < c.heightM[0] || y > c.heightM[1]) problems.push(`height ${y.toFixed(2)} m is outside ${c.heightM[0]}–${c.heightM[1]} m`);
  const length = Math.max(x, z);
  if (length < c.lengthM[0] || length > c.lengthM[1]) problems.push(`length ${length.toFixed(2)} m is outside ${c.lengthM[0]}–${c.lengthM[1]} m`);
  if (Math.abs(d.minY) > 0.03) problems.push(`origin is ${d.minY.toFixed(2)} m from the ground (must sit on it)`);
  if (x > z) problems.push('the body runs along X; it must run along Z');
  if (!d.facesNegativeZ) problems.push('the model must face -Z');
  for (const clip of c.requiredClips) if (!d.clips.includes(clip)) problems.push(`missing animation clip "${clip}"`);
  return problems;
}

/**
 * Read a loaded candidate (a glTF scene and its clips) into the description the
 * contract checks. It only reads. Facing cannot be inferred reliably from a
 * bounding box (a tail can reach further than a nose), so the loader states it
 * from the file's own metadata or the artist's sheet.
 */
export function describeDexterAsset(
  root: THREE.Object3D, clips: readonly THREE.AnimationClip[], bytes: number, facesNegativeZ: boolean,
): DexterAssetDescription {
  root.updateWorldMatrix(true, true);
  let triangles = 0, maxTextureSize = 0;
  const bones = new Set<THREE.Object3D>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.add(o);
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    triangles += Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(m)) {
        const texture = value as THREE.Texture | null;
        const image = texture?.isTexture ? texture.image as { width?: number; height?: number } | undefined : undefined;
        if (image) maxTextureSize = Math.max(maxTextureSize, image.width ?? 0, image.height ?? 0);
      }
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return {
    bytes, triangles, bones: bones.size, maxTextureSize, clips: clips.map((c) => c.name),
    size: [size.x, size.y, size.z], minY: box.min.y, facesNegativeZ,
  };
}

/** An owner-supplied character offered to W10, with the approval record that must accompany it. */
export interface DexterCandidate {
  readonly character: DexterCharacter;
  readonly description: DexterAssetDescription;
  /** The owner's approval of this exact file. Absent means not approved. */
  readonly approval?: { readonly status: 'OWNER_APPROVED_DEXTER'; readonly provenance: string };
}

/**
 * The only way W10 obtains its character. A candidate is used only when it
 * carries the owner's approval with provenance, reports itself approved, and
 * meets the technical contract. Anything else is disposed and the labelled
 * test-only rig is used instead, with the reasons.
 */
export function selectDexterCharacter(scope: ResourceScope, candidate?: DexterCandidate): { character: DexterCharacter; rejected: string[] } {
  if (!candidate) return { character: createTestOnlyDexterRig(scope), rejected: [] };
  const rejected = validateDexterAsset(candidate.description);
  if (candidate.approval?.status !== 'OWNER_APPROVED_DEXTER' || !candidate.approval.provenance.trim()) rejected.unshift('no owner approval with provenance');
  if (candidate.character.status !== 'OWNER_APPROVED_DEXTER') rejected.unshift(`character reports ${candidate.character.status}`);
  if (rejected.length === 0) return { character: candidate.character, rejected };
  candidate.character.dispose();
  return { character: createTestOnlyDexterRig(scope), rejected };
}

/**
 * Temporary quadruped for silhouette and camera checks only. It is NOT Dexter
 * and must never be presented as Dexter.
 */
export function createTestOnlyDexterRig(scope: ResourceScope): DexterCharacter {
  const rig = new THREE.Group();
  rig.name = 'W10 TEST-ONLY RIG — NOT APPROVED DEXTER';
  const white = scope.track(new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.96 }));
  const black = scope.track(new THREE.MeshStandardMaterial({ color: 0x222525, roughness: 0.96 }));
  const tan = scope.track(new THREE.MeshStandardMaterial({ color: 0xb1875d, roughness: 0.96 }));
  const green = scope.track(new THREE.MeshStandardMaterial({ color: 0x457647, roughness: 0.86 }));
  const body = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.24, 0.48, 5, 10)), white);
  body.rotation.x = Math.PI / 2; body.position.set(0, 0.48, 0); rig.add(body);
  const vest = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.25, 0.25, 5, 10)), green);
  vest.rotation.x = Math.PI / 2; vest.position.set(0, 0.55, 0.05); rig.add(vest);
  const head = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.23, 12, 10)), black);
  head.position.set(0, 0.7, -0.47); rig.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.065, 0.18, 4, 8)), black);
    ear.position.set(s * 0.21, 0.48, -0.48); rig.add(ear);
    const cheek = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.09, 8, 6)), tan);
    cheek.position.set(s * 0.12, 0.64, -0.65); rig.add(cheek);
    for (const z of [-0.26, 0.28]) {
      const leg = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.055, 0.25, 4, 7)), white);
      leg.position.set(s * 0.18, 0.2, z); rig.add(leg);
    }
  }
  const tail = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.08, 0.25, 4, 7)), white);
  tail.rotation.x = -0.8; tail.position.set(0, 0.62, 0.57); rig.add(tail);
  return {
    object: rig,
    status: 'TEST_ONLY_NOT_APPROVED_DEXTER',
    update(position, yaw) { rig.position.copy(position); rig.rotation.y = yaw; },
    dispose() { rig.removeFromParent(); },
  };
}

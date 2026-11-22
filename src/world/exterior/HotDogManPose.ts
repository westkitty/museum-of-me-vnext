import * as THREE from 'three';

/**
 * ISLAND-04: authored idle and serving pose for Hot Dog Man.
 *
 * The approved model ships with zero animation clips and a T-pose, and no
 * borrowed clip targets its rig. The pose is therefore driven procedurally
 * from the rig's own geometry instead of hard-coded bone axes:
 * - facing is the measured foot -> toe direction;
 * - each arm segment is aimed in world space from its measured joint
 *   positions, then written back as a local rotation.
 * That keeps the pose correct for this skeleton whatever its local bone axes
 * are, and lets tests measure the result directly.
 */

const P = 'mixamorig:';
export const HOT_DOG_MAN_BONE_NAMES = {
  spine: `${P}Spine1`,
  chest: `${P}Spine2`,
  neck: `${P}Neck`,
  head: `${P}Head`,
  leftArm: `${P}LeftArm`,
  leftForeArm: `${P}LeftForeArm`,
  leftHand: `${P}LeftHand`,
  rightArm: `${P}RightArm`,
  rightForeArm: `${P}RightForeArm`,
  rightHand: `${P}RightHand`,
  leftFoot: `${P}LeftFoot`,
  leftToe: `${P}LeftToeBase`,
  rightFoot: `${P}RightFoot`,
  rightToe: `${P}RightToeBase`,
} as const;

export type HotDogManBoneKey = keyof typeof HOT_DOG_MAN_BONE_NAMES;

export interface HotDogManRig {
  readonly root: THREE.Object3D;
  readonly bones: Readonly<Record<HotDogManBoneKey, THREE.Bone>>;
  /** Bind-pose local rotations, restored before every pose evaluation. */
  readonly rest: ReadonlyMap<THREE.Bone, THREE.Quaternion>;
}

/** Find every bone the pose needs. Returns null if the rig is not this skeleton. */
export function findHotDogManRig(root: THREE.Object3D): HotDogManRig | null {
  const found: Partial<Record<HotDogManBoneKey, THREE.Bone>> = {};
  const byName = new Map<string, THREE.Bone>();
  root.traverse((node) => {
    // GLTFLoader strips colons from the binding name and keeps the source name here.
    if ((node as THREE.Bone).isBone) byName.set(node.userData.name ?? node.name, node as THREE.Bone);
  });
  for (const [key, name] of Object.entries(HOT_DOG_MAN_BONE_NAMES) as [HotDogManBoneKey, string][]) {
    const bone = byName.get(name);
    if (!bone) return null;
    found[key] = bone;
  }
  const rest = new Map<THREE.Bone, THREE.Quaternion>();
  for (const bone of Object.values(found)) rest.set(bone!, bone!.quaternion.clone());
  return { root, bones: found as Record<HotDogManBoneKey, THREE.Bone>, rest };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qWorld = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _identity = new THREE.Quaternion();

/** Scale in metres and plant the avatar on its local ground plane. */
export function fitAvatar(object: THREE.Object3D, height: number): void {
  const bounds = new THREE.Box3().setFromObject(object, true);
  const size = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(size) || size <= 0) throw new Error('Invalid avatar bounds');
  const factor = height / size;
  object.scale.multiplyScalar(factor);
  object.position.y -= bounds.min.y * factor;
}

/** Orient an avatar using its authored foot direction. */
export function faceAvatar(rig: HotDogManRig, yaw: number): void {
  const forward = rigForward(rig, new THREE.Vector3());
  rig.root.rotation.y += yaw - Math.atan2(forward.x, forward.z);
}

/** Horizontal facing of the rig, from the average foot -> toe direction (world space). */
export function rigForward(rig: HotDogManRig, out: THREE.Vector3): THREE.Vector3 {
  rig.root.updateWorldMatrix(true, true);
  const { leftFoot, leftToe, rightFoot, rightToe } = rig.bones;
  leftToe.getWorldPosition(_a).sub(leftFoot.getWorldPosition(_b));
  rightToe.getWorldPosition(_c).sub(rightFoot.getWorldPosition(_d));
  out.copy(_a).add(_c);
  out.y = 0;
  if (out.lengthSq() < 1e-10) return out.set(0, 0, 1);
  return out.normalize();
}

/**
 * Rotate `bone` so the direction from it to `child` points along `dirWorld`.
 * `weight` 0..1 blends from the current pose. Updates the subtree afterwards.
 */
export function aimBone(bone: THREE.Bone, child: THREE.Object3D, dirWorld: THREE.Vector3, weight = 1): void {
  bone.updateWorldMatrix(true, true);
  child.getWorldPosition(_a).sub(bone.getWorldPosition(_b));
  if (_a.lengthSq() < 1e-12) return;
  _a.normalize();
  _q.setFromUnitVectors(_a, _c.copy(dirWorld).normalize());
  if (weight < 1) _q.slerpQuaternions(_identity, _q, Math.max(0, weight));
  bone.getWorldQuaternion(_qWorld);
  _qWorld.premultiply(_q);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_qParent).invert();
    bone.quaternion.copy(_qParent.multiply(_qWorld));
  } else {
    bone.quaternion.copy(_qWorld);
  }
  bone.updateMatrixWorld(true);
}

export interface HotDogManPoseInput {
  /** Seconds of idle time (breathing, glance). Frozen under reduced motion. */
  readonly time: number;
  /** 0 = idle hands at the counter, 1 = right arm offering across the counter. */
  readonly serve: number;
  /** Small idle breathing / weight shift. */
  readonly breathe: boolean;
}

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _dir2 = new THREE.Vector3();

function lateral(rig: HotDogManRig, arm: THREE.Bone, out: THREE.Vector3): THREE.Vector3 {
  arm.getWorldPosition(out).sub(rig.bones.chest.getWorldPosition(_d));
  out.y = 0;
  return out.lengthSq() < 1e-10 ? out.set(1, 0, 0) : out.normalize();
}

/** Mix of three basis vectors, normalized into `out`. */
function mix(out: THREE.Vector3, f: number, u: number, s: number, side: THREE.Vector3): THREE.Vector3 {
  return out.set(0, 0, 0).addScaledVector(_fwd, f).addScaledVector(_up, u).addScaledVector(side, s).normalize();
}

/**
 * Evaluate the pose. Always starts from the bind pose, so it is stateless and
 * deterministic for a given input (no drift, no accumulation).
 */
export function applyHotDogManPose(rig: HotDogManRig, input: HotDogManPoseInput): void {
  for (const [bone, q] of rig.rest) bone.quaternion.copy(q);
  rig.root.updateMatrixWorld(true);
  rigForward(rig, _fwd);
  const b = rig.bones;
  const serve = THREE.MathUtils.clamp(input.serve, 0, 1);

  // Breathing: a slow chest lift about the lateral axis.
  if (input.breathe) {
    lateral(rig, b.leftArm, _side);
    const lift = Math.sin(input.time * 1.7) * 0.025;
    _q.setFromAxisAngle(_side, lift);
    b.chest.getWorldQuaternion(_qWorld).premultiply(_q);
    b.chest.parent!.getWorldQuaternion(_qParent).invert();
    b.chest.quaternion.copy(_qParent.multiply(_qWorld));
    rig.root.updateMatrixWorld(true);
  }

  // Left arm: down at the side, forearm resting forward on the counter.
  lateral(rig, b.leftArm, _side);
  aimBone(b.leftArm, b.leftForeArm, mix(_dir, 0.18, -0.93, 0.2, _side));
  aimBone(b.leftForeArm, b.leftHand, mix(_dir, 0.82, -0.5, 0.06, _side));

  // Right arm: same idle, blended toward offering a hot dog across the counter.
  lateral(rig, b.rightArm, _side);
  mix(_dir, 0.18, -0.93, 0.2, _side);
  mix(_dir2, 0.86, -0.42, 0.12, _side);
  aimBone(b.rightArm, b.rightForeArm, _dir.lerp(_dir2, serve).normalize());
  mix(_dir, 0.82, -0.5, 0.06, _side);
  mix(_dir2, 0.92, 0.32, -0.05, _side);
  aimBone(b.rightForeArm, b.rightHand, _dir.lerp(_dir2, serve).normalize());

  // A small nod while serving; an occasional glance otherwise.
  const nod = serve * 0.12 + (input.breathe ? Math.sin(input.time * 0.45) * 0.03 : 0);
  if (nod !== 0) {
    lateral(rig, b.leftArm, _side);
    _q.setFromAxisAngle(_side, nod);
    b.head.getWorldQuaternion(_qWorld).premultiply(_q);
    b.head.parent!.getWorldQuaternion(_qParent).invert();
    b.head.quaternion.copy(_qParent.multiply(_qWorld));
    rig.root.updateMatrixWorld(true);
  }
}

/** Serving envelope for a gesture started `t` seconds ago: rise, hold, return. */
export function serveEnvelope(t: number): number {
  if (t < 0 || t >= 3.2) return 0;
  if (t < 0.7) return THREE.MathUtils.smoothstep(t, 0, 0.7);
  if (t < 2.3) return 1;
  return 1 - THREE.MathUtils.smoothstep(t, 2.3, 3.2);
}

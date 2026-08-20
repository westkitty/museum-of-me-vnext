import * as THREE from 'three';
import type { CollisionWorld } from '../world/CollisionWorld';
import type { InputManager } from './Input';
import type { Vec3 } from '../world/layout';

export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.78;
export const EYE_HEIGHT = 1.64;

const WALK_SPEED = 3.4;
const RUN_SPEED = 6.2;
const ACCEL = 34;
const FRICTION = 14;
const GRAVITY = 22;
const STEP_UP = 0.55;
const MAX_PITCH = Math.PI / 2 - 0.02;
const LOOK_SCALE = 0.0022;

/**
 * Capsule-ish first-person controller: a vertical cylinder with horizontal
 * depenetration and a support query for the floor. Fixed-step, so behaviour is
 * frame-rate independent; the camera interpolates between steps in render().
 */
export class PlayerController {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  grounded = false;

  /** Previous fixed-step position, for render interpolation. */
  private readonly prevPosition = new THREE.Vector3();
  private readonly prevYaw = { v: 0 };
  private readonly prevPitch = { v: 0 };

  /** Set while a scripted move (map wayfinding, reset) owns the player. */
  private frozen = false;

  constructor(
    private readonly world: CollisionWorld,
    private readonly input: InputManager,
  ) {}

  teleport(p: Vec3, yaw = this.yaw): void {
    this.position.set(p[0], p[1], p[2]);
    this.prevPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.prevYaw.v = yaw;
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    if (frozen) this.velocity.set(0, 0, 0);
  }

  /** Mouse look. Applied once per frame from real deltas, not fixed steps. */
  applyLook(dx: number, dy: number, sensitivity: number, invertY: boolean): void {
    if (this.frozen) return;
    this.yaw -= dx * LOOK_SCALE * sensitivity;
    this.pitch -= (invertY ? -dy : dy) * LOOK_SCALE * sensitivity;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    // Keep yaw bounded so interpolation never has to unwrap a huge number.
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  fixedUpdate(dt: number): void {
    this.prevPosition.copy(this.position);
    this.prevYaw.v = this.yaw;
    this.prevPitch.v = this.pitch;
    if (this.frozen) return;

    // ── desired horizontal motion in world space ──
    let ix = 0;
    let iz = 0;
    if (this.input.isDown('forward')) iz -= 1;
    if (this.input.isDown('back')) iz += 1;
    if (this.input.isDown('left')) ix -= 1;
    if (this.input.isDown('right')) ix += 1;

    // The touch stick adds to the same intent, so nothing downstream needs to
    // know which input the visitor is using.
    if (!this.input.uiCaptured) {
      ix += this.input.touchMoveX;
      iz += this.input.touchMoveY;
    }

    const len = Math.hypot(ix, iz);
    const speed = this.input.isDown('run') ? RUN_SPEED : WALK_SPEED;
    let wishX = 0;
    let wishZ = 0;
    if (len > 0) {
      ix /= len;
      iz /= len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Forward is −Z rotated by yaw.
      wishX = (ix * cos - iz * sin) * speed;
      wishZ = (ix * sin + iz * cos) * speed;
    }

    // ── accelerate toward the wish velocity, then apply friction ──
    this.velocity.x = approach(this.velocity.x, wishX, ACCEL * dt);
    this.velocity.z = approach(this.velocity.z, wishZ, ACCEL * dt);
    if (len === 0) {
      this.velocity.x = approach(this.velocity.x, 0, FRICTION * dt);
      this.velocity.z = approach(this.velocity.z, 0, FRICTION * dt);
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // ── horizontal depenetration ──
    const p = { x: this.position.x, y: this.position.y, z: this.position.z };
    if (this.world.resolveHorizontal(p, PLAYER_RADIUS, PLAYER_HEIGHT)) {
      // Cancel velocity into the surface so we slide rather than stick.
      const dx = p.x - this.position.x;
      const dz = p.z - this.position.z;
      const n = Math.hypot(dx, dz);
      if (n > 1e-6) {
        const nx = dx / n;
        const nz = dz / n;
        const into = this.velocity.x * nx + this.velocity.z * nz;
        if (into < 0) {
          this.velocity.x -= nx * into;
          this.velocity.z -= nz * into;
        }
      }
      this.position.x = p.x;
      this.position.z = p.z;
    }

    // ── vertical: support query, then gravity ──
    this.velocity.y -= GRAVITY * dt;
    this.position.y += this.velocity.y * dt;

    const support = this.world.supportHeight(
      this.position.x,
      this.position.z,
      this.prevPosition.y,
      STEP_UP,
    );

    if (support !== null && this.position.y <= support + 1e-3) {
      this.position.y = support;
      this.velocity.y = 0;
      this.grounded = true;
    } else if (support !== null && this.velocity.y >= 0 && support > this.position.y) {
      // Stepping up onto a low ledge while moving.
      this.position.y = support;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Safety net: the museum has no pits, so falling means something is wrong.
    // Return the visitor to the nearest support rather than dropping forever.
    if (this.position.y < -60) {
      this.position.y = support ?? 0;
      this.velocity.set(0, 0, 0);
    }

    // Head clearance.
    const ceiling = this.world.ceilingHeight(this.position.x, this.position.z, this.position.y);
    if (Number.isFinite(ceiling) && this.position.y + PLAYER_HEIGHT > ceiling) {
      this.position.y = Math.max(support ?? this.position.y, ceiling - PLAYER_HEIGHT);
      if (this.velocity.y > 0) this.velocity.y = 0;
    }
  }

  /** Write the interpolated eye transform into the camera. */
  applyToCamera(camera: THREE.PerspectiveCamera, alpha: number): void {
    const x = lerp(this.prevPosition.x, this.position.x, alpha);
    const y = lerp(this.prevPosition.y, this.position.y, alpha);
    const z = lerp(this.prevPosition.z, this.position.z, alpha);
    camera.position.set(x, y + EYE_HEIGHT, z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
    camera.rotation.z = 0;
  }

  /** Eye position at the current fixed step — used for raycasts and zone tests. */
  get eyePosition(): Vec3 {
    return [this.position.x, this.position.y + EYE_HEIGHT, this.position.z];
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

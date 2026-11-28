import type * as THREE from 'three';

/** Largest offsets, exported so tests can hold them to a comfortable range. */
export const CAMERA_FEEL_LIMITS = { bob: 0.024, dip: 0.085, roll: 0.0075, sprintZoom: 0.965 } as const;

const FOOTFALL_HZ_MAX = 2.1;
const WALK_REFERENCE = 3.4;

export interface CameraFeelInput {
  /** Body velocity in metres per second. */
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly grounded: boolean;
  /** False while seated, frozen, flying, in a panel, or under reduced motion. */
  readonly enabled: boolean;
}

/**
 * Presentation-only weight for the first-person camera: a footfall, a landing
 * and a breath of widening at a sprint. It never touches the body, the look
 * direction's yaw and pitch, collision or input, and it settles to exactly
 * zero at rest, so a standing visitor sees the authored eye to the millimetre.
 */
export class CameraFeel {
  private phase = 0;
  private gait = 0;
  private dip = 0;
  private dipVelocity = 0;
  private roll = 0;
  private zoom = 1;
  private fallSpeed = 0;
  private wasGrounded = true;

  update(dt: number, input: CameraFeelInput): void {
    const step = Math.min(Math.max(dt, 0), 0.05);
    const { velocity } = input;
    if (!input.enabled) {
      this.reset();
      this.wasGrounded = input.grounded;
      return;
    }
    const speed = Math.hypot(velocity.x, velocity.z);
    const walking = input.grounded && speed > 0.25;
    this.gait = ease(this.gait, walking ? Math.min(1, speed / WALK_REFERENCE) : 0, step, 0.12);
    if (walking) {
      const hz = Math.min(FOOTFALL_HZ_MAX, 1.05 + speed * 0.12);
      this.phase = (this.phase + step * hz * Math.PI * 2) % (Math.PI * 2);
    }

    if (!input.grounded) this.fallSpeed = Math.max(0, -velocity.y);
    else if (!this.wasGrounded) {
      if (this.fallSpeed > 2.5) this.dipVelocity -= Math.min(1.5, this.fallSpeed * 0.16);
      this.fallSpeed = 0;
    }
    this.wasGrounded = input.grounded;
    // Critically damped, so a landing settles once and never rings.
    const k = 13;
    this.dipVelocity += (-k * k * this.dip - 2 * k * this.dipVelocity) * step;
    this.dip = Math.max(-CAMERA_FEEL_LIMITS.dip, this.dip + this.dipVelocity * step);
    if (Math.abs(this.dip) < 1e-5 && Math.abs(this.dipVelocity) < 1e-4) this.dip = this.dipVelocity = 0;

    const lateral = velocity.x * Math.cos(input.yaw) - velocity.z * Math.sin(input.yaw);
    const lean = Math.max(-1, Math.min(1, lateral / 9)) * CAMERA_FEEL_LIMITS.roll;
    this.roll = ease(this.roll, input.grounded ? -lean : 0, step, 0.14);
    const sprint = Math.max(0, Math.min(1, (speed - 5) / 8));
    this.zoom = ease(this.zoom, 1 + (CAMERA_FEEL_LIMITS.sprintZoom - 1) * sprint, step, 0.22);
  }

  /** Adds the offsets to a camera the controller has just placed. */
  apply(camera: THREE.PerspectiveCamera): void {
    camera.position.y += this.offsetY;
    camera.rotation.z += this.roll;
    if (camera.zoom !== this.zoom) {
      camera.zoom = this.zoom;
      camera.updateProjectionMatrix();
    }
  }

  get offsetY(): number {
    const bob = this.gait === 0 ? 0 : (Math.cos(this.phase * 2) - 1) * 0.5 * CAMERA_FEEL_LIMITS.bob * this.gait;
    return bob + this.dip;
  }

  get isResting(): boolean {
    return this.offsetY === 0 && this.roll === 0 && this.zoom === 1;
  }

  private reset(): void {
    this.phase = this.gait = this.dip = this.dipVelocity = this.roll = this.fallSpeed = 0;
    this.zoom = 1;
  }
}

/** Exponential approach that lands exactly on its target. */
function ease(current: number, target: number, dt: number, tau: number): number {
  const next = target + (current - target) * Math.exp(-dt / tau);
  return Math.abs(next - target) < 1e-4 ? target : next;
}

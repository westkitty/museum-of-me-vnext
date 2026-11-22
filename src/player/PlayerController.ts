import * as THREE from 'three';
import type { CollisionWorld } from '../world/CollisionWorld';
import type { InputManager } from './Input';
import type { Vec3 } from '../world/layout';

export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.78;
export const EYE_HEIGHT = 1.64;

export const WALK_SPEED = 3.4;
/** Shift sprint: 2.5x the earlier 6.2 m/s (owner request: +150%). */
export const RUN_SPEED = 15.5;
/**
 * Inside the obsidian sphere the visitor moves as if through dense water:
 * walking at WATER_WALK_FACTOR of normal walking speed, and a sprint is only
 * a little faster (still slower than an ordinary walk). The change eases in and
 * out over WATER_EASE_SECONDS; acceleration and turning are unchanged.
 */
export const WATER_WALK_FACTOR = 0.62;
export const WATER_RUN_FACTOR = 0.62 * 1.35;
export const WATER_EASE_SECONDS = 0.45;
/** Thickness a flying visitor treats beneath any floor or ramp surface. */
export const FLIGHT_SLAB_DEPTH = 0.6;
export const JUMP_SPEED = 7.2;
const ACCEL = 34;
const FRICTION = 14;
const GRAVITY = 22;
const STEP_UP = 0.55;
const MAX_PITCH = Math.PI / 2 - 0.02;
const LOOK_SCALE = 0.0022;

/**
 * Camera comfort on step-ups. Physics still lifts the body onto a ledge or
 * stair tread in one fixed step (collision is unchanged); only the eye follows
 * over a short exponential ease, so a 0.5 m step is not a 0.5 m single-frame
 * camera jolt. Rises smaller than STEP_SMOOTH_MIN (ordinary ramps, which climb
 * a few centimetres per step) are untouched, so slopes keep a 1:1 eye.
 */
export const STEP_SMOOTH_MIN = 0.08;
export const STEP_SMOOTH_TAU = 0.075;

export const FLIGHT_SPEED = 7;
export const FLIGHT_RUN_SPEED = 16;
/** Metres above the last support the visitor must clear before landing again
 * can end flight -- otherwise entering while standing on the pad immediately
 * counts as "touched the ground" and switches gravity straight back on. */
const FLIGHT_LEAVE_GROUND_MARGIN = 1.2;
/** Initial upward pop on stepping onto the flight pad, so gravity release
 * reads as a launch rather than the visitor simply drifting off the floor. */
export const FLIGHT_LAUNCH_SPEED = 8.5;
/** Decay rate for that launch pop, in m/s per second. */
const FLIGHT_LAUNCH_DECAY = 12;

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

  /** True while gravity and wall collision are suspended (the flight pad). */
  flightMode = false;
  private developerFlight = false;
  private readonly developerTakeoff = new THREE.Vector3();

  get developerFlightMode(): boolean { return this.developerFlight; }

  /** Previous fixed-step position, for render interpolation. */
  private readonly prevPosition = new THREE.Vector3();
  /** Last spot the visitor stood on real support; the fall safety net returns here. */
  private readonly lastSafe = new THREE.Vector3();
  private readonly prevYaw = { v: 0 };
  private readonly prevPitch = { v: 0 };
  /** A jump press is consumed by the next fixed step. */
  private jumpQueued = false;
  /** Cleared on entering flight, set once the visitor has actually cleared
   * the floor -- see FLIGHT_LEAVE_GROUND_MARGIN. */
  private hasLeftGroundInFlight = false;
  /** Remaining upward pop from the launch; decays to 0 then flight is pure
   * look/WASD control. See FLIGHT_LAUNCH_SPEED/FLIGHT_LAUNCH_DECAY. */
  private launchVelocityY = 0;

  /** Metres the eye still trails the body after a step-up (camera only). */
  private eyeLag = 0;
  private prevEyeLag = 0;

  /** Current camera-only step-up lag, for tests and diagnostics. */
  get stepEyeLag(): number {
    return this.eyeLag;
  }

  /** Set while a scripted move (map wayfinding, reset) owns the player. */
  private frozen = false;
  private readonly freezeOwners = new Set<symbol>();

  /** True while a scripted move or an open UI panel owns the player -- callers
   * outside this class (App's flight-pad trigger) must not act on the player
   * while this is true. */
  get isFrozen(): boolean {
    return this.frozen || this.freezeOwners.size > 0;
  }

  constructor(
    private world: CollisionWorld,
    private readonly input: InputManager,
  ) {
    this.input.on('jump', () => {
      if (!this.isFrozen && !this.input.uiCaptured) this.jumpQueued = true;
    });
  }

  get collisionWorld(): CollisionWorld {
    return this.world;
  }

  setCollisionWorld(world: CollisionWorld): void {
    this.world = world;
  }

  /**
   * Carry the visitor across a non-Euclidean seam: position and the
   * interpolation origin move together, so the frame shows no streak, and
   * velocity, facing and flight are kept (unlike teleport).
   */
  shift(dx: number, dy: number, dz: number): void {
    this.position.x += dx; this.position.y += dy; this.position.z += dz;
    this.prevPosition.x += dx; this.prevPosition.y += dy; this.prevPosition.z += dz;
  }

  /** 0 on dry ground, 1 fully in the sphere's water; eased toward the target. */
  private water = 0;
  private waterTarget = 0;

  /** Set each frame by the app: whether the visitor stands in the obsidian chamber. */
  setInWater(inWater: boolean): void {
    this.waterTarget = inWater ? 1 : 0;
  }

  /** Current water blend (0–1), for tests and diagnostics. */
  get waterLevel(): number {
    return this.water;
  }

  teleport(p: Vec3, yaw = this.yaw): void {
    this.water = 0;
    this.waterTarget = 0;
    this.seat = null;
    this.position.set(p[0], p[1], p[2]);
    this.prevPosition.copy(this.position);
    this.lastSafe.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.prevYaw.v = yaw;
    this.jumpQueued = false;
    this.flightMode = false;
    this.developerFlight = false;
    this.eyeLag = 0;
    this.prevEyeLag = 0;
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    if (frozen) {
      this.velocity.set(0, 0, 0);
      this.jumpQueued = false;
    }
  }

  /** Release only this owner's freeze; scripted/UI freezes remain authoritative. */
  acquireFreeze(): () => void {
    const owner = Symbol('player freeze');
    this.freezeOwners.add(owner);
    this.velocity.set(0, 0, 0);
    this.jumpQueued = false;
    return () => { this.freezeOwners.delete(owner); };
  }

  /**
   * Seated viewing (the cinema). Movement and gravity stop and the eye drops
   * to `eyeHeight`; looking around stays free. `stand()` puts the visitor back
   * exactly where they stood before sitting, so sitting never moves their
   * walking position. Not a freeze: panels and scripted moves still freeze on
   * top of it, and a seat never blocks them.
   */
  private seat: { eyeHeight: number; returnTo: THREE.Vector3 } | null = null;

  get isSeated(): boolean {
    return this.seat !== null;
  }

  get seatedEyeHeight(): number | null {
    return this.seat?.eyeHeight ?? null;
  }

  sit(feet: Vec3, yaw: number, eyeHeight: number): boolean {
    if (this.flightMode || this.isFrozen) return false;
    const returnTo = this.seat?.returnTo ?? this.position.clone();
    this.position.set(feet[0], feet[1], feet[2]);
    this.prevPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.prevYaw.v = yaw;
    this.pitch = 0;
    this.prevPitch.v = 0;
    this.jumpQueued = false;
    this.eyeLag = 0;
    this.prevEyeLag = 0;
    this.seat = { eyeHeight, returnTo };
    return true;
  }

  /** Leave the seat. Returns false when not seated. */
  stand(): boolean {
    if (!this.seat) return false;
    this.position.copy(this.seat.returnTo);
    this.prevPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.jumpQueued = false;
    this.seat = null;
    this.grounded = true;
    return true;
  }

  private get eyeHeight(): number {
    return this.seat?.eyeHeight ?? EYE_HEIGHT;
  }

  /** Entered from the flight pad while grounded. Gravity and walls let go,
   * with a brief upward pop so it reads as a launch, not a drift. */
  enterFlight(launchSpeed = FLIGHT_LAUNCH_SPEED): void {
    if (this.flightMode) return;
    this.flightMode = true;
    this.hasLeftGroundInFlight = false;
    this.velocity.set(0, 0, 0);
    this.launchVelocityY = launchSpeed;
    // A jump queued before liftoff (or during flight, where nothing ever
    // consumes it) must not survive into normal mode and fire as an
    // involuntary jump the instant the visitor lands.
    this.jumpQueued = false;
  }

  /** Noclip without a pad launch or automatic landing. Existing visitor flight
   * remains independent; return to safe takeoff if noclip ends inside a wall. */
  setDeveloperFlight(enabled: boolean): boolean {
    if (enabled && this.isFrozen) return false;
    if (enabled === this.developerFlight) return true;
    if (enabled) {
      this.developerTakeoff.copy(this.position);
      this.developerFlight = true;
      this.flightMode = true;
      this.velocity.set(0, 0, 0);
      this.launchVelocityY = 0;
      this.jumpQueued = false;
      this.grounded = false;
      return true;
    }
    const probe = { x: this.position.x, y: this.position.y, z: this.position.z };
    const insideWall = this.world.resolveHorizontal(probe, PLAYER_RADIUS, PLAYER_HEIGHT);
    const support = this.world.supportHeight(this.position.x, this.position.z, this.position.y, STEP_UP);
    if (insideWall || support === null || this.position.y < support - 0.1) {
      this.position.copy(this.developerTakeoff);
      this.prevPosition.copy(this.position);
    }
    this.exitFlight();
    this.grounded = false;
    return true;
  }

  private exitFlight(): void {
    this.developerFlight = false;
    this.flightMode = false;
    this.velocity.set(0, 0, 0);
    this.launchVelocityY = 0;
    this.jumpQueued = false;
  }

  /** Mouse/keyboard/touch look. Applied once per frame from real deltas. */
  applyLook(dx: number, dy: number, sensitivity: number, invertY: boolean): void {
    if (this.isFrozen) return;
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
    this.prevEyeLag = this.eyeLag;
    if (this.isFrozen || this.seat) return;
    if (this.flightMode) {
      this.eyeLag = 0;
      this.fixedUpdateFlight(dt);
      return;
    }
    const wasGrounded = this.grounded;

    // -- desired horizontal motion in world space --
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
    const running = this.input.isDown('run');
    this.water += (this.waterTarget - this.water) * (1 - Math.exp(-dt / WATER_EASE_SECONDS));
    const dry = running ? RUN_SPEED : WALK_SPEED;
    const wet = WALK_SPEED * (running ? WATER_RUN_FACTOR : WATER_WALK_FACTOR);
    const speed = dry + (wet - dry) * this.water;
    let wishX = 0;
    let wishZ = 0;
    if (len > 0) {
      ix /= len;
      iz /= len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Forward is -Z rotated by yaw, matching the camera exactly. A camera
      // with rotation.y = yaw (order YXZ) looks along (-sin, 0, -cos) and has
      // its right along (cos, 0, -sin), so intent must be rotated the same way.
      // Mirroring either axis makes the visitor walk away from where they are
      // looking at every yaw that is not on the main axis.
      wishX = (ix * cos + iz * sin) * speed;
      wishZ = (-ix * sin + iz * cos) * speed;
    }

    // -- accelerate toward the wish velocity, then apply friction --
    this.velocity.x = approach(this.velocity.x, wishX, ACCEL * dt);
    this.velocity.z = approach(this.velocity.z, wishZ, ACCEL * dt);
    if (len === 0) {
      this.velocity.x = approach(this.velocity.x, 0, FRICTION * dt);
      this.velocity.z = approach(this.velocity.z, 0, FRICTION * dt);
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // -- horizontal depenetration --
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

    // -- vertical: jump, then gravity and support --
    if (this.jumpQueued) {
      if (this.grounded) {
        this.velocity.y = JUMP_SPEED;
        this.grounded = false;
      }
      // A press is one attempt. Holding Space cannot auto-bunny-hop on landing.
      this.jumpQueued = false;
    }

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

    if (this.grounded && support !== null) this.lastSafe.copy(this.position);

    // Safety net: the museum has no pits, so falling means something is wrong.
    // Return the visitor to the last spot they stood on real support. (Before
    // the island safety fix this lifted them to y = support ?? 0 at the same
    // x/z, which over unsupported water restarted the fall every ~2.5 s.)
    if (this.position.y < -60) {
      this.position.copy(this.lastSafe);
      this.prevPosition.copy(this.lastSafe);
      this.velocity.set(0, 0, 0);
      this.grounded = true;
    }

    // Head clearance.
    const ceiling = this.world.ceilingHeight(this.position.x, this.position.z, this.position.y);
    if (Number.isFinite(ceiling) && this.position.y + PLAYER_HEIGHT > ceiling) {
      this.position.y = Math.max(support ?? this.position.y, ceiling - PLAYER_HEIGHT);
      if (this.velocity.y > 0) this.velocity.y = 0;
    }

    // Camera comfort: let the eye ease up after a walked step-up.
    const rise = this.position.y - this.prevPosition.y;
    if (wasGrounded && this.grounded && rise > STEP_SMOOTH_MIN && rise <= STEP_UP + 0.01) {
      this.eyeLag = Math.min(STEP_UP, this.eyeLag + rise);
    }
    this.eyeLag *= Math.exp(-dt / STEP_SMOOTH_TAU);
    if (this.eyeLag < 1e-4) this.eyeLag = 0;
  }

  /**
   * Free-fly noclip: gravity and wall collision are both off. Forward/back
   * follow the full look direction (pitch included) so looking up or down
   * and holding W climbs or dives, exactly like walking except untethered.
   * Strafing stays level, using yaw only, so it never rolls with the pitch.
   */
  private fixedUpdateFlight(dt: number): void {
    let ix = 0;
    let iz = 0;
    if (this.input.isDown('forward')) iz -= 1;
    if (this.input.isDown('back')) iz += 1;
    if (this.input.isDown('left')) ix -= 1;
    if (this.input.isDown('right')) ix += 1;
    if (!this.input.uiCaptured) {
      ix += this.input.touchMoveX;
      iz += this.input.touchMoveY;
    }

    const len = Math.hypot(ix, iz);
    const speed = this.input.isDown('run') ? FLIGHT_RUN_SPEED : FLIGHT_SPEED;
    if (len > 0) {
      ix /= len;
      iz /= len;
      const f = this.forward;
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);
      // -iz because forward is bound to the 'forward' action, which sets iz = -1.
      this.position.x += (f.x * -iz + rightX * ix) * speed * dt;
      this.position.y += f.y * -iz * speed * dt;
      this.position.z += (f.z * -iz + rightZ * ix) * speed * dt;
    }

    // Developer flight strafes vertically and never auto-lands.
    if (this.developerFlight) {
      const vertical = Number(this.input.isDown('jump')) - Number(this.input.isDown('descend'));
      this.position.y += vertical * speed * dt;
      this.velocity.set(0, 0, 0);
      this.grounded = false;
      return;
    }

    // The launch pop rides on top of look/WASD control and decays to nothing,
    // rather than gating input -- so pushing forward immediately on entry
    // still works, it just also happens to be climbing for a moment.
    if (this.launchVelocityY > 0) {
      this.position.y += this.launchVelocityY * dt;
      this.launchVelocityY = Math.max(0, this.launchVelocityY - FLIGHT_LAUNCH_DECAY * dt);
    }

    this.velocity.set(0, 0, 0);
    this.grounded = false;

    // Visitor flight collides like walking does: walls and railings push the
    // capsule out, and ceilings stop the climb. Without this a flying visitor
    // could pass into solid geometry or out of the building and be stuck.
    const ceiling = this.world.ceilingHeight(this.position.x, this.position.z, this.position.y);
    if (Number.isFinite(ceiling) && this.position.y + PLAYER_HEIGHT > ceiling) {
      this.position.y = Math.max(ceiling - PLAYER_HEIGHT, this.prevPosition.y);
      this.launchVelocityY = 0;
    }
    this.resolveFlightSlabs();
    this.world.resolveHorizontal(this.position, PLAYER_RADIUS, PLAYER_HEIGHT);

    // Landing ends flight. A margin above the last known support means
    // standing on the pad at the moment flight begins can't immediately
    // read as "already landed" and hand gravity straight back.
    const support = this.world.supportHeight(this.position.x, this.position.z, this.position.y, 0.55);
    if (support !== null && this.position.y - support > FLIGHT_LEAVE_GROUND_MARGIN) {
      this.hasLeftGroundInFlight = true;
    }
    if (this.hasLeftGroundInFlight && support !== null && this.position.y <= support + 1e-3) {
      this.position.y = support;
      this.exitFlight();
      this.grounded = true;
    }
  }

  /**
   * Floors and ramps are solid slabs to a flying visitor, not just surfaces
   * to land on. Rising from below, the head stops under a slab's underside
   * (FLIGHT_SLAB_DEPTH below its top); moving sideways into a slab's thickness
   * is refused. Without this the visitor flew up through the balcony ring and
   * other slabs with the camera inside them, and out of the building
   * (2026-11-21 walkthrough). Open stair wells (masked floors) stay open.
   */
  private resolveFlightSlabs(): void {
    const p = this.position;
    const prev = this.prevPosition;
    // A slab whose top is above the visitor's feet and whose underside is
    // below the top of their head overlaps the capsule.
    const overlapping = (x: number, z: number, y: number) =>
      this.world.walkableSurfaceBetween(x, z, y + 0.05, y + PLAYER_HEIGHT + FLIGHT_SLAB_DEPTH);
    const slab = overlapping(p.x, p.z, p.y);
    if (slab === null) return;
    const wasBelow = prev.y + PLAYER_HEIGHT <= slab - FLIGHT_SLAB_DEPTH + 1e-6;
    if (wasBelow) {
      // Rising into the underside: stop with the head just beneath it.
      p.y = Math.min(p.y, slab - FLIGHT_SLAB_DEPTH - PLAYER_HEIGHT);
      this.launchVelocityY = 0;
      if (overlapping(p.x, p.z, p.y) === null) return;
    }
    // Sideways into a slab's thickness: refuse the horizontal move.
    if (overlapping(prev.x, prev.z, p.y) === null) {
      p.x = prev.x;
      p.z = prev.z;
    }
  }

  /** Write the interpolated eye transform into the camera. */
  applyToCamera(camera: THREE.PerspectiveCamera, alpha: number): void {
    const x = lerp(this.prevPosition.x, this.position.x, alpha);
    const y = lerp(this.prevPosition.y - this.prevEyeLag, this.position.y - this.eyeLag, alpha);
    const z = lerp(this.prevPosition.z, this.position.z, alpha);
    camera.position.set(x, y + this.eyeHeight, z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
    camera.rotation.z = 0;
  }

  /** Eye-position snapshot for ordinary callers. */
  get eyePosition(): Vec3 {
    return [this.position.x, this.position.y + this.eyeHeight, this.position.z];
  }

  /** Write eye position into caller-owned scratch storage for hot paths. */
  writeEyePosition(out: [number, number, number]): Vec3 {
    out[0] = this.position.x;
    out[1] = this.position.y + this.eyeHeight;
    out[2] = this.position.z;
    return out;
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

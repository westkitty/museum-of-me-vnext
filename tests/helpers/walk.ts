import * as THREE from 'three';
import { Museum } from '../../src/world/Museum';
import { ResourceScope } from '../../src/assets/ResourceScope';
import { CollisionWorld } from '../../src/world/CollisionWorld';
import { PLAYER_RADIUS, PLAYER_HEIGHT } from '../../src/player/PlayerController';
import type { Vec3 } from '../../src/world/layout';

export interface BuiltMuseum {
  museum: Museum;
  collision: CollisionWorld;
  scope: ResourceScope;
  root: THREE.Group;
  mounts: ReadonlyMap<string, THREE.Group>;
}

/** Build the real museum headlessly. No WebGL is required to construct geometry. */
export function buildMuseum(): BuiltMuseum {
  const scope = new ResourceScope('test-museum');
  const museum = new Museum(scope);
  const built = museum.build();
  return { museum, collision: built.collision, scope, root: built.root, mounts: built.exhibitMounts };
}

export interface WalkStep {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly label: string;
}

export interface WalkFailure {
  readonly label: string;
  readonly reason: string;
  readonly at: Vec3;
}

const STEP = 0.28;
const STEP_UP = 0.55;
/** How far the walker may deviate laterally to slide past a corner. */
const SLIDE = 0.5;
/** Consecutive non-advancing steps before a segment is declared blocked. */
const STALL_LIMIT = 6;

/**
 * Walks a straight line between two points against real collision, using the
 * same radius, height and step-up rule as the player controller. Returns null
 * on success, or the first failure encountered.
 *
 * This is the mechanism that proves traversal rather than asserting it.
 */
export function walkSegment(world: CollisionWorld, step: WalkStep): WalkFailure | null {
  const pos = { x: step.from[0], y: step.from[1], z: step.from[2] };
  const dx = step.to[0] - pos.x;
  const dz = step.to[2] - pos.z;
  const distance = Math.hypot(dx, dz);
  // Consecutive waypoints can coincide (two bays share a hall position); there
  // is nothing to walk and nothing to prove.
  if (distance < 1e-3) return null;
  const steps = Math.max(1, Math.ceil(distance / STEP));
  const ux = dx / Math.max(1e-6, distance);
  const uz = dz / Math.max(1e-6, distance);

  // Settle onto the floor at the start.
  const startSupport = world.supportHeight(pos.x, pos.z, pos.y + 2, 3);
  if (startSupport === null) {
    return { label: step.label, reason: 'no floor under the start of this segment', at: [pos.x, pos.y, pos.z] };
  }
  pos.y = startSupport;

  let bestRemaining = Math.hypot(step.to[0] - pos.x, step.to[2] - pos.z);
  let stalled = 0;

  for (let i = 0; i < steps; i++) {
    const prevX = pos.x;
    const prevZ = pos.z;
    pos.x += ux * STEP;
    pos.z += uz * STEP;

    world.resolveHorizontal(pos, PLAYER_RADIUS, PLAYER_HEIGHT);

    const support = world.supportHeight(pos.x, pos.z, pos.y, STEP_UP);
    if (support === null) {
      return { label: step.label, reason: 'walked over a hole in the floor', at: [pos.x, pos.y, pos.z] };
    }
    if (support - pos.y > STEP_UP + 1e-6) {
      return {
        label: step.label,
        reason: `step of ${(support - pos.y).toFixed(2)} m exceeds the ${STEP_UP} m step-up limit`,
        at: [pos.x, pos.y, pos.z],
      };
    }
    pos.y = support;

    const ceiling = world.ceilingHeight(pos.x, pos.z, pos.y);
    if (Number.isFinite(ceiling) && ceiling - pos.y < PLAYER_HEIGHT) {
      return {
        label: step.label,
        reason: `headroom ${(ceiling - pos.y).toFixed(2)} m is below the ${PLAYER_HEIGHT} m player height`,
        at: [pos.x, pos.y, pos.z],
      };
    }

    // Progress check. Measured as reduction in remaining distance to the
    // target, not as raw displacement — otherwise sliding sideways along a wall
    // reads as progress and a solid blocker slips through the test.
    const remaining = Math.hypot(step.to[0] - pos.x, step.to[2] - pos.z);
    // Arrived. Depenetration at the start can shift us, so distance-to-target
    // is the honest arrival test rather than a fixed step count.
    if (remaining <= STEP) return null;
    if (remaining < bestRemaining - 1e-3) {
      bestRemaining = remaining;
      stalled = 0;
    } else {
      stalled++;
      // Allow a lateral nudge to get around a pier, as a real visitor would.
      const nx = -uz;
      const nz = ux;
      let recovered = false;
      for (const sideStep of [SLIDE, -SLIDE, SLIDE * 2, -SLIDE * 2]) {
        const probe = { x: prevX + nx * sideStep + ux * STEP, y: pos.y, z: prevZ + nz * sideStep + uz * STEP };
        world.resolveHorizontal(probe, PLAYER_RADIUS, PLAYER_HEIGHT);
        const probeRemaining = Math.hypot(step.to[0] - probe.x, step.to[2] - probe.z);
        if (probeRemaining < bestRemaining - 1e-3 && world.supportHeight(probe.x, probe.z, pos.y, STEP_UP) !== null) {
          pos.x = probe.x;
          pos.z = probe.z;
          bestRemaining = probeRemaining;
          stalled = 0;
          recovered = true;
          break;
        }
      }
      if (!recovered && stalled >= STALL_LIMIT) {
        return { label: step.label, reason: 'blocked by geometry', at: [pos.x, pos.y, pos.z] };
      }
    }
  }
  return null;
}

/** Walk a whole waypoint list. Returns every failure found, not just the first. */
export function walkRoute(
  world: CollisionWorld,
  waypoints: readonly { label: string; at: Vec3 }[],
): WalkFailure[] {
  const failures: WalkFailure[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const failure = walkSegment(world, {
      from: a.at,
      to: b.at,
      label: `${a.label} → ${b.label}`,
    });
    if (failure) failures.push(failure);
  }
  return failures;
}

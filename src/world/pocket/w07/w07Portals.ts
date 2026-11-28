import type { CollisionWorld } from '../../CollisionWorld';
import type { PlayerController } from '../../../player/PlayerController';
import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from '../../../player/PlayerController';
import {
  AIM_ASSIST, exitPoint, FLING_SPEED, MAX_EXIT_SPEED, MIN_EXIT_SPEED, type Panel, PANELS, PORTAL_COOLDOWN, SHOT_RANGE,
  type Vec3, yawFacing, type ZoneId,
} from './w07Layout';

export type PortalColour = 'amber' | 'teal';

export interface Portal {
  readonly panel: Panel;
  readonly colour: PortalColour;
  readonly order: number;
}

/** Wall portals damp sprinting: only a fall carries full speed through the lab's panels. */
export const MAX_WALL_ENTRY_SPEED = 8;
/** The museum player's gravity (m/s^2), used to resolve a reduced-motion flight at once. */
const GRAVITY = 22;

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Rotate a horizontal vector by `theta` about +Y, matching the player's yaw convention. */
function rotateY(x: number, z: number, theta: number): [number, number] {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [x * c + z * s, -x * s + z * c];
}

/**
 * Which approved panel a slingshot shot from `eye` along `dir` lands on:
 * an exact hit on a panel's aperture wins (nearest first); otherwise the
 * aiming assist snaps to the panel closest to the view ray within AIM_ASSIST.
 * A panel is only shootable from its listed standing areas and from its front.
 */
export function shotTarget(eye: Vec3, dir: Vec3): Panel | null {
  let best: Panel | null = null;
  let bestT = Infinity;
  let assist: Panel | null = null;
  let assistAngle = AIM_ASSIST;
  for (const p of PANELS) {
    const [cx, cy, cz] = p.centre;
    const n = p.normal;
    const ex = eye[0] - cx, ey = eye[1] - cy, ez = eye[2] - cz;
    if (ex * n[0] + ey * n[1] + ez * n[2] < 0.2) continue;
    if (!p.shootFrom.some((r) => eye[0] >= r.minX - 0.05 && eye[0] <= r.maxX + 0.05 && eye[2] >= r.minZ - 0.05 && eye[2] <= r.maxZ + 0.05)) continue;
    const dn = dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2];
    if (dn < -1e-6) {
      const t = -(ex * n[0] + ey * n[1] + ez * n[2]) / dn;
      if (t > 0 && t <= SHOT_RANGE) {
        const hx = eye[0] + dir[0] * t - cx, hy = eye[1] + dir[1] * t, hz = eye[2] + dir[2] * t - cz;
        const margin = 0.25;
        let inside: boolean;
        if (p.kind === 'floor') inside = Math.abs(hx) <= p.half + margin && Math.abs(hz) <= p.half + margin;
        else {
          const lateral = Math.abs(hx * n[2] - hz * n[0]);
          inside = lateral <= p.half + margin && hy >= p.bottom - margin && hy <= p.top + margin;
        }
        if (inside && t < bestT) {
          best = p;
          bestT = t;
        }
      }
    }
    const len = Math.hypot(ex, ey, ez);
    if (len > SHOT_RANGE || len < 1e-6) continue;
    const cos = -(dir[0] * ex + dir[1] * ey + dir[2] * ez) / len;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle < assistAngle) {
      assist = p;
      assistAngle = angle;
    }
  }
  return best ?? assist;
}

export interface TransitEvent {
  readonly from: Panel;
  readonly to: Panel;
  readonly speed: number;
}

/**
 * The lab's two-portal system. Rules (deterministic):
 * - a shot on a free approved panel opens a portal there; with two already
 *   open, the older one closes first. A shot on an open portal closes it.
 * - the two portals are always linked to each other once both exist.
 * - stepping into a linked wall portal (or falling onto a linked floor
 *   portal) places the visitor just out of the partner's socket, facing out,
 *   moving out at the speed they carried in (clamped; wall entries damped).
 * - leaving a wall portal fast holds that horizontal momentum (the player's
 *   own friction would otherwise kill it) until the visitor lands or meets a
 *   wall. Under reduced motion that flight resolves at once to its landing.
 */
export function createPortalSystem(player: PlayerController, collision: CollisionWorld, onTransit?: (e: TransitEvent) => void) {
  let portals: Portal[] = [];
  let order = 0;
  let cooldown = 0;
  let fling: { x: number; z: number } | null = null;
  let transits = 0;
  let flings = 0;
  const prevVel = { x: 0, y: 0, z: 0 };

  const linked = () => portals.length === 2;
  const portalOn = (id: string) => portals.find((p) => p.panel.id === id) ?? null;
  const partner = (p: Portal) => portals.find((q) => q !== p)!;

  const entrySpeed = (p: Portal): number | null => {
    const pos = player.position;
    const v = player.velocity;
    const panel = p.panel;
    const [cx, cy, cz] = panel.centre;
    if (panel.kind === 'floor') {
      if (Math.abs(pos.x - cx) > panel.half + 0.1 || Math.abs(pos.z - cz) > panel.half + 0.1) return null;
      if (pos.y > cy + 0.02 || v.y >= 0) return null;
      return -v.y;
    }
    const n = panel.normal;
    const dx = pos.x - cx, dz = pos.z - cz;
    const d = dx * n[0] + dz * n[2];
    const lateral = Math.abs(dx * n[2] - dz * n[0]);
    if (d > PLAYER_RADIUS + 0.06 || d < -0.3 || lateral > panel.half - 0.05) return null;
    if (pos.y < panel.bottom - 0.3 || pos.y > panel.top - 1.2) return null;
    const into = Math.max(-(prevVel.x * n[0] + prevVel.z * n[2]), -(v.x * n[0] + v.z * n[2]), 0);
    return Math.min(into, MAX_WALL_ENTRY_SPEED);
  };

  /** Resolve a held-momentum flight at once (reduced motion): same arc, no camera travel. */
  const resolveFlightNow = (): void => {
    if (!fling) return;
    const p = { x: player.position.x, y: player.position.y, z: player.position.z };
    let vx = fling.x, vz = fling.z, vy = player.velocity.y;
    const dt = 1 / 60;
    for (let i = 0; i < 900; i++) {
      const prevY = p.y;
      vy -= GRAVITY * dt;
      p.x += vx * dt;
      p.z += vz * dt;
      if (collision.resolveHorizontal(p, PLAYER_RADIUS, PLAYER_HEIGHT)) vx = vz = 0;
      p.y += vy * dt;
      const support = collision.supportHeight(p.x, p.z, prevY, 0.55);
      if (support !== null && p.y <= support && vy <= 0) {
        p.y = support;
        break;
      }
      if (p.y < -60) break;
    }
    fling = null;
    player.restorePose([p.x, p.y, p.z], player.yaw, player.pitch);
  };

  const transit = (from: Portal, speedIn: number): void => {
    const to = partner(from);
    const a = from.panel, b = to.panel;
    const speed = Math.max(MIN_EXIT_SPEED, Math.min(MAX_EXIT_SPEED, speedIn));
    const v = player.velocity;
    let vx = 0, vy = 0, vz = 0;
    let yaw = player.yaw;
    if (b.kind === 'wall') {
      const yawOut = yawFacing(b.normal);
      if (a.kind === 'wall') {
        const yawIn = yawFacing([-a.normal[0], 0, -a.normal[2]]);
        const theta = wrap(yawOut - yawIn);
        yaw = wrap(player.yaw + theta);
        [vx, vz] = rotateY(v.x, v.z, theta);
        // Keep the carried tangential drift small; the outward speed is the carried speed.
        const out = vx * b.normal[0] + vz * b.normal[2];
        const tx = vx - b.normal[0] * out, tz = vz - b.normal[2] * out;
        const tl = Math.hypot(tx, tz);
        const ts = tl > 2 ? 2 / tl : 1;
        vx = b.normal[0] * speed + tx * ts;
        vz = b.normal[2] * speed + tz * ts;
        vy = Math.max(-2, Math.min(2, v.y));
      } else {
        yaw = yawOut;
        vx = b.normal[0] * speed;
        vz = b.normal[2] * speed;
        vy = 0;
      }
    } else {
      vy = speed;
    }
    player.teleport(exitPoint(b) as [number, number, number], yaw);
    player.velocity.set(vx, vy, vz);
    player.grounded = false;
    cooldown = PORTAL_COOLDOWN;
    transits++;
    fling = b.kind === 'wall' && speed >= FLING_SPEED ? { x: vx, z: vz } : null;
    if (fling) flings++;
    onTransit?.({ from: a, to: b, speed });
  };

  return {
    get portals(): readonly Portal[] { return portals; },
    get linked() { return linked(); },
    get transits() { return transits; },
    get flings() { return flings; },
    get flying() { return fling !== null; },
    portalOn,
    /** True where a linked floor portal is open (its floor stops supporting). */
    floorOpen(id: string): boolean {
      return linked() && portalOn(id)?.panel.kind === 'floor';
    },
    /** Shoot a panel: open a portal there, or close the one already there. */
    place(panel: Panel): 'placed' | 'removed' {
      const existing = portalOn(panel.id);
      if (existing) {
        portals = portals.filter((p) => p !== existing);
        return 'removed';
      }
      if (portals.length === 2) {
        const older = portals[0].order < portals[1].order ? portals[0] : portals[1];
        portals = portals.filter((p) => p !== older);
      }
      const colour: PortalColour = portals.some((p) => p.colour === 'amber') ? 'teal' : 'amber';
      portals = [...portals, { panel, colour, order: order++ }];
      return 'placed';
    },
    /** Close every portal outside `zone` (each chamber is solved on its own). */
    clearOutside(zone: ZoneId | null): number {
      const before = portals.length;
      portals = portals.filter((p) => p.panel.zone === zone);
      return before - portals.length;
    },
    clearAll(): void {
      portals = [];
      fling = null;
    },
    /** The eye position and view ray of the visitor, for aiming. */
    aim(): { eye: Vec3; dir: Vec3 } {
      const f = player.forward;
      return { eye: [player.position.x, player.position.y + EYE_HEIGHT, player.position.z], dir: [f.x, f.y, f.z] };
    },
    fixedUpdate(dt: number, reducedMotion: boolean): void {
      cooldown = Math.max(0, cooldown - dt);
      const v = player.velocity;
      if (fling) {
        if (player.grounded) fling = null;
        else if (Math.hypot(v.x - fling.x, v.z - fling.z) > 3) fling = null;
        else {
          v.x = fling.x;
          v.z = fling.z;
        }
      }
      if (linked() && cooldown === 0) {
        for (const p of portals) {
          const s = entrySpeed(p);
          if (s === null) continue;
          transit(p, s);
          if (reducedMotion) resolveFlightNow();
          break;
        }
      }
      prevVel.x = v.x;
      prevVel.y = v.y;
      prevVel.z = v.z;
    },
  };
}

export type PortalSystem = ReturnType<typeof createPortalSystem>;

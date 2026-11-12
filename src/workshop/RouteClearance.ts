import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../player/PlayerController';
import type { Vec3 } from '../world/layout';
import type { ColliderSnapshot } from '../world/CollisionWorld';
import type { MuseumSceneIndex } from './SceneIndex';

type WallSnapshot = Extract<ColliderSnapshot, { kind: 'wall' }>;
export interface RouteClearanceFinding {
  readonly objectId: string | null;
  readonly colliderId: string;
  readonly world: 'exterior' | 'interior';
  readonly routeFrom: string;
  readonly routeTo: string;
  readonly authority: 'authored' | 'unknown';
  readonly explanation: string;
}
export interface RouteClearanceReport {
  readonly status: 'WARNING' | 'UNKNOWN';
  readonly findings: readonly RouteClearanceFinding[];
  readonly limitations: readonly string[];
}

/** Conservative swept-player test; square-expanded corners can yield false positives. */
export function routeMayIntersectWall(from: Vec3, to: Vec3, wall: WallSnapshot): boolean {
  const oriented = wall.oriented;
  const cos = Math.cos(oriented?.yaw ?? 0), sin = Math.sin(oriented?.yaw ?? 0);
  const cx = oriented?.centerX ?? (wall.minX + wall.maxX) / 2;
  const cz = oriented?.centerZ ?? (wall.minZ + wall.maxZ) / 2;
  const hx = (oriented?.halfX ?? (wall.maxX - wall.minX) / 2) + PLAYER_RADIUS;
  const hz = (oriented?.halfZ ?? (wall.maxZ - wall.minZ) / 2) + PLAYER_RADIUS;
  const transform = (p: Vec3): [number, number] => {
    const x = p[0] - cx, z = p[2] - cz;
    return [cos * x - sin * z, sin * x + cos * z];
  };
  const start = transform(from), end = transform(to);
  let low = 0, high = 1;
  for (const [axis, extent] of [[0, hx], [1, hz]] as const) {
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-9) {
      if (Math.abs(start[axis]) > extent) return false;
      continue;
    }
    const a = (-extent - start[axis]) / delta, b = (extent - start[axis]) / delta;
    low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
    if (low > high) return false;
  }
  const y1 = from[1] + (to[1] - from[1]) * low;
  const y2 = from[1] + (to[1] - from[1]) * high;
  return Math.min(y1, y2) < wall.maxY && Math.max(y1, y2) + PLAYER_HEIGHT > wall.minY;
}

/** An advisory scan of authored dynamic walls near canonical route segments. */
export function scanAuthoredRouteClearance(index: MuseumSceneIndex): RouteClearanceReport {
  const limitations = ['Only dynamic wall colliders and the canonical route are scanned.',
    'This conservative geometry test can report false positives at corners.',
    'Static architecture, alternate routes, masked floors, real traversal, both stair routes and interaction reach are not verified.',
    'Models still loading may have temporary collision bounds.'];
  if (!index.collisions.exterior || !index.collisions.interior) {
    return { status: 'UNKNOWN', findings: [], limitations: [...limitations, 'A collision world is not loaded.'] };
  }
  const findings: RouteClearanceFinding[] = [];
  for (const world of ['exterior', 'interior'] as const) {
    const walls = index.collisions[world]!.filter((collider): collider is typeof collider & WallSnapshot =>
      collider.ownership === 'dynamic' && collider.kind === 'wall');
    for (const wall of walls) {
      const raw = wall.id.startsWith('wall:') ? wall.id.slice(5) : wall.id;
      const object = index.authored.find((item) => raw === item.id || raw.startsWith(`${item.id}:segment-`));
      // The first canonical leg crosses the vestibule; later points are interior.
      for (let i = 0; i + 1 < index.route.length; i++) {
        if (world === 'exterior' && i !== 0) continue;
        const from = index.route[i], to = index.route[i + 1];
        if (!routeMayIntersectWall(from.position, to.position, wall)) continue;
        findings.push({ objectId: object?.id ?? null, colliderId: wall.id, world,
          routeFrom: from.label, routeTo: to.label, authority: object ? 'authored' : 'unknown',
          explanation: 'Possible contact with the player envelope along this route segment; inspect and test traversal.' });
        break;
      }
    }
  }
  return { status: 'WARNING', findings, limitations };
}

import {
  ATRIUM_DOOR, ENTRANCE_DOOR, GROUND_Y, LEVEL_1_Y, OCTAGON_FACES, PLAZA_DEPTH, PLAZA_HALF_WIDTH,
  PLACEMENT_BY_EXHIBIT, SANCTUARY_CENTER, SANCTUARY_DIR, SANCTUARY_FLOOR_Y, SANCTUARY_RAMP_FROM,
  SANCTUARY_RAMP_TO, STAIRS, WINGS, faceDirection, place, rightOf, stairArcPoint, stairArrivalFace, stairLanding, type Vec3,
} from './layout';
import { LAND_SUPPORT_Y, PATH_CENTERLINES, PIER_CENTERLINE, isSiteLand } from './exterior/IslandSiteLayout';
import { BALCONY_ROUTE_RADIUS, BALCONY_WALK_FACES, ROTUNDA_ROUTE_RADIUS } from './route';
import type { CollisionWorld } from './CollisionWorld';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../player/PlayerController';

export const MUSEUM_ENTRANCE_TARGET = 'museum-entrance';
export type GuideWorld = 'exterior' | 'interior';

export const ISLAND_LANDMARKS = [
  { name: 'Museum entrance', at: ENTRANCE_DOOR },
  { name: 'Arrival pier', at: [PIER_CENTERLINE[2][0], LAND_SUPPORT_Y, PIER_CENTERLINE[2][1]] },
  { name: 'East lagoon', at: [93, LAND_SUPPORT_Y, 0] },
] as const;

interface Edge {
  a: number;
  b: number;
  length: number;
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function interpolate(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

class FootpathNetwork {
  private readonly points: Vec3[] = [];
  private readonly nodes = new Map<string, number>();
  private readonly edges: Edge[] = [];
  private readonly neighbours: { to: number; length: number }[][] = [];

  connect(path: readonly Vec3[]): void {
    for (let i = 1; i < path.length; i++) {
      const a = this.node(path[i - 1]);
      const b = this.node(path[i]);
      if (a === b) continue;
      const length = distance(path[i - 1], path[i]);
      this.edges.push({ a, b, length });
      this.neighbours[a].push({ to: b, length });
      this.neighbours[b].push({ to: a, length });
    }
  }

  private node(point: Vec3): number {
    const key = point.join(',');
    const existing = this.nodes.get(key);
    if (existing !== undefined) return existing;
    const index = this.points.length;
    this.nodes.set(key, index);
    this.points.push(point);
    this.neighbours.push([]);
    return index;
  }

  route(from: Vec3, to: Vec3, canJoin?: (a: Vec3, b: Vec3) => boolean): Vec3[] {
    const goal = this.nodes.get(to.join(','));
    if (goal === undefined) return [];
    // Label every graph node with its distance to the goal. Bay detour
    // graphs can have disconnected edges where walls cut into their grid.
    const costs = this.points.map(() => Infinity);
    const nextOnRoute = this.points.map(() => -1);
    const visited = new Set<number>();
    costs[goal] = 0;
    while (visited.size < this.points.length) {
      let next = -1;
      for (let index = 0; index < costs.length; index++) {
        if (visited.has(index) || !Number.isFinite(costs[index])) continue;
        if (next === -1 || costs[index] < costs[next]) next = index;
      }
      if (next === -1) break;
      visited.add(next);
      for (const link of this.neighbours[next]) {
        const cost = costs[next] + link.length;
        if (cost < costs[link.to]) {
          costs[link.to] = cost;
          nextOnRoute[link.to] = next;
        }
      }
    }

    // Join the nearest walkable segment with a path to the destination. The
    // remainder follows the graph, so it cannot cut across a lagoon or atrium.
    let nearest: { node: number; point: Vec3; gap: number } | undefined;
    for (const edge of this.edges) {
      if (!Number.isFinite(costs[edge.a])) continue;
      const a = this.points[edge.a];
      const b = this.points[edge.b];
      const dot = (from[0] - a[0]) * (b[0] - a[0])
        + (from[1] - a[1]) * (b[1] - a[1]) + (from[2] - a[2]) * (b[2] - a[2]);
      const t = Math.max(0, Math.min(1, dot / (edge.length * edge.length)));
      const point = interpolate(a, b, t);
      const gap = distance(from, point);
      if ((!nearest || gap < nearest.gap) && (!canJoin || canJoin(from, point))) {
        const fromA = costs[edge.a] + edge.length * t;
        const fromB = costs[edge.b] + edge.length * (1 - t);
        nearest = { node: fromA <= fromB ? edge.a : edge.b, point, gap };
      }
    }
    if (!nearest) return [];
    const routed: Vec3[] = [from, nearest.point];
    for (let index = nearest.node; index !== -1; index = nextOnRoute[index]) routed.push(this.points[index]);
    return routed.filter((point, index) => index === 0 || distance(point, routed[index - 1]) > 0.01);
  }
}

const outside = new FootpathNetwork();
const exteriorPoint = ([x, z]: readonly [number, number]): Vec3 => [x, LAND_SUPPORT_Y, z];
for (const path of PATH_CENTERLINES) outside.connect(path.map(exteriorPoint));
const rampTopZ = ENTRANCE_DOOR[2] + PLAZA_DEPTH;
outside.connect([
  exteriorPoint(PIER_CENTERLINE[3]), exteriorPoint(PIER_CENTERLINE[2]),
  [0, LAND_SUPPORT_Y, 184], exteriorPoint(PIER_CENTERLINE[1]),
  [0, LAND_SUPPORT_Y, 164], [0, GROUND_Y, rampTopZ], ENTRANCE_DOOR,
]);

function canJoinExterior(from: Vec3, to: Vec3): boolean {
  const steps = Math.ceil(distance(from, to) / 1.2);
  for (let i = 1; i <= steps; i++) {
    const [x, , z] = interpolate(from, to, i / steps);
    // Off-path joining keeps clear of the shell and the water. The entrance
    // ramp and pier links themselves are authored and do not need this check.
    if (!isSiteLand(x, z) && !(Math.abs(x) <= 2.5 && z >= 157 && z <= 218)) return false;
    if (Math.abs(x) < PLAZA_HALF_WIDTH + 6 && z > -106 && z < ENTRANCE_DOOR[2] + 1 && !(Math.abs(x) < 2.5 && z >= ENTRANCE_DOOR[2])) return false;
  }
  return true;
}

const inside = new FootpathNetwork();
// The same face centres used by canonicalRoute keep the upper circuit away
// from the atrium drop and the lower circuit away from the flight plinth.
const groundRing = OCTAGON_FACES.map((face) => place(faceDirection(face), ROTUNDA_ROUTE_RADIUS, 0, GROUND_Y));
const upperRing = OCTAGON_FACES.map((face) => place(faceDirection(face), BALCONY_ROUTE_RADIUS, 0, LEVEL_1_Y));
inside.connect([...groundRing, groundRing[0]]);
// Each grand stair rises through the balcony ring into an open, railed well,
// so the walkable balcony is the north arc between the two stair heads.
inside.connect(BALCONY_WALK_FACES.map((face) => upperRing[OCTAGON_FACES.indexOf(face)]));
for (const stair of STAIRS) {
  const arc = Array.from({ length: stair.collisionSegments + 1 }, (_, i) =>
    stairArcPoint(stair, i / stair.collisionSegments));
  const index = OCTAGON_FACES.indexOf(stair.face);
  const arrival = OCTAGON_FACES.indexOf(stairArrivalFace(stair));
  inside.connect([groundRing[index], ...arc, stairLanding(stair), upperRing[arrival]]);
}
for (const wing of WINGS) {
  const ring = wing.level === 0 ? groundRing : upperRing;
  const dir = faceDirection(wing.face);
  const hall = [ring[OCTAGON_FACES.indexOf(wing.face)], place(dir, wing.hallFrom, 0, wing.floorY)];
  for (let index = 0; index < wing.exhibits.length; index += 2) {
    const slot = index / 2;
    const cross = place(dir, wing.hallFrom + wing.bayLead + slot * wing.bayPitch, 0, wing.floorY);
    hall.push(cross);
    for (const exhibitId of wing.exhibits.slice(index, index + 2)) {
      const placement = PLACEMENT_BY_EXHIBIT.get(exhibitId)!;
      inside.connect([cross, placement.doorway, placement.visitorSpot]);
    }
  }
  hall.push(place(dir, wing.hallTo, 0, wing.floorY));
  // The south hall runs on through the vestibule and the entrance atrium to
  // the atrium's front door, the interior side of the exterior doors.
  if (wing.id === 'south') hall.push(ENTRANCE_DOOR, ATRIUM_DOOR);
  inside.connect(hall);
}
inside.connect([
  groundRing[OCTAGON_FACES.indexOf('nw')],
  place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM, 0, GROUND_Y),
  place(SANCTUARY_DIR, SANCTUARY_RAMP_TO, 0, SANCTUARY_FLOOR_Y),
  SANCTUARY_CENTER,
]);

// A bay is oriented along its wing, so a world-space bounding box can
// overlap another bay or a hall. Match the actual bay rectangle on its
// floor before choosing any graph edge. Return through the room's own
// approach point instead of snapping to a nearer path behind a wall.
const bayApproaches = WINGS.flatMap((wing) => {
  const direction = faceDirection(wing.face);
  const lateral = rightOf(direction);
  return wing.exhibits.map((id) => {
    const placement = PLACEMENT_BY_EXHIBIT.get(id)!;
    return { wing, direction, lateral, placement, sign: placement.side === 'right' ? 1 : -1 };
  });
});

/** Check an off-path join against the same floor and capsule as its visitor. */
function shortcutIsClear(collision: CollisionWorld, from: Vec3, to: Vec3, floorTolerance: number): boolean {
  const steps = Math.max(1, Math.ceil(distance(from, to) / 0.26));
  const sample = { x: 0, y: 0, z: 0 };
  for (let i = 1; i <= steps; i++) {
    const [x, y, z] = interpolate(from, to, i / steps);
    const support = collision.supportHeight(x, z, y);
    if (support === null || Math.abs(y - support) > floorTolerance) return false;
    sample.x = x;
    sample.y = support;
    sample.z = z;
    if (collision.resolveHorizontal(sample, PLAYER_RADIUS, PLAYER_HEIGHT)
      && Math.hypot(sample.x - x, sample.z - z) > 0.16) return false;
  }
  return true;
}

/** Let the capsule slide past a corner while keeping both feet on this floor. */
function canWalkToBayApproach(collision: CollisionWorld, from: Vec3, to: Vec3): boolean {
  const stride = 0.28;
  const initial = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const probe = { x: from[0], y: from[1], z: from[2] };
  if (initial <= stride) return true;
  const xStep = (to[0] - from[0]) / initial * stride;
  const zStep = (to[2] - from[2]) / initial * stride;
  let remaining = initial;
  for (let step = 0; step < Math.ceil(initial / stride); step++) {
    const x = probe.x;
    const z = probe.z;
    let advanced = false;
    for (const sidestep of [0, 0.5, -0.5, 1, -1]) {
      probe.x = x + xStep - zStep / stride * sidestep;
      probe.z = z + zStep + xStep / stride * sidestep;
      collision.resolveHorizontal(probe, PLAYER_RADIUS, PLAYER_HEIGHT);
      const support = collision.supportHeight(probe.x, probe.z, probe.y);
      const next = Math.hypot(to[0] - probe.x, to[2] - probe.z);
      if (support === null || Math.abs(support - to[1]) > 0.25 || next >= remaining - 0.001) continue;
      if (next <= stride) return true;
      remaining = next;
      advanced = true;
      break;
    }
    if (!advanced) return false;
  }
  return false;
}

function bayExit(from: Vec3, collision?: CollisionWorld): Vec3[] {
  for (const { wing, direction, lateral, placement, sign } of bayApproaches) {
    if (Math.abs(from[1] - wing.floorY) > 1.25) continue;
    const along = (from[0] - placement.visitorSpot[0]) * direction[0]
      + (from[2] - placement.visitorSpot[2]) * direction[2];
    const depth = sign * (from[0] * lateral[0] + from[2] * lateral[2]) - wing.hallHalfWidth;
    if (Math.abs(along) > wing.bayHalfAlong || depth < 0 || depth > wing.bayDepth) continue;
    if (distance(from, placement.visitorSpot) < 0.015) return [placement.visitorSpot];

    const canWalk = (a: Vec3, b: Vec3) => !collision || shortcutIsClear(collision, a, b, 0.25);
    if (collision && canWalkToBayApproach(collision, from, placement.visitorSpot)) return [from, placement.visitorSpot];
    if (!collision && depth <= wing.bayDepth / 2 - 2.3) return [from, placement.visitorSpot];

    // The plinth occupies the middle of every bay. Try the nearer side first.
    const centre = wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch;
    const at = (offset: number, inward: number) => place(direction, centre + offset, sign * (wing.hallHalfWidth + inward), wing.floorY);
    const side = along < 0 ? -1 : 1;
    for (const lane of [side * 3, -side * 3]) {
      const turn = at(lane, depth);
      const approach = at(lane, 3.2);
      if (canWalk(from, turn) && canWalk(turn, approach) && canWalk(approach, placement.visitorSpot)) {
        return [from, turn, approach, placement.visitorSpot].filter((point, index, route) =>
          index === 0 || distance(point, route[index - 1]) > 0.01);
      }
    }
    if (!collision) return [from, placement.visitorSpot];

    // Some corners meet another wing or the Sanctuary's ramp. Search only
    // this bay and only if the ordinary approach lanes are blocked.
    const local = new FootpathNetwork();
    const depthCount = Math.ceil(wing.bayDepth / 1.25);
    const alongCount = Math.ceil(wing.bayHalfAlong / 1.25);
    const grid = Array.from({ length: depthCount }, (_, row) => Array.from({ length: alongCount * 2 + 1 }, (_, column) =>
      at((column - alongCount) * (wing.bayHalfAlong - 0.85) / alongCount, 0.85 + row * (wing.bayDepth - 1.7) / (depthCount - 1))));
    for (const row of grid) {
      for (const point of row) {
        if (distance(point, placement.visitorSpot) < 2.3 && canWalk(point, placement.visitorSpot)) {
          local.connect([point, placement.visitorSpot]);
        }
      }
    }
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid[row].length; column++) {
        const point = grid[row][column];
        for (const [r, c] of [[row + 1, column], [row, column + 1]]) {
          const adjacent = grid[r]?.[c];
          if (adjacent && canWalk(point, adjacent)) local.connect([point, adjacent]);
        }
      }
    }
    return local.route(from, placement.visitorSpot, canWalk);
  }
  return [from];
}

export function isGuideTarget(id: string): boolean {
  return id === MUSEUM_ENTRANCE_TARGET || PLACEMENT_BY_EXHIBIT.has(id);
}

export function guideDestination(world: GuideWorld, id: string): Vec3 | undefined {
  if (!isGuideTarget(id)) return undefined;
  if (world === 'exterior') return ENTRANCE_DOOR;
  if (id === MUSEUM_ENTRANCE_TARGET) return ATRIUM_DOOR;
  return PLACEMENT_BY_EXHIBIT.get(id)?.doorway;
}

export function planVisitorRoute(world: GuideWorld, from: Vec3, id: string, collision?: CollisionWorld): Vec3[] {
  const goal = guideDestination(world, id);
  if (!goal) return [];
  if (world === 'exterior') return outside.route(from, goal, (a, b) =>
    canJoinExterior(a, b) && (!collision || shortcutIsClear(collision, a, b, 0.55)));
  const exit = bayExit(from, collision);
  if (!exit.length) return [];
  const route = inside.route(exit[exit.length - 1], goal);
  return route.length ? [...exit.slice(0, -1), ...route] : route;
}

export function visitorRouteDistance(points: readonly Vec3[]): number {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

export function exhibitWalkDistance(from: Vec3, id: string): number {
  return visitorRouteDistance(planVisitorRoute('interior', from, id));
}

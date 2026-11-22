import { CollisionWorld } from '../CollisionWorld';
import type { Vec3 } from '../layout';

/** Authored site coordinates (X,Z), clockwise in the top-down Y-up view. */
export const ISLAND_OUTLINE: readonly (readonly [number, number])[] = [
  [-48, -174], [0, -182], [52, -171], [112, -151], [161, -112], [181, -58],
  [188, 0], [178, 58], [158, 111],
  // ISLAND-02A: sculpted southeast coastal peninsula supporting the climbable lighthouse headland.
  [190, 124], [210, 148], [198, 176], [166, 180], [140, 156],
  [112, 151], [58, 174], [20, 180],
  [0, 216], [-20, 180], [-61, 169], [-114, 147], [-158, 108], [-179, 56],
  [-187, 0], [-176, -62], [-157, -115], [-108, -153],
];

/**
 * Fixed origin/bounds for the deterministic forest-belt grid so coastal additions
 * like the southeast lighthouse peninsula do not shift existing tree seeds.
 */
export const FOREST_BELT_BOUNDS = {
  minX: -187,
  maxX: 188,
  minZ: -182,
  maxZ: 216,
} as const;

/** Southeast lighthouse tower centre at terrace elevation (Y = 1.5 m). */
export const LIGHTHOUSE_PENINSULA_CENTER: Vec3 = [176, 1.5, 152];

/** Connected coastal approach trail branching east from Path 1 onto the headland ramp. */
export const LIGHTHOUSE_APPROACH_PATH: readonly (readonly [number, number])[] = [
  [44, 142], [70, 144], [100, 139], [128, 141], [148, 152],
];

export function isLighthousePeninsula(x: number, z: number): boolean {
  return x > 144 && z > 118;
}

export function distanceToLighthousePath(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < LIGHTHOUSE_APPROACH_PATH.length - 1; i++) {
    const [ax, az] = LIGHTHOUSE_APPROACH_PATH[i];
    const [bx, bz] = LIGHTHOUSE_APPROACH_PATH[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/** East-side sheltered water, entirely enclosed by the land boundary. */
export const LAGOON_OUTLINE: readonly (readonly [number, number])[] = [
  [57, -30], [72, -46], [98, -48], [119, -34], [128, -13], [119, 4],
  [124, 22], [111, 43], [89, 49], [67, 36], [58, 17], [64, 2],
];

/** The actual filled waterline, inset from the basin rim; keep all uses identical. */
export const LAGOON_WATERLINE_INSET = 0.034;
const lagoonCenterX = LAGOON_OUTLINE.reduce((sum, [x]) => sum + x, 0) / LAGOON_OUTLINE.length;
const lagoonCenterZ = LAGOON_OUTLINE.reduce((sum, [, z]) => sum + z, 0) / LAGOON_OUTLINE.length;
export const LAGOON_SURFACE_OUTLINE: readonly (readonly [number, number])[] = LAGOON_OUTLINE.map(([x, z]) =>
  [x + (lagoonCenterX - x) * LAGOON_WATERLINE_INSET,
    z + (lagoonCenterZ - z) * LAGOON_WATERLINE_INSET] as const);

/** Minimum distance to the filled waterline; zero outside it. */
export function lagoonWaterClearance(x: number, z: number): number {
  if (!insidePolygon(x, z, LAGOON_SURFACE_OUTLINE)) return 0;
  let clearance = Infinity;
  for (let i = 0; i < LAGOON_SURFACE_OUTLINE.length; i++) {
    const [ax, az] = LAGOON_SURFACE_OUTLINE[i];
    const [bx, bz] = LAGOON_SURFACE_OUTLINE[(i + 1) % LAGOON_SURFACE_OUTLINE.length];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    clearance = Math.min(clearance, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return clearance;
}

export const SPIRE_GARDEN_CENTER: Vec3 = [-104, -0.5, -82];
export const SPIRE_GARDEN_RADIUS = 23;
export const PIER_CENTERLINE: readonly (readonly [number, number])[] = [[0, 157], [0, 176], [0, 196], [0, 218]];
export const PATH_CENTERLINES: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 184], [10, 183], [24, 170], [44, 150], [44, 128], [42, 108], [46, 86], [46, 54]],
  [[46, 54], [47, 30], [47, 4], [46, -16], [46, -40], [45, -64], [45, -88], [44.5, -100], [41, -108], [32, -110], [16, -109.5]],
  [[16, -109.5], [0, -109.5], [-16, -109.5], [-32, -110], [-41, -108], [-44.5, -100], [-59, -83], [-84, -68], [-104, -48]],
  [[-104, -60], [-133, -25], [-145, 8], [-133, 43], [-100, 70], [-62, 82]],
  [[-62, 82], [-53, 88], [-48, 100], [-44, 118], [-44, 150], [-24, 170], [-10, 183], [0, 184]],
];

/** Fixed scenic grove coordinates shared by rendering and regression tests. */
export const SCENIC_GROVE_POINTS: readonly (readonly [number, number])[] = [
  [-128, -108], [-143, -79], [-151, -43], [-155, 10],
  [-138, 65], [-112, 105], [-75, 125], [-38, 142],
  [24, 147], [65, 130], [105, 110], [141, 69],
  [152, 35], [151, -75], [129, -107], [96, -126],
  [49, -141], [-8, -151], [-65, -137], [-102, -124],
];

/**
 * The ancient-tree landmark stands on the outer (east) side of the lagoon
 * walk, opposite the museum's east elevation. It used to be centred on the
 * east facade wall itself (x = 38), half buried in the building.
 */
export const ANCIENT_TREE_CENTER: Vec3 = [57, -0.48, -84];
/** Woodland, flowers and butterflies leave this clearing to the landmark. */
export const ANCIENT_TREE_CLEARING_RADIUS = 11;
export function inAncientTreeClearing(x: number, z: number): boolean {
  return Math.hypot(x - ANCIENT_TREE_CENTER[0], z - ANCIENT_TREE_CENTER[2]) < ANCIENT_TREE_CLEARING_RADIUS;
}

/**
 * Lantern stations (z) on the lagoon walk, path 2, between the hide and the
 * ancient tree. The lantern walk used to stand at x = 16–38, inside the
 * museum's own east wing where no visitor could ever see it.
 */
export const LANTERN_WALK_Z: readonly number[] = [-26, -35, -44, -53, -62, -71];

/** Where the island loop crosses the pier: the only fork on the visitor's way in. */
export const PIER_JUNCTION: readonly [number, number] = [0, 184];
/** Walking distance from the pier junction to the museum doors (z = 128). */
export const PIER_JUNCTION_TO_DOORS = 56;

/**
 * The island walking loop as one polyline, starting at the pier junction and
 * running east (path 1 order). Path 3 meets path 4 across the spire-garden rim.
 */
export const PATH_LOOP: readonly (readonly [number, number])[] = PATH_CENTERLINES.flatMap((line, k) =>
  (k === 0 ? line : line.slice(line[0][0] === PATH_CENTERLINES[k - 1].at(-1)![0]
    && line[0][1] === PATH_CENTERLINES[k - 1].at(-1)![1] ? 1 : 0)));
const LOOP_CUMULATIVE: readonly number[] = PATH_LOOP.reduce<number[]>((acc, point, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(point[0] - PATH_LOOP[i - 1][0], point[1] - PATH_LOOP[i - 1][1]));
  return acc;
}, []);
export const PATH_LOOP_LENGTH = LOOP_CUMULATIVE[LOOP_CUMULATIVE.length - 1];

/** Nearest point on the loop: arc position from the pier junction (east-first) and lateral distance. */
export function projectOntoLoop(x: number, z: number): { s: number; distance: number; x: number; z: number } {
  let best = { s: 0, distance: Infinity, x: PATH_LOOP[0][0], z: PATH_LOOP[0][1] };
  for (let i = 0; i < PATH_LOOP.length - 1; i++) {
    const [ax, az] = PATH_LOOP[i];
    const [bx, bz] = PATH_LOOP[i + 1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.distance) best = { s: LOOP_CUMULATIVE[i] + Math.sqrt(len2) * t, distance: d, x: px, z: pz };
  }
  return best;
}

/**
 * Walking distances back to the museum doors from a point beside the loop:
 * returning the way path 1 came (east side) or carrying on round (west side).
 */
export function walkingDistancesToDoors(x: number, z: number): { east: number; west: number } {
  const { s, distance } = projectOntoLoop(x, z);
  return {
    east: distance + s + PIER_JUNCTION_TO_DOORS,
    west: distance + (PATH_LOOP_LENGTH - s) + PIER_JUNCTION_TO_DOORS,
  };
}

/** Distance from (x, z) to the nearest island path centreline. */
export function distanceToPaths(x: number, z: number): number {
  let best = Infinity;
  for (const line of PATH_CENTERLINES) {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
  }
  return best;
}

export const LAND_SUPPORT_Y = -0.5;
export const LAND_GRID_SIZE = 12;

function insidePolygon(x: number, z: number, polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function isSiteLand(x: number, z: number): boolean {
  return insidePolygon(x, z, ISLAND_OUTLINE) && !insidePolygon(x, z, LAGOON_OUTLINE);
}

export function isLagoon(x: number, z: number): boolean {
  return insidePolygon(x, z, LAGOON_OUTLINE);
}

export function sitePolygonsAreValid(): boolean {
  const polygons = [ISLAND_OUTLINE, LAGOON_OUTLINE];
  for (const polygon of polygons) {
    if (polygon.length < 3 || new Set(polygon.map((p) => `${p[0]},${p[1]}`)).size !== polygon.length) return false;
    if (polygon.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) return false;
  }
  if (LAGOON_OUTLINE.some(([x, z]) => !insidePolygon(x, z, ISLAND_OUTLINE))) return false;
  return !hasSelfIntersection(ISLAND_OUTLINE) && !hasSelfIntersection(LAGOON_OUTLINE);
}

function hasSelfIntersection(polygon: readonly (readonly [number, number])[]): boolean {
  const orient = (a: readonly [number, number], b: readonly [number, number], c: readonly [number, number]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    for (let j = i + 1; j < polygon.length; j++) {
      if (j === i || j === (i + 1) % polygon.length || (j + 1) % polygon.length === i) continue;
      const c = polygon[j];
      const d = polygon[(j + 1) % polygon.length];
      if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return true;
    }
  }
  return false;
}

/** Conservative six-metre support tiles: every corner must be land and clear of the lagoon. */
export function addIslandSupport(collision: CollisionWorld): number {
  const xs = ISLAND_OUTLINE.map((p) => p[0]);
  const zs = ISLAND_OUTLINE.map((p) => p[1]);
  let count = 0;
  for (let x = Math.floor(Math.min(...xs) / LAND_GRID_SIZE) * LAND_GRID_SIZE;
    x < Math.max(...xs); x += LAND_GRID_SIZE) {
    for (let z = Math.floor(Math.min(...zs) / LAND_GRID_SIZE) * LAND_GRID_SIZE;
      z < Math.max(...zs); z += LAND_GRID_SIZE) {
      const corners = [[x, z], [x + LAND_GRID_SIZE, z], [x, z + LAND_GRID_SIZE], [x + LAND_GRID_SIZE, z + LAND_GRID_SIZE]] as const;
      if (!corners.every(([cx, cz]) => isSiteLand(cx, cz))) continue;
      collision.addFloor(x, x + LAND_GRID_SIZE, z, z + LAND_GRID_SIZE, LAND_SUPPORT_Y);
      count++;
    }
  }
  // Full-corner tiles deliberately leave a thin unsupported strip inside the
  // polygonal coast and around lagoon edges. The visible island still extends
  // to those points: supplement with ONE exactly masked floor so walkers can
  // reach real land edges without falling through, but never stand on water.
  // This is a broad-phase AABB with a precise isSiteLand narrow-phase filter.
  collision.addMaskedFloor(
    Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs),
    LAND_SUPPORT_Y, isSiteLand,
  );
  return count;
}

/**
 * Island safety: the lagoon is open water with no floor. Its shoreline gets a
 * solid bank edge (oriented wall colliders along LAGOON_OUTLINE, waist high),
 * so a visitor walking or running at the water stops on the bank instead of
 * falling through the basin. Pocket-world entry (W01) will add a deliberate
 * dive interaction; nothing here strands or traps a visitor.
 */
export const LAGOON_EDGE_HEIGHT = 1.4; // above the 1.18 m jump apex
export const LAGOON_EDGE_THICKNESS = 0.3;
export function addLagoonEdge(collision: CollisionWorld): number {
  for (let i = 0; i < LAGOON_OUTLINE.length; i++) {
    const [ax, az] = LAGOON_OUTLINE[i];
    const [bx, bz] = LAGOON_OUTLINE[(i + 1) % LAGOON_OUTLINE.length];
    const dx = bx - ax, dz = bz - az;
    const length = Math.hypot(dx, dz);
    const ux = dx / length, uz = dz / length;
    // Overlap neighbouring segments slightly so corners have no gap.
    const halfX = length / 2 + LAGOON_EDGE_THICKNESS / 2;
    const halfT = LAGOON_EDGE_THICKNESS / 2;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const broadX = Math.abs(ux) * halfX + Math.abs(uz) * halfT;
    const broadZ = Math.abs(uz) * halfX + Math.abs(ux) * halfT;
    collision.add({
      kind: 'wall',
      minX: cx - broadX, maxX: cx + broadX,
      minY: LAND_SUPPORT_Y, maxY: LAND_SUPPORT_Y + LAGOON_EDGE_HEIGHT,
      minZ: cz - broadZ, maxZ: cz + broadZ,
      oriented: { centerX: cx, centerZ: cz, halfX, halfZ: halfT, yaw: Math.atan2(-uz, ux) },
    });
  }
  return LAGOON_OUTLINE.length;
}

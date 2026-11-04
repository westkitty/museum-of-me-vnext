import { CollisionWorld } from '../CollisionWorld';
import type { Vec3 } from '../layout';

/** Authored site coordinates (X,Z), clockwise in the top-down Y-up view. */
export const ISLAND_OUTLINE: readonly (readonly [number, number])[] = [
  [-48, -174], [0, -182], [52, -171], [112, -151], [161, -112], [181, -58],
  [188, 0], [178, 58], [158, 111], [112, 151], [58, 174], [20, 180],
  [0, 216], [-20, 180], [-61, 169], [-114, 147], [-158, 108], [-179, 56],
  [-187, 0], [-176, -62], [-157, -115], [-108, -153],
];

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
  [[0, 184], [18, 165], [42, 146], [50, 118], [44, 86], [36, 54]],
  [[36, 54], [46, 38], [47, 22], [46, 4], [43, -16], [36, -38], [10, -70]],
  [[10, -70], [-23, -85], [-59, -83], [-84, -68], [-104, -48]],
  [[-104, -60], [-133, -25], [-145, 8], [-133, 43], [-100, 70], [-62, 82]],
  [[-62, 82], [-22, 92], [20, 83], [48, 59], [36, 54]],
];

/** Fixed scenic grove coordinates shared by rendering and regression tests. */
export const SCENIC_GROVE_POINTS: readonly (readonly [number, number])[] = [
  [-128, -108], [-143, -79], [-151, -43], [-155, 10],
  [-138, 65], [-112, 105], [-75, 125], [-38, 142],
  [24, 147], [65, 130], [105, 110], [141, 69],
  [152, 35], [151, -75], [129, -107], [96, -126],
  [49, -141], [-8, -151], [-65, -137], [-102, -124],
];

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

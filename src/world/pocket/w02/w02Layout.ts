import { ISLAND_OUTLINE } from '../../exterior/IslandSiteLayout';
import type { Rect } from '../kit/worldKit';

/**
 * W02 Prehistoric Fern Island — authored route topology.
 *
 * The ancient island is the museum island's own coastline (ISLAND_OUTLINE)
 * scaled to a short walk, with no museum on it. A Veiled Gorge cuts it
 * north–south. -Z is north. Every walkable surface below is listed here once
 * and consumed by both the visible geometry and the collider builder.
 */

export const COAST_SCALE = 0.27;
export const GORGE_WEST = -4;
export const GORGE_EAST = 8;
export const BRIDGE_Z_MIN = 2;
export const BRIDGE_Z_MAX = 10;
export const BRIDGE_Y = 2;
export const SPAWN: readonly [number, number, number] = [-42, 0, 8];
export const ISLAND_DEPTH = 12.5;
export const SEA_Y = -12;
/** Anything below this is a fall into the gorge or off the cliffs. */
export const FALL_RESET_Y = -5;

export type Point = readonly [number, number];
export const coast: readonly Point[] = ISLAND_OUTLINE.map(([x, z]) => [x * COAST_SCALE, z * COAST_SCALE] as const);

export function insidePolygon(points: readonly Point[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function insideCoast(x: number, z: number): boolean {
  return insidePolygon(coast, x, z);
}

/** Supported ancient-island ground: inside the coastline and outside the gorge. */
export function isIslandGround(x: number, z: number): boolean {
  return (x <= GORGE_WEST || x >= GORGE_EAST) && insideCoast(x, z);
}

export function clipCoast(boundary: number, keepLeft: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < coast.length; i++) {
    const a = coast[i];
    const b = coast[(i + 1) % coast.length];
    const aInside = keepLeft ? a[0] <= boundary : a[0] >= boundary;
    const bInside = keepLeft ? b[0] <= boundary : b[0] >= boundary;
    if (aInside) result.push(a);
    if (aInside !== bInside) {
      const t = (boundary - a[0]) / (b[0] - a[0]);
      result.push([boundary, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

/** Coast pushed outward from its centroid, for beach and shallows rings. */
export function expandedCoast(factor: number): Point[] {
  let cx = 0, cz = 0;
  for (const [x, z] of coast) { cx += x; cz += z; }
  cx /= coast.length; cz /= coast.length;
  return coast.map(([x, z]) => [cx + (x - cx) * factor, cz + (z - cz) * factor] as const);
}

export interface W02RampDef extends Rect { readonly axis: 'x' | 'z'; readonly yAtMin: number; readonly yAtMax: number }
export interface W02ShelfDef extends Rect { readonly id: string; readonly y: number }

// ACT I — arrival and the broad root climb.
export const CLIMB: W02RampDef = { minX: -32, maxX: -17, minZ: 0, maxZ: 12, axis: 'x', yAtMin: 0, yAtMax: 2 };
export const WEST_SHELF: W02ShelfDef = { id: 'west-shelf', minX: -17, maxX: GORGE_WEST, minZ: 0, maxZ: 12, y: 2 };
/** Optional fossil loop reconnects to the rest shelf from the north. */
export const FOSSIL_RAMP: W02RampDef = { minX: -14, maxX: -10, minZ: -10, maxZ: 0, axis: 'z', yAtMin: 0, yAtMax: 2 };
export const FOSSIL_POS: readonly [number, number, number] = [-28, 0, -16];
export const SEED_POS: readonly [number, number, number] = [-10, 3, 6];

// ACT II — the Veiled Gorge crossing.
export const BRIDGE: Rect = { minX: GORGE_WEST, maxX: GORGE_EAST, minZ: BRIDGE_Z_MIN, maxZ: BRIDGE_Z_MAX };
export const BRIDGE_PLANKS = 8;
export const BRIDGE_GROW_SECONDS = 4.2;

// ACT III — the eastern ascent to the Elder Fern summit.
export const EAST_SHELF: W02ShelfDef = { id: 'east-shelf', minX: GORGE_EAST, maxX: 18, minZ: 0, maxZ: 12, y: 2 };
/** Recovery ramp from the eastern ground back up to the east shelf. */
export const EAST_GROUND_RAMP: W02RampDef = { minX: 18, maxX: 26, minZ: 4, maxZ: 10, axis: 'x', yAtMin: 2, yAtMax: 0 };
export const RAMP_A: W02RampDef = { minX: 12, maxX: 18, minZ: -14, maxZ: 0, axis: 'z', yAtMin: 6, yAtMax: 2 };
export const BALCONY: W02ShelfDef = { id: 'fern-balcony', minX: 8, maxX: 22, minZ: -24, maxZ: -14, y: 6 };
export const RAMP_C: W02RampDef = { minX: 22, maxX: 36, minZ: -23, maxZ: -17, axis: 'x', yAtMin: 6, yAtMax: 10 };
export const SADDLE: W02ShelfDef = { id: 'root-saddle', minX: 36, maxX: 44, minZ: -26, maxZ: -12, y: 10 };
export const RAMP_E: W02RampDef = { minX: 37, maxX: 43, minZ: -12, maxZ: 2, axis: 'z', yAtMin: 10, yAtMax: 14 };
export const SUMMIT: W02ShelfDef = { id: 'elder-summit', minX: 32, maxX: 46, minZ: 2, maxZ: 16, y: 14 };

export const ELDER_FERN_POS: readonly [number, number, number] = [42.5, 14, 12.5];
export const HEART_POS: readonly [number, number, number] = [41, 15.1, 10.4];
export const RETURN_GATE_POS: readonly [number, number, number] = [35.5, 14, 13.6];

/** Ordered checkpoint shelves after the crossing; each saves once when reached. */
export const ROUTE_CHECKPOINTS: readonly W02ShelfDef[] = [EAST_SHELF, BALCONY, SADDLE, SUMMIT];

export const ALL_RAMPS: readonly W02RampDef[] = [CLIMB, FOSSIL_RAMP, EAST_GROUND_RAMP, RAMP_A, RAMP_C, RAMP_E];
export const ALL_SHELVES: readonly W02ShelfDef[] = [WEST_SHELF, EAST_SHELF, BALCONY, SADDLE, SUMMIT];

export function rampHeightAt(r: W02RampDef, x: number, z: number): number {
  const t = r.axis === 'x' ? (x - r.minX) / (r.maxX - r.minX) : (z - r.minZ) / (r.maxZ - r.minZ);
  return r.yAtMin + (r.yAtMax - r.yAtMin) * t;
}

/**
 * The main visitor route as walkable waypoints (feet height included) used by
 * route guidance lanterns and by the input-driven browser journey.
 */
export const MAIN_ROUTE: readonly (readonly [number, number])[] = [
  [-42, 8], [-30, 6], [-18, 6], [-11, 6],
  // bridge crossing
  [-2, 6], [6, 6], [11, 6], [15, 2], [15, -12], [15, -19], [24, -20], [34, -20], [40, -19], [40, -10], [40, 1], [40, 8.3],
];
export const FOSSIL_LOOP: readonly (readonly [number, number])[] = [
  [-42, 8], [-38, -6], [-30, -13], [-20, -12], [-12, -11], [-12, -4], [-12, 1], [-11, 4],
];

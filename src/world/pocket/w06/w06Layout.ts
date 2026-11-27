/**
 * W06 Skyborne Gardens — topology and the wind.
 *
 * Floating garden islands over a sea of cloud. Wind is the tool: a seed
 * parasol turns any fall into a slow, steerable glide, and updraft columns lift
 * the visitor gently between islands. There is no jumping anywhere; every glide
 * lands on a wide island, and a miss returns the visitor softly to the last
 * island they stood on. -Z is north. Bearings: a point on an island rim at
 * bearing a is (cx + r cos a, cz + r sin a), so south (+z) is +pi/2.
 */

export interface Island {
  readonly id: string;
  readonly cx: number;
  readonly cz: number;
  readonly r: number;
  readonly y: number;
  /** Rim arcs left without a railing: [bearing, half-angle]. */
  readonly open: readonly (readonly [number, number])[];
}

export interface Updraft {
  readonly id: string;
  readonly cx: number;
  readonly cz: number;
  readonly r: number;
  /** Lift begins half a metre below the base. */
  readonly base: number;
  /** The visitor hovers just above the top (level with the upper island). */
  readonly top: number;
}

const S = Math.PI / 2;
const N = -Math.PI / 2;

export const SPAWN: readonly [number, number, number] = [0, 0, 24];
export const FALL_RESET_Y = -14;
export const CLOUD_SEA_Y = -16;

/** Gliding: the steepest descent and the fastest horizontal drift while airborne. */
export const GLIDE_SINK = 2.2;
export const AIR_SPEED = 5;
/** Updraft lift speed (m/s) and hover height above the column top. */
export const LIFT_SPEED = 4.5;
export const HOVER = 0.3;

// ACT I — the Seed Meadow and the first glide.
export const MEADOW: Island = { id: 'seed-meadow', cx: 0, cz: 20, r: 9, y: 0, open: [[N, 0.3]] };
export const PARASOL_POS: readonly [number, number, number] = [-4.2, 0, 14];
/** The launch lip is gated until the visitor holds a seed parasol. */
export const MEADOW_LIP_GATE = { minX: -3.8, maxX: 3.8, minZ: 10.7, maxZ: 11.7 } as const;
export const ORCHARD: Island = { id: 'cloud-orchard', cx: 0, cz: -4, r: 9, y: -6, open: [[S, 1.0], [N, 0.32]] };

// ACT II — updrafts up through the Terrace (and the optional Lookout Spire).
export const UPDRAFT_A: Updraft = { id: 'orchard-updraft', cx: 0, cz: -11.5, r: 2.2, base: -6, top: 4 };
export const TERRACE: Island = { id: 'wind-terrace', cx: 0, cz: -20, r: 7, y: 4, open: [[S, 0.45], [N, 0.45], [Math.PI, 0.4]] };
export const UPDRAFT_SPIRE: Updraft = { id: 'spire-updraft', cx: -7.5, cz: -20, r: 1.8, base: 4, top: 9 };
export const SPIRE: Island = { id: 'lookout-spire', cx: -10.8, cz: -20, r: 2.8, y: 9, open: [[0, 0.75]] };
export const LANTERN_POS: readonly [number, number, number] = [-12.2, 9, -20];
export const UPDRAFT_B: Updraft = { id: 'terrace-updraft', cx: 0, cz: -28.5, r: 2.2, base: 4, top: 14 };
export const PAVILION: Island = { id: 'sky-pavilion', cx: 0, cz: -38, r: 8, y: 14, open: [[S, 0.4], [N, 0.3]] };

// ACT III — the Great Thermal and the Summit Garden.
export const GREAT_THERMAL: Updraft = { id: 'great-thermal', cx: 0, cz: -56, r: 4, base: FALL_RESET_Y + 1, top: 26 };
export const SUMMIT: Island = { id: 'summit-garden', cx: 0, cz: -68, r: 9, y: 26, open: [[S, 0.5]] };
export const CAIRN_POS: readonly [number, number, number] = [0, 26, -71.2];
export const GATE_POS: readonly [number, number, number] = [6, 26, -66];
export const GATE_APPROACH: readonly [number, number] = [3.6, -65.6];

export const ISLANDS: readonly Island[] = [MEADOW, ORCHARD, TERRACE, SPIRE, PAVILION, SUMMIT];
export const UPDRAFTS: readonly Updraft[] = [UPDRAFT_A, UPDRAFT_SPIRE, UPDRAFT_B, GREAT_THERMAL];
export const ROUTE_CHECKPOINTS: readonly Island[] = [ORCHARD, TERRACE, PAVILION, SUMMIT];

export function onIsland(i: Island, x: number, z: number): boolean {
  return Math.hypot(x - i.cx, z - i.cz) <= i.r;
}

export function inUpdraft(u: Updraft, x: number, z: number, y: number): boolean {
  return Math.hypot(x - u.cx, z - u.cz) <= u.r && y >= u.base - 0.5 && y <= u.top + 1.2;
}

export const ROUTE = {
  toParasol: [[0, 24], [-2.2, 15.6]] as const,
  toLip: [[0, 13]] as const,
  glideToOrchard: [[0, -2]] as const,
  intoUpdraftA: [[0, -11.5]] as const,
  ontoTerrace: [[0, -16.2], [0, -20]] as const,
  intoSpireUpdraft: [[-7.4, -20]] as const,
  ontoSpire: [[-10.4, -20]] as const,
  backToTerrace: [[-7.4, -20], [-3, -20]] as const,
  intoUpdraftB: [[0, -28.5]] as const,
  ontoPavilion: [[0, -33.5], [0, -38]] as const,
  toPavilionLip: [[0, -44.5]] as const,
  glideIntoThermal: [[0, -56]] as const,
  ontoSummit: [[0, -62.5], [0, -68.2]] as const,
} as const;

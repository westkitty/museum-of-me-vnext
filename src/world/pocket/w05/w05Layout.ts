import type { Rect } from '../kit/worldKit';

/**
 * W05 Impossible Greenhouse — topology.
 *
 * A glasshouse far larger inside than out. Light and water are the two tools:
 * Act I directs sunlight to grow lily pads across a pond, Act II raises a leaf
 * raft on a flooding cistern, Act III joins both to wake the Impossible Bloom.
 * Nothing depends on timing or hearing. -Z is north.
 */

export interface Landing extends Rect { readonly id: string; readonly y: number }

export const SPAWN: readonly [number, number, number] = [0, 0, 24];
export const FALL_RESET_Y = -4;

// ACT I — the Potting Atrium, the Sun Mirror and the Lily Pond.
export const ATRIUM: Landing = { id: 'potting-atrium', minX: -8, maxX: 8, minZ: 13, maxZ: 28, y: 0 };
export const POND: Rect = { minX: -8, maxX: 8, minZ: 1, maxZ: 13 };
export const POND_WATER_Y = -0.45;
export const LILY_RADIUS = 2.6;
/** Pad centres (x, z), south to north; consecutive pads overlap by a 3 m-wide lens. */
export const LILY_PADS: readonly (readonly [number, number])[] = [[0.6, 11], [-0.6, 7], [0.6, 3]];
export const GROW_SECONDS = 2.2;
export const SUN_MIRROR_POS: readonly [number, number, number] = [-4.5, 0, 15.5];
export const MIRROR_STAND: readonly [number, number] = [-2.4, 17.2];
/** The skylight shaft that falls onto the Sun Mirror. */
export const SKYLIGHT_Y = 34;

export function inLily(i: number, x: number, z: number): boolean {
  const [cx, cz] = LILY_PADS[i];
  return Math.hypot(x - cx, z - cz) <= LILY_RADIUS;
}

// ACT II — the Fern Hall, the Cistern and the leaf raft.
export const DECK: Landing = { id: 'fern-hall', minX: -10, maxX: 10, minZ: -14, maxZ: 1, y: 0 };
export const ORCHID_ALCOVE: Landing = { id: 'orchid-alcove', minX: 10, maxX: 16, minZ: -10, maxZ: -4, y: 0 };
export const ORCHID_POS: readonly [number, number, number] = [14, 0, -7];
export const CISTERN: Rect = { minX: -3, maxX: 3, minZ: -22, maxZ: -14 };
export const RAFT: Rect = { minX: -2.8, maxX: 2.8, minZ: -21.8, maxZ: -14.2 };
export const RAFT_TOP = 6;
export const RAFT_SECONDS = 6;
/** World (x, z) of the valve wheel standing on the raft (it rides up and down with it). */
export const RAFT_VALVE_XZ: readonly [number, number] = [2.0, -15.0];
export const DECK_CALL_POS: readonly [number, number, number] = [5, 0, -12.4];

export const GALLERY: Landing = { id: 'vine-gallery', minX: -10, maxX: 10, minZ: -34, maxZ: -22, y: 6 };

// ACT III — the Leaf Ramp, the Canopy and the Impossible Bloom.
export const LEAF_RAMP = { minX: -2, maxX: 2, minZ: -50, maxZ: -34, axis: 'z' as const, yAtMin: 11, yAtMax: 6 };
export const CANOPY_CENTER: readonly [number, number] = [0, -60];
export const CANOPY_RADIUS = 10;
export const CANOPY_Y = 11;
export const CANOPY: Landing = { id: 'canopy', minX: -10, maxX: 10, minZ: -70, maxZ: -50, y: CANOPY_Y };
export const BLOOM_POS: readonly [number, number, number] = [0, CANOPY_Y, -60];
export const BLOOM_COLLAR = 2.4;
export const CANOPY_MIRROR_POS: readonly [number, number, number] = [-6, CANOPY_Y, -55];
export const DEW_VALVE_POS: readonly [number, number, number] = [6, CANOPY_Y, -65];
export const GATE_POS: readonly [number, number, number] = [8, CANOPY_Y, -58];
export const GATE_APPROACH: readonly [number, number] = [5.6, -57.4];
/** Canopy mirror aim targets, in cycle order. Only the bud wakes the Bloom. */
export const CANOPY_TARGETS = ['ferns', 'glass', 'bud'] as const;
export type CanopyTarget = typeof CANOPY_TARGETS[number];

/** Where the canopy mirror's reflected light lands for each target. */
export const CANOPY_TARGET_POINTS: Record<CanopyTarget, readonly [number, number, number]> = {
  ferns: [-8, CANOPY_Y + 0.8, -63.5],
  glass: [-16, 34, -72],
  bud: [0, CANOPY_Y + 2.4, -60],
};

export function inCanopy(x: number, z: number): boolean {
  return Math.hypot(x - CANOPY_CENTER[0], z - CANOPY_CENTER[1]) <= CANOPY_RADIUS;
}

export const ROUTE_CHECKPOINTS: readonly Landing[] = [DECK, GALLERY, CANOPY];

export const ROUTE = {
  toMirror: [[0, 24], [MIRROR_STAND[0], MIRROR_STAND[1]]] as const,
  toPond: [[0, 14.2]] as const,
  acrossPond: [[0.6, 11], [-0.6, 7], [0.6, 3], [0, -1]] as const,
  toRaft: [[0, -8], [0, -17.6]] as const,
  offRaft: [[0, -21], [0, -26]] as const,
  toCanopy: [[0, -33], [0, -50], [0, -52.5]] as const,
  toCanopyMirror: [[-4, -53.6]] as const,
  toDewValve: [[4.4, -54], [4.4, -63.2]] as const,
  orchid: [[6, -7], [12.4, -7]] as const,
  toDeckCall: [[3, -11]] as const,
} as const;

import type { Rect } from '../kit/worldKit';

export type Vec3 = readonly [number, number, number];

/**
 * W08 World Inside a Raindrop: authored layout (metres, world units).
 *
 * The visitor stands inside a single raindrop hanging over the reflecting
 * rill. The drop's lower meniscus is a wide, safe floor; three terraces of
 * liquid glass climb toward the crown. Each act is a refraction puzzle: a
 * water lens turns sunlight from a pore in the drop's skin onto a glass seed,
 * and the seed sets into a walkway. Everything is reachable without jumping.
 */

/** The drop's centre and inner radius (the visible skin). */
export const DROP_CENTRE: Vec3 = [0, 12, -8];
export const DROP_RADIUS = 36;
/** The meniscus floor: a disc at y 0 around the drop's axis. */
export const MENISCUS_RADIUS = 30;
export const onMeniscus = (x: number, z: number, pad = 0): boolean =>
  Math.hypot(x - DROP_CENTRE[0], z - DROP_CENTRE[2]) <= MENISCUS_RADIUS - pad;

export const SPAWN: Vec3 = [0, 0, 16];

export interface Terrace extends Rect {
  readonly id: 'glass-terrace' | 'drift-terrace' | 'bubble-terrace' | 'crown';
  readonly y: number;
}
export const T1: Terrace = { id: 'glass-terrace', minX: -19, maxX: -10, minZ: -7, maxZ: 3, y: 4 };
export const T2: Terrace = { id: 'drift-terrace', minX: -19, maxX: -10, minZ: -27, maxZ: -17, y: 4 };
export const T3: Terrace = { id: 'bubble-terrace', minX: 2, maxX: 12, minZ: -30, maxZ: -18, y: 10 };
export const CROWN: Terrace = { id: 'crown', minX: 10.5, maxX: 19, minZ: -30, maxZ: -21, y: 24 };
export const TERRACES: readonly Terrace[] = [T1, T2, T3, CROWN];

/** Water columns holding each terrace up (solid). */
export const STEMS: readonly { x: number; z: number; r: number; top: number }[] = [
  { x: -14.5, z: -2, r: 0.9, top: T1.y - 0.6 },
  { x: -14.5, z: -22, r: 0.9, top: T2.y - 0.6 },
  { x: 7, z: -21, r: 1.0, top: T3.y - 0.6 },
  { x: 16, z: -25.5, r: 0.9, top: CROWN.y - 0.6 },
];

/** Glass walkways set by light (ramp colliders added when they set). */
export interface Crystal {
  readonly id: 'stair' | 'span';
  readonly rect: Rect;
  readonly axis: 'x';
  readonly yAtMin: number;
  readonly yAtMax: number;
}
/** Act I: the Glass Stair from the meniscus (x −3, y 0) up to the Glass Terrace (x −10, y 4). */
export const STAIR: Crystal = { id: 'stair', rect: { minX: -10, maxX: -3, minZ: -1.3, maxZ: 1.3 }, axis: 'x', yAtMin: T1.y, yAtMax: 0 };
/** Act II: the Glass Span from the Drift Terrace (x −10, y 4) up to the Bubble Terrace (x 2, y 10). */
export const SPAN: Crystal = { id: 'span', rect: { minX: -10, maxX: 2, minZ: -25.6, maxZ: -23.2 }, axis: 'x', yAtMin: T2.y, yAtMax: T3.y };

/** Water lenses: each cycles through aims; aim index 0 is always a harmless pool of light. */
export interface Lens {
  readonly id: 'lens-1' | 'lens-2' | 'lens-3';
  readonly pos: Vec3; // pedestal base
  /** Direction from the drop centre to the sun pore feeding this lens. */
  readonly poreDir: Vec3;
  readonly aims: readonly { readonly target: Vec3; readonly hits: 'pool' | 'stair' | 'span' | 'prism' | 'bubble' | 'dock'; readonly name: string }[];
}
export const LENS_HEIGHT = 1.45;
export const SEED_1: Vec3 = [-3.2, 0.25, 1.95];
export const SEED_2: Vec3 = [-10.8, T2.y + 0.25, -26.3];
export const PRISM_POS: Vec3 = [13, 0, -8];
export const BUBBLE_CRADLE: Vec3 = [9, T3.y, -26];
export const BUBBLE_RADIUS = 2;
/** Riders stay within this horizontal radius of the bubble's axis. */
export const BUBBLE_RIDE_RADIUS = 1.45;
export const LENSES: readonly Lens[] = [
  {
    id: 'lens-1', pos: [3, 0, 9], poreDir: [0.62, 0.62, 0.48],
    aims: [
      { target: [10, 0.02, 3], hits: 'pool', name: 'the meniscus' },
      { target: SEED_1, hits: 'stair', name: 'the glass seed' },
      { target: [PRISM_POS[0], 0.9, PRISM_POS[2]], hits: 'prism', name: 'the far prism' },
    ],
  },
  {
    id: 'lens-2', pos: [-11.6, T2.y, -20.4], poreDir: [-0.7, 0.6, -0.38],
    aims: [
      { target: [-16, T2.y + 0.02, -25], hits: 'pool', name: 'the terrace' },
      { target: [-14.5, T2.y + 0.02, -17.6], hits: 'dock', name: 'the drift dock' },
      { target: SEED_2, hits: 'span', name: 'the glass seed' },
    ],
  },
  {
    id: 'lens-3', pos: [4.6, T3.y, -20.4], poreDir: [0.5, 0.78, 0.38],
    aims: [
      { target: [5, T3.y + 0.02, -27.5], hits: 'pool', name: 'the terrace' },
      { target: [BUBBLE_CRADLE[0], BUBBLE_CRADLE[1] + 1.2, BUBBLE_CRADLE[2]], hits: 'bubble', name: 'the sleeping bubble' },
    ],
  },
];
/** A seed sets after this long in light. */
export const SET_SECONDS = 1;

/** Act II: the drift pad (a flattened water sphere) between the two west terraces. */
export const PAD_X = -14.5;
export const PAD_HALF_X = 2;
export const PAD_HALF_Z = 2.2;
export const PAD_DOCK_T1 = -9;
export const PAD_DOCK_T2 = -15;
export const PAD_SPEED = 1.2;
/** Superellipse footprint of the pad (matches its visible shape). */
export const onPad = (padZ: number, x: number, z: number, pad = 0): boolean => {
  const u = Math.abs(x - PAD_X) / (PAD_HALF_X - pad);
  const w = Math.abs(z - padZ) / (PAD_HALF_Z - pad);
  return u ** 4 + w ** 4 <= 1;
};

/** Act III: the bubble rises from the Bubble Terrace to the crown. */
export const BUBBLE_TOP_Y = CROWN.y;
export const BUBBLE_SPEED = 1.6;
export const NUCLEUS_POS: Vec3 = [15, CROWN.y, -23];
export const EXIT_POS: Vec3 = [18, CROWN.y, -26.5];

/** A drop onto lower glass from this height lifts the visitor back to the last checkpoint. */
export const SOFT_FALL_HEIGHT = 2.5;

/** Rails (axis-aligned segments) keep the crown and the span's outer edges safe. */
export const RAILS: readonly { x0: number; z0: number; x1: number; z1: number; y: number }[] = [
  { x0: CROWN.minX, z0: CROWN.minZ, x1: CROWN.maxX, z1: CROWN.minZ, y: CROWN.y },
  { x0: CROWN.minX, z0: CROWN.maxZ, x1: CROWN.maxX, z1: CROWN.maxZ, y: CROWN.y },
  { x0: CROWN.maxX, z0: CROWN.minZ, x1: CROWN.maxX, z1: CROWN.maxZ, y: CROWN.y },
  // West edge, leaving the bubble's dock open.
  { x0: CROWN.minX, z0: CROWN.minZ, x1: CROWN.minX, z1: BUBBLE_CRADLE[2] - 2.1, y: CROWN.y },
  { x0: CROWN.minX, z0: BUBBLE_CRADLE[2] + 2.1, x1: CROWN.minX, z1: CROWN.maxZ, y: CROWN.y },
];

/** Waypoints for the reference route (feet x, z). */
export const ROUTE = {
  toLens1: [[2, 11.4]],
  toStairFoot: [[-1.4, 2.4], [-2, 0]],
  upStair: [[-11.5, 0]],
  toPadT1: [[-14.5, -5.6], [PAD_X, PAD_DOCK_T1]],
  offPadT2: [[PAD_X, -19.2]],
  toLens2: [[-12.6, -21.6]],
  toSpanFoot: [[-10.6, -24.4]],
  upSpan: [[3.6, -24.4]],
  toLens3: [[4.6, -22.2]],
  intoBubble: [[BUBBLE_CRADLE[0], BUBBLE_CRADLE[2]]],
  ontoCrown: [[12.2, -25.5]],
  toNucleus: [[13.4, -24]],
  toExit: [[16.4, -26.5]],
  // Optional: down to the prism from the meniscus.
  toPrism: [[6, 12], [11, 2], [11.4, -6.8]],
} as const;

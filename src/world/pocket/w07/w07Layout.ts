/**
 * W07 Portal Slingshot Trials — topology.
 *
 * An under-construction test lab. Three chambers in a row to the north of the
 * entry foyer (-Z is north). A slingshot (never a gun) fires a pellet that
 * opens a portal on an approved white panel; two portals link, and walking
 * into one steps out of the other. Every panel has a fixed socket, so the
 * portal pairing, exit position and velocity transform are deterministic.
 *
 * Chamber One: a simple linked passage past calibration glass.
 * Chamber Two: carry the weighted block through the portals to a remote plate.
 * Chamber Three: fall down the drop shaft into a floor portal and leave a high
 * wall portal fast enough to cross the gap to the calibration ledge.
 */

export type Vec3 = readonly [number, number, number];
export type ZoneId = 'foyer' | 'A' | 'B' | 'C';

export interface Box {
  readonly minX: number; readonly maxX: number;
  readonly minY: number; readonly maxY: number;
  readonly minZ: number; readonly maxZ: number;
}

export interface Rect { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }

export interface Panel {
  readonly id: string;
  readonly zone: ZoneId;
  /** Socket centre (wall: on the wall plane at mid-aperture height; floor: on the floor plane). */
  readonly centre: Vec3;
  /** Outward unit normal (out of the surface, into the room). */
  readonly normal: Vec3;
  readonly kind: 'wall' | 'floor';
  /** Aperture half-width along the surface (wall: horizontal; floor: square half-size). */
  readonly half: number;
  /** Wall apertures: bottom and top heights. */
  readonly bottom: number;
  readonly top: number;
  /** Where the visitor may stand to shoot this panel (line of sight through open space or glass). */
  readonly shootFrom: readonly Rect[];
}

export const SPAWN: Vec3 = [0, 0, 26];
export const LAB_FLOOR = 0;

// Movement through portals.
export const MIN_EXIT_SPEED = 3.0;
export const MAX_EXIT_SPEED = 20;
/** Above this exit speed the visitor's horizontal momentum is held until they land or meet a wall. */
export const FLING_SPEED = 4.5;
export const EXIT_CLEARANCE = 0.9;
export const PORTAL_COOLDOWN = 0.35;
/** Aiming assist: the slingshot snaps to a panel within this angle of the view ray. */
export const AIM_ASSIST = 0.14;
export const SHOT_RANGE = 40;

// ---- Zones (feet positions).
export const ZONES: readonly { id: ZoneId; rect: Rect }[] = [
  { id: 'foyer', rect: { minX: -7, maxX: 7, minZ: 18, maxZ: 30 } },
  { id: 'A', rect: { minX: -8, maxX: 12, minZ: -4.4, maxZ: 18 } },
  { id: 'B', rect: { minX: -10, maxX: 10, minZ: -30.4, maxZ: -4.4 } },
  { id: 'C', rect: { minX: -10, maxX: 10, minZ: -62, maxZ: -30.4 } },
];

export function zoneAt(x: number, z: number): ZoneId | null {
  for (const zone of ZONES) {
    const r = zone.rect;
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return zone.id;
  }
  return null;
}

export function inRect(r: Rect, x: number, z: number, pad = 0): boolean {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;
}

// ---- Foyer.
export const FOYER: Rect = { minX: -7, maxX: 7, minZ: 18, maxZ: 30 };
export const FOYER_HEIGHT = 6;
export const SLINGSHOT_POS: Vec3 = [3.2, 0, 21.5];
export const FOYER_GATE: Box = { minX: -2, maxX: 2, minY: -1, maxY: 7, minZ: 17.6, maxZ: 18 };

// ---- Chamber One.
export const ROOM_A: Rect = { minX: -8, maxX: 8, minZ: -4, maxZ: 17.6 };
export const ROOM_A_HEIGHT = 7;
export const A_NEAR: Rect = { minX: -8, maxX: 8, minZ: 6.1, maxZ: 17.6 };
export const A_FAR: Rect = { minX: -8, maxX: 8, minZ: -4, maxZ: 5.9 };
export const A_GLASS_Z = 6;
export const CLOSET: Rect = { minX: 8.4, maxX: 12, minZ: 9, maxZ: 14 };
export const CLOSET_WINDOW = { minZ: 10.5, maxZ: 12.5, minY: 0.9, maxY: 2.4 } as const;
export const PROTOTYPE_POS: Vec3 = [9.2, 0, 13.2];
export const RESET_A_POS: Vec3 = [-5, 1.3, 17.45];

// ---- Chamber Two.
export const ROOM_B: Rect = { minX: -10, maxX: 10, minZ: -30, maxZ: -4.4 };
export const ROOM_B_HEIGHT = 8;
export const B_MAIN: Rect = { minX: -10, maxX: 1.9, minZ: -30, maxZ: -4.4 };
export const B_GALLERY: Rect = { minX: 2.1, maxX: 10, minZ: -30, maxZ: -4.4 };
export const B_GLASS_X = 2;
export const DISPENSER_POS: Vec3 = [-7.5, 0, -8];
export const BLOCK_HALF = 0.4;
export const PLATE_POS: Vec3 = [6, 0, -25];
export const PLATE_RADIUS = 0.9;
export const B_DOOR: Box = { minX: -7, maxX: -3, minY: -1, maxY: 8, minZ: -30.4, maxZ: -30 };
export const RESET_B_POS: Vec3 = [-8, 1.3, -4.55];

// ---- Chamber Three.
export const ROOM_C: Rect = { minX: -10, maxX: 10, minZ: -62, maxZ: -30.4 };
export const ROOM_C_HEIGHT = 12;
export const SHAFT: Rect = { minX: -8.5, maxX: -5.5, minZ: -37.5, maxZ: -34.5 };
export const SHAFT_FLOOR_Y = -7;
export const PYLON: Box = { minX: -3, maxX: 3, minY: 0, maxY: 8, minZ: -46, maxZ: -44 };
export const MAIN_C_NORTH_Z = -46;
export const WALKWAY_NORTH_Z = -50;
export const WALKWAY_INNER_X = 6;
export const CHASM: Rect = { minX: -10, maxX: 10, minZ: -52, maxZ: -46 };
export const NET_Y = -3;
export const LEDGE: Rect = { minX: -10, maxX: 10, minZ: -62, maxZ: -52 };
export const LEDGE_Y = 2;
export const CORE_POS: Vec3 = [-4, LEDGE_Y, -57];
export const GATE_POS: Vec3 = [5, LEDGE_Y, -59];
export const GATE_APPROACH: readonly [number, number] = [5, -56.4];
export const RESET_C_POS: Vec3 = [-9, 1.3, -30.55];

/** Main chamber-three floor: everything south of the chasm except the drop shaft. */
export function onRoomCFloor(x: number, z: number): boolean {
  if (x < ROOM_C.minX || x > ROOM_C.maxX || z > ROOM_C.maxZ) return false;
  if (inRect(SHAFT, x, z)) return false;
  if (z >= MAIN_C_NORTH_Z) return true;
  // Side walkways run north beside the chasm, ending short of the ledge.
  return z >= WALKWAY_NORTH_Z && Math.abs(x) >= WALKWAY_INNER_X;
}

// ---- Approved white panels.
const WALL_BOTTOM = 0;
const WALL_TOP = 2.6;
const WALL_HALF = 1.0;
const wall = (id: string, zone: ZoneId, x: number, z: number, normal: Vec3, shootFrom: readonly Rect[], bottom = WALL_BOTTOM, top = WALL_TOP): Panel => ({
  id, zone, kind: 'wall', centre: [x, (bottom + top) / 2, z], normal, half: WALL_HALF, bottom, top, shootFrom,
});

export const PANEL_A1 = wall('A1', 'A', -8, 12, [1, 0, 0], [A_NEAR]);
export const PANEL_A2 = wall('A2', 'A', 8, 1, [-1, 0, 0], [A_NEAR, A_FAR]);
/** Optional: the sealed supply closet, seen only through its window. */
export const PANEL_A3 = wall('A3', 'A', 12, 11.5, [-1, 0, 0], [{ minX: -6, maxX: 7.8, minZ: 9.6, maxZ: 13.4 }, CLOSET]);
export const PANEL_B1 = wall('B1', 'B', -10, -17, [1, 0, 0], [B_MAIN, B_GALLERY]);
export const PANEL_B2 = wall('B2', 'B', 10, -17, [-1, 0, 0], [B_MAIN, B_GALLERY]);
export const PANEL_C1: Panel = {
  id: 'C1', zone: 'C', kind: 'floor', centre: [-7, SHAFT_FLOOR_Y, -36], normal: [0, 1, 0], half: 1.5, bottom: SHAFT_FLOOR_Y, top: SHAFT_FLOOR_Y,
  shootFrom: [{ minX: -10, maxX: -3, minZ: -40, maxZ: -32 }],
};
/** High on the pylon's north face, seen only from the side walkways. */
export const PANEL_C2 = wall('C2', 'C', 0, -46, [0, 0, -1], [
  { minX: -10, maxX: -WALKWAY_INNER_X, minZ: WALKWAY_NORTH_Z, maxZ: -46.2 },
  { minX: WALKWAY_INNER_X, maxX: 10, minZ: WALKWAY_NORTH_Z, maxZ: -46.2 },
  LEDGE,
], 4.0, 6.6);
export const PANEL_C3 = wall('C3', 'C', -10, -42, [1, 0, 0], [{ minX: -10, maxX: 10, minZ: -46, maxZ: -30.4 }]);

export const PANELS: readonly Panel[] = [PANEL_A1, PANEL_A2, PANEL_A3, PANEL_B1, PANEL_B2, PANEL_C1, PANEL_C2, PANEL_C3];

/** Where a visitor leaving through this panel's portal is placed (feet). */
export function exitPoint(p: Panel): Vec3 {
  if (p.kind === 'floor') return [p.centre[0], p.centre[1] + 0.05, p.centre[2]];
  return [p.centre[0] + p.normal[0] * EXIT_CLEARANCE, p.bottom + 0.02, p.centre[2] + p.normal[2] * EXIT_CLEARANCE];
}

/** Yaw that faces along a horizontal normal (forward is (-sin yaw, -cos yaw)). */
export function yawFacing(n: Vec3): number {
  return Math.atan2(-n[0], -n[2]);
}

// ---- Solid walls (the lab shell, partitions and glass), as boxes.
const T = 0.4;
export const SHELL: readonly Box[] = [
  // Foyer.
  { minX: -7.4, maxX: 7.4, minY: -1, maxY: FOYER_HEIGHT, minZ: 30, maxZ: 30 + T },
  { minX: -7 - T, maxX: -7, minY: -1, maxY: FOYER_HEIGHT, minZ: 18, maxZ: 30 },
  { minX: 7, maxX: 7 + T, minY: -1, maxY: FOYER_HEIGHT, minZ: 18, maxZ: 30 },
  // Foyer / Chamber One wall (gate between x -2..2 is dynamic).
  { minX: -8.4, maxX: -2, minY: -1, maxY: ROOM_A_HEIGHT, minZ: 17.6, maxZ: 18 },
  { minX: 2, maxX: 8.4, minY: -1, maxY: ROOM_A_HEIGHT, minZ: 17.6, maxZ: 18 },
  // Chamber One sides (the east side holds the closet window: solid to the visitor).
  { minX: -8.4, maxX: -8, minY: -1, maxY: ROOM_A_HEIGHT, minZ: -4, maxZ: 17.6 },
  { minX: 8, maxX: 8.4, minY: -1, maxY: ROOM_A_HEIGHT, minZ: -4, maxZ: 17.6 },
  // Calibration glass across Chamber One.
  { minX: -8, maxX: 8, minY: -1, maxY: ROOM_A_HEIGHT, minZ: A_GLASS_Z - 0.1, maxZ: A_GLASS_Z + 0.1 },
  // Closet.
  { minX: 8.4, maxX: 12.4, minY: -1, maxY: 4, minZ: 8.6, maxZ: 9 },
  { minX: 8.4, maxX: 12.4, minY: -1, maxY: 4, minZ: 14, maxZ: 14.4 },
  { minX: 12, maxX: 12.4, minY: -1, maxY: 4, minZ: 8.6, maxZ: 14.4 },
  // Chamber One / Two wall (door x -5..-1 is open).
  { minX: -10.4, maxX: -5, minY: -1, maxY: ROOM_B_HEIGHT, minZ: -4.4, maxZ: -4 },
  { minX: -1, maxX: 10.4, minY: -1, maxY: ROOM_B_HEIGHT, minZ: -4.4, maxZ: -4 },
  // Chamber Two sides and glass.
  { minX: -10.4, maxX: -10, minY: -1, maxY: ROOM_B_HEIGHT, minZ: -30, maxZ: -4.4 },
  { minX: 10, maxX: 10.4, minY: -1, maxY: ROOM_B_HEIGHT, minZ: -30, maxZ: -4.4 },
  { minX: B_GLASS_X - 0.1, maxX: B_GLASS_X + 0.1, minY: -1, maxY: ROOM_B_HEIGHT, minZ: -30, maxZ: -4.4 },
  // Chamber Two / Three wall (door x -7..-3 is dynamic).
  { minX: -10.4, maxX: -7, minY: -1, maxY: ROOM_C_HEIGHT, minZ: -30.4, maxZ: -30 },
  { minX: -3, maxX: 10.4, minY: -1, maxY: ROOM_C_HEIGHT, minZ: -30.4, maxZ: -30 },
  // Chamber Three shell (reaching down past the shaft and the safety net).
  { minX: -10.4, maxX: -10, minY: -8, maxY: ROOM_C_HEIGHT, minZ: -62, maxZ: -30.4 },
  { minX: 10, maxX: 10.4, minY: -8, maxY: ROOM_C_HEIGHT, minZ: -62, maxZ: -30.4 },
  { minX: -10.4, maxX: 10.4, minY: -8, maxY: ROOM_C_HEIGHT, minZ: -62.4, maxZ: -62 },
  // The pylon that carries panel C2.
  PYLON,
  // Drop shaft lining (tops level with the floor, so walking past is never snagged).
  { minX: -8.9, maxX: -8.5, minY: SHAFT_FLOOR_Y - 1, maxY: 0, minZ: -37.9, maxZ: -34.1 },
  { minX: -5.5, maxX: -5.1, minY: SHAFT_FLOOR_Y - 1, maxY: 0, minZ: -37.9, maxZ: -34.1 },
  { minX: -8.9, maxX: -5.1, minY: SHAFT_FLOOR_Y - 1, maxY: 0, minZ: -37.9, maxZ: -37.5 },
  { minX: -8.9, maxX: -5.1, minY: SHAFT_FLOOR_Y - 1, maxY: 0, minZ: -34.5, maxZ: -34.1 },
  // The ledge's front face (its top stops just below the ledge so landings never snag).
  { minX: -10, maxX: 10, minY: NET_Y - 1, maxY: LEDGE_Y - 0.05, minZ: -52.4, maxZ: -52 },
  // Ledge and walkway bodies seen from the net (below their tops).
  { minX: -10, maxX: -WALKWAY_INNER_X, minY: NET_Y - 1, maxY: -0.6, minZ: WALKWAY_NORTH_Z, maxZ: -46 },
  { minX: WALKWAY_INNER_X, maxX: 10, minY: NET_Y - 1, maxY: -0.6, minZ: WALKWAY_NORTH_Z, maxZ: -46 },
  { minX: -10, maxX: 10, minY: NET_Y - 1, maxY: -0.6, minZ: -46, maxZ: -45.6 },
];

/** Railings: [x0, z0, x1, z1, floor y]. */
export const RAILS: readonly (readonly [number, number, number, number, number])[] = [
  // Drop shaft: north, south and west sides (the east side is the drop line).
  [-8.5, -37.5, -5.5, -37.5, 0],
  [-8.5, -34.5, -5.5, -34.5, 0],
  [-8.5, -37.5, -8.5, -34.5, 0],
  // Chasm edge beside the pylon, the walkway inner edges and their north ends.
  [-WALKWAY_INNER_X, -46, -3, -46, 0],
  [3, -46, WALKWAY_INNER_X, -46, 0],
  [-WALKWAY_INNER_X, -46, -WALKWAY_INNER_X, WALKWAY_NORTH_Z, 0],
  [WALKWAY_INNER_X, -46, WALKWAY_INNER_X, WALKWAY_NORTH_Z, 0],
  [-10, WALKWAY_NORTH_Z, -WALKWAY_INNER_X, WALKWAY_NORTH_Z, 0],
  [WALKWAY_INNER_X, WALKWAY_NORTH_Z, 10, WALKWAY_NORTH_Z, 0],
];

/** Keyboard route stands (x, z) used by the tests. */
export const ROUTE = {
  toSlingshot: [[0, 26], [1.4, 22.6]] as const,
  intoChamberOne: [[0, 19.5], [0, 14]] as const,
  /** Facing the west wall's panel A1 from the near side. */
  nearA1: [[-5.6, 12]] as const,
  /** Out of A2 in the far side, to the door into Chamber Two. */
  toChamberTwo: [[3, 0.6], [-3, -2.6], [-3, -6.4]] as const,
  toDispenser: [[-6.2, -8]] as const,
  toB1: [[-7.6, -17]] as const,
  /** From B2's exit to the plate. */
  toPlate: [[6, -23.9]] as const,
  /** Back out of the gallery through B2 (walk east into the panel). */
  toB2: [[9.2, -17]] as const,
  toDoorB: [[-5, -21], [-5, -29], [-5, -32.6]] as const,
  toWalkway: [[7.8, -40], [7.8, -48.6]] as const,
  toShaftLip: [[7.8, -42], [-3.6, -40], [-4.9, -36]] as const,
  /** Walk west off the open east lip of the drop shaft. */
  offShaftLip: [[-7, -36]] as const,
  toCore: [[-1.6, -57]] as const,
  toGate: [[5, -56.4]] as const,
  toCloset: [[6.4, 11.5]] as const,
} as const;

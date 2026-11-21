import { LEVEL_1_Y, ROTUNDA_APOTHEM, ROTUNDA_WALL, type Vec3 } from './layout';

/**
 * The Museum Cinema: one destination on the upper floor, entered from the
 * Rotunda balcony's east face (the Bible's "second-floor theater … a proper
 * home for the many video/film projects", built as a shared venue so the
 * six-wing structure is unchanged).
 *
 * Why here, from the architecture rather than taste:
 * - The upper floor's other faces are taken (NW media, NE infra wings) or
 *   carry the grand stairs' arrivals (SW, SE). E, W, N and S face the drum's
 *   solid band over a ground wing.
 * - The north hall rises to y 14.4 and the south hall to 11.4, so neither can
 *   carry a room at balcony height. The east and west halls stop at y 10.4
 *   (hall ceiling top), the east and west bays at 9.4.
 * - East gives the longer clear run (the east hall is 72 m, west 36 m).
 *
 * So the cinema stands over the east wing. Its walking surface is 0.6 m above
 * the balcony (`CINEMA_FLOOR_Y`), clear of the east hall's roof, reached by a
 * gentle lobby ramp. It stays south of the NE infra wing's bays (which reach
 * to z ≈ −0.8 near x 36), north of the south wing's bays, and above every
 * ground-floor ceiling it crosses. `tests/cinema.test.ts` checks all of this
 * against the real built museum rather than trusting these comments.
 *
 * Plan (x outward from the Rotunda, z to the south, metres):
 *
 *   balcony ─ threshold ─ lobby (ramp) ─┬─ door ─ auditorium (screen at the
 *                                        │        west wall, rows rising east)
 *                                        └─ exit passage behind the screen ─┘
 */

/** The drum face the cinema opens from. */
export const CINEMA_FACE = 'e' as const;

/** The balcony floor the threshold opens from. */
export const CINEMA_ENTRY_Y = LEVEL_1_Y;
/** The cinema's own floor: 0.6 m above the balcony, clear of the east hall roof (top y 10.4). */
export const CINEMA_FLOOR_Y = LEVEL_1_Y + 0.6;

/** Threshold through the drum's east face (which spans z ±6.6). */
export const CINEMA_THRESHOLD_X = ROTUNDA_APOTHEM; // wall centre plane
export const CINEMA_THRESHOLD_WIDTH = 5.2;
export const CINEMA_THRESHOLD_HEIGHT = 4.4;

/** Lobby: from the drum's outer face to the auditorium's front wall. */
export const LOBBY = {
  minX: ROTUNDA_APOTHEM + ROTUNDA_WALL / 2, // 16.6
  maxX: 26.6,
  minZ: -5,
  maxZ: 5,
  /** Ramp from balcony height up to the cinema floor. */
  rampFromX: 19.4,
  rampToX: 23.4,
  ceilingY: LEVEL_1_Y + 5.2,
} as const;

export const WALL_T = 0.3;

/** Auditorium interior (inner faces of its walls). */
export const AUDITORIUM = {
  minX: 26.9,
  maxX: 56,
  minZ: 0.4,
  maxZ: 24.4,
  ceilingY: 21.8,
} as const;

/** Door from the lobby into the auditorium's front-north corner (front wall at x 26.6–26.9). */
export const ENTRY_DOOR = { minZ: 0.7, maxZ: 4.7, height: 3.4 } as const;
/** Exit from the front-south corner into the passage behind the screen. */
export const EXIT_DOOR = { minZ: 20.6, maxZ: 24.1, height: 3.2 } as const;
/** Exit passage behind the screen wall, back to the lobby's south side. */
export const EXIT_PASSAGE = { minX: 24.4, maxX: 26.6, minZ: 5, maxZ: 24.4 } as const;
/**
 * Light lock: a velvet baffle continuing the exit passage's wall north into the
 * lobby. Visitors walk round its north end to the doors, and no straight line
 * runs from the auditorium through the doors to the bright Rotunda.
 */
export const LIGHT_LOCK = { x: EXIT_PASSAGE.minX - 0.15, minZ: -0.4, maxZ: 5 } as const;

/** Screen frame on the west (front) wall, facing +x. Masking fits each film inside it. */
export const SCREEN = {
  x: AUDITORIUM.minX + 0.35,
  centerZ: 12.4,
  width: 13,
  height: 13 * 9 / 16,
  bottomY: 12.4,
} as const;
export const SCREEN_CENTER: Vec3 = [SCREEN.x, SCREEN.bottomY + SCREEN.height / 2, SCREEN.centerZ];

/** Flat front zone between the screen and the first tier. */
export const FRONT_ZONE_TO_X = 35;

/** Stadium tiers: each a 2.1 m deep step rising 0.36 m (under the 0.55 m step-up). */
export const TIER_COUNT = 9;
export const TIER_DEPTH = 2.1;
export const TIER_RISE = 0.36;
export function tierStartX(i: number): number { return FRONT_ZONE_TO_X + i * TIER_DEPTH; }
export function tierEndX(i: number): number { return tierStartX(i) + TIER_DEPTH; }
export function tierY(i: number): number { return CINEMA_FLOOR_Y + (i + 1) * TIER_RISE; }
/** Rear cross-aisle: level with the last tier, carrying the accessible viewing positions. */
export const REAR_PLATFORM = { minX: tierEndX(TIER_COUNT - 1), maxX: AUDITORIUM.maxX, y: tierY(TIER_COUNT - 1) } as const;

/** Aisles across the width (z). North is a ramp (step-free route to the rear); centre and south are stepped. */
export const NORTH_AISLE = { minZ: AUDITORIUM.minZ, maxZ: 2.5 } as const;
export const CENTRE_AISLE = { minZ: 11.4, maxZ: 13.4 } as const;
export const SOUTH_AISLE = { minZ: 22.3, maxZ: AUDITORIUM.maxZ } as const;
/** Seat blocks between the aisles. */
export const SEAT_BLOCKS = [
  { id: 'north', minZ: NORTH_AISLE.maxZ + 0.1, maxZ: CENTRE_AISLE.minZ },
  { id: 'south', minZ: CENTRE_AISLE.maxZ, maxZ: SOUTH_AISLE.minZ - 0.1 },
] as const;
export const SEAT_WIDTH = 0.6;
/** Seat row footprint at the back of each tier; the walkway in front is TIER_DEPTH − SEAT_ROW_DEPTH. */
export const SEAT_ROW_DEPTH = 0.95;
export const SEAT_ROW_HEIGHT = 0.95;
/** Eye height above the tier floor when seated. */
export const SEATED_EYE_HEIGHT = 1.12;
/** Eye height at an accessible viewing position (a visitor seated in their own chair). */
export const ACCESSIBLE_EYE_HEIGHT = 1.22;
/** Facing the screen (−x): forward is (−sin yaw, −cos yaw). */
export const SCREEN_FACING_YAW = Math.PI / 2;

export const ROW_LETTERS = 'ABCDEFGHJ';

export interface CinemaSeat {
  readonly id: string;
  readonly row: number;
  readonly label: string;
  readonly block: 'north' | 'south';
  /** Floor point of the seat (where a seated visitor's feet are). */
  readonly position: Vec3;
  /** Walkway point in front of the seat: where the visitor stands to sit, and stands back up to. */
  readonly aisleSide: Vec3;
}

function seatsFor(): CinemaSeat[] {
  const seats: CinemaSeat[] = [];
  for (let row = 0; row < TIER_COUNT; row++) {
    const y = tierY(row);
    const seatX = tierEndX(row) - SEAT_ROW_DEPTH / 2;
    const standX = tierStartX(row) + (TIER_DEPTH - SEAT_ROW_DEPTH) / 2;
    let number = 1;
    for (const block of SEAT_BLOCKS) {
      const count = Math.floor((block.maxZ - block.minZ) / SEAT_WIDTH);
      const margin = (block.maxZ - block.minZ - count * SEAT_WIDTH) / 2;
      for (let k = 0; k < count; k++) {
        const z = block.minZ + margin + SEAT_WIDTH * (k + 0.5);
        const label = `${ROW_LETTERS[row]}${number++}`;
        seats.push({
          id: `seat:${label}`, row, label, block: block.id,
          position: [seatX, y, z],
          aisleSide: [standX, y, z],
        });
      }
    }
  }
  return seats;
}

export const CINEMA_SEATS: readonly CinemaSeat[] = seatsFor();

/** Step-free viewing positions on the rear platform, reached by the north ramp aisle. */
export const ACCESSIBLE_POSITIONS: readonly { id: string; label: string; position: Vec3 }[] = [4.2, 6.2, 8.2, 10.2].map((z, i) => ({
  id: `cinema-accessible:${i + 1}`,
  label: `Accessible viewing position ${i + 1}`,
  position: [REAR_PLATFORM.minX + 1.3, REAR_PLATFORM.y, z] as Vec3,
}));

/** Projection booth behind the rear wall, its ports level with the screen centre. */
export const BOOTH = { minX: AUDITORIUM.maxX + WALL_T, maxX: AUDITORIUM.maxX + WALL_T + 3, minZ: 8.6, maxZ: 16.2, floorY: 15.2, height: 3.4 } as const;

/** Representative standing points, for routes, tests and the map. */
export const CINEMA_POINTS = {
  balconyApproach: [ROTUNDA_APOTHEM - 2.4, LEVEL_1_Y, 0] as Vec3,
  threshold: [ROTUNDA_APOTHEM + 1.2, LEVEL_1_Y, 0] as Vec3,
  lobby: [21.4, CINEMA_FLOOR_Y - 0.3, 0] as Vec3,
  lobbyTurn: [23.9, CINEMA_FLOOR_Y, -2.7] as Vec3,
  lightLock: [25.5, CINEMA_FLOOR_Y, -2.7] as Vec3,
  lobbyEast: [25.5, CINEMA_FLOOR_Y, 2.7] as Vec3,
  insideEntry: [28.6, CINEMA_FLOOR_Y, 2.7] as Vec3,
  frontZone: [31.5, CINEMA_FLOOR_Y, 12.4] as Vec3,
  northAisleTop: [REAR_PLATFORM.minX + 1.2, REAR_PLATFORM.y, 1.45] as Vec3,
  rearPlatform: [REAR_PLATFORM.minX + 1.3, REAR_PLATFORM.y, 12.4] as Vec3,
  southAisleFront: [33.5, CINEMA_FLOOR_Y, 23.35] as Vec3,
  exitInside: [28.4, CINEMA_FLOOR_Y, 22.35] as Vec3,
  exitPassageSouth: [25.5, CINEMA_FLOOR_Y, 22.35] as Vec3,
  exitPassageNorth: [25.5, CINEMA_FLOOR_Y, 4.2] as Vec3,
} as const;

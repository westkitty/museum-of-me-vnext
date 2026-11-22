import type { Vec3 } from '../layout';

/**
 * Pure data layout for the Museum Rooftop Complex and West Flank Ascent (ISLAND-03).
 *
 * Zero Three.js imports (mirrors `cinemaLayout.ts`).
 *
 * Invariants verified here and tested in `tests/rooftop-architecture.test.ts`:
 * - Protected Cinema spatial envelope in InteriorWorld:
 *   X in [15.08, 59.45], Z in [-5.3, +24.7], Y in [9.6, 22.2].
 *   Every rooftop structure stays strictly west of X = 14.0 (< 15.08).
 * - Central dome sits at (0, 11.5, 0) with outer rib radius 15.22 m (top Y = 28.95).
 *   Cafe north edge at Z = 17.0 (> 15.22) and Greenhouse east edge at X = -16.5
 *   stay strictly outside the dome hemisphere.
 * - East/West barrel wings reach peak rib Y = 18.17 m (at |X| = 25.5).
 *   All roof decks sit at ROOF_DECK_Y = 18.6 with slab thickness 0.35 m
 *   (underside Y = 18.25 > 18.17), supported on structural piers down to the
 *   central spine (Y = 11.5) or barrel roof shoulders without clipping.
 */

export const ROOF_DECK_Y = 18.6;
export const ROOF_SLAB_THICKNESS = 0.35;
export const ROOF_DECK_UNDERSIDE_Y = ROOF_DECK_Y - ROOF_SLAB_THICKNESS; // 18.25
export const ROOF_RAIL_HEIGHT = 1.15;
export const ROOF_RAIL_THICKNESS = 0.16;

export const ROOF_MID_LANDING_Y = 9.5;
export const ROOF_GROUND_Y = -0.5;

export const CENTRAL_SPINE_TOP_Y = 11.5;
export const CENTRAL_SPINE_HALF_X = 13.0;
export const WEST_BARREL_CENTER_X = -25.5;
export const WEST_BARREL_HALF_WIDTH = 13.4;
export const WEST_BARREL_BASE_Y = 9.5;
export const WEST_BARREL_RISE = 8.5;
export const WEST_BARREL_RIB_ALLOWANCE = 0.17;
export const WEST_BARREL_PEAK_Y = WEST_BARREL_BASE_Y + WEST_BARREL_RISE + WEST_BARREL_RIB_ALLOWANCE; // 18.17

export const DOME_CENTER: Vec3 = [0, 11.5, 0];
export const DOME_OUTER_RADIUS = 15.22;

export const PROTECTED_CINEMA_ENVELOPE = {
  minX: 15.08,
  maxX: 59.45,
  minZ: -5.3,
  maxZ: 24.7,
  minY: 9.6,
  maxY: 22.2,
} as const;

export interface DeckRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly y: number;
}

export interface RampRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly axis: 'z';
  readonly yAtMin: number;
  readonly yAtMax: number;
}

/** Rooftop Cafe Terrace: south of dome, west of Cinema, over the central spine. */
export const ROOF_CAFE_DECK: DeckRect = {
  minX: -14.0,
  maxX: 14.0,
  minZ: 17.0,
  maxZ: 45.0,
  y: ROOF_DECK_Y,
};

/** 8 m wide connecting promenade linking the Cafe Terrace to the Greenhouse & West Ascent. */
export const ROOF_PROMENADE_DECK: DeckRect = {
  minX: -37.5,
  maxX: -14.0,
  minZ: 24.0,
  maxZ: 32.0,
  y: ROOF_DECK_Y,
};

/** Glass Greenhouse deck (opposite Cinema on the west wing). */
export const ROOF_GREENHOUSE_DECK: DeckRect = {
  minX: -37.5,
  maxX: -16.5,
  minZ: -4.0,
  maxZ: 24.0,
  y: ROOF_DECK_Y,
};

/** Transparent conservatory enclosure footprint inside the Greenhouse deck. */
export const ROOF_GREENHOUSE_SHELL = {
  minX: -35.0,
  maxX: -17.5,
  minZ: -2.0,
  maxZ: 22.0,
  eaveY: 22.8,
  ridgeY: 25.4,
} as const;

/** 4 m wide walk-in south arched doorway into the Glass Greenhouse. */
export const ROOF_GREENHOUSE_DOOR = {
  minX: -28.0,
  maxX: -24.0,
  z: 22.0,
  height: 3.4,
} as const;

/** 2.5 m clear exterior perimeter walkway west of the conservatory glass. */
export const ROOF_WEST_WALKWAY: DeckRect = {
  minX: -37.5,
  maxX: -35.0,
  minZ: -4.0,
  maxZ: 24.0,
  y: ROOF_DECK_Y,
};

/** Flight Pad II deck extending south from the Cafe Terrace. */
export const ROOF_FLIGHT_PAD_II_DECK: DeckRect = {
  minX: -8.0,
  maxX: 8.0,
  minZ: 45.0,
  maxZ: 63.0,
  y: ROOF_DECK_Y,
};

/** Exterior West Flank Ascent (strictly inside |X| < 50 && |Z| < 112 tree-free apron, 0.35 m outside eave). */
export const WEST_ASCENT_ENTRY: Vec3 = [-42.0, ROOF_GROUND_Y, 114.0];

export const WEST_LOWER_RAMP: RampRect = {
  minX: -43.0,
  maxX: -39.5,
  minZ: 56.0,
  maxZ: 112.0,
  axis: 'z',
  yAtMin: ROOF_MID_LANDING_Y,
  yAtMax: ROOF_GROUND_Y,
};

export const WEST_MID_LANDING: DeckRect = {
  minX: -43.0,
  maxX: -39.5,
  minZ: 48.0,
  maxZ: 56.0,
  y: ROOF_MID_LANDING_Y,
};

export const WEST_UPPER_RAMP: RampRect = {
  minX: -43.0,
  maxX: -39.5,
  minZ: -4.0,
  maxZ: 48.0,
  axis: 'z',
  yAtMin: ROOF_DECK_Y,
  yAtMax: ROOF_MID_LANDING_Y,
};

/** Upper bridge landing joining the top of the Upper West Ramp to the West Perimeter Walkway. */
export const WEST_UPPER_BRIDGE_LANDING: DeckRect = {
  minX: -43.0,
  maxX: -37.5,
  minZ: -10.0,
  maxZ: -4.0,
  y: ROOF_DECK_Y,
};

/** Bridge threshold strip continuing east across X = -37.5..-35.0 to meet the West Perimeter Walkway cleanly. */
export const WEST_UPPER_WALKWAY_LINK: DeckRect = {
  minX: -37.5,
  maxX: -35.0,
  minZ: -10.0,
  maxZ: -4.0,
  y: ROOF_DECK_Y,
};

export const ALL_ROOF_DECKS: readonly DeckRect[] = [
  ROOF_CAFE_DECK,
  ROOF_PROMENADE_DECK,
  ROOF_GREENHOUSE_DECK,
  ROOF_FLIGHT_PAD_II_DECK,
  WEST_MID_LANDING,
  WEST_UPPER_BRIDGE_LANDING,
  WEST_UPPER_WALKWAY_LINK,
];

// ── Rooftop Interactables, Seating & Flight Pad II ─────────────────────────

export const HOT_DOG_STAND_ID = 'rooftop-hot-dog-stand';
export const HOT_DOG_STAND_CENTER: Vec3 = [7.5, ROOF_DECK_Y, 29.0];
export const HOT_DOG_STAND_SIZE = { depthX: 2.8, widthZ: 4.2 } as const;
export const HOT_DOG_STAND_OPERATOR_SPOT: Vec3 = [7.8, ROOF_DECK_Y, 29.0];
export const HOT_DOG_STAND_VISITOR_SPOT: Vec3 = [5.0, ROOF_DECK_Y, 29.0];

export const ROOF_CAFE_TABLES: readonly Vec3[] = [
  [-3.5, ROOF_DECK_Y, 25.0],
  [2.0, ROOF_DECK_Y, 25.0],
  [-3.5, ROOF_DECK_Y, 33.5],
  [2.0, ROOF_DECK_Y, 33.5],
];
export const ROOF_CAFE_TABLE_COLLIDER_HALF = 1.05;

export interface AccessibleBaySpec {
  readonly id: string;
  readonly label: string;
  readonly center: Vec3;
  readonly clearHalf: number;
}

export const ROOF_ACCESSIBLE_BAYS: readonly AccessibleBaySpec[] = [
  {
    id: 'cafe-accessible-dome-bay',
    label: 'Step-free Dome Overlook Bay',
    center: [-8.5, ROOF_DECK_Y, 20.5],
    clearHalf: 1.5,
  },
  {
    id: 'cafe-accessible-horizon-bay',
    label: 'Step-free Sky-Island Horizon Bay',
    center: [10.5, ROOF_DECK_Y, 38.5],
    clearHalf: 1.5,
  },
];

export const GREENHOUSE_FLOWER_ID = 'rooftop-greenhouse-flower-w05';
export const GREENHOUSE_FLOWER_CENTER: Vec3 = [-26.0, ROOF_DECK_Y, 10.0];
export const GREENHOUSE_COLLAR_RADIUS = 2.4;
export const GREENHOUSE_COLLAR_HEIGHT = 0.48;

export const ROOF_FLIGHT_PAD_II_CENTER: Vec3 = [0, ROOF_DECK_Y, 54.0];
export const ROOF_FLIGHT_PAD_II_RADIUS = 3.4;
export const ROOF_FLIGHT_PAD_II_LAUNCH_SPEED = 16.5;
export const ROOF_FLIGHT_PAD_II_Y_TOLERANCE = 0.6;
export const ROOF_FLIGHT_PAD_II_TELEPORT_ID = 'rooftop-flight-pad-ii-teleport';
export const ROOF_FLIGHT_PAD_II_TELEPORT_CENTER: Vec3 = [-4.2, ROOF_DECK_Y, 51.5];

export function isOnRooftopFlightPad(x: number, y: number, z: number): boolean {
  if (Math.abs(y - ROOF_DECK_Y) > ROOF_FLIGHT_PAD_II_Y_TOLERANCE) return false;
  const dx = x - ROOF_FLIGHT_PAD_II_CENTER[0];
  const dz = z - ROOF_FLIGHT_PAD_II_CENTER[2];
  return dx * dx + dz * dz <= ROOF_FLIGHT_PAD_II_RADIUS * ROOF_FLIGHT_PAD_II_RADIUS;
}

/** Height of the west barrel wing (including standing-seam rib allowance) at X, or null outside it. */
export function westBarrelPeakAtX(x: number): number | null {
  const u = (x - WEST_BARREL_CENTER_X) / WEST_BARREL_HALF_WIDTH;
  if (Math.abs(u) > 1) return null;
  return WEST_BARREL_BASE_Y + WEST_BARREL_RISE * Math.sqrt(Math.max(0, 1 - u * u)) + WEST_BARREL_RIB_ALLOWANCE;
}

/** Surface height along the West Flank ramp/landing spine at Z, or null outside. */
export function westFlankSurfaceYAtZ(z: number): number | null {
  if (z >= WEST_LOWER_RAMP.minZ && z <= WEST_LOWER_RAMP.maxZ) {
    const t = (z - WEST_LOWER_RAMP.minZ) / (WEST_LOWER_RAMP.maxZ - WEST_LOWER_RAMP.minZ);
    return WEST_LOWER_RAMP.yAtMin + (WEST_LOWER_RAMP.yAtMax - WEST_LOWER_RAMP.yAtMin) * t;
  }
  if (z >= WEST_MID_LANDING.minZ && z < WEST_MID_LANDING.maxZ) {
    return WEST_MID_LANDING.y;
  }
  if (z >= WEST_UPPER_RAMP.minZ && z < WEST_UPPER_RAMP.maxZ) {
    const t = (z - WEST_UPPER_RAMP.minZ) / (WEST_UPPER_RAMP.maxZ - WEST_UPPER_RAMP.minZ);
    return WEST_UPPER_RAMP.yAtMin + (WEST_UPPER_RAMP.yAtMax - WEST_UPPER_RAMP.yAtMin) * t;
  }
  if (z >= WEST_UPPER_BRIDGE_LANDING.minZ && z < WEST_UPPER_BRIDGE_LANDING.maxZ) {
    return WEST_UPPER_BRIDGE_LANDING.y;
  }
  return null;
}

/** Canonical traversal waypoints for tests and wayfinding verification. */
export const ROOF_WAYPOINTS = {
  path5Entry: WEST_ASCENT_ENTRY,
  lowerRampFoot: [-41.25, ROOF_GROUND_Y, 112.0] as Vec3,
  midLanding: [-41.25, ROOF_MID_LANDING_Y, 52.0] as Vec3,
  upperRampTop: [-41.25, ROOF_DECK_Y, -4.0] as Vec3,
  upperBridgeWest: [-41.25, ROOF_DECK_Y, -7.0] as Vec3,
  upperBridgeEast: [-36.25, ROOF_DECK_Y, -7.0] as Vec3,
  westWalkwayMid: [-36.25, ROOF_DECK_Y, 10.0] as Vec3,
  westWalkwaySouth: [-36.25, ROOF_DECK_Y, 26.0] as Vec3,
  greenhouseDoorApproach: [-26.0, ROOF_DECK_Y, 26.0] as Vec3,
  greenhouseDoor: [-26.0, ROOF_DECK_Y, 22.0] as Vec3,
  greenhouseFlowerApproach: [-26.0, ROOF_DECK_Y, 13.5] as Vec3,
  promenadeMid: [-20.0, ROOF_DECK_Y, 28.0] as Vec3,
  cafeCenter: [-0.75, ROOF_DECK_Y, 29.0] as Vec3,
  hotDogCounter: HOT_DOG_STAND_VISITOR_SPOT,
  cafeSouthAisle: [0.0, ROOF_DECK_Y, 42.0] as Vec3,
  flightPadII: ROOF_FLIGHT_PAD_II_CENTER,
  flightPadPedestalSpot: [-3.0, ROOF_DECK_Y, 51.5] as Vec3,
} as const;

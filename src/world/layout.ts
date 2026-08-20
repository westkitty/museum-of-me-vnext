import type { WingId } from '../content/types';

/**
 * THE MUSEUM'S SPATIAL SPINE.
 *
 * Pure data and pure maths — no Three.js. Geometry, collision, streaming zones,
 * the map, wayfinding and exhibit anchors are all derived from this one module,
 * so the building can never disagree with itself.
 *
 * Coordinate system: Y up, −Z north, +X east, +Z south, −X west. Metres.
 */

export type Vec3 = readonly [number, number, number];

export interface Box {
  /** Centre. */
  readonly c: Vec3;
  /** Half-extents. */
  readonly h: Vec3;
}

// ── Rotunda ────────────────────────────────────────────────────────────────

/** Inner apothem of the octagon: wall face sits 16 m from the centre. */
export const ROTUNDA_APOTHEM = 16;
export const ROTUNDA_WALL = 1.2;
/** Balcony floor height. Two architectural levels. */
export const LEVEL_1_Y = 10;
/** Inner edge of the balcony ring — the atrium opening. */
export const BALCONY_INNER_APOTHEM = 11;
/** Where the dome springs from the drum. */
export const DOME_SPRING_Y = 19;
/** Interior apex. Plan §6.3 asks for roughly 25 m floor-to-dome. */
export const DOME_APEX_Y = 25;
export const GROUND_Y = 0;

/** The eight octagon faces, by compass bearing. Index 0 is north. */
export const OCTAGON_FACES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type OctagonFace = (typeof OCTAGON_FACES)[number];

/** Outward unit normal of each octagon face. */
export function faceDirection(face: OctagonFace): Vec3 {
  const i = OCTAGON_FACES.indexOf(face);
  const a = (i * Math.PI) / 4;
  // i=0 → north (0,0,−1); rotating clockwise when viewed from above.
  return [Math.sin(a), 0, -Math.cos(a)];
}

/** Right-hand vector when walking along `dir` with Y up. */
export function rightOf(dir: Vec3): Vec3 {
  return [-dir[2], 0, dir[0]];
}

export function add(a: Vec3, b: Vec3, s = 1): Vec3 {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

/** Point at `along` metres outward from the centre plus `lateral` metres right. */
export function place(dir: Vec3, along: number, lateral = 0, y = 0): Vec3 {
  const r = rightOf(dir);
  return [dir[0] * along + r[0] * lateral, y, dir[2] * along + r[2] * lateral];
}

// ── Wings ──────────────────────────────────────────────────────────────────

export interface BaySpec {
  /** 0-based index along the hall, outward from the rotunda. */
  readonly slot: number;
  readonly side: 'left' | 'right';
  /** Half-width along the hall axis. */
  readonly halfAlong: number;
  /** Depth outward from the hall wall. */
  readonly depth: number;
  readonly height: number;
}

export interface WingSpec {
  readonly id: WingId;
  readonly face: OctagonFace;
  readonly level: 0 | 1;
  /** Floor height of this wing. */
  readonly floorY: number;
  /** Clear opening of the threshold arch. */
  readonly archWidth: number;
  readonly archHeight: number;
  /** Connector corridor: from the rotunda wall out to the hall. */
  readonly corridorFrom: number;
  readonly corridorTo: number;
  readonly corridorHalfWidth: number;
  /** Main hall. */
  readonly hallFrom: number;
  readonly hallTo: number;
  readonly hallHalfWidth: number;
  readonly hallHeight: number;
  /** Distance between bay centres along the hall. */
  readonly bayPitch: number;
  /** Distance from `hallFrom` to the first bay centre. */
  readonly bayLead: number;
  readonly bayDepth: number;
  readonly bayHalfAlong: number;
  readonly bayHeight: number;
  /** Clear opening between hall and bay. */
  readonly bayOpening: number;
  /** Exhibit IDs in visitor order, alternating left/right outward. */
  readonly exhibits: readonly string[];
}

const BAY_PITCH = 18;
const BAY_LEAD = 9;
const BAY_DEPTH = 16;
const BAY_HALF_ALONG = 8;
const BAY_OPENING = 9;

export const WINGS: readonly WingSpec[] = [
  {
    id: 'north', face: 'n', level: 0, floorY: GROUND_Y,
    archWidth: 10, archHeight: 8,
    corridorFrom: ROTUNDA_APOTHEM, corridorTo: 24, corridorHalfWidth: 5,
    hallFrom: 24, hallTo: 96, hallHalfWidth: 8, hallHeight: 14,
    bayPitch: BAY_PITCH, bayLead: BAY_LEAD, bayDepth: BAY_DEPTH,
    bayHalfAlong: BAY_HALF_ALONG, bayHeight: 12, bayOpening: BAY_OPENING,
    exhibits: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08'],
  },
  {
    id: 'east', face: 'e', level: 0, floorY: GROUND_Y,
    archWidth: 9, archHeight: 7,
    corridorFrom: ROTUNDA_APOTHEM, corridorTo: 24, corridorHalfWidth: 4.5,
    hallFrom: 24, hallTo: 96, hallHalfWidth: 7, hallHeight: 10,
    bayPitch: BAY_PITCH, bayLead: BAY_LEAD, bayDepth: BAY_DEPTH,
    bayHalfAlong: BAY_HALF_ALONG, bayHeight: 9, bayOpening: BAY_OPENING,
    exhibits: ['E17', 'E18', 'E19', 'E20', 'E21', 'E22', 'E23'],
  },
  {
    id: 'south', face: 's', level: 0, floorY: GROUND_Y,
    archWidth: 11, archHeight: 8,
    corridorFrom: ROTUNDA_APOTHEM, corridorTo: 24, corridorHalfWidth: 5.5,
    hallFrom: 24, hallTo: 114, hallHalfWidth: 9, hallHeight: 11,
    bayPitch: BAY_PITCH, bayLead: BAY_LEAD, bayDepth: BAY_DEPTH,
    bayHalfAlong: BAY_HALF_ALONG, bayHeight: 10, bayOpening: BAY_OPENING,
    exhibits: ['E24', 'E25', 'E26', 'E27', 'E28', 'E29', 'E30', 'E31', 'E32', 'E33'],
  },
  {
    id: 'west', face: 'w', level: 0, floorY: GROUND_Y,
    archWidth: 9, archHeight: 7,
    corridorFrom: ROTUNDA_APOTHEM, corridorTo: 24, corridorHalfWidth: 4.5,
    hallFrom: 24, hallTo: 60, hallHalfWidth: 7, hallHeight: 10,
    bayPitch: BAY_PITCH, bayLead: BAY_LEAD, bayDepth: BAY_DEPTH,
    bayHalfAlong: BAY_HALF_ALONG, bayHeight: 9, bayOpening: BAY_OPENING,
    exhibits: ['E09', 'E10', 'E11', 'E12'],
  },
  {
    id: 'media', face: 'nw', level: 1, floorY: LEVEL_1_Y,
    archWidth: 8, archHeight: 6.5,
    corridorFrom: ROTUNDA_APOTHEM, corridorTo: 26, corridorHalfWidth: 4,
    hallFrom: 26, hallTo: 62, hallHalfWidth: 6.5, hallHeight: 8,
    bayPitch: BAY_PITCH, bayLead: BAY_LEAD, bayDepth: 14,
    bayHalfAlong: 7, bayHeight: 7.5, bayOpening: 8,
    exhibits: ['E13', 'E14', 'E15', 'E16'],
  },
  {
    id: 'infra', face: 'ne', level: 1, floorY: LEVEL_1_Y,
    archWidth: 8, archHeight: 6.5,
    corridorFrom: ROTUNDA_APOTHEM, corridorTo: 26, corridorHalfWidth: 4,
    hallFrom: 26, hallTo: 48, hallHalfWidth: 6.5, hallHeight: 9,
    bayPitch: BAY_PITCH, bayLead: BAY_LEAD, bayDepth: 18,
    bayHalfAlong: 9, bayHeight: 8.5, bayOpening: 9,
    exhibits: ['E34', 'E35'],
  },
];

export const WING_BY_ID = new Map(WINGS.map((w) => [w.id, w]));

/**
 * Which bay an exhibit occupies. Visitors meet exhibits in numeric order by
 * alternating sides as they walk outward, which keeps the route legible.
 */
export function bayForIndex(index: number): { slot: number; side: 'left' | 'right' } {
  return { slot: Math.floor(index / 2), side: index % 2 === 0 ? 'left' : 'right' };
}

export interface ExhibitPlacement {
  readonly exhibitId: string;
  readonly wing: WingId;
  readonly slot: number;
  readonly side: 'left' | 'right';
  /** Centre of the bay floor. The hero object stands here. */
  readonly anchor: Vec3;
  /** In the hall, directly outside the bay opening. */
  readonly doorway: Vec3;
  /** Inside the bay, in front of the hero object — where a visitor stands. */
  readonly visitorSpot: Vec3;
  /** Axis-aligned bounds the exhibit owns. */
  readonly bounds: Box;
  /** Outward direction of the wing, for orienting the hero object. */
  readonly facing: Vec3;
}

/** Resolve every exhibit's world placement from the wing specs. */
export function computePlacements(): readonly ExhibitPlacement[] {
  const out: ExhibitPlacement[] = [];
  for (const w of WINGS) {
    const dir = faceDirection(w.face);
    w.exhibits.forEach((exhibitId, i) => {
      const { slot, side } = bayForIndex(i);
      const r = rightOf(dir);
      const along = w.hallFrom + w.bayLead + slot * w.bayPitch;
      const sign = side === 'right' ? 1 : -1;
      const lateral = sign * (w.hallHalfWidth + w.bayDepth / 2);
      // Just inside the hall, clear of the wall plane.
      const doorLateral = sign * (w.hallHalfWidth - 1.2);
      out.push({
        exhibitId,
        wing: w.id,
        slot,
        side,
        anchor: place(dir, along, lateral, w.floorY),
        doorway: place(dir, along, doorLateral, w.floorY),
        visitorSpot: place(dir, along, sign * (w.hallHalfWidth + 3.2), w.floorY),
        bounds: {
          c: place(dir, along, lateral, w.floorY + w.bayHeight / 2),
          h: bayHalfExtents(dir, w),
        },
        // The hero object faces back toward the hall, greeting the visitor.
        facing: [-sign * r[0], 0, -sign * r[2]],
      });
    });
  }
  return out;
}

/**
 * Half-extents of a bay in world axes. Wings on diagonal faces are rotated, so
 * the axis-aligned bound is the rotated box's enclosing extent — deliberately
 * slightly generous, which is correct for streaming and activation tests.
 */
function bayHalfExtents(dir: Vec3, w: WingSpec): Vec3 {
  const r = rightOf(dir);
  const a = w.bayHalfAlong;
  const d = w.bayDepth / 2;
  const hx = Math.abs(dir[0]) * a + Math.abs(r[0]) * d;
  const hz = Math.abs(dir[2]) * a + Math.abs(r[2]) * d;
  return [hx, w.bayHeight / 2, hz];
}

export const PLACEMENTS = computePlacements();
export const PLACEMENT_BY_EXHIBIT = new Map(PLACEMENTS.map((p) => [p.exhibitId, p]));

// ── Entrance, plaza, and the main axis ─────────────────────────────────────

export const SOUTH = WING_BY_ID.get('south')!;
/** Vestibule between the south hall and the outside world. */
export const VESTIBULE_FROM = SOUTH.hallTo;
export const VESTIBULE_TO = SOUTH.hallTo + 14;
export const ENTRANCE_DOOR: Vec3 = place(faceDirection('s'), VESTIBULE_TO, 0, GROUND_Y);
/** Where a visitor is standing when the museum opens. */
export const SPAWN_POSITION: Vec3 = place(faceDirection('s'), VESTIBULE_TO - 5, 0, GROUND_Y);
/** Facing: looking north, up the main axis toward the Rotunda. */
export const SPAWN_YAW = 0;
export const PLAZA_DEPTH = 30;
export const PLAZA_HALF_WIDTH = 34;

// ── Dexter Sanctuary ───────────────────────────────────────────────────────

/**
 * Plan §7: slightly below and behind the central Rotunda axis, reached through a
 * quieter threshold. It descends from the north-west face, passing beneath
 * nothing and arriving in its own quiet volume. It is NOT one of the 35.
 */
export const SANCTUARY_FACE: OctagonFace = 'nw';
export const SANCTUARY_DIR = faceDirection(SANCTUARY_FACE);
export const SANCTUARY_RAMP_FROM = ROTUNDA_APOTHEM;
export const SANCTUARY_RAMP_TO = ROTUNDA_APOTHEM + 30;
export const SANCTUARY_FLOOR_Y = -5;
export const SANCTUARY_RAMP_HALF_WIDTH = 3;
export const SANCTUARY_RADIUS = 14;
export const SANCTUARY_HEIGHT = 9;
export const SANCTUARY_CENTER: Vec3 = place(
  SANCTUARY_DIR,
  SANCTUARY_RAMP_TO + SANCTUARY_RADIUS - 2,
  0,
  SANCTUARY_FLOOR_Y,
);

// ── Vertical circulation ───────────────────────────────────────────────────

export interface StairSpec {
  readonly id: string;
  /** Octagon face the stair runs along the inside of. */
  readonly face: OctagonFace;
  readonly fromY: number;
  readonly toY: number;
  readonly halfWidth: number;
  /** Distance from centre at the foot and at the head. */
  readonly footAlong: number;
  readonly headAlong: number;
  /** Lateral offset of the stair's centreline. */
  readonly lateral: number;
  /** Run length along the lateral axis. */
  readonly run: number;
}

/**
 * Two grand stairs rise along the inside of the south-west and south-east walls
 * to the balcony. Both carry ramp collision beneath the visible steps (plan §21),
 * so the capsule controller walks them without a jump and they double as the
 * accessible route.
 */
export const STAIRS: readonly StairSpec[] = [
  {
    id: 'grand-stair-sw', face: 'sw', fromY: GROUND_Y, toY: LEVEL_1_Y,
    halfWidth: 3, footAlong: 13.5, headAlong: 13.5, lateral: -2, run: 26,
  },
  {
    id: 'grand-stair-se', face: 'se', fromY: GROUND_Y, toY: LEVEL_1_Y,
    halfWidth: 3, footAlong: 13.5, headAlong: 13.5, lateral: 2, run: 26,
  },
];

// ── Zones (streaming, audio, wayfinding, the map) ──────────────────────────

export type ZoneId = 'rotunda' | 'plaza' | 'sanctuary' | 'balcony' | WingId;

/**
 * Zone volumes. Wings run on diagonals, so an axis-aligned box would swallow the
 * Rotunda; each zone therefore declares the shape that actually describes it.
 */
export type ZoneShape =
  | { readonly kind: 'box'; readonly c: Vec3; readonly h: Vec3 }
  | { readonly kind: 'cylinder'; readonly c: Vec3; readonly radius: number; readonly yMin: number; readonly yMax: number }
  | {
      readonly kind: 'slab';
      readonly dir: Vec3;
      readonly alongMin: number;
      readonly alongMax: number;
      readonly halfWidth: number;
      readonly yMin: number;
      readonly yMax: number;
    };

export interface Zone {
  readonly id: ZoneId;
  readonly label: string;
  readonly shape: ZoneShape;
  /** A representative standing point — used by the map and by wayfinding. */
  readonly center: Vec3;
  /** Zones whose Layer-2 detail should also be resident while inside this one. */
  readonly neighbours: readonly ZoneId[];
  readonly level: 0 | 1;
}

export function shapeContains(shape: ZoneShape, p: Vec3): boolean {
  switch (shape.kind) {
    case 'box':
      return (
        Math.abs(p[0] - shape.c[0]) <= shape.h[0] &&
        Math.abs(p[1] - shape.c[1]) <= shape.h[1] &&
        Math.abs(p[2] - shape.c[2]) <= shape.h[2]
      );
    case 'cylinder': {
      if (p[1] < shape.yMin || p[1] > shape.yMax) return false;
      const dx = p[0] - shape.c[0];
      const dz = p[2] - shape.c[2];
      return dx * dx + dz * dz <= shape.radius * shape.radius;
    }
    case 'slab': {
      if (p[1] < shape.yMin || p[1] > shape.yMax) return false;
      const along = p[0] * shape.dir[0] + p[2] * shape.dir[2];
      if (along < shape.alongMin || along > shape.alongMax) return false;
      const r = rightOf(shape.dir);
      const lateral = p[0] * r[0] + p[2] * r[2];
      return Math.abs(lateral) <= shape.halfWidth;
    }
  }
}

function wingShape(w: WingSpec): ZoneShape {
  // The south wing owns its vestibule, so arriving visitors are already inside.
  const outer = w.id === 'south' ? VESTIBULE_TO : w.hallTo;
  return {
    kind: 'slab',
    dir: faceDirection(w.face),
    alongMin: ROTUNDA_APOTHEM - 0.5,
    alongMax: outer + 1,
    halfWidth: w.hallHalfWidth + w.bayDepth + 1,
    yMin: w.floorY - 1,
    yMax: w.floorY + w.hallHeight + 2,
  };
}

export const ZONES: readonly Zone[] = [
  {
    id: 'rotunda', label: 'Reliquary Rotunda', level: 0,
    shape: { kind: 'cylinder', c: [0, 0, 0], radius: ROTUNDA_APOTHEM + 1.5, yMin: -1.5, yMax: LEVEL_1_Y - 0.5 },
    center: [0, GROUND_Y, 0],
    neighbours: ['north', 'east', 'south', 'west', 'balcony', 'sanctuary'],
  },
  {
    id: 'balcony', label: 'Rotunda Balcony', level: 1,
    shape: { kind: 'cylinder', c: [0, 0, 0], radius: ROTUNDA_APOTHEM + 1.5, yMin: LEVEL_1_Y - 0.5, yMax: LEVEL_1_Y + 8 },
    center: [0, LEVEL_1_Y, ROTUNDA_APOTHEM - 3],
    neighbours: ['rotunda', 'media', 'infra'],
  },
  {
    id: 'plaza', label: 'Arrival Plaza', level: 0,
    shape: {
      kind: 'slab',
      dir: faceDirection('s'),
      alongMin: VESTIBULE_TO + 1,
      alongMax: VESTIBULE_TO + PLAZA_DEPTH + 12,
      halfWidth: PLAZA_HALF_WIDTH + 6,
      yMin: -4,
      yMax: 14,
    },
    center: place(faceDirection('s'), VESTIBULE_TO + 10, 0, GROUND_Y),
    neighbours: ['south'],
  },
  {
    id: 'sanctuary', label: 'Dexter Sanctuary', level: 0,
    shape: {
      kind: 'slab',
      dir: SANCTUARY_DIR,
      alongMin: ROTUNDA_APOTHEM + 1,
      alongMax: SANCTUARY_RAMP_TO + SANCTUARY_RADIUS * 2,
      halfWidth: SANCTUARY_RADIUS + 2,
      yMin: SANCTUARY_FLOOR_Y - 2,
      yMax: SANCTUARY_FLOOR_Y + SANCTUARY_HEIGHT + 2,
    },
    center: SANCTUARY_CENTER,
    neighbours: ['rotunda'],
  },
  ...WINGS.map(
    (w): Zone => ({
      id: w.id,
      label: w.id,
      level: w.level,
      shape: wingShape(w),
      center: place(faceDirection(w.face), (w.hallFrom + w.hallTo) / 2, 0, w.floorY),
      neighbours: w.level === 0 ? ['rotunda'] : ['balcony'],
    }),
  ),
];

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));

/**
 * Which zone the visitor is in. Wings and the Sanctuary are tested before the
 * Rotunda, so a threshold reads as belonging to the space you are walking into.
 * Outside every volume the nearest zone centre wins.
 */
const ZONE_TEST_ORDER: readonly Zone[] = [
  ...ZONES.filter((z) => z.id !== 'rotunda' && z.id !== 'balcony'),
  ...ZONES.filter((z) => z.id === 'rotunda' || z.id === 'balcony'),
];

export function zoneAt(p: Vec3): ZoneId {
  for (const z of ZONE_TEST_ORDER) if (shapeContains(z.shape, p)) return z.id;
  let best: ZoneId = 'plaza';
  let bestDist = Infinity;
  for (const z of ZONES) {
    const d = (p[0] - z.center[0]) ** 2 + (p[2] - z.center[2]) ** 2 + (p[1] - z.center[1]) ** 2 * 4;
    if (d < bestDist) {
      bestDist = d;
      best = z.id;
    }
  }
  return best;
}

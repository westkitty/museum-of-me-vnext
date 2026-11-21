import {
  ATRIUM_FRONT_Z, ATRIUM_INNER_OPENING_HEIGHT, ATRIUM_INNER_OPENING_WIDTH, ENTRANCE_PORTAL_Z, GROUND_Y,
  LEVEL_1_Y, OBSIDIAN_SPHERE_CENTER_Z, PLACEMENTS, PORTAL_HEIGHT, PORTAL_WIDTH, ROTUNDA_APOTHEM,
  SANCTUARY_DIR, SANCTUARY_FLOOR_Y, SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_HALF_WIDTH, SANCTUARY_RAMP_TO,
  SOUTH, STAIRS, TICKET_KIOSK_POSITION, VESTIBULE_TO, WINGS, faceDirection, place, stairArcPoint,
  stairLanding, type Vec3,
} from './layout';
import { bayOpeningSpan } from './installationPlacement';
import {
  CINEMA_ENTRY_Y, CINEMA_FLOOR_Y, CINEMA_THRESHOLD_HEIGHT, CINEMA_THRESHOLD_WIDTH, ENTRY_DOOR, EXIT_DOOR, EXIT_PASSAGE,
  FRONT_ZONE_TO_X, LIGHT_LOCK, LOBBY, NORTH_AISLE, REAR_PLATFORM,
} from './cinemaLayout';

/**
 * The museum's visitor-accessible passages, derived from the same layout
 * authority that builds the architecture. Every doorway, arch, bay opening,
 * stair, ramp and threshold a visitor can use is listed here once, with
 * walking lanes across its usable width, so a traversal harness can walk each
 * one in both directions with the real player controller and collision world.
 *
 * This module only describes geometry; it never moves anyone and never builds
 * or edits collision.
 */

/** Player capsule radius and height (mirrors PlayerController; kept here so the
 * inventory has no runtime dependency on the controller). */
export const CAPSULE_RADIUS = 0.35;
export const CAPSULE_HEIGHT = 1.78;
/** Extra margin a passage must give beyond the capsule on each side. */
export const CLEARANCE_TOLERANCE = 0.15;

export type PassageKind =
  | 'exterior-approach' | 'kiosk' | 'sphere-aperture' | 'sphere-route' | 'world-seam'
  | 'atrium-portal' | 'vestibule' | 'wing-arch' | 'corridor-hall' | 'exhibit-bay'
  | 'stair' | 'sanctuary' | 'cinema';

export interface PassageLane {
  /** Signed offset across the aperture from its centreline, metres. */
  readonly offset: number;
  /** Waypoints from the origin side to the destination side. Walked in reverse for the return. */
  readonly path: readonly Vec3[];
}

export interface Passage {
  readonly id: string;
  readonly kind: PassageKind;
  /** World the walk starts in. A world seam starts outside and ends inside. */
  readonly world: 'exterior' | 'interior';
  readonly origin: string;
  readonly destination: string;
  /** Centre of the usable aperture and its clear opening. */
  readonly aperture: { readonly center: Vec3; readonly width: number; readonly height: number };
  /** Clear width the capsule needs, with tolerance on both sides. */
  readonly requiredWidth: number;
  readonly lanes: readonly PassageLane[];
  /** Exhibit served by this passage, if any. */
  readonly exhibitId?: string;
  /** Where the visitor stands to engage the exhibit/kiosk, reached on the centre lane. */
  readonly interaction?: Vec3;
}

const REQUIRED_WIDTH = 2 * (CAPSULE_RADIUS + CLEARANCE_TOLERANCE);
/** How far past a bay's wall line a lane must reach to have crossed its threshold. */
export const BAY_THRESHOLD_DEPTH = 1.0;

/** Lane offsets for an aperture whose clear half-width is `halfClear`. */
function laneOffsets(halfClear: number): number[] {
  const edge = halfClear - CAPSULE_RADIUS - CLEARANCE_TOLERANCE;
  if (edge <= 0.05) return [0];
  return [0, -edge, edge].map((v) => Math.round(v * 1000) / 1000);
}

function shift(p: Vec3, axis: Vec3, by: number): Vec3 {
  return [p[0] + axis[0] * by, p[1], p[2] + axis[2] * by];
}

/** Right-hand lateral of an outward wing direction. */
function lateralOf(dir: Vec3): Vec3 {
  return [-dir[2], 0, dir[0]];
}

export function buildPassageInventory(): readonly Passage[] {
  const out: Passage[] = [];
  const add = (p: Omit<Passage, 'requiredWidth'>) => out.push({ ...p, requiredWidth: REQUIRED_WIDTH });

  // ── Exterior arrival, kiosk and the obsidian sphere ────────────────────────
  const sphere = OBSIDIAN_SPHERE_CENTER_Z;
  const kiosk = TICKET_KIOSK_POSITION;
  add({
    id: 'exterior:kiosk', kind: 'kiosk', world: 'exterior',
    origin: 'arrival plaza', destination: 'ticket kiosk',
    aperture: { center: kiosk, width: 3, height: 3 },
    lanes: [{ offset: 0, path: [[0, GROUND_Y, 166], [kiosk[0] + 1.6, GROUND_Y, kiosk[2] + 1.4]] }],
    interaction: [kiosk[0] + 1.6, GROUND_Y, kiosk[2] + 1.4],
  });
  // The outer aperture is a gap in the curved wall (open sectors span about
  // ±3.49 m); the inner aperture is the same shape on the far side.
  const sphereHalf = 3.49;
  add({
    id: 'exterior:sphere-outer-aperture', kind: 'sphere-aperture', world: 'exterior',
    origin: 'arrival plaza', destination: 'obsidian sphere',
    aperture: { center: [0, GROUND_Y, sphere + 9.15], width: sphereHalf * 2, height: 5.18 },
    lanes: laneOffsets(sphereHalf).map((o) => ({ offset: o, path: [[o, GROUND_Y, sphere + 13.5], [o, GROUND_Y, sphere + 6.2]] })),
  });
  for (const side of [-1, 1] as const) {
    // Lanes are radii around the solid column, from its flank to the wall.
    const radii = [4.6, 6.2, 7.9];
    add({
      id: `exterior:sphere-${side < 0 ? 'west' : 'east'}-route`, kind: 'sphere-route', world: 'exterior',
      origin: 'sphere outer aperture', destination: 'sphere inner aperture',
      aperture: { center: [side * 6.2, GROUND_Y, sphere], width: 8.78 - 2.95, height: 6 },
      lanes: radii.map((r) => ({
        offset: r,
        path: [
          [0, GROUND_Y, sphere + 7.4],
          [side * r * 0.62, GROUND_Y, sphere + r * 0.78],
          [side * r, GROUND_Y, sphere],
          [side * r * 0.62, GROUND_Y, sphere - r * 0.78],
          [0, GROUND_Y, sphere - 7.4],
        ],
      })),
    });
  }
  // The physical doorway that carries the visitor into the atrium. Walked
  // across worlds by the harness: exterior z → interior z + SEAM_OFFSET_Z.
  add({
    id: 'seam:sphere-to-atrium', kind: 'world-seam', world: 'exterior',
    origin: 'sphere inner aperture (exterior)', destination: 'atrium front door (interior)',
    aperture: { center: [0, GROUND_Y, ENTRANCE_PORTAL_Z], width: PORTAL_WIDTH, height: PORTAL_HEIGHT },
    lanes: laneOffsets(PORTAL_WIDTH / 2).map((o) => ({
      offset: o, path: [[o, GROUND_Y, ENTRANCE_PORTAL_Z + 4], [o, GROUND_Y, ATRIUM_FRONT_Z - 4]],
    })),
  });

  // ── Atrium and vestibule ───────────────────────────────────────────────────
  add({
    id: 'interior:atrium-inner-portal', kind: 'atrium-portal', world: 'interior',
    origin: 'entrance atrium', destination: 'vestibule',
    aperture: { center: [0, GROUND_Y, VESTIBULE_TO], width: ATRIUM_INNER_OPENING_WIDTH, height: ATRIUM_INNER_OPENING_HEIGHT },
    lanes: laneOffsets(ATRIUM_INNER_OPENING_WIDTH / 2).map((o) => ({
      offset: o, path: [[o, GROUND_Y, VESTIBULE_TO + 4], [o, GROUND_Y, VESTIBULE_TO - 4]],
    })),
  });
  const southEnd = SOUTH.hallTo;
  add({
    id: 'interior:vestibule-to-south-hall', kind: 'vestibule', world: 'interior',
    origin: 'vestibule', destination: 'south hall',
    aperture: { center: [0, GROUND_Y, southEnd], width: 8, height: 6 },
    lanes: laneOffsets(4).map((o) => ({ offset: o, path: [[o, GROUND_Y, southEnd + 4], [o, GROUND_Y, southEnd - 4]] })),
  });

  // ── Wings: rotunda/balcony arch, corridor into hall, every exhibit bay ─────
  for (const w of WINGS) {
    const dir = faceDirection(w.face);
    const lat = lateralOf(dir);
    const y = w.floorY;
    const ring = w.level === 0 ? 'rotunda' : 'balcony';
    // Ground arches open the rotunda wall; upper arches open the balcony drum.
    const archHalf = Math.min(w.archWidth / 2, w.corridorHalfWidth);
    add({
      id: `interior:${w.id}:arch`, kind: 'wing-arch', world: 'interior',
      origin: ring, destination: `${w.id} corridor`,
      aperture: { center: place(dir, ROTUNDA_APOTHEM, 0, y), width: w.archWidth, height: w.archHeight },
      lanes: laneOffsets(archHalf - 0.3).map((o) => ({
        offset: o,
        path: [shift(place(dir, ROTUNDA_APOTHEM - (w.level === 0 ? 4 : 3), 0, y), lat, o), shift(place(dir, ROTUNDA_APOTHEM + 4, 0, y), lat, o)],
      })),
    });
    add({
      id: `interior:${w.id}:corridor-hall`, kind: 'corridor-hall', world: 'interior',
      origin: `${w.id} corridor`, destination: `${w.id} hall`,
      aperture: { center: place(dir, w.corridorTo, 0, y), width: w.corridorHalfWidth * 2, height: w.archHeight },
      lanes: laneOffsets(w.corridorHalfWidth - 0.3).map((o) => ({
        offset: o,
        path: [shift(place(dir, w.corridorTo - 3, 0, y), lat, o), shift(place(dir, w.corridorTo + 3, 0, y), lat, o)],
      })),
    });
  }
  for (const placement of PLACEMENTS) {
    const w = WINGS.find((wing) => wing.id === placement.wing)!;
    const dir = faceDirection(w.face);
    const sign = placement.side === 'right' ? 1 : -1;
    const along = w.hallFrom + w.bayLead + placement.slot * w.bayPitch;
    const y = w.floorY;
    const span = bayOpeningSpan(placement.exhibitId);
    add({
      id: `interior:${w.id}:bay:${placement.exhibitId}`, kind: 'exhibit-bay', world: 'interior',
      origin: `${w.id} hall`, destination: `${placement.exhibitId} bay`,
      exhibitId: placement.exhibitId,
      aperture: { center: place(dir, along + (span.from + span.to) / 2, sign * w.hallHalfWidth, y), width: span.to - span.from, height: w.bayHeight * 0.72 },
      lanes: laneOffsets((span.to - span.from) / 2).map((o) => o + (span.from + span.to) / 2).map((o) => ({
        offset: o,
        // Through the threshold: wall face (0.3 m) plus one capsule diameter.
        // The centre lane goes on to the visitor spot (`interaction`).
        path: [place(dir, along + o, sign * (w.hallHalfWidth - 2), y), place(dir, along + o, sign * (w.hallHalfWidth + BAY_THRESHOLD_DEPTH), y)],
      })),
      interaction: placement.visitorSpot,
    });
  }

  // ── Vertical circulation ───────────────────────────────────────────────────
  for (const stair of STAIRS) {
    const lanes = laneOffsets(stair.halfWidth).map((o) => {
      const at = (t: number): Vec3 => {
        const p = stairArcPoint(stair, t);
        const r = Math.hypot(p[0], p[2]);
        return [p[0] * (r + o) / r, p[1], p[2] * (r + o) / r];
      };
      // Approach from the rotunda ring, then onto the stair from the front on
      // the lane's own line (a little before the foot), never sideways across
      // the first treads.
      const before = stairArcPoint(stair, -0.2);
      const beforeR = Math.hypot(before[0], before[2]);
      const approach: Vec3 = [before[0] * 10.6 / beforeR, GROUND_Y, before[2] * 10.6 / beforeR];
      const lead: Vec3 = [before[0] * (beforeR + o) / beforeR, GROUND_Y, before[2] * (beforeR + o) / beforeR];
      const arc = Array.from({ length: stair.collisionSegments + 1 }, (_, i) => at(i / stair.collisionSegments));
      return { offset: o, path: [approach, lead, ...arc, stairLanding(stair)] };
    });
    add({
      id: `interior:${stair.id}`, kind: 'stair', world: 'interior',
      origin: 'rotunda floor', destination: 'balcony',
      aperture: { center: stairArcPoint(stair, 0.5), width: stair.halfWidth * 2, height: LEVEL_1_Y },
      lanes,
    });
  }
  const sLat = lateralOf(SANCTUARY_DIR);
  add({
    id: 'interior:sanctuary-ramp', kind: 'sanctuary', world: 'interior',
    origin: 'rotunda', destination: 'Dexter Sanctuary',
    aperture: { center: place(SANCTUARY_DIR, ROTUNDA_APOTHEM, 0, GROUND_Y), width: 5, height: 4.6 },
    lanes: laneOffsets(Math.min(2.5, SANCTUARY_RAMP_HALF_WIDTH - 0.3)).map((o) => ({
      offset: o,
      path: [
        shift(place(SANCTUARY_DIR, ROTUNDA_APOTHEM - 4, 0, GROUND_Y), sLat, o),
        shift(place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM + 1, 0, GROUND_Y), sLat, o),
        shift(place(SANCTUARY_DIR, SANCTUARY_RAMP_TO, 0, SANCTUARY_FLOOR_Y), sLat, o),
        shift(place(SANCTUARY_DIR, SANCTUARY_RAMP_TO + 4, 0, SANCTUARY_FLOOR_Y), sLat, o),
      ],
    })),
  });

  // ── Museum Cinema (src/world/cinemaLayout.ts) ───────────────────────────
  const cinema = (id: string, origin: string, destination: string, center: Vec3, width: number, height: number, lanes: PassageLane[]) =>
    add({ id: `interior:cinema:${id}`, kind: 'cinema', world: 'interior', origin, destination, aperture: { center, width, height }, lanes });
  const across = (halfClear: number, path: (o: number) => Vec3[]): PassageLane[] =>
    laneOffsets(halfClear).map((o) => ({ offset: o, path: path(o) }));
  cinema('threshold', 'balcony', 'cinema lobby', [ROTUNDA_APOTHEM, CINEMA_ENTRY_Y, 0], CINEMA_THRESHOLD_WIDTH, CINEMA_THRESHOLD_HEIGHT,
    across(CINEMA_THRESHOLD_WIDTH / 2, (o) => [[ROTUNDA_APOTHEM - 3.4, CINEMA_ENTRY_Y, o], [ROTUNDA_APOTHEM + 3, CINEMA_ENTRY_Y, o]]));
  cinema('lobby-ramp', 'cinema lobby', 'auditorium doors', [(LOBBY.rampFromX + LOBBY.rampToX) / 2, CINEMA_ENTRY_Y, 0], LOBBY.maxZ - LOBBY.minZ, 4,
    across(1.6, (o) => [[LOBBY.rampFromX - 1, CINEMA_ENTRY_Y, o], [LIGHT_LOCK.x - 0.65, CINEMA_FLOOR_Y, o]]));
  const lockMid = (LOBBY.minZ + LIGHT_LOCK.minZ) / 2;
  cinema('light-lock', 'cinema lobby', 'auditorium doors', [LIGHT_LOCK.x, CINEMA_FLOOR_Y, lockMid], LIGHT_LOCK.minZ - LOBBY.minZ, 4,
    across((LIGHT_LOCK.minZ - LOBBY.minZ) / 2, (o) => [[LIGHT_LOCK.x - 2, CINEMA_FLOOR_Y, lockMid + o], [LIGHT_LOCK.x + 1.25, CINEMA_FLOOR_Y, lockMid + o]]));
  const entryMid = (ENTRY_DOOR.minZ + ENTRY_DOOR.maxZ) / 2;
  cinema('entry-door', 'cinema lobby', 'auditorium', [LOBBY.maxX + 0.15, CINEMA_FLOOR_Y, entryMid], ENTRY_DOOR.maxZ - ENTRY_DOOR.minZ, ENTRY_DOOR.height,
    across((ENTRY_DOOR.maxZ - ENTRY_DOOR.minZ) / 2, (o) => [[LOBBY.maxX - 1.1, CINEMA_FLOOR_Y, entryMid + o], [LOBBY.maxX + 2.2, CINEMA_FLOOR_Y, entryMid + o]]));
  const exitMid = (EXIT_DOOR.minZ + EXIT_DOOR.maxZ) / 2;
  const passageMid = (EXIT_PASSAGE.minX + EXIT_PASSAGE.maxX) / 2;
  cinema('exit-door', 'auditorium', 'exit passage', [LOBBY.maxX + 0.15, CINEMA_FLOOR_Y, exitMid], EXIT_DOOR.maxZ - EXIT_DOOR.minZ, EXIT_DOOR.height,
    across((EXIT_DOOR.maxZ - EXIT_DOOR.minZ) / 2, (o) => [[LOBBY.maxX + 2.2, CINEMA_FLOOR_Y, exitMid + o], [passageMid, CINEMA_FLOOR_Y, exitMid + o]]));
  cinema('exit-passage', 'exit passage', 'cinema lobby', [passageMid, CINEMA_FLOOR_Y, LOBBY.maxZ], EXIT_PASSAGE.maxX - EXIT_PASSAGE.minX, 3.8,
    across((EXIT_PASSAGE.maxX - EXIT_PASSAGE.minX) / 2, (o) => [[passageMid + o, CINEMA_FLOOR_Y, EXIT_PASSAGE.maxZ - 2.5], [passageMid + o, CINEMA_FLOOR_Y, LIGHT_LOCK.minZ - 1.2]]));
  const aisleMid = (NORTH_AISLE.minZ + NORTH_AISLE.maxZ) / 2;
  cinema('north-aisle-ramp', 'auditorium front', 'rear platform', [(FRONT_ZONE_TO_X + REAR_PLATFORM.minX) / 2, CINEMA_FLOOR_Y, aisleMid], NORTH_AISLE.maxZ - NORTH_AISLE.minZ, 4,
    across((NORTH_AISLE.maxZ - NORTH_AISLE.minZ) / 2, (o) => [[FRONT_ZONE_TO_X - 2, CINEMA_FLOOR_Y, aisleMid + o], [REAR_PLATFORM.minX + 1, REAR_PLATFORM.y, aisleMid + o]]));
  return out;
}

export const PASSAGES = buildPassageInventory();

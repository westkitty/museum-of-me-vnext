import {
  WINGS, PLACEMENTS, faceDirection, place,
  SPAWN_POSITION, ROTUNDA_APOTHEM, LEVEL_1_Y, GROUND_Y,
  SANCTUARY_DIR, SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_TO, SANCTUARY_CENTER, SANCTUARY_FLOOR_Y,
  STAIRS, stairArcPoint, type Vec3, type WingSpec,
} from './layout';
import { START_POSITION } from './start';

/** A named waypoint on the museum's canonical visitor route. */
export interface Waypoint {
  readonly label: string;
  readonly at: Vec3;
  /** Exhibit doorway this waypoint corresponds to, if any. */
  readonly exhibitId?: string;
}

function hallWaypoints(w: WingSpec): Waypoint[] {
  const d = faceDirection(w.face);
  const out: Waypoint[] = [
    { label: `${w.id}: threshold`, at: place(d, ROTUNDA_APOTHEM + 3, 0, w.floorY) },
    { label: `${w.id}: hall entry`, at: place(d, w.hallFrom + 3, 0, w.floorY) },
  ];
  const mine = PLACEMENTS.filter((p) => p.wing === w.id).sort(
    (a, b) => a.slot - b.slot || (a.side === 'left' ? -1 : 1),
  );
  for (const p of mine) {
    const along = w.hallFrom + w.bayLead + p.slot * w.bayPitch;
    out.push({ label: `${w.id}: outside ${p.exhibitId}`, at: place(d, along, 0, w.floorY) });
    out.push({ label: `${w.id}: inside ${p.exhibitId}`, at: p.visitorSpot, exhibitId: p.exhibitId });
    out.push({ label: `${w.id}: back to hall ${p.exhibitId}`, at: place(d, along, 0, w.floorY) });
  }
  out.push({ label: `${w.id}: far end`, at: place(d, w.hallTo - 4, 0, w.floorY) });
  out.push({ label: `${w.id}: return`, at: place(d, ROTUNDA_APOTHEM + 3, 0, w.floorY) });
  return out;
}

const RING_RADIUS = 10.5;
/** Balcony ring floor spans apothem 11..16 (layout.ts); 13.5 stays clear of
 * both the inner atrium drop and the outer wall/piers, and matches the radius
 * already used for the wing thresholds and the stair landings. */
const BALCONY_RING_RADIUS = 13.5;

function ringPoint(face: Parameters<typeof faceDirection>[0], y = GROUND_Y, radius = RING_RADIUS): Vec3 {
  return place(faceDirection(face), radius, 0, y);
}

/**
 * Faces stepped between `from` and `to`, tracing the annular ring rather than
 * a straight chord across it. A straight line between two ring points whose
 * faces are more than about 90° apart dips inside the inner apothem — on the
 * balcony that is the open atrium drop, not floor — so hopping straight from
 * one wing threshold to a distant one is not something a visitor can walk.
 */
function ringPath(
  from: Parameters<typeof faceDirection>[0],
  to: Parameters<typeof faceDirection>[0],
  y = GROUND_Y,
  radius = RING_RADIUS,
): Waypoint[] {
  const order = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  let delta = b - a;
  if (delta > 4) delta -= 8;
  if (delta < -4) delta += 8;
  const stepDir = Math.sign(delta) || 1;
  const out: Waypoint[] = [];
  for (let i = 0; i !== delta + stepDir && Math.abs(i) <= Math.abs(delta); i += stepDir) {
    const face = order[(a + i + 16) % 8];
    const label = radius === RING_RADIUS ? `rotunda ring ${face}` : `balcony ring ${face}`;
    out.push({ label, at: ringPoint(face, y, radius) });
    if (i === delta) break;
  }
  return out;
}

function stairWaypoints(): Waypoint[] {
  const s = STAIRS[0];
  // The verification route follows the same arc as the visible treads and
  // collision ramps. A straight foot-to-head chord would cut inside the
  // curved stair and falsely exercise the atrium rather than its walking path.
  return Array.from({ length: s.collisionSegments + 1 }, (_, index) => {
    const t = index / s.collisionSegments;
    const label = index === 0
      ? 'stair foot'
      : index === s.collisionSegments
        ? 'stair head'
        : `stair rise ${index}`;
    return { label, at: stairArcPoint(s, t) };
  });
}

/**
 * THE MANDATORY TRAVERSAL:
 * exterior start → entrance → every wing → upper level → Sanctuary → entrance,
 * continuously, with no teleport and no level transition.
 */
export function canonicalRoute(): readonly Waypoint[] {
  const south = WINGS.find((w) => w.id === 'south')!;
  const sd = faceDirection('s');

  const route: Waypoint[] = [
    { label: 'arrival plaza', at: START_POSITION },
    { label: 'main entrance', at: SPAWN_POSITION },
    { label: 'vestibule', at: place(sd, south.hallTo + 3, 0, GROUND_Y) },
  ];

  route.push(...reverseHall(south));
  route.push({ label: 'rotunda ring s', at: ringPoint('s') });

  let atFace: 'n' | 'e' | 's' | 'w' = 's';
  for (const id of ['north', 'east', 'west'] as const) {
    const w = WINGS.find((x) => x.id === id)!;
    const face = w.face as 'n' | 'e' | 'w';
    route.push(...ringPath(atFace, face));
    route.push(...hallWaypoints(w));
    route.push({ label: `rotunda ring ${face}`, at: ringPoint(face) });
    atFace = face;
  }

  route.push(...ringPath(atFace, 'sw'));
  route.push(...stairWaypoints());
  let atBalconyFace: 'sw' | 'nw' | 'ne' = 'sw';
  for (const id of ['media', 'infra'] as const) {
    const w = WINGS.find((x) => x.id === id)!;
    const face = w.face as 'nw' | 'ne';
    route.push(...ringPath(atBalconyFace, face, LEVEL_1_Y, BALCONY_RING_RADIUS));
    route.push({ label: `balcony toward ${id}`, at: place(faceDirection(face), BALCONY_RING_RADIUS, 0, LEVEL_1_Y) });
    route.push(...hallWaypoints(w));
    route.push({ label: `balcony from ${id}`, at: place(faceDirection(face), BALCONY_RING_RADIUS, 0, LEVEL_1_Y) });
    atBalconyFace = face;
  }
  route.push(...ringPath(atBalconyFace, 'sw', LEVEL_1_Y, BALCONY_RING_RADIUS));

  route.push(...stairWaypoints().reverse());
  route.push(...ringPath('sw', 'nw'));
  route.push({ label: 'sanctuary threshold', at: place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM + 2, 0, GROUND_Y) });
  route.push({ label: 'sanctuary descent', at: place(SANCTUARY_DIR, SANCTUARY_RAMP_TO - 2, 0, SANCTUARY_FLOOR_Y) });
  route.push({ label: 'dexter sanctuary', at: [SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y, SANCTUARY_CENTER[2]] });
  route.push({ label: 'sanctuary return', at: place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM + 2, 0, GROUND_Y) });

  route.push(...ringPath('nw', 's'));
  route.push({ label: 'south hall', at: place(sd, south.hallFrom + 3, 0, GROUND_Y) });
  route.push({ label: 'vestibule', at: place(sd, south.hallTo + 3, 0, GROUND_Y) });
  route.push({ label: 'main entrance', at: SPAWN_POSITION });

  return route;
}

function reverseHall(w: WingSpec): Waypoint[] {
  const forward = hallWaypoints(w);
  return [...forward].reverse();
}

export function exhibitWaypoints(): readonly Waypoint[] {
  return PLACEMENTS.map((p) => ({
    label: p.exhibitId,
    at: p.anchor,
    exhibitId: p.exhibitId,
  }));
}

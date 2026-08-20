import {
  WINGS, PLACEMENTS, faceDirection, place, rightOf,
  SPAWN_POSITION, VESTIBULE_TO, ROTUNDA_APOTHEM, LEVEL_1_Y, GROUND_Y,
  SANCTUARY_DIR, SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_TO, SANCTUARY_CENTER, SANCTUARY_FLOOR_Y,
  STAIRS, type Vec3, type WingSpec,
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

function ringPoint(face: Parameters<typeof faceDirection>[0], y = GROUND_Y): Vec3 {
  return place(faceDirection(face), RING_RADIUS, 0, y);
}

function ringPath(from: Parameters<typeof faceDirection>[0], to: Parameters<typeof faceDirection>[0], y = GROUND_Y): Waypoint[] {
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
    out.push({ label: `rotunda ring ${face}`, at: ringPoint(face, y) });
    if (i === delta) break;
  }
  return out;
}

function stairWaypoints(): Waypoint[] {
  const s = STAIRS[0];
  const d = faceDirection(s.face);
  const r = rightOf(s.face === 'sw' ? d : d);
  const foot: Vec3 = [
    d[0] * s.footAlong + r[0] * (s.lateral - s.run / 2), GROUND_Y,
    d[2] * s.footAlong + r[2] * (s.lateral - s.run / 2),
  ];
  const head: Vec3 = [
    d[0] * s.headAlong + r[0] * (s.lateral + s.run / 2), LEVEL_1_Y,
    d[2] * s.headAlong + r[2] * (s.lateral + s.run / 2),
  ];
  return [
    { label: 'stair foot', at: foot },
    { label: 'stair head', at: head },
  ];
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
  for (const id of ['media', 'infra'] as const) {
    const w = WINGS.find((x) => x.id === id)!;
    route.push({ label: `balcony toward ${id}`, at: place(faceDirection(w.face), 13.5, 0, LEVEL_1_Y) });
    route.push(...hallWaypoints(w));
    route.push({ label: `balcony from ${id}`, at: place(faceDirection(w.face), 13.5, 0, LEVEL_1_Y) });
  }

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

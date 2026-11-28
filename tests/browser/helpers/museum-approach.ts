import { expect, type Page } from '@playwright/test';
import { PATH_CENTERLINES } from '../../../src/world/exterior/IslandSiteLayout';
import { ROOF_WAYPOINTS, WEST_ASCENT_ENTRY } from '../../../src/world/exterior/rooftopLayout';
import {
  ATRIUM_FRONT_Z, ENTRANCE_PORTAL_Z, OBSIDIAN_SPHERE_CENTER_Z, PLACEMENTS, ROTUNDA_APOTHEM, SOUTH, STAIRS, VESTIBULE_TO, WINGS,
  faceDirection, place, stairArcPoint, stairLanding,
} from '../../../src/world/layout';
import { pose } from './world-journey';
import type { Visitor } from './visitor';

/**
 * Natural approaches to the entrances that are not on the island's ground
 * paths: the two inside the museum (W04 at the DexTilt exhibit E19, W07 at
 * the test-lab door in the infra wing) and the three on the roof (W05 at the
 * greenhouse flower, W06 at the Flight Pad II console, W10's rooftop
 * destination beside it).
 *
 * The visitor starts on the arrival pier and walks with the real controller
 * and collision world: through the obsidian sphere and the front door (the
 * museum opens it when the visitor gets there, exactly as for any visit),
 * along the centre lanes of the authored passages (atrium, vestibule, rotunda,
 * grand stair, wing arches, corridors, exhibit bays), or up the West Flank
 * Ascent ramps (src/world/exterior/rooftopLayout.ts ROOF_WAYPOINTS,
 * collision-verified in tests/rooftop-architecture.test.ts). Nothing is placed
 * or teleported. The only page reads are the player pose, the active world and
 * the world position of the entrance object the visitor aims at.
 *
 * The lanes are rebuilt here from src/world/layout.ts with the formulas of
 * src/world/passages.ts (buildPassageInventory), because that module reaches
 * the content JSON, which the test runner cannot import. The walk itself is
 * the proof: a lane that drifted from the architecture would block it.
 */
type XZ = readonly [number, number];
type Leg = { readonly world: 'exterior' | 'interior'; readonly path: readonly XZ[]; readonly careful?: boolean };

const xz = (p: readonly number[]): XZ => [p[0], p[2]];
const wing = (id: string) => {
  const w = WINGS.find((x) => x.id === id);
  if (!w) throw new Error(`no wing ${id}`);
  return { w, dir: faceDirection(w.face) };
};
/** passages.ts `interior:<wing>:arch`, centre lane. */
const archLane = (id: string): XZ[] => {
  const { w, dir } = wing(id);
  return [xz(place(dir, ROTUNDA_APOTHEM - (w.level === 0 ? 4 : 3), 0, w.floorY)), xz(place(dir, ROTUNDA_APOTHEM + 4, 0, w.floorY))];
};
/** passages.ts `interior:<wing>:corridor-hall`, centre lane. */
const corridorLane = (id: string): XZ[] => {
  const { w, dir } = wing(id);
  return [xz(place(dir, w.corridorTo - 3, 0, w.floorY)), xz(place(dir, w.corridorTo + 3, 0, w.floorY))];
};
/** passages.ts `interior:<wing>:bay:<exhibit>`: from the hall into the bay threshold (span centre taken as the bay centre). */
const bayLane = (exhibitId: string): XZ[] => {
  const placement = PLACEMENTS.find((p) => p.exhibitId === exhibitId);
  if (!placement) throw new Error(`no placement ${exhibitId}`);
  const { w, dir } = wing(placement.wing);
  const sign = placement.side === 'right' ? 1 : -1;
  const along = w.hallFrom + w.bayLead + placement.slot * w.bayPitch;
  return [xz(place(dir, along, sign * (w.hallHalfWidth - 2), w.floorY)), xz(place(dir, along, sign * (w.hallHalfWidth + 1), w.floorY))];
};
/** passages.ts `interior:<stair>`, centre lane: from the rotunda ring, onto the foot from the front, up the arc, onto the landing. */
const stairLane = (id: string): XZ[] => {
  const stair = STAIRS.find((s) => s.id === id);
  if (!stair) throw new Error(`no stair ${id}`);
  const before = stairArcPoint(stair, -0.2);
  const r = Math.hypot(before[0], before[2]);
  const arc = Array.from({ length: stair.collisionSegments + 1 }, (_, i) => xz(stairArcPoint(stair, i / stair.collisionSegments)));
  return [[before[0] * 10.6 / r, before[2] * 10.6 / r], xz(before), ...arc, xz(stairLanding(stair))];
};

const SPHERE_Z = OBSIDIAN_SPHERE_CENTER_Z;
/** Pier junction → the south doorway: the sphere's outer aperture, then round its east side on the middle lane. */
const PIER_TO_DOOR: Leg = {
  world: 'exterior',
  path: [[0, 184], [0, 164], [0, SPHERE_Z + 13.5], [0, SPHERE_Z + 7.4],
    [6.2 * 0.62, SPHERE_Z + 6.2 * 0.78], [6.2, SPHERE_Z], [6.2 * 0.62, SPHERE_Z - 6.2 * 0.78], [0, SPHERE_Z - 7.4], [0, ENTRANCE_PORTAL_Z + 4]],
};

/** Inside: atrium → vestibule → south hall → rotunda (just inside the south arch). */
const DOOR_TO_ROTUNDA: Leg = {
  world: 'interior',
  path: [[0, ATRIUM_FRONT_Z - 4], [0, VESTIBULE_TO + 4], [0, VESTIBULE_TO - 4], [0, SOUTH.hallTo + 4], [0, SOUTH.hallTo - 4],
    ...[...corridorLane('south')].reverse(), ...[...archLane('south')].reverse()],
};

/** Rotunda floor → the east wing hall, passing inside the south-east grand stair. */
const ROTUNDA_TO_EAST_HALL: Leg = {
  world: 'interior',
  path: [[7.5, 7.5], ...archLane('east'), ...corridorLane('east')],
};

/** Rotunda floor → the balcony by the south-east grand stair → the infra (north-east) wing hall. */
const ROTUNDA_TO_INFRA_HALL: Leg = {
  world: 'interior',
  careful: true,
  path: [...stairLane('grand-stair-se'),
    // Round the balcony ring from the stair head to the infra arch.
    [13.5, 0], [10.6, -10.6], ...archLane('infra'), ...corridorLane('infra')],
};

/** Path 5 from the pier junction to the foot of the West Flank Ascent. */
const PATH5_WEST = [...PATH_CENTERLINES[4]].reverse();
const PIER_TO_ASCENT: Leg = {
  world: 'exterior',
  path: [...PATH5_WEST.slice(0, PATH5_WEST.findIndex(([x, z]) => x === -44 && z === 118) + 1), xz(WEST_ASCENT_ENTRY)],
};
/** Up both ramps, over the bridge and along the west walkway to the promenade corner. */
const ASCENT_TO_ROOF: Leg = {
  world: 'exterior',
  careful: true,
  path: [xz(ROOF_WAYPOINTS.lowerRampFoot), [-41.25, 84], xz(ROOF_WAYPOINTS.midLanding), [-41.25, 22],
    xz(ROOF_WAYPOINTS.upperRampTop), xz(ROOF_WAYPOINTS.upperBridgeWest), xz(ROOF_WAYPOINTS.upperBridgeEast),
    xz(ROOF_WAYPOINTS.westWalkwayMid), xz(ROOF_WAYPOINTS.westWalkwaySouth)],
};
/** Promenade → the café's west aisle → its south-west corner, clear of the tables and of Flight Pad II. */
const ROOF_TO_CAFE_SOUTH: Leg = {
  world: 'exterior',
  careful: true,
  path: [xz(ROOF_WAYPOINTS.promenadeMid), [-8.5, 29], [-8.5, 40]],
};

export interface MuseumApproach {
  readonly id: string;
  readonly legs: readonly Leg[];
  /** Where the visitor stands, given the entrance object's world position. */
  readonly standAt: (target: readonly [number, number, number]) => XZ;
  /** Reads the entrance object's world position (a read, never a write). */
  readonly target: (page: Page) => Promise<[number, number, number]>;
  readonly anchorId: string;
  readonly title: RegExp;
  /** Needs the museum interior (crosses the front door). */
  readonly indoor: boolean;
}

const objectPosition = (page: Page, root: 'interior' | 'exterior' | 'rooftop', name: string, lift = 0) => page.waitForFunction(
  ({ root, name, lift }) => {
    const app = window.__museum!;
    const group = root === 'interior' ? app.interiorWorld?.root : root === 'rooftop' ? app.exteriorWorld.rooftop.group : app.exteriorWorld.root;
    const o = group?.getObjectByName(name);
    if (!o) return null;
    o.updateWorldMatrix(true, false);
    const p = o.getWorldPosition(o.position.clone());
    return [p.x, p.y + lift, p.z];
  }, { root, name, lift }, { timeout: 60_000, polling: 200 },
).then(async (h) => (await h.jsonValue()) as [number, number, number]);

export const MUSEUM_APPROACHES = {
  W04: {
    id: 'W04', indoor: true, anchorId: 'pocket-portal:w04', title: /Digital Beat World/i,
    legs: [PIER_TO_DOOR, DOOR_TO_ROTUNDA, ROTUNDA_TO_EAST_HALL,
      { world: 'interior', careful: true, path: bayLane('E19') }],
    standAt: (t) => [t[0], t[2] + 2.9],
    target: (page) => objectPosition(page, 'interior', 'dextilt-desktop-display'),
  },
  W07: {
    id: 'W07', indoor: true, anchorId: 'pocket-portal:w07', title: /Portal Slingshot Trials/i,
    legs: [PIER_TO_DOOR, DOOR_TO_ROTUNDA, ROTUNDA_TO_INFRA_HALL],
    // Hall axis NE; the door is at its far end. Stand on the centre line, 1 m to the right, as the world test does.
    standAt: () => [Math.SQRT1_2 * 45 + Math.SQRT1_2, -Math.SQRT1_2 * 45 + Math.SQRT1_2],
    target: (page) => objectPosition(page, 'interior', 'test-lab-door-control', 2.1),
  },
  W05: {
    id: 'W05', indoor: false, anchorId: 'rooftop-greenhouse-flower-w05', title: /Impossible Greenhouse/i,
    legs: [PIER_TO_ASCENT, ASCENT_TO_ROOF,
      { world: 'exterior', careful: true, path: [xz(ROOF_WAYPOINTS.greenhouseDoorApproach), xz(ROOF_WAYPOINTS.greenhouseDoor)] }],
    standAt: (t) => [t[0], t[2] + 3.6],
    target: (page) => objectPosition(page, 'rooftop', 'greenhouse-flower-w05-interaction'),
  },
  W06: {
    id: 'W06', indoor: false, anchorId: 'rooftop-flight-pad-ii-teleport', title: /Skyborne Gardens/i,
    legs: [PIER_TO_ASCENT, ASCENT_TO_ROOF, ROOF_TO_CAFE_SOUTH, { world: 'exterior', careful: true, path: [[-6.6, 46]] }],
    // West of the console, well off Flight Pad II (stepping onto the pad launches the visitor).
    standAt: (t) => [t[0] - 2.4, t[2]],
    target: (page) => objectPosition(page, 'rooftop', 'flight-pad-ii-teleport-interaction'),
  },
  W10_ROOF: {
    id: 'W10', indoor: false, anchorId: 'pocket-portal:w10-roof', title: /Breath of the Weasel/i,
    legs: [PIER_TO_ASCENT, ASCENT_TO_ROOF, ROOF_TO_CAFE_SOUTH, { world: 'exterior', careful: true, path: [[-2.4, 44]] }],
    // From the north, as the world test does, so the visitor never steps onto the pad.
    standAt: () => [-2.4, 48.3],
    target: (page) => objectPosition(page, 'exterior', 'flight-pad-ii-wilderness-destination'),
  },
} as const satisfies Record<string, MuseumApproach>;

export type MuseumApproachId = keyof typeof MUSEUM_APPROACHES;

const activeWorld = (page: Page) => page.evaluate(() => window.__museum!.activeWorld);

/**
 * Walk north through the south doorway. The museum opens it when the visitor
 * arrives (predictive preparation starts on the approach); until then the
 * doorway holds them, as it holds any visitor. Forward stays held until the
 * visitor is inside.
 */
async function crossFrontDoor(page: Page, v: Visitor): Promise<void> {
  await v.turnTo(0, 0.06);
  await v.holdForward(true);
  try {
    await expect.poll(() => activeWorld(page), { timeout: 90_000, intervals: [100] }).toBe('interior');
  } finally {
    await v.holdForward(false);
  }
}

/** From the pier start, walk to the entrance, aim at it and confirm the focus. */
export async function walkToMuseumEntrance(page: Page, v: Visitor, id: MuseumApproachId): Promise<void> {
  const a: MuseumApproach = MUSEUM_APPROACHES[id];
  for (const leg of a.legs) {
    if (leg.world === 'interior' && (await activeWorld(page)) !== 'interior') await crossFrontDoor(page, v);
    for (const [i, [x, z]] of leg.path.entries()) {
      const last = i === leg.path.length - 1;
      await v.walkTo(x, z, { tolerance: leg.careful || last ? 0.5 : 1.2, run: !leg.careful && !last, timeoutMs: 120_000 });
    }
  }
  const target = await a.target(page);
  const [sx, sz] = a.standAt(target);
  await v.walkTo(sx, sz, { tolerance: 0.35 });
  const here = await pose(page);
  // A visitor whose aim does not take steps closer and looks again.
  for (let attempt = 0; ; attempt++) {
    try {
      await v.aimAt(target, a.anchorId);
      return;
    } catch (error) {
      if (attempt >= 2) throw error;
      const k = 0.15 * (attempt + 1);
      await v.walkTo(here.x + (target[0] - here.x) * k, here.z + (target[2] - here.z) * k, { tolerance: 0.25 });
    }
  }
}

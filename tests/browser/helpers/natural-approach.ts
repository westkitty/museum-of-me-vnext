import { expect, type Page } from '@playwright/test';
import {
  LIGHTHOUSE_APPROACH_PATH, LIGHTHOUSE_PENINSULA_CENTER, OBSERVATORY_APPROACH_PATH, OBSERVATORY_CENTER, PATH_CENTERLINES,
} from '../../../src/world/exterior/IslandSiteLayout';
import { RILL_DROPLET_POS } from '../../../src/world/exterior/RillDroplet';
import { START_POSITION } from '../../../src/world/start';
import { pose } from './world-journey';
import type { Visitor } from './visitor';

/**
 * Natural museum-side approaches: the visitor starts where every visit starts
 * (the arrival pier, START_POSITION) and walks the island's authored paths to
 * a world's entrance with the real controller and collision world. Nothing is
 * placed or teleported. The trail points come from IslandSiteLayout and the
 * collision-verified ascent routes in tests/ruined-observatory.test.ts and
 * tests/lighthouse-peninsula.test.ts.
 *
 * Interior (W04, W07) and rooftop (W05, W06, W10 roof) entrances are not
 * covered here; their journeys still use labelled diagnostic placement.
 */
type XZ = readonly [number, number];

const [PATH1, , , PATH4, PATH5] = PATH_CENTERLINES;
const EAST_TO = (x: number, z: number): XZ[] => {
  const i = PATH1.findIndex(([px, pz]) => px === x && pz === z);
  if (i < 0) throw new Error(`(${x}, ${z}) is not a Path 1 point`);
  return PATH1.slice(0, i + 1);
};
/** Path 5 walked from the pier junction westward (it is authored the other way round). */
const WEST = [...PATH5].reverse();
const [OX, , OZ] = OBSERVATORY_CENTER;
const [TX, , TZ] = LIGHTHOUSE_PENINSULA_CENTER;

export interface Approach {
  readonly id: string;
  /** Pier start → entrance, on paths. The first point is the pier junction. */
  readonly path: readonly XZ[];
  /** The point the entrance is aimed at, and its interaction id. */
  readonly aim: readonly [number, number, number];
  readonly anchorId: string;
  readonly title: RegExp;
  /** Walk slowly on stairs and ramps, where a running stride overshoots corners. */
  readonly carefulFrom?: number;
}

export const APPROACHES = {
  W10: {
    id: 'W10', path: [[2, 197]], aim: [4, 0.9, 195], anchorId: 'pocket-portal:w10-pier', title: /Breath of the Weasel/i,
  },
  W08: {
    id: 'W08', path: [[0, 184], [-1, 160], [-2, 146]], aim: RILL_DROPLET_POS, anchorId: 'pocket-portal:w08', title: /World Inside a Raindrop/i,
  },
  W09: {
    id: 'W09',
    path: [...EAST_TO(42, 108), ...OBSERVATORY_APPROACH_PATH, [OX - 6.5, OZ], [OX - 3.2, OZ]],
    aim: [OX, 4.5, OZ], anchorId: 'observatory-orrery-w09', title: /Museum Between Seconds/i, carefulFrom: 9,
  },
  L01: {
    id: 'L01',
    path: [...EAST_TO(44, 150), ...LIGHTHOUSE_APPROACH_PATH,
      [TX - 13, TZ], [TX - 8, TZ + 3.2], [TX - 3.2, TZ + 3.2],
      [TX - 3.2, TZ - 3.2], [TX + 3.2, TZ - 3.2], [TX + 3.2, TZ + 3.2], [TX - 3.2, TZ + 3.2],
      [TX - 3.2, TZ - 3.2], [TX + 3.2, TZ - 3.2], [TX + 3.2, TZ + 3.2], [TX - 3.2, TZ + 3.2],
      [TX - 5.7, TZ + 3.2], [TX - 5.7, TZ], [TX - 1.4, TZ]],
    aim: [TX, 13.45, TZ], anchorId: 'lighthouse-lens-l01', title: /Lighthouse at World.s End/i, carefulFrom: 11,
  },
  W01: {
    id: 'W01', path: [...PATH1, [47, 30], [47, 4], [53.5, 4]], aim: [56, 0.5, 4], anchorId: 'pocket-portal:w01', title: /Lagoon Depths/i,
  },
  W03: {
    id: 'W03', path: [...WEST.slice(0, WEST.findIndex(([x, z]) => x === -44 && z === 150) + 1), [-44, 134], [-36.6, 134]],
    // The gnomon block tops out at y 0.34 and interaction reach is 4.2 m: stand within ~3 m and aim at its top face.
    aim: [-34, 0.3, 134], anchorId: 'pocket-portal:w03', title: /Clockwork Sundial/i,
  },
  W02: {
    id: 'W02', path: [...WEST, ...[...PATH4].reverse().slice(1, 5), [-140, -5.1], [-138.2, -5.1]],
    aim: [-134.5, 0.52, -5.1], anchorId: 'pocket-portal:w02', title: /Prehistoric Fern Island/i,
  },
} as const satisfies Record<string, Approach>;

export type ApproachId = keyof typeof APPROACHES;

/** The visitor stands where every visit begins: the arrival pier, facing the museum. */
export async function expectAtPierStart(page: Page): Promise<void> {
  const p = await pose(page);
  expect(Math.hypot(p.x - START_POSITION[0], p.z - START_POSITION[2]), 'visitor starts on the arrival pier').toBeLessThan(1.5);
}

/**
 * Walk from wherever the visitor stands on the pier to the entrance, aim at it
 * and confirm the interaction focus. Touch visitors walk (touch has no run).
 */
export async function walkToEntrance(v: Visitor, id: ApproachId, opts: { reverseFrom?: readonly XZ[] } = {}): Promise<void> {
  const a: Approach = APPROACHES[id];
  const path = [...(opts.reverseFrom ? [...opts.reverseFrom].reverse() : []), ...a.path];
  for (const [i, [x, z]] of path.entries()) {
    const careful = a.carefulFrom !== undefined && i >= (opts.reverseFrom?.length ?? 0) + a.carefulFrom;
    const last = i === path.length - 1;
    await v.walkTo(x, z, { tolerance: careful || last ? 0.5 : 1.2, run: !careful && !last, timeoutMs: 120_000 });
  }
  // A visitor whose aim does not take steps closer and looks again.
  const [fx, fz] = path[path.length - 1];
  for (let attempt = 0; ; attempt++) {
    try {
      await v.aimAt(a.aim, a.anchorId);
      return;
    } catch (error) {
      if (attempt >= 2) throw error;
      await v.walkTo(fx + (a.aim[0] - fx) * 0.15 * (attempt + 1), fz + (a.aim[2] - fz) * 0.15 * (attempt + 1), { tolerance: 0.25 });
    }
  }
}

/** Retrace an approach back to the pier junction (the way the visitor came). */
export async function walkBackToPier(v: Visitor, id: ApproachId): Promise<void> {
  const a: Approach = APPROACHES[id];
  const back = [...a.path].reverse();
  for (const [i, [x, z]] of back.entries()) {
    const careful = a.carefulFrom !== undefined && i < a.path.length - a.carefulFrom;
    await v.walkTo(x, z, { tolerance: careful ? 0.5 : 1.2, run: !careful, timeoutMs: 120_000 });
  }
}

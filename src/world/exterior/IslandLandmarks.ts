import type { Vec3 } from '../layout';
import { ANCIENT_TREE_CENTER, ANCIENT_TREE_CLEARING_RADIUS, SPIRE_GARDEN_CENTER, SPIRE_GARDEN_RADIUS } from './IslandSiteLayout';

/**
 * ISLAND-01 (world expansion 2026-11-21): the island's existing named
 * landmarks as data, so woodland placement can keep every one of them
 * findable. Coordinates are copied from the authored builders
 * (ExteriorSignatureFeatures, IslandLandscape, IslandSiteLayout); they are not
 * new positions. `approach` is the nearest island-loop path point (or the
 * arrival axis), `inspection` a collision-supported standing spot from which
 * the feature is read, and `focus` the point a visitor looks at.
 *
 * Woodland rules derived from this table:
 * - nothing with a trunk collider, and no understory or canopy that reaches
 *   below CANOPY_UNDERSIDE_MIN, stands inside a landmark's `clearing` radius;
 * - a straight `corridor` from approach to inspection stays free of trunks
 *   and understory, so the walk in is physically open and the view is clear
 *   at eye height (crowns may still meet overhead).
 */
export interface IslandLandmark {
  readonly id: string;
  readonly label: string;
  /** Scene object name of the existing feature (proves the table is not invented). */
  readonly featureName: string;
  readonly focus: Vec3;
  readonly approach: readonly [number, number];
  readonly inspection: readonly [number, number];
  /** Radius around focus kept free of trunks, understory and low canopy. */
  readonly clearing: number;
  /** Half-width of the trunk/understory-free walk from approach to inspection. */
  readonly corridor: number;
}

/** Lowest underside (m above ground) of any woodland crown; eye height is 1.64 m. */
export const CANOPY_UNDERSIDE_MIN = 3.0;
const GROUND = -0.48;

export const ISLAND_LANDMARKS: readonly IslandLandmark[] = [
  { id: 'astronomical-terrace', label: 'Astronomical seasonal terrace', featureName: 'astronomical-seasonal-terrace',
    focus: [-34, GROUND + 1.2, 134], approach: [-44, 134], inspection: [-38.5, 134], clearing: 8, corridor: 1.8 },
  { id: 'pollinator-meadow', label: 'Wildflower pollinator meadow', featureName: 'wildflower-pollinator-meadow',
    focus: [-68, GROUND + 0.8, 118], approach: [-45.1, 112.9], inspection: [-56, 115.4], clearing: 15, corridor: 2.2 },
  { id: 'hare-statue', label: 'Hare statue', featureName: 'animal-statuary-hare',
    focus: [-62, GROUND + 0.9, 115], approach: [-45.5, 111.3], inspection: [-59.5, 114.4], clearing: 4, corridor: 1.6 },
  { id: 'fern-ravine', label: 'Living fern ravine', featureName: 'living-fern-ravine',
    focus: [-126, GROUND + 0.8, -2], approach: [-139.6, -6.9], inspection: [-134.5, -5.1], clearing: 13.5, corridor: 2.0 },
  { id: 'golden-spire', label: 'Golden spire garden', featureName: 'single-golden-spire',
    focus: [SPIRE_GARDEN_CENTER[0], GROUND + 6, SPIRE_GARDEN_CENTER[2]], approach: [-104, -60], inspection: [-104, -64],
    clearing: SPIRE_GARDEN_RADIUS + 2, corridor: 2.4 },
  { id: 'neolithic-circle', label: 'Neolithic stone circle', featureName: 'neolithic-stone-circle',
    focus: [-72, GROUND + 1.5, -118], approach: [-42.3, -105], inspection: [-61.4, -113.4], clearing: 13, corridor: 2.0 },
  { id: 'wings-of-dawn', label: 'Rear garden, Wings of Dawn', featureName: 'rear-garden-monumental-reveal',
    focus: [0, GROUND + 2.5, -124.5], approach: [0, -109.5], inspection: [0, -114], clearing: 12, corridor: 2.4 },
  { id: 'ancient-tree', label: 'Ancient tree', featureName: 'ancient-tree-landmark',
    focus: [ANCIENT_TREE_CENTER[0], GROUND + 4, ANCIENT_TREE_CENTER[2]], approach: [45, -84], inspection: [50.5, -84],
    clearing: ANCIENT_TREE_CLEARING_RADIUS, corridor: 1.8 },
  { id: 'lantern-path', label: 'Moonlit lantern path', featureName: 'moonlit-lantern-path',
    focus: [46, GROUND + 0.6, -48], approach: [46, -40], inspection: [46, -48], clearing: 4, corridor: 1.6 },
  { id: 'observation-hide', label: 'Wildlife observation hide', featureName: 'wildlife-observation-hide',
    focus: [55, GROUND + 1.2, -14], approach: [46.1, -13.6], inspection: [50, -13.8], clearing: 6, corridor: 1.6 },
  { id: 'otter-statue', label: 'Otter statue', featureName: 'animal-statuary-group',
    focus: [56, GROUND + 0.9, -8], approach: [46.4, -7.5], inspection: [53.5, -7.8], clearing: 4, corridor: 1.6 },
  { id: 'tidepools', label: 'Coastal tidepool garden', featureName: 'coastal-tidepool-garden',
    focus: [136, GROUND - 0.1, 36], approach: [130, 55], inspection: [132.5, 41.5], clearing: 7, corridor: 1.8 },
  { id: 'wind-grove', label: 'Sculptural wind grove', featureName: 'sculptural-wind-grove',
    focus: [48, GROUND + 3.5, 108], approach: [42.2, 106.9], inspection: [44, 107.3], clearing: 8, corridor: 1.6 },
  { id: 'reflecting-rill', label: 'Reflecting rill', featureName: 'sculpted-reflecting-rill',
    focus: [-7.5, GROUND + 0.3, 143.8], approach: [0, 150], inspection: [-2, 146], clearing: 6, corridor: 1.6 },
  { id: 'south-pier', label: 'South arrival pier', featureName: 'south-arrival-pier-deck',
    focus: [0, GROUND + 0.5, 200], approach: [0, 184], inspection: [0, 192], clearing: 6, corridor: 2.0 },
];

function segmentDistance(x: number, z: number, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

/** True inside any landmark clearing (grown by `margin`). */
export function inLandmarkClearing(x: number, z: number, margin = 0): boolean {
  return ISLAND_LANDMARKS.some((l) => Math.hypot(x - l.focus[0], z - l.focus[2]) < l.clearing + margin);
}

/** True inside any approach corridor (grown by `margin`, e.g. a trunk or shrub radius). */
export function inLandmarkCorridor(x: number, z: number, margin = 0): boolean {
  return ISLAND_LANDMARKS.some((l) => segmentDistance(x, z, l.approach, l.inspection) < l.corridor + margin
    || segmentDistance(x, z, l.inspection, [l.focus[0], l.focus[2]]) < l.corridor + margin);
}

/** Ground-level woodland (trunks, understory) may not stand here. */
export function landmarkGroundExcluded(x: number, z: number, margin = 0): boolean {
  return inLandmarkClearing(x, z, margin) || inLandmarkCorridor(x, z, margin);
}

const SIGHT_EYE_Y = -0.5 + 1.64;

/**
 * True when a crown sphere (centre, radius) crosses the eye-height line from
 * a landmark's approach point to its focus. Used to keep raised crowns from
 * hiding elevated landmarks (spire, ancient tree, wind vanes) from the path.
 */
export function blocksLandmarkSightline(x: number, y: number, z: number, radius: number): boolean {
  for (const l of ISLAND_LANDMARKS) {
    const ax = l.approach[0], ay = SIGHT_EYE_Y, az = l.approach[1];
    const dx = l.focus[0] - ax, dy = l.focus[1] + 0.5 - ay, dz = l.focus[2] - az;
    const len2 = dx * dx + dy * dy + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / len2));
    const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t), z - (az + dz * t));
    if (d < radius) return true;
  }
  return false;
}

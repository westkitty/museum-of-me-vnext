import {
  PLACEMENT_BY_EXHIBIT, WING_BY_ID, rightOf, add,
  SANCTUARY_CENTER, SANCTUARY_DIR, SANCTUARY_FLOOR_Y,
  type Vec3,
} from './layout';
import { PRIMARY_TO_VNEXT, SOURCE_INSTALLATIONS } from '../content/sourceParity';
import { SPATIAL_CONTRACT } from '../content/installationState';

/**
 * WHERE THE FOURTEEN SOURCE INSTALLATIONS STAND IN THE vNEXT BUILDING.
 *
 * Spatial adjudication (see Reliquary_Installation_Spatial_Matrix.md):
 *
 * - Exact old-hall world coordinates are NOT a governing requirement. The two
 *   highest source authorities disagree with each other on every one of the
 *   fourteen positions (CURATED `exhibitData[].position` vs Version B
 *   `source-data.json exhibits[].position`) while agreeing byte-for-byte on
 *   every semantic field. A contract the sources themselves do not share
 *   cannot be the contract.
 * - What both authorities DO share, and what is therefore governing, is
 *   preserved here: room grouping, order along the hall outward from the
 *   entrance, interaction radius, reading zone, camera safe distance, the
 *   interpretive lectern in front of the installation, a collision footprint,
 *   and the sanctuary standing rearmost behind the rest of the museum.
 *
 * Each installation is placed inside the bay of the vNext exhibit its project
 * was frozen onto, in a front corner clear of everything that bay's bespoke
 * exhibit builds, which is never moved, recoloured or lifecycle-coupled.
 */

export interface InstallationPlacement {
  readonly id: string;
  /** vNext exhibit whose bay hosts it, or 'sanctuary'. */
  readonly host: string;
  /** Where the installation object stands. */
  readonly position: Vec3;
  /** Interpretive lectern, between the visitor and the installation. */
  readonly lectern: Vec3;
  /** Source `interactionPoint`: where the visitor stands to operate it. */
  readonly interactionPoint: Vec3;
  readonly readingZoneRadius: number;
  readonly interactionRadius: number;
  readonly cameraSafeDistance: number;
  readonly lecternCollisionRadius: number;
  /** Half-extents of the installation's collision footprint. */
  readonly footprint: readonly [number, number];
  /** Unit vector from the lectern toward the installation. */
  readonly facing: Vec3;
  /** Source room this installation shared with its neighbours. */
  readonly sourceWing: string;
  /** Source order along the hall, outward from the entrance, within its room. */
  readonly sourceOrder: number;
}

function unit(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[2]) || 1;
  return [v[0] / l, 0, v[2] / l];
}

/** Source order within a room: the old halls run from +Z (entrance) to −Z. */
function sourceOrderWithinWing(id: string): number {
  const wing = SOURCE_INSTALLATIONS.find((i) => i.id === id)?.wing;
  const peers = SOURCE_INSTALLATIONS
    .filter((i) => i.wing === wing)
    .sort((a, b) => b.position[2] - a.position[2]);
  return peers.findIndex((i) => i.id === id);
}

export function computeInstallationPlacements(): readonly InstallationPlacement[] {
  const out: InstallationPlacement[] = [];
  // How many installations share each vNext host, so a doubled host can seat
  // both without either one standing on the other.
  const shareCount = new Map<string, string[]>();
  for (const spec of SOURCE_INSTALLATIONS) {
    const host = PRIMARY_TO_VNEXT[spec.id];
    const list = shareCount.get(host) ?? [];
    list.push(spec.id);
    shareCount.set(host, list);
  }

  for (const spec of SOURCE_INSTALLATIONS) {
    const host = PRIMARY_TO_VNEXT[spec.id];
    const peers = shareCount.get(host)!;
    const seat = peers.indexOf(spec.id);
    const contract = host === 'sanctuary' ? SPATIAL_CONTRACT.sanctuary : SPATIAL_CONTRACT.standard;
    const footprint = (host === 'sanctuary'
      ? SPATIAL_CONTRACT.footprint.sanctuary
      : SPATIAL_CONTRACT.footprint.wing) as [number, number];
    const half: [number, number] = [footprint[0] / 2, footprint[1] / 2];

    if (host === 'sanctuary') {
      const right = rightOf(SANCTUARY_DIR);
      const position = add(
        [SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y, SANCTUARY_CENTER[2]],
        right,
        7.0,
      );
      // The lectern sits on the ramp side so a visitor arriving through the
      // museum meets the interpretive surface before the installation itself.
      const lectern = add(position, SANCTUARY_DIR, -2.9);
      const interactionPoint = add(position, SANCTUARY_DIR, -3.9);
      out.push({
        id: spec.id, host, position, lectern, interactionPoint,
        readingZoneRadius: contract.readingZoneRadius,
        interactionRadius: contract.interactionRadius,
        cameraSafeDistance: contract.cameraSafeDistance,
        lecternCollisionRadius: contract.lecternCollisionRadius,
        footprint: half,
        facing: unit(SANCTUARY_DIR),
        sourceWing: spec.wing,
        sourceOrder: sourceOrderWithinWing(spec.id),
      });
      continue;
    }

    const placement = PLACEMENT_BY_EXHIBIT.get(host);
    const wing = placement ? WING_BY_ID.get(placement.wing) : undefined;
    if (!placement || !wing) continue;

    // `facing` points from the bay back toward the hall; along the hall is its
    // perpendicular.
    //
    // Every bespoke exhibit builds toward the back and centre of its bay: its
    // hero object, consoles and its own lectern all stand at or behind the
    // anchor. The front corners, either side of the doorway behind the return
    // of the hall wall, are the one part of a bay no exhibit uses. An
    // installation therefore stands in a front corner, turned to face the
    // bay's centre line, so a visitor walking in meets its lectern beside the
    // entry path and nothing of the bespoke exhibit is covered. (It used to be
    // seated deep in the bay, where it stood on top of exhibit lecterns and
    // consoles in eleven of the thirteen host bays.)
    const toHall = unit(placement.facing);
    const along = rightOf(toHall);
    const side = peers.length === 1 || seat === 0 ? -1 : 1;
    const outward: Vec3 = [along[0] * side, 0, along[2] * side];
    const inward: Vec3 = [-outward[0], 0, -outward[2]];

    // In the installation's own frame the footprint is `half[0]` wide and
    // `half[1]` deep. Turned sideways, its depth runs along the hall and its
    // width runs from the back of the corner toward the doorway wall.
    const WALL_CLEARANCE = 0.4;
    const alongOffset = wing.bayHalfAlong - half[1] - WALL_CLEARANCE;
    const towardHall = wing.bayDepth / 2 - half[0] - WALL_CLEARANCE;

    const position = add(add(placement.anchor, toHall, towardHall), outward, alongOffset);
    const lectern = add(position, inward, 2.9);
    const interactionPoint = add(position, inward, 3.9);

    // The collider is axis-aligned in world space, so express the turned
    // footprint as world half-extents.
    const worldFootprint: [number, number] = [
      Math.abs(outward[0]) * half[1] + Math.abs(toHall[0]) * half[0],
      Math.abs(outward[2]) * half[1] + Math.abs(toHall[2]) * half[0],
    ];

    out.push({
      id: spec.id, host, position, lectern, interactionPoint,
      readingZoneRadius: contract.readingZoneRadius,
      interactionRadius: contract.interactionRadius,
      cameraSafeDistance: contract.cameraSafeDistance,
      lecternCollisionRadius: contract.lecternCollisionRadius,
      footprint: worldFootprint,
      facing: outward,
      sourceWing: spec.wing,
      sourceOrder: sourceOrderWithinWing(spec.id),
    });
  }
  return out;
}

export const INSTALLATION_PLACEMENTS = computeInstallationPlacements();
export const INSTALLATION_PLACEMENT_BY_ID = new Map(
  INSTALLATION_PLACEMENTS.map((p) => [p.id, p]),
);

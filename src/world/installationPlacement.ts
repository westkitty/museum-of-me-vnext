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
 * was frozen onto, offset clear of that bay's bespoke hero object, which is
 * never moved, recoloured or lifecycle-coupled.
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

    // `facing` points from the bay back toward the hall. Deeper into the bay is
    // the opposite direction; along the hall is its perpendicular.
    const toHall = unit(placement.facing);
    const deeper: Vec3 = [-toHall[0], 0, -toHall[2]];
    const along = rightOf(toHall);

    const alongSpan = Math.min(4.6, wing.bayHalfAlong - 3.2);
    const depthSpan = Math.min(4.2, wing.bayDepth / 2 - 3.6);
    const alongOffset = peers.length === 1 ? -alongSpan : (seat === 0 ? -alongSpan : alongSpan);

    const position = add(add(placement.anchor, deeper, depthSpan), along, alongOffset);
    const lectern = add(position, toHall, 2.9);
    const interactionPoint = add(position, toHall, 3.9);

    out.push({
      id: spec.id, host, position, lectern, interactionPoint,
      readingZoneRadius: contract.readingZoneRadius,
      interactionRadius: contract.interactionRadius,
      cameraSafeDistance: contract.cameraSafeDistance,
      lecternCollisionRadius: contract.lecternCollisionRadius,
      footprint: half,
      facing: deeper,
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

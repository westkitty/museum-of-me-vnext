import * as THREE from 'three';
import { PATH_CENTERLINES, isLagoon, isSiteLand } from '../world/exterior/IslandSiteLayout';
import type { MuseumSceneIndex } from './SceneIndex';

/** Half-width of the rendered path ribbon (IslandLandscape.buildPaths). */
export const RIBBON_HALF_WIDTH = 2.3;
/** Minimum gap between a ribbon edge and any solid exterior collider. */
export const SCENERY_GAP = 0.5;
/** Minimum gap between a ribbon edge and a museum building wall. */
export const BUILDING_GAP = 1.0;

export interface PathSolid {
  readonly id: string;
  readonly minX: number; readonly maxX: number;
  readonly minY: number; readonly maxY: number;
  readonly minZ: number; readonly maxZ: number;
}

export interface IslandPathResult {
  /** 1-based path number, in PATH_CENTERLINES order. */
  readonly path: number;
  /** Distinct problems, e.g. "0.31 m from tree-12 at (40.2, 18.7)". */
  readonly problems: readonly string[];
}

/**
 * Everything a visitor at ground level could walk into on the exterior: walls
 * taller than the ground plane. Oriented walls are tested by their axis-aligned
 * bounds, which only makes the check stricter. The building is the subset of
 * tall, long walls.
 */
export function islandPathSolids(index: Pick<MuseumSceneIndex, 'collisions'>): { solids: PathSolid[]; building: Set<string> } {
  const solids: PathSolid[] = [];
  for (const collider of index.collisions.exterior ?? []) {
    if (collider.kind !== 'wall') continue;
    if (collider.maxY > -0.45 && collider.minY < 1.3) solids.push(collider);
  }
  const building = new Set(solids
    .filter((c) => c.maxY - c.minY > 8 && Math.max(c.maxX - c.minX, c.maxZ - c.minZ) > 20)
    .map((c) => c.id));
  return { solids, building };
}

/**
 * Walks every island path ribbon as rendered (centripetal Catmull-Rom over the
 * path centreline, ±RIBBON_HALF_WIDTH across) and reports where it leaves land,
 * enters the lagoon, or passes too close to a solid collider.
 */
export function scanIslandPaths(solids: readonly PathSolid[], building: ReadonlySet<string>,
  centerlines: readonly (readonly (readonly [number, number])[])[] = PATH_CENTERLINES): IslandPathResult[] {
  return centerlines.map((points, k) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, -0.465, z)), false, 'centripetal');
    const samples = points.length * 40;
    const problems = new Set<string>();
    for (let i = 0; i <= samples; i++) {
      const p = curve.getPoint(i / samples);
      const t = curve.getTangent(i / samples).normalize();
      for (let off = -RIBBON_HALF_WIDTH; off <= RIBBON_HALF_WIDTH + 1e-6; off += RIBBON_HALF_WIDTH / 5) {
        const x = p.x + t.z * off;
        const z = p.z - t.x * off;
        const at = `(${x.toFixed(1)}, ${z.toFixed(1)})`;
        if (!isSiteLand(x, z)) problems.add(`off land at ${at}`);
        if (isLagoon(x, z)) problems.add(`in the lagoon at ${at}`);
        for (const c of solids) {
          const gap = Math.hypot(Math.max(c.minX - x, 0, x - c.maxX), Math.max(c.minZ - z, 0, z - c.maxZ));
          const need = building.has(c.id) ? BUILDING_GAP : SCENERY_GAP;
          if (gap < need) problems.add(`${gap.toFixed(2)} m from ${c.id} at ${at}`);
        }
      }
    }
    return { path: k + 1, problems: [...problems] };
  });
}

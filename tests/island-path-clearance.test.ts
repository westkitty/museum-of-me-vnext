import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildMuseumSceneIndex } from '../src/workshop/SceneIndex';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { PATH_CENTERLINES, isLagoon, isSiteLand } from '../src/world/exterior/IslandSiteLayout';

/** Half-width of the rendered path ribbon (IslandLandscape.buildPaths). */
const RIBBON_HALF_WIDTH = 2.3;
/** Minimum gap between a ribbon edge and any solid exterior collider, and between a ribbon edge and a building wall. */
const SCENERY_GAP = 0.5;
const BUILDING_GAP = 1.0;

describe('island path ribbons as rendered', () => {
  const world = new ExteriorWorld('low');
  const index = buildMuseumSceneIndex({ schemaVersion: 2, objects: [] }, { exterior: world.collision });
  // Everything a visitor at ground level could walk into: walls taller than the ground plane.
  // Oriented walls are tested by their axis-aligned bounds, which only makes the check stricter.
  type Snapshot = NonNullable<typeof index.collisions.exterior>[number];
  const solids = (index.collisions.exterior ?? [])
    .filter((c): c is Extract<Snapshot, { kind: 'wall' }> => c.kind === 'wall')
    .filter((c) => c.maxY > -0.45 && c.minY < 1.3);
  const building = solids.filter((c) => c.maxY - c.minY > 8 && Math.max(c.maxX - c.minX, c.maxZ - c.minZ) > 20);

  it('finds the museum building walls to test against', () => {
    expect(building.length).toBeGreaterThanOrEqual(4);
  });

  PATH_CENTERLINES.forEach((points, k) => {
    it(`path ${k + 1}: the full ±${RIBBON_HALF_WIDTH} m spline ribbon stays on land, off the lagoon and clear of every collider`, () => {
      // Same curve the landscape renders, including centripetal spline overshoot.
      const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, -0.465, z)), false, 'centripetal');
      const samples = points.length * 40;
      const problems: string[] = [];
      for (let i = 0; i <= samples; i++) {
        const p = curve.getPoint(i / samples);
        const t = curve.getTangent(i / samples).normalize();
        for (let off = -RIBBON_HALF_WIDTH; off <= RIBBON_HALF_WIDTH + 1e-6; off += RIBBON_HALF_WIDTH / 5) {
          const x = p.x + t.z * off;
          const z = p.z - t.x * off;
          const at = `(${x.toFixed(1)}, ${z.toFixed(1)})`;
          if (!isSiteLand(x, z)) problems.push(`off land at ${at}`);
          if (isLagoon(x, z)) problems.push(`in the lagoon at ${at}`);
          for (const c of solids) {
            const gap = Math.hypot(Math.max(c.minX - x, 0, x - c.maxX), Math.max(c.minZ - z, 0, z - c.maxZ));
            const need = building.includes(c) ? BUILDING_GAP : SCENERY_GAP;
            if (gap < need) problems.push(`${gap.toFixed(2)} m from ${c.id} at ${at}`);
          }
        }
      }
      expect([...new Set(problems)].slice(0, 10)).toEqual([]);
    });
  });
});

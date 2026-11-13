import { describe, expect, it } from 'vitest';
import { RIBBON_HALF_WIDTH, islandPathSolids, scanIslandPaths } from '../src/workshop/IslandPathClearance';
import { buildMuseumSceneIndex } from '../src/workshop/SceneIndex';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { PATH_CENTERLINES } from '../src/world/exterior/IslandSiteLayout';

describe('island path ribbons as rendered', () => {
  const world = new ExteriorWorld('low');
  const index = buildMuseumSceneIndex({ schemaVersion: 2, objects: [] }, { exterior: world.collision });
  const { solids, building } = islandPathSolids(index);
  const results = scanIslandPaths(solids, building);

  it('finds the museum building walls to test against', () => {
    expect(building.size).toBeGreaterThanOrEqual(4);
  });

  PATH_CENTERLINES.forEach((_, k) => {
    it(`path ${k + 1}: the full ±${RIBBON_HALF_WIDTH} m spline ribbon stays on land, off the lagoon and clear of every collider`, () => {
      expect(results[k].problems.slice(0, 10)).toEqual([]);
    });
  });

  it('reports a solid placed on a path', () => {
    const [x, z] = PATH_CENTERLINES[0][1];
    const blocker = { id: 'test-crate', minX: x - 0.5, maxX: x + 0.5, minY: -0.4, maxY: 0.6, minZ: z - 0.5, maxZ: z + 0.5 };
    const [first] = scanIslandPaths([...solids, blocker], building);
    expect(first.problems.some((problem) => problem.includes('from test-crate'))).toBe(true);
  });
});

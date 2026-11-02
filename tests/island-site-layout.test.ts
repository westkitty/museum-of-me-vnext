import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/world/CollisionWorld';
import {
  addIslandSupport, isLagoon, isSiteLand, LAND_GRID_SIZE,
  LAGOON_OUTLINE, SPIRE_GARDEN_CENTER, sitePolygonsAreValid,
} from '../src/world/exterior/IslandSiteLayout';

describe('shared exterior island topology', () => {
  it('uses closed, simple polygons and keeps the lagoon inside island land', () => {
    expect(sitePolygonsAreValid()).toBe(true);
    expect(LAGOON_OUTLINE.every(([x, z]) => isSiteLand(x, z) || isLagoon(x, z))).toBe(true);
    expect(isSiteLand(SPIRE_GARDEN_CENTER[0], SPIRE_GARDEN_CENTER[2])).toBe(true);
    expect(isLagoon(92, 1)).toBe(true);
  });

  it('creates conservative support on land and paths while leaving lagoon and offshore space unsupported', () => {
    const collision = new CollisionWorld();
    const tiles = addIslandSupport(collision);
    expect(tiles).toBeGreaterThan(500);
    expect(tiles).toBeLessThan(1_500);
    expect(collision.supportHeight(0, 0, 0)).toBe(-0.5);
    expect(collision.supportHeight(34, 54, 0)).toBe(-0.5);
    expect(collision.supportHeight(92, 1, 0)).toBeNull();
    expect(collision.supportHeight(260, 0, 0)).toBeNull();
    expect(LAND_GRID_SIZE).toBe(12);
  });
});

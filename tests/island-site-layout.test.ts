import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { START_POSITION, START_YAW } from '../src/world/start';
import { THRESHOLD_PREPARE_Z, VESTIBULE_TO, PLAZA_DEPTH } from '../src/world/layout';
import {
  addIslandSupport, isLagoon, isSiteLand, LAND_GRID_SIZE,
  LAGOON_OUTLINE, LAND_SUPPORT_Y, PIER_CENTERLINE, SPIRE_GARDEN_CENTER, sitePolygonsAreValid,
} from '../src/world/exterior/IslandSiteLayout';

describe('shared exterior island topology', () => {
  it('does not let a masked broad-phase floor support points outside its shape', () => {
    const collision = new CollisionWorld();
    collision.addMaskedFloor(-10, 10, -10, 10, 0, (x, z) => x >= 0 && z >= 0);
    expect(collision.supportHeight(3, 3, 0)).toBe(0);
    expect(collision.supportHeight(-3, 3, 0)).toBeNull();
    expect(collision.supportHeight(3, -3, 0)).toBeNull();
    expect(collision.supportHeight(13, 3, 0)).toBeNull();
    expect(collision.size).toBe(1);
  });

  it('begins on the south pier beyond entrance prompting and predictive loading', () => {
    const pier = PIER_CENTERLINE[2];
    expect(START_POSITION).toEqual([pier[0], LAND_SUPPORT_Y, pier[1]]);
    expect(START_POSITION[2]).toBeGreaterThan(VESTIBULE_TO + PLAZA_DEPTH + 12);
    expect(START_POSITION[2]).toBeGreaterThan(THRESHOLD_PREPARE_Z + 30);
    expect(START_YAW).toBe(0);
  });

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
    // A 12-metre rectangle with four dry corners is conservative; the real
    // coast has narrow land strips that are still visibly walkable.
    for (const [x, z] of [[185, 0], [-181, 0], [131, 30]]) {
      expect(isSiteLand(x, z)).toBe(true);
      expect(collision.supportHeight(x, z, 0)).toBe(LAND_SUPPORT_Y);
    }
    for (const [x, z] of [[190, 0], [92, 1], [260, 0]]) {
      expect(isSiteLand(x, z)).toBe(false);
      expect(collision.supportHeight(x, z, 0)).toBeNull();
    }
    expect(LAND_GRID_SIZE).toBe(12);
  });
});

import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/world/CollisionWorld';
import {
  LAGOON_OUTLINE, LAND_SUPPORT_Y, addIslandSupport, addLagoonEdge, isLagoon,
} from '../src/world/exterior/IslandSiteLayout';

/** Island safety (2026-11-22): the floorless lagoon has a solid bank edge. */
describe('lagoon bank edge', () => {
  it('stops a visitor walking straight at the water from anywhere along the shore', () => {
    const collision = new CollisionWorld();
    addIslandSupport(collision);
    expect(addLagoonEdge(collision)).toBe(LAGOON_OUTLINE.length);
    const cx = LAGOON_OUTLINE.reduce((n, [x]) => n + x, 0) / LAGOON_OUTLINE.length;
    const cz = LAGOON_OUTLINE.reduce((n, [, z]) => n + z, 0) / LAGOON_OUTLINE.length;
    for (let i = 0; i < LAGOON_OUTLINE.length; i++) {
      const [ax, az] = LAGOON_OUTLINE[i];
      const [bx, bz] = LAGOON_OUTLINE[(i + 1) % LAGOON_OUTLINE.length];
      for (const t of [0.1, 0.5, 0.9]) {
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        // Walk from 2 m on the land side straight at the water in 5 cm steps.
        const nx = cx - x, nz = cz - z, n = Math.hypot(nx, nz);
        const pos = { x: x - (nx / n) * 2, y: LAND_SUPPORT_Y, z: z - (nz / n) * 2 };
        expect(isLagoon(pos.x, pos.z)).toBe(false);
        for (let k = 0; k < 120; k++) {
          pos.x += (nx / n) * 0.05; pos.z += (nz / n) * 0.05;
          collision.resolveHorizontal(pos, 0.35, 1.78);
          expect(isLagoon(pos.x, pos.z), `segment ${i} t=${t} step ${k}`).toBe(false);
        }
        expect(collision.supportHeight(pos.x, pos.z, LAND_SUPPORT_Y)).toBe(LAND_SUPPORT_Y);
      }
      // Open water beyond the edge is still unsupported: it is water, not a floor.
      const mx = (ax + bx) / 2 + (cx - (ax + bx) / 2) * 0.3;
      const mz = (az + bz) / 2 + (cz - (az + bz) / 2) * 0.3;
      expect(collision.supportHeight(mx, mz, 0)).toBeNull();
    }
  });
});

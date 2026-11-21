import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { GeometryKit } from '../src/world/GeometryKit';
import { INSTALLATION_PLACEMENTS, bayOpeningSpan } from '../src/world/installationPlacement';
import {
  GROUND_Y, OBSIDIAN_SPHERE_CENTER_Z, PLACEMENT_BY_EXHIBIT, WING_BY_ID, WINGS, faceDirection, place, rightOf,
} from '../src/world/layout';
import { PASSAGES, CAPSULE_RADIUS, CLEARANCE_TOLERANCE, BAY_THRESHOLD_DEPTH } from '../src/world/passages';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/player/PlayerController';
import { ObsidianSphereEntrance } from '../src/world/exterior/ObsidianSphereEntrance';
import { buildMuseum } from './helpers/walk';

/**
 * Passage integrity, 2026-11-21: regressions for the defects the movement-based
 * walkthrough found (docs/PASSAGE_INTEGRITY_2026-11-21.md).
 */

/** True when a capsule standing at (x, z) is pushed by any collider. */
function blocked(world: CollisionWorld, x: number, z: number, y = GROUND_Y): boolean {
  const p = { x, y, z };
  world.resolveHorizontal(p, PLAYER_RADIUS, PLAYER_HEIGHT);
  return Math.hypot(p.x - x, p.z - z) > 1e-6;
}

describe('D1: an opening is as wide in collision as it looks', () => {
  for (const [label, from, to] of [
    ['axis-aligned', [-10, 0, 0], [10, 0, 0]],
    ['diagonal', [-7, 0, -7], [7, 0, 7]],
  ] as const) {
    it(`${label} wall: no collider intrudes into the visible opening`, () => {
      const collision = new CollisionWorld();
      const kit = new GeometryKit(new ResourceScope('d1'), collision, new THREE.Group());
      const width = 4;
      kit.wallWithOpening(from as never, to as never, GROUND_Y, 6, 0.6, width, 4, new THREE.MeshBasicMaterial());
      const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
      const u = [(to[0] - from[0]) / length, (to[2] - from[2]) / length];
      // A capsule centred in the wall plane, as close to the jamb as its own
      // radius plus the walking tolerance allows, must be free.
      const edge = width / 2 - PLAYER_RADIUS - CLEARANCE_TOLERANCE;
      for (const s of [-edge, 0, edge]) expect(blocked(collision, u[0] * s, u[1] * s), `offset ${s}`).toBe(false);
      // And the flanks are still solid just beyond the jamb.
      expect(blocked(collision, u[0] * (width / 2 + 0.3), u[1] * (width / 2 + 0.3))).toBe(true);
    });
  }
});

describe('D1/D2: every passage lane is collision-free where it crosses its aperture', () => {
  const built = buildMuseum();
  for (const passage of PASSAGES.filter((p) => p.world === 'interior' && p.kind !== 'stair' && p.kind !== 'sanctuary')) {
    it(passage.id, () => {
      for (const lane of passage.lanes) {
        const [a, b] = [lane.path[0], lane.path[lane.path.length - 1]];
        // Sample the straight crossing every 10 cm.
        const steps = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.1);
        for (let i = 0; i <= steps; i++) {
          const x = a[0] + (b[0] - a[0]) * (i / steps);
          const z = a[2] + (b[2] - a[2]) * (i / steps);
          expect(blocked(built.collision, x, z, a[1]), `${passage.id} lane ${lane.offset} at (${x.toFixed(2)}, ${z.toFixed(2)})`).toBe(false);
        }
      }
    });
  }
});

describe('D2: source installations stand clear of their bay mouths', () => {
  it('no installation footprint or lectern lies within the swept doorway of its host bay', () => {
    for (const install of INSTALLATION_PLACEMENTS.filter((p) => p.host !== 'sanctuary')) {
      const bay = PLACEMENT_BY_EXHIBIT.get(install.host)!;
      const wing = WING_BY_ID.get(bay.wing)!;
      const dir = faceDirection(wing.face);
      const r = rightOf(dir);
      const sign = bay.side === 'right' ? 1 : -1;
      const along = wing.hallFrom + wing.bayLead + bay.slot * wing.bayPitch;
      const wallPoint = place(dir, along, sign * wing.hallHalfWidth, wing.floorY);
      // Footprint corners in world space (axis-aligned collider).
      // Corners of the exact oriented collider (local x toward the hall).
      const o = install.orientedFootprint;
      const cos = Math.cos(o.yaw), sin = Math.sin(o.yaw);
      const corners = [[-o.halfX, -o.halfZ], [o.halfX, -o.halfZ], [-o.halfX, o.halfZ], [o.halfX, o.halfZ]]
        .map(([lx, lz]) => [install.position[0] + cos * lx + sin * lz, install.position[2] - sin * lx + cos * lz]);
      // Depth of the footprint's nearest point behind the hall wall plane, and
      // its extent along the hall relative to the opening.
      const depths = corners.map(([x, z]) => ((x - wallPoint[0]) * r[0] + (z - wallPoint[2]) * r[2]) * sign);
      const alongs = corners.map(([x, z]) => (x - wallPoint[0]) * dir[0] + (z - wallPoint[2]) * dir[2]);
      const nearestDepth = Math.min(...depths);
      // The clear doorway: the full opening, or narrowed by a wall return
      // where an installation could not be set back (bayOpeningSpan).
      const span = bayOpeningSpan(install.host);
      const overlapsOpeningSpan = Math.min(...alongs) < span.to - 1e-6 && Math.max(...alongs) > span.from + 1e-6;
      // A visitor stepping through any lane must cross the threshold
      // (the passage inventory's destination) with capsule clearance.
      if (overlapsOpeningSpan) {
        expect(nearestDepth, `${install.id} in ${install.host}`).toBeGreaterThan(BAY_THRESHOLD_DEPTH + CAPSULE_RADIUS + CLEARANCE_TOLERANCE);
      }
    }
  });
});

describe('D3: the obsidian column is no larger in collision than it looks', () => {
  it('a capsule just outside the visible column is free at every angle; inside the column is solid', () => {
    const collision = new CollisionWorld();
    collision.addFloor(-20, 20, 110, 160, GROUND_Y);
    new ObsidianSphereEntrance(new ResourceScope('d3'), collision).build();
    const visibleRadius = 2.95; // CylinderGeometry(2.55, 2.95) base radius
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const rFree = visibleRadius + PLAYER_RADIUS + 0.35;
      expect(blocked(collision, Math.cos(a) * rFree, OBSIDIAN_SPHERE_CENTER_Z + Math.sin(a) * rFree), `angle ${a.toFixed(2)}`).toBe(false);
      const rSolid = visibleRadius * 0.9;
      expect(blocked(collision, Math.cos(a) * rSolid, OBSIDIAN_SPHERE_CENTER_Z + Math.sin(a) * rSolid), `solid at ${a.toFixed(2)}`).toBe(true);
    }
  });
});

describe('D4: no blank white panels or walk-through solids in the vestibule', () => {
  it('the vestibule carries no featureless white overlay walls', () => {
    const built = buildMuseum();
    const names: string[] = [];
    built.root.traverse((o) => { if (o.name) names.push(o.name); });
    expect(names.filter((n) => n.startsWith('baseline-vestibule-wall'))).toEqual([]);
  });
  it('wings exist as before', () => {
    expect(WINGS).toHaveLength(6);
  });
});

describe('obsidian chamber: wading movement', () => {
  async function controller(run = false) {
    const { PlayerController } = await import('../src/player/PlayerController');
    const collision = new CollisionWorld();
    collision.addFloor(-200, 200, -200, 200, GROUND_Y);
    const keys = new Set(['forward', ...(run ? ['run'] : [])]);
    const input = { isDown: (a: string) => keys.has(a), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
    return new PlayerController(collision, input as never);
  }
  const speedAfter = (player: Awaited<ReturnType<typeof controller>>, inWater: boolean, seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) { player.setInWater(inWater); player.fixedUpdate(1 / 60); }
    const z0 = player.position.z;
    for (let i = 0; i < 30; i++) { player.setInWater(inWater); player.fixedUpdate(1 / 60); }
    return (z0 - player.position.z) * 2;
  };

  it('eases to about 62% of walking speed inside, and back to full speed outside', async () => {
    const { WALK_SPEED } = await import('../src/player/PlayerController');
    const player = await controller();
    expect(speedAfter(player, false, 1)).toBeCloseTo(WALK_SPEED, 1);
    // Not instant: a quarter-second after entering it is still between the two.
    player.setInWater(true); for (let i = 0; i < 15; i++) { player.setInWater(true); player.fixedUpdate(1 / 60); }
    expect(player.waterLevel).toBeGreaterThan(0.2);
    expect(player.waterLevel).toBeLessThan(0.6);
    const wet = speedAfter(player, true, 3);
    expect(wet / WALK_SPEED).toBeGreaterThan(0.55);
    expect(wet / WALK_SPEED).toBeLessThan(0.7);
    expect(speedAfter(player, false, 3)).toBeCloseTo(WALK_SPEED, 1);
  });

  it('a sprint in the water is still slower than an ordinary walk', async () => {
    const { WALK_SPEED } = await import('../src/player/PlayerController');
    const player = await controller(true);
    expect(speedAfter(player, true, 3)).toBeLessThan(WALK_SPEED);
  });

  it('the chamber is the sphere interior only', async () => {
    const { isInsideObsidianChamber } = await import('../src/world/exterior/ObsidianSphereEntrance');
    expect(isInsideObsidianChamber(0, OBSIDIAN_SPHERE_CENTER_Z + 6)).toBe(true);
    expect(isInsideObsidianChamber(5, OBSIDIAN_SPHERE_CENTER_Z)).toBe(true);
    expect(isInsideObsidianChamber(0, OBSIDIAN_SPHERE_CENTER_Z + 12)).toBe(false); // plaza
    expect(isInsideObsidianChamber(0, 126)).toBe(false); // beyond the seam doorway
  });
});

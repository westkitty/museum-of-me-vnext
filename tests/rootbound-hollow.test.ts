import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import {
  ANCIENT_TREE_CENTER,
  ANCIENT_TREE_CLEARING_RADIUS,
  LAND_SUPPORT_Y,
  ROOTBOUND_HOLLOW_CENTER,
  ROOTBOUND_HOLLOW_PORTAL,
} from '../src/world/exterior/IslandSiteLayout';
import {
  ROOTBOUND_CHAMBER_FLOOR_Y,
  ROOTBOUND_RELIC_ID,
  ROOTBOUND_RELIC_POSITION,
  ROOTBOUND_THRESHOLD_Y,
} from '../src/world/exterior/ExteriorRootboundHollow';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { Journal } from '../src/state/Journal';
import { SECRETS } from '../src/content/secrets';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/player/PlayerController';
import type { Vec3 } from '../src/world/layout';
import { walkRoute } from './helpers/walk';

describe('ISLAND-02C Rootbound Hollow beneath Ancient Tree roots', () => {
  it('supports continuous physical traversal from western approach [50.5, -84] into the vaulted chamber and back out', () => {
    const world = new ExteriorWorld('low');

    const inbound: Vec3[] = [
      [50.5, LAND_SUPPORT_Y, -84.0],
      [52.6, LAND_SUPPORT_Y, -86.6],
      [54.1, LAND_SUPPORT_Y, -88.8],
      [ROOTBOUND_HOLLOW_PORTAL[0], -0.37, ROOTBOUND_HOLLOW_PORTAL[1]],
      [56.6, ROOTBOUND_THRESHOLD_Y, -88.8],
      [58.4, ROOTBOUND_CHAMBER_FLOOR_Y, -88.8],
      [60.2, ROOTBOUND_CHAMBER_FLOOR_Y, -88.6],
      [62.2, ROOTBOUND_CHAMBER_FLOOR_Y, -88.6],
      // Walk around both flanks of the Relic pedestal inside the chamber
      [62.4, ROOTBOUND_CHAMBER_FLOOR_Y, -90.4],
      [64.2, ROOTBOUND_CHAMBER_FLOOR_Y, -90.4],
      [62.2, ROOTBOUND_CHAMBER_FLOOR_Y, -90.2],
      [62.2, ROOTBOUND_CHAMBER_FLOOR_Y, -86.8],
      [64.2, ROOTBOUND_CHAMBER_FLOOR_Y, -86.8],
      [62.2, ROOTBOUND_CHAMBER_FLOOR_Y, -88.6],
    ];

    const inboundSteps = inbound.map((at, i) => ({ label: `inbound-${i}`, at }));
    expect(walkRoute(world.collision, inboundSteps)).toEqual([]);

    const outbound = [
      [62.2, ROOTBOUND_CHAMBER_FLOOR_Y, -88.6],
      [60.2, ROOTBOUND_CHAMBER_FLOOR_Y, -88.6],
      [58.4, ROOTBOUND_CHAMBER_FLOOR_Y, -88.8],
      [56.6, ROOTBOUND_THRESHOLD_Y, -88.8],
      [54.1, LAND_SUPPORT_Y, -88.8],
      [52.6, LAND_SUPPORT_Y, -86.6],
      [50.5, LAND_SUPPORT_Y, -84.0],
    ] as const satisfies readonly Vec3[];
    const outboundSteps = outbound.map((at, i) => ({ label: `outbound-${i}`, at }));
    expect(walkRoute(world.collision, outboundSteps)).toEqual([]);

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('preserves Ancient Tree coordinates, trunk collider, clearing radius, and existing tree-roots secret', () => {
    const world = new ExteriorWorld('medium');

    expect(ANCIENT_TREE_CENTER).toEqual([57, -0.48, -84]);
    expect(ANCIENT_TREE_CLEARING_RADIUS).toBe(11);
    expect(world.root.getObjectByName('ancient-tree-landmark')).toBeTruthy();

    // Trunk collider [57, -0.48 + 3.4, -84], half-extents [2.3, 3.4, 2.3] remains intact
    const trunkWall = world.collision.snapshot().find(
      (c) =>
        c.kind === 'wall'
        && Math.abs((c.minX + c.maxX) / 2 - 57) < 0.01
        && Math.abs((c.minZ + c.maxZ) / 2 - (-84)) < 0.01
        && Math.abs((c.maxX - c.minX) / 2 - 2.3) < 0.01
        && Math.abs((c.maxY - c.minY) / 2 - 3.4) < 0.01,
    );
    expect(trunkWall).toBeDefined();

    // Existing tree-roots carved stone secret remains unobstructed
    const stone = SECRETS.find((s) => s.id === 'tree-roots')!;
    if (stone.trigger.kind !== 'object') throw new Error('expected object trigger');
    expect(
      world.collision.resolveHorizontal(
        { x: stone.trigger.position[0], y: -0.5, z: stone.trigger.position[2] },
        0.3,
        PLAYER_HEIGHT,
      ),
    ).toBe(false);

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('raises the interior floor strictly above the Y=-0.5 grass plane and encloses walls/vault with solid collision', () => {
    const world = new ExteriorWorld('low');

    // Chamber floor sits 12 cm above Y = -0.50 grass plane -> zero grass-plane clipping
    const chamberY = world.collision.supportHeight(
      ROOTBOUND_HOLLOW_CENTER[0],
      ROOTBOUND_HOLLOW_CENTER[2],
      ROOTBOUND_CHAMBER_FLOOR_Y,
    );
    expect(chamberY).toBeCloseTo(ROOTBOUND_CHAMBER_FLOOR_Y, 4);
    expect(chamberY!).toBeGreaterThan(-0.46);

    // Threshold saddle rises smoothly above -0.50
    const crestY = world.collision.supportHeight(56.6, -88.8, -0.5);
    expect(crestY).toBeCloseTo(ROOTBOUND_THRESHOLD_Y, 4);

    // Headroom and solid roof slab overhead
    const ceiling = world.collision.ceilingHeight(
      ROOTBOUND_HOLLOW_CENTER[0],
      ROOTBOUND_HOLLOW_CENTER[2],
      ROOTBOUND_CHAMBER_FLOOR_Y,
    );
    expect(Number.isFinite(ceiling)).toBe(true);
    expect(ceiling - ROOTBOUND_CHAMBER_FLOOR_Y).toBeGreaterThan(PLAYER_HEIGHT + 0.5);

    // Perimeter walls and relic shrine pedestal block horizontal penetration
    expect(world.collision.resolveHorizontal({ x: 61.8, y: ROOTBOUND_CHAMBER_FLOOR_Y, z: -91.5 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: 61.8, y: ROOTBOUND_CHAMBER_FLOOR_Y, z: -85.7 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: 65.2, y: ROOTBOUND_CHAMBER_FLOOR_Y, z: -88.6 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: ROOTBOUND_RELIC_POSITION[0], y: ROOTBOUND_CHAMBER_FLOOR_Y, z: ROOTBOUND_RELIC_POSITION[2] }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('maintains zero THREE.Light objects, registers rootbound-hollow-relic without touching Journal/SECRETS, honors reducedMotion, and disposes cleanly', () => {
    const world = new ExteriorWorld('high');

    const lights: THREE.Light[] = [];
    world.root.traverse((obj) => {
      if ((obj as THREE.Light).isLight) lights.push(obj as THREE.Light);
    });
    expect(lights).toHaveLength(0);

    expect(world.root.getObjectByName('rootbound-hollow')).toBeTruthy();
    expect(world.root.getObjectByName('rootbound-hollow-portal')).toBeTruthy();
    expect(world.root.getObjectByName('rootbound-hollow-chamber')).toBeTruthy();
    expect(world.root.getObjectByName('rootbound-hollow-relic-core')).toBeTruthy();

    // Respects reducedMotion
    const seed = world.root.getObjectByName('rootbound-heartwood-seed')!;
    const ring = world.root.getObjectByName('rootbound-relic-outer-ring')!;
    world.variableUpdate(1.0, [62.2, ROOTBOUND_CHAMBER_FLOOR_Y + 1.64, -88.6], 'plaza', true);
    expect(seed.rotation.y).toBe(0);
    const restRingY = ring.rotation.y;
    world.variableUpdate(1.0, [62.2, ROOTBOUND_CHAMBER_FLOOR_Y + 1.64, -88.6], 'plaza', false);
    expect(seed.rotation.y).not.toBe(0);
    expect(ring.rotation.y).not.toBe(restRingY);

    // InteractionManager raycast focus & activation from chamber center looking east at relic
    const interaction = new InteractionManager();
    const announcements: string[] = [];
    const journal = new Journal(null);
    const control = world.rootboundHollow.getRelicControl((msg) => announcements.push(msg));
    interaction.register(ROOTBOUND_RELIC_ID, control);

    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200);
    camera.position.set(62.2, ROOTBOUND_CHAMBER_FLOOR_Y + 1.64, -88.6);
    camera.lookAt(ROOTBOUND_RELIC_POSITION[0], ROOTBOUND_CHAMBER_FLOOR_Y + 1.48, ROOTBOUND_RELIC_POSITION[2]);
    camera.updateMatrixWorld();
    world.root.updateMatrixWorld(true);

    interaction.update(camera, 0.1);
    expect(interaction.currentFocus?.exhibitId).toBe(ROOTBOUND_RELIC_ID);
    expect(interaction.currentFocus?.label).toContain('Examine Rootbound Relic');

    expect(interaction.activate()).toBe(true);
    expect(announcements).toHaveLength(1);
    expect(announcements[0]).toContain('Rootbound Hollow');
    expect(interaction.currentFocus?.label).toContain('discovered');

    // Confirm SECRETS count remains 10 (not an 11th passport stamp) & Journal stays clean
    expect(SECRETS).toHaveLength(10);
    expect(journal.visitedCount).toBe(0);

    interaction.dispose();
    world.dispose();
    expect(world.scope.size).toBe(0);
  });
});

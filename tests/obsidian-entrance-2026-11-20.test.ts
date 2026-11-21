import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import {
  ObsidianSphereEntrance, isSphereWallSector, sphereRevealLevel,
} from '../src/world/exterior/ObsidianSphereEntrance';
import {
  OBSIDIAN_SPHERE_CENTER_Z, ENTRANCE_PORTAL_Z, TICKET_KIOSK_POSITION,
} from '../src/world/layout';
import { PlayerController, PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/player/PlayerController';

function build(): { collision: CollisionWorld; entrance: ObsidianSphereEntrance; scope: ResourceScope } {
  const scope = new ResourceScope('obsidian-entrance-test');
  const collision = new CollisionWorld();
  collision.addFloor(-16, 16, ENTRANCE_PORTAL_Z - 3, 155, 0);
  const entrance = new ObsidianSphereEntrance(scope, collision);
  entrance.build();
  return { collision, entrance, scope };
}

function player(collision: CollisionWorld): PlayerController {
  const input = {
    on: () => () => undefined,
    isDown: (action: string) => action === 'forward',
    uiCaptured: false,
    touchMoveX: 0,
    touchMoveY: 0,
  };
  return new PlayerController(collision, input as never);
}

function walkTo(controller: PlayerController, x: number, z: number): void {
  for (let tick = 0; tick < 600; tick++) {
    const dx = x - controller.position.x;
    const dz = z - controller.position.z;
    if (Math.hypot(dx, dz) < 0.42) return;
    controller.yaw = Math.atan2(-dx, -dz);
    controller.fixedUpdate(1 / 60);
  }
  throw new Error('Timed out at ' + controller.position.toArray().join(',') + ' toward ' + x + ',' + z);
}

describe('obsidian spherical entrance: real passage, two-way and light', () => {
  it('creates one physical sphere, a solid central monolith, and two open door sectors', () => {
    const { collision, entrance, scope } = build();
    const names = new Set<string>();
    entrance.group.traverse((node) => names.add(node.name));
    expect(names).toContain('obsidian-sphere-dome');
    expect(names).toContain('obsidian-central-column');
    expect(names).toContain('obsidian-sphere-outside-arch');
    expect(names).toContain('obsidian-sphere-atrium-arch');
    expect(names).toContain('obsidian-circulation-arc-west');
    expect(names).toContain('obsidian-circulation-arc-east');
    expect([...Array(32).keys()].filter(isSphereWallSector).length).toBeGreaterThan(16);

    const wallBatch = entrance.group.getObjectByName('obsidian-sphere-curved-wall-batch') as THREE.InstancedMesh;
    expect(wallBatch.isInstancedMesh).toBe(true);
    expect(wallBatch.count).toBe([...Array(32).keys()].filter(isSphereWallSector).length);
    expect(entrance.group.getObjectByName('obsidian-sphere-meridian-batch')).toBeDefined();
    expect(entrance.group.getObjectByName('obsidian-open-sky-oculus')).toBeDefined();
    // One batched wall draw and one merged meridian draw keep the actual
    // shadowless sphere affordable; do not reintroduce 46 individual meshes.
    let meshes = 0;
    entrance.group.traverse((node) => { if ((node as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBeLessThanOrEqual(20);

    const inside = { x: 0, y: 0, z: OBSIDIAN_SPHERE_CENTER_Z };
    expect(collision.resolveHorizontal(inside, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(Math.hypot(inside.x, inside.z - OBSIDIAN_SPHERE_CENTER_Z)).toBeGreaterThan(2.9);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('permits real ground-collision traversal around either side without a teleport', () => {
    for (const side of [-1, 1]) {
      const { collision, scope } = build();
      const controller = player(collision);
      controller.teleport([0, 0, 150], 0);
      for (const [x, z] of [
        [0, 147], [side * 4.8, 143], [side * 5.2, 138],
        [side * 4.8, 133], [0, 130], [0, 127],
      ]) {
        walkTo(controller, x, z);
        expect(controller.grounded).toBe(true);
        expect(controller.position.y).toBeCloseTo(0, 1);
      }
      expect(controller.position.z).toBeLessThan(129);
      for (const [x, z] of [
        [0, 130], [side * 4.8, 133], [side * 5.2, 138],
        [side * 4.8, 143], [0, 147], [0, 150],
      ]) walkTo(controller, x, z);
      expect(controller.position.z).toBeGreaterThan(149);
      scope.dispose();
    }
  });

  it('fades restrained threshold lighting in by depth, with stable reduced motion', () => {
    expect(TICKET_KIOSK_POSITION[2]).toBeGreaterThan(OBSIDIAN_SPHERE_CENTER_Z + 10);
    const far = sphereRevealLevel(0, 154);
    const entry = sphereRevealLevel(0, 145);
    const exit = sphereRevealLevel(0, 130);
    expect(far).toBeLessThan(entry);
    expect(entry).toBeLessThan(exit);
    expect(sphereRevealLevel(0, 138, true)).toBeCloseTo(0.52);

    const { entrance, scope } = build();
    const ring = entrance.group.getObjectByName('obsidian-sphere-floor-ring') as THREE.Mesh;
    entrance.update(1, [0, 0, 145], false);
    const before = (ring.material as THREE.MeshBasicMaterial).opacity;
    for (let t = 0; t < 120; t++) entrance.update(1 / 60, [0, 0, 130], false);
    expect((ring.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(before);
    entrance.update(1 / 60, [0, 0, 135], true);
    expect((ring.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.04 + 0.52 * 0.62);
    const vaults = [1, 2, 3].map((number) => entrance.group.getObjectByName(
      'obsidian-reveal-vault-' + number,
    ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>);
    expect(vaults.every(Boolean)).toBe(true);
    const opacity = (index: number) => vaults[index].material.opacity;
    // The first arch responds before the two inner arches, so the route
    // emerges through walking rather than a simultaneous flashing effect.
    entrance.update(1 / 60, [0, 0, 145], false);
    expect(opacity(0)).toBeGreaterThan(opacity(1));
    expect(opacity(1)).toBeCloseTo(opacity(2), 5);
    for (let t = 0; t < 120; t++) entrance.update(1 / 60, [0, 0, 130], false);
    expect(opacity(2)).toBeGreaterThan(0.1);
    entrance.update(1 / 60, [0, 0, 140], true);
    expect(opacity(0)).toBeCloseTo(opacity(1));
    expect(opacity(1)).toBeCloseTo(opacity(2));
    scope.dispose();
  });
});

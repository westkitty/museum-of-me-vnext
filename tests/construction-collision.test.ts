import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { constructionColliders } from '../src/workshop/ConstructionCollision';
import type { WorkshopPlacementRecord } from '../src/workshop/schema';

function bind(world: CollisionWorld, record: WorkshopPlacementRecord): void {
  for (const { id, collider } of constructionColliders(record)) {
    if (collider.kind === 'floor') world.setDynamicFloor(id, collider);
    else world.setDynamicWall(id, collider);
  }
}

describe('construction collision without meshes', () => {
  it('retains a rotated door opening and its jambs from saved metadata', () => {
    const angle = 2.3;
    const record: WorkshopPlacementRecord = { id: 'wall', label: 'wall', prefab: 'partition-wall', anchor: 'floor',
      position: [20, 0, 20], rotation: [0, angle, 0], scale: [3, 1, 1], opening: 'door', collision: 'solid' };
    const world = new CollisionWorld();
    bind(world, record);
    expect(world.resolveHorizontal({ x: 20, y: 0, z: 20 }, 0.35, 1.78)).toBe(false);
    expect(world.resolveHorizontal({ x: 20 + Math.cos(angle) * 1.05, y: 0,
      z: 20 - Math.sin(angle) * 1.05 }, 0.35, 1.78)).toBe(true);
    expect(world.ceilingHeight(20, 20, 2)).toBeCloseTo(2.19);
  });

  it('uses the rotated slab footprint rather than its bounding rectangle', () => {
    const record: WorkshopPlacementRecord = { id: 'floor', label: 'floor', prefab: 'floor-slab', anchor: 'floor',
      position: [20, 2, 20], rotation: [0, Math.PI / 4, 0], scale: [2, 1, 1], collision: 'solid' };
    const world = new CollisionWorld();
    bind(world, record);
    expect(world.supportHeight(20, 20, 2)).toBeCloseTo(2);
    expect(world.supportHeight(22, 22, 2)).toBeNull();
  });
});

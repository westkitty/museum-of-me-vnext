import { describe, expect, it } from 'vitest';
import { CollisionWorld, type Wall } from '../src/world/CollisionWorld';

const wallAt = (x: number, z: number): Wall => ({
  kind: 'wall', minX: x - 1, maxX: x + 1, minY: 0, maxY: 3, minZ: z - 1, maxZ: z + 1,
});

describe('dynamic collider spatial index', () => {
  it('retains collisions and floor support through moves, replacements and removal', () => {
    const world = new CollisionWorld();
    for (let i = 0; i < 2000; i++) world.setDynamicWall(`distant-${i}`, wallAt(1000 + i * 3, 1000));
    world.setDynamicWall('wall', wallAt(-12, -12));
    world.setDynamicFloor('floor', { kind: 'floor', minX: -14, maxX: -10, minZ: -14, maxZ: -10, y: 2 });
    expect(world.size).toBe(2002);
    expect(world.supportHeight(-12, -12, 2)).toBe(2);
    const position = { x: -12, y: 2, z: -12 };
    expect(world.resolveHorizontal(position, 0.3, 1)).toBe(true);
    world.setDynamicWall('wall', wallAt(25, 25));
    world.setDynamicFloor('floor', { kind: 'floor', minX: 24, maxX: 26, minZ: 24, maxZ: 26, y: 4 });
    expect(world.resolveHorizontal({ x: -12, y: 0, z: -12 }, 0.3, 1)).toBe(false);
    expect(world.supportHeight(-12, -12, 2)).toBeNull();
    expect(world.supportHeight(25, 25, 4)).toBe(4);
    expect(world.resolveHorizontal({ x: 25, y: 0, z: 25 }, 0.3, 1)).toBe(true);
    world.setDynamicWall('wall', null);
    world.setDynamicFloor('floor', null);
    expect(world.resolveHorizontal({ x: 25, y: 0, z: 25 }, 0.3, 1)).toBe(false);
    expect(world.supportHeight(25, 25, 4)).toBeNull();
    world.clear();
    expect(world.size).toBe(0);
  });

  it('deduplicates multi-cell walls and preserves insertion order after replacement', () => {
    const world = new CollisionWorld();
    const broad: Wall = { kind: 'wall', minX: -20, maxX: 20, minY: 0, maxY: 3, minZ: -1, maxZ: 1 };
    world.setDynamicWall('first', broad);
    world.setDynamicWall('second', wallAt(0, 0));
    const before = { x: 0, y: 0, z: 0 };
    world.resolveHorizontal(before, 0.3, 1);
    world.setDynamicWall('first', { ...broad });
    const after = { x: 0, y: 0, z: 0 };
    world.resolveHorizontal(after, 0.3, 1);
    expect(after).toEqual(before);
  });
});

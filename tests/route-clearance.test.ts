import { describe, expect, it } from 'vitest';
import { CollisionWorld, type ColliderSnapshot } from '../src/world/CollisionWorld';
import { buildMuseumSceneIndex } from '../src/workshop/SceneIndex';
import { routeMayIntersectWall, scanAuthoredRouteClearance } from '../src/workshop/RouteClearance';
import type { WorkshopPlacementManifest } from '../src/workshop/schema';

const manifest: WorkshopPlacementManifest = { schemaVersion: 1, objects: [{ id: 'blocked-wall', label: 'Wall',
  prefab: 'partition-wall', anchor: 'floor', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: 'solid', worldId: 'interior' }] };
const wall: Extract<ColliderSnapshot, { kind: 'wall' }> = { id: 'wall:blocked-wall', ownership: 'dynamic', kind: 'wall',
  minX: -1, maxX: 1, minY: 0, maxY: 3, minZ: -0.1, maxZ: 0.1 };

describe('authored route clearance advisory', () => {
  it('finds intersecting walls, preserves vertical separation and respects rotated narrow phase', () => {
    expect(routeMayIntersectWall([0, 0, -5], [0, 0, 5], wall)).toBe(true);
    expect(routeMayIntersectWall([0, 10, -5], [0, 10, 5], wall)).toBe(false);
    expect(routeMayIntersectWall([4, 0, -5], [4, 0, 5], wall)).toBe(false);
    const rotated = { ...wall, minX: -4, maxX: 4, minZ: -4, maxZ: 4,
      oriented: { centerX: 0, centerZ: 0, halfX: 2, halfZ: 0.1, yaw: Math.PI / 4 } };
    expect(routeMayIntersectWall([2, 0, 2], [3, 0, 3], rotated)).toBe(false);
    expect(routeMayIntersectWall([-1, 0, 1], [1, 0, -1], rotated)).toBe(true);
  });

  it('reports the responsible authored object without claiming full route safety', () => {
    const outside = new CollisionWorld(), inside = new CollisionWorld();
    inside.setDynamicWall('blocked-wall', wall);
    const base = buildMuseumSceneIndex(manifest, { exterior: outside, interior: inside });
    const index = { ...base, route: [
      { id: 'route:000', label: 'start', position: [0, 0, -5] as const },
      { id: 'route:001', label: 'end', position: [0, 0, 5] as const },
    ] };
    const report = scanAuthoredRouteClearance(index);
    expect(report.status).toBe('WARNING');
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ objectId: 'blocked-wall', authority: 'authored', world: 'interior' });
    inside.setDynamicWall('blocked-wall', null);
    const clear = scanAuthoredRouteClearance({ ...index, collisions: { exterior: outside.snapshot(), interior: inside.snapshot() } });
    expect(clear.findings).toHaveLength(0);
    expect(clear.status).toBe('WARNING');
    expect(scanAuthoredRouteClearance({ ...index, collisions: { exterior: null, interior: inside.snapshot() } }).status).toBe('UNKNOWN');
  });
});

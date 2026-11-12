import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MAX_RESIDENT_PLACEMENTS, MuseumPlacements, RESIDENT_RADIUS } from '../src/workshop/MuseumPlacements';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { canonicalizeWorkshopManifest, type WorkshopPlacementRecord } from '../src/workshop/schema';

const PREFABS = ['museum-bench', 'display-plinth', 'artifact-table', 'sign-post', 'sculpture-sphere'] as const;

/** 2,000 records spread over a 40 x 50 grid, 4 m apart, on the exterior island. */
function distributed(count = 2000, extra: Partial<WorkshopPlacementRecord> = {}): WorkshopPlacementRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `bulk-${String(index).padStart(4, '0')}`,
    label: `Bulk ${index}`,
    prefab: PREFABS[index % PREFABS.length],
    anchor: 'floor',
    position: [120 + (index % 40) * 4, 0, 120 + Math.floor(index / 40) * 4] as [number, number, number],
    rotation: [0, (index % 7) * 0.4, 0] as [number, number, number],
    scale: [1 + (index % 3) * 0.25, 1, 1] as [number, number, number],
    worldId: 'exterior',
    ...extra,
  }));
}
const manifest = (objects: WorkshopPlacementRecord[]) => ({ schemaVersion: 2 as const, objects });
const focusAt = (x: number, z: number) => new THREE.Vector3(x, 1.7, z);
const liveIds = (placements: MuseumPlacements) => placements.group.children.map((child) => child.userData.workshopId as string);

describe('Workshop bounded placement residency', () => {
  it('keeps 2,000 saved placements as records and builds only a bounded nearby set', () => {
    const objects = distributed();
    const started = performance.now();
    const placements = new MuseumPlacements(manifest(objects));
    expect(placements.objectCount).toBe(2000);
    expect(placements.residentCount).toBe(0);

    placements.syncWorld('exterior', new CollisionWorld(), undefined, undefined, undefined, focusAt(120, 120));
    const elapsed = performance.now() - started;
    expect(placements.residentCount).toBeGreaterThan(0);
    expect(placements.residentCount).toBeLessThanOrEqual(MAX_RESIDENT_PLACEMENTS);
    for (const id of liveIds(placements)) {
      const record = placements.getRecord(id)!;
      expect(Math.hypot(record.position[0] - 120, record.position[2] - 120)).toBeLessThanOrEqual(RESIDENT_RADIUS + 2);
    }
    expect(placements.captureManifest().objects).toEqual(canonicalizeWorkshopManifest(manifest(objects)).objects);
    // Informational only: a CPU-side construction measurement, not GPU or frame time.
    console.info(`[residency] 2000 records, ${placements.residentCount} live, setup ${elapsed.toFixed(1)} ms`);
    placements.dispose();
  });

  it('releases far placements and builds near ones as the focus moves, without losing records', () => {
    const objects = distributed();
    const placements = new MuseumPlacements(manifest(objects));
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(120, 120));
    const near = placements.getObject('bulk-0000')!;
    const disposals = near.children.map((child) => vi.spyOn((child as THREE.Mesh).geometry, 'dispose'));

    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(276, 316));
    expect(near.parent).toBeNull();
    for (const spy of disposals) expect(spy).toHaveBeenCalledOnce();
    expect(liveIds(placements)).not.toContain('bulk-0000');
    expect(liveIds(placements)).toContain('bulk-1999');
    expect(placements.residentCount).toBeLessThanOrEqual(MAX_RESIDENT_PLACEMENTS);
    expect(placements.captureManifest().objects).toHaveLength(2000);
    expect(placements.getRecord('bulk-0000')).toEqual(objects[0]);
    placements.dispose();
  });

  it('derives collision for every solid placement, live or not, identical to the live root bounds', () => {
    const objects = distributed(2000, { collision: 'solid' });
    const placements = new MuseumPlacements(manifest(objects));
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(120, 120));
    const walls = new Map(world.snapshot().filter((entry) => entry.ownership === 'dynamic')
      .map((entry) => [entry.id, entry]));
    expect(walls.size).toBe(2000);
    expect(placements.residentCount).toBeLessThanOrEqual(MAX_RESIDENT_PLACEMENTS);

    // Compare dormant record-derived bounds with the bounds of the same object once built.
    for (const id of ['bulk-1999', 'bulk-1501', 'bulk-0977', 'bulk-0822']) {
      expect(liveIds(placements)).not.toContain(id);
      const root = placements.getObject(id)!;
      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      const wall = walls.get(`wall:${id}`) as unknown as Record<string, number>;
      for (const [key, value] of Object.entries({ minX: box.min.x, maxX: box.max.x, minY: box.min.y,
        maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z })) expect(wall[key]).toBeCloseTo(value, 6);
    }
    placements.dispose();
    expect(world.snapshot().filter((entry) => entry.ownership === 'dynamic')).toEqual([]);
  });

  it('never unloads the pinned selection or a root moved by an uncaptured live edit', () => {
    const placements = new MuseumPlacements(manifest(distributed()));
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(120, 120));
    const edited = placements.getObject('bulk-0001')!;
    edited.position.x += 0.5;
    placements.setPinned('bulk-1000');
    const pinned = placements.getObject('bulk-1000')!;

    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(276, 316));
    expect(placements.getObject('bulk-0001')).toBe(edited);
    expect(edited.parent).toBe(placements.group);
    expect(placements.getObject('bulk-1000')).toBe(pinned);
    const captured = placements.captureManifest().objects.find((record) => record.id === 'bulk-0001')!;
    expect(captured.position[0]).toBeCloseTo(124.5, 6);

    placements.setPinned(null);
    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(120, 120));
    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(276, 316));
    expect(pinned.parent).toBeNull();
    placements.dispose();
  });

  it('removes and edits dormant placements and updates their collision', () => {
    const placements = new MuseumPlacements(manifest(distributed(2000, { collision: 'solid' })));
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(120, 120));
    const far = placements.getRecord('bulk-1999')!;
    expect(liveIds(placements)).not.toContain('bulk-1999');

    placements.removeRecord('bulk-1998');
    placements.setRecord({ ...far, position: [far.position[0], 0, far.position[2] + 1] });
    placements.syncWorld('exterior', world, undefined, undefined, undefined, focusAt(120, 120));
    const ids = world.snapshot().map((entry) => entry.id);
    expect(ids).not.toContain('wall:bulk-1998');
    expect(placements.objectCount).toBe(1999);
    expect(placements.getRecord('bulk-1999')?.position[2]).toBe(far.position[2] + 1);
    const moved = world.snapshot().find((entry) => entry.id === 'wall:bulk-1999') as unknown as { minZ: number };
    expect(moved.minZ).toBeGreaterThan(far.position[2] - 1);
    placements.dispose();
  });

  it('keeps every placement of a small manifest live regardless of focus', () => {
    const placements = new MuseumPlacements(manifest(distributed(40)));
    placements.syncWorld('exterior', new CollisionWorld(), undefined, undefined, undefined, focusAt(-400, -400));
    expect(placements.residentCount).toBe(40);
    placements.dispose();
  });
});

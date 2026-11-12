import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MAX_RESIDENT_PLACEMENTS, MuseumPlacements, RESIDENT_RADIUS } from '../src/workshop/MuseumPlacements';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { zoneAtXYZ } from '../src/world/layout';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
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

describe('Workshop zone-aware interior residency', () => {
  // North holds fewer records than the live cap, so distance alone would spill into other wings.
  const ZONE_QUOTA = { north: 120, east: 700, south: 600, west: 554, rotunda: 26 } as const;

  /** 2,000 interior records at conservation-valid points, spread over the four ground wings and the rotunda. */
  function interiorRecords(): WorkshopPlacementRecord[] {
    const out: WorkshopPlacementRecord[] = [];
    const taken = new Map<string, number>();
    for (let x = -100; x <= 100 && out.length < 2000; x += 2) {
      for (let z = -100; z <= 110 && out.length < 2000; z += 2) {
        const zone = zoneAtXYZ(x, 0.5, z) as keyof typeof ZONE_QUOTA;
        if (!(zone in ZONE_QUOTA) || (taken.get(zone) ?? 0) >= ZONE_QUOTA[zone]) continue;
        const record: WorkshopPlacementRecord = { id: `in-${zone}-${String(taken.get(zone) ?? 0).padStart(3, '0')}`,
          label: zone, prefab: 'sculpture-sphere', anchor: 'floor', position: [x, 0.5, z],
          rotation: [0, 0, 0], scale: [0.3, 0.3, 0.3], worldId: 'interior' };
        if (!validateWorkshopManifestForMuseum({ schemaVersion: 2, objects: [record] }, []).ok) continue;
        taken.set(zone, (taken.get(zone) ?? 0) + 1);
        out.push(record);
      }
    }
    return out;
  }
  const records = interiorRecords();
  const zoneOf = (id: string) => id.split('-')[1];
  const sync = (placements: MuseumPlacements, world: CollisionWorld, focus: THREE.Vector3) =>
    placements.syncWorld('interior', new CollisionWorld(), world, undefined, undefined, focus);

  it('builds a 2,000-record interior fixture from conservation-valid points', () => {
    expect(records).toHaveLength(2000);
  });

  it('loads the current zone first and leaves non-adjacent wings dormant even when they are near', () => {
    const placements = new MuseumPlacements(manifest(records));
    const interior = new CollisionWorld();
    const focus = new THREE.Vector3(0, 1.7, -60);
    expect(zoneAtXYZ(focus.x, focus.y, focus.z)).toBe('north');
    sync(placements, interior, focus);

    const live = liveIds(placements);
    const northIds = records.filter((record) => zoneOf(record.id) === 'north').map((record) => record.id);
    // Every north record is live; the only other live records are in the adjacent rotunda.
    expect(new Set(live.filter((id) => zoneOf(id) === 'north'))).toEqual(new Set(northIds));
    for (const id of live) expect(['north', 'rotunda']).toContain(zoneOf(id));
    // A non-adjacent east-wing record within RESIDENT_RADIUS of the focus stays dormant.
    const nearEast = records.find((record) => zoneOf(record.id) === 'east'
      && Math.hypot(record.position[0] - focus.x, record.position[2] - focus.z) < RESIDENT_RADIUS);
    expect(nearEast).toBeDefined();
    expect(live).not.toContain(nearEast!.id);
    placements.dispose();
  });

  it('fills from the rotunda and its neighbouring wings when the visitor stands in the rotunda', () => {
    const placements = new MuseumPlacements(manifest(records));
    sync(placements, new CollisionWorld(), new THREE.Vector3(0, 1.7, 0));
    const live = liveIds(placements);
    const rotunda = records.filter((record) => zoneOf(record.id) === 'rotunda').map((record) => record.id);
    for (const id of rotunda) expect(live).toContain(id);
    const expected = records.filter((record) => zoneOf(record.id) !== 'rotunda')
      .map((record) => ({ id: record.id, d: Math.hypot(record.position[0], record.position[1] - 1.7, record.position[2]) }))
      .filter((entry) => entry.d <= RESIDENT_RADIUS)
      .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))
      .slice(0, MAX_RESIDENT_PLACEMENTS - rotunda.length).map((entry) => entry.id);
    expect(new Set(live)).toEqual(new Set([...rotunda, ...expected]));
    placements.dispose();
  });

  it('re-evaluates on a zone crossing shorter than the distance step', () => {
    const placements = new MuseumPlacements(manifest(records));
    const interior = new CollisionWorld();
    // Find two points under 4 m apart on the north axis that lie in different zones.
    let inside = -10;
    while (zoneAtXYZ(0, 1.7, inside - 1) === 'rotunda') inside -= 1;
    const before = new THREE.Vector3(0, 1.7, inside + 1);
    const after = new THREE.Vector3(0, 1.7, inside - 2);
    expect(zoneAtXYZ(before.x, before.y, before.z)).toBe('rotunda');
    expect(zoneAtXYZ(after.x, after.y, after.z)).toBe('north');
    sync(placements, interior, before);
    expect(new Set(liveIds(placements).map(zoneOf)).size).toBeGreaterThan(1);
    sync(placements, interior, after);
    for (const id of liveIds(placements)) expect(['north', 'rotunda']).toContain(zoneOf(id));
    expect(liveIds(placements).some((id) => ['east', 'west', 'south'].includes(zoneOf(id)))).toBe(false);
    placements.dispose();
  });

  it('keeps dormant interior collision for every solid record across zone changes', () => {
    const solid = records.map((record) => ({ ...record, collision: 'solid' as const }));
    const placements = new MuseumPlacements(manifest(solid));
    const interior = new CollisionWorld();
    sync(placements, interior, new THREE.Vector3(0, 1.7, -60));
    const count = () => interior.snapshot().filter((entry) => entry.ownership === 'dynamic').length;
    expect(count()).toBe(2000);
    sync(placements, interior, new THREE.Vector3(60, 1.7, 0));
    expect(count()).toBe(2000);
    placements.dispose();
  });
});

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { CollisionWorld } from '../src/world/CollisionWorld';
import type { WorkshopPlacementRecord } from '../src/workshop/schema';

const model = (id: string, worldId: 'exterior' | 'interior'): WorkshopPlacementRecord => ({
  id, label: id, prefab: 'catalog-model', assetId: 'openlife:park_bench', anchor: 'floor',
  position: [250, 0, 250], rotation: [0, 0, 0], scale: [1, 1, 1], worldId,
});
const tick = () => new Promise<void>((done) => setTimeout(done, 0));
const visual = () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const dispose = vi.spyOn(geometry, 'dispose');
  root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  return { root, dispose };
};

describe('Workshop model world residency', () => {
  it('bounds concurrent loads, releases inactive visuals, and preserves saved records', async () => {
    const pending: ((object: THREE.Object3D) => void)[] = [];
    const loader = vi.fn(() => new Promise<THREE.Object3D>((resolve) => pending.push(resolve)));
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [
      model('outside-one', 'exterior'), model('outside-two', 'exterior'), model('inside', 'interior'),
    ] }, null, loader);
    const exterior = new CollisionWorld(), interior = new CollisionWorld();
    expect(loader).not.toHaveBeenCalled();
    placements.syncWorld('exterior', exterior, interior);
    expect(loader).toHaveBeenCalledTimes(2);
    const first = visual(), stale = visual();
    pending[0](first.root);
    await tick();
    expect(placements.getObject('outside-one')?.children[0]).toBe(first.root);
    placements.syncWorld('interior', exterior, interior);
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(placements.captureManifest().objects).toHaveLength(3);
    pending[1](stale.root);
    await tick();
    expect(stale.dispose).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledTimes(3);
    const inside = visual();
    pending[2](inside.root);
    await tick();
    expect(placements.getObject('inside')?.children[0]).toBe(inside.root);
    placements.dispose();
    expect(inside.dispose).toHaveBeenCalledOnce();
  });

  it('disposes a late model after the placement system is disposed', async () => {
    let resolve!: (object: THREE.Object3D) => void;
    const loader = () => new Promise<THREE.Object3D>((done) => { resolve = done; });
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [model('outside', 'exterior')] }, null, loader);
    placements.syncWorld('exterior', new CollisionWorld());
    placements.dispose();
    const late = visual();
    resolve(late.root);
    await tick();
    expect(late.dispose).toHaveBeenCalledOnce();
  });

  it('applies world visibility on transitions and immediately after rebuilds', () => {
    const outside: WorkshopPlacementRecord = { ...model('outside', 'exterior'), prefab: 'sculpture-sphere', assetId: undefined };
    const inside: WorkshopPlacementRecord = { ...outside, id: 'inside', worldId: 'interior' };
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [outside, inside] });
    const exterior = new CollisionWorld(), interior = new CollisionWorld();
    placements.syncWorld('exterior', exterior, interior);
    expect(placements.getObject('outside')?.visible).toBe(true);
    expect(placements.getObject('inside')?.visible).toBe(false);
    placements.replaceManifest({ schemaVersion: 1, objects: [outside, inside] });
    expect(placements.getObject('inside')?.visible).toBe(false);
    placements.syncWorld('interior', exterior, interior);
    expect(placements.getObject('outside')?.visible).toBe(false);
    expect(placements.getObject('inside')?.visible).toBe(true);
    placements.dispose();
  });

  it('keeps existing roots and in-flight model loads when adding an object', async () => {
    let resolve!: (object: THREE.Object3D) => void;
    const loader = vi.fn(() => new Promise<THREE.Object3D>((done) => { resolve = done; }));
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [model('model-z', 'exterior')] }, null, loader);
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world);
    const priorRoot = placements.getObject('model-z');
    placements.setRecord({ id: 'object-a', label: 'Sphere', prefab: 'sculpture-sphere', anchor: 'free',
      position: [250, 0, 250], rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'exterior', collision: 'solid' });
    expect(placements.getObject('model-z')).toBe(priorRoot);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(placements.group.children.map((root) => root.userData.workshopId)).toEqual(['model-z', 'object-a'].sort());
    placements.syncWorld('exterior', world);
    expect(world.resolveHorizontal({ x: 250, y: 0, z: 250 }, 0.35, 1.78)).toBe(true);
    const loaded = visual();
    resolve(loaded.root);
    await tick();
    expect(priorRoot?.children[0]).toBe(loaded.root);
    expect(loaded.dispose).not.toHaveBeenCalled();
    placements.dispose();
    expect(loaded.dispose).toHaveBeenCalledOnce();
  });
});

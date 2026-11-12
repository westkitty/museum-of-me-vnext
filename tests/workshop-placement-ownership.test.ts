import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { CollisionWorld } from '../src/world/CollisionWorld';
import type { InteractionManager } from '../src/interaction/InteractionManager';
import type { WorkshopPlacementRecord } from '../src/workshop/schema';

const record = (id: string, extra: Partial<WorkshopPlacementRecord> = {}): WorkshopPlacementRecord => ({
  id, label: id, prefab: 'museum-bench', anchor: 'floor',
  position: [250, 0, 250], rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'exterior', ...extra,
});
const manifest = (...objects: WorkshopPlacementRecord[]) => ({ schemaVersion: 1, objects });
const tick = () => new Promise<void>((done) => setTimeout(done, 0));

function meshes(root: THREE.Object3D | null): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root?.traverse((node) => { if ((node as THREE.Mesh).isMesh) out.push(node as THREE.Mesh); });
  return out;
}

function spyDisposals(root: THREE.Object3D | null) {
  const geometry = meshes(root).map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
  const material = meshes(root).map((mesh) => vi.spyOn(mesh.material as THREE.Material, 'dispose'));
  return { geometry, material };
}

const wallIds = (world: CollisionWorld) => world.snapshot()
  .filter((collider) => collider.ownership === 'dynamic').map((collider) => collider.id).sort();

describe('Workshop per-placement resource ownership', () => {
  it('removes one placement without rebuilding or disposing its neighbours or shared materials', () => {
    const placements = new MuseumPlacements(manifest(record('keep'), record('drop', { color: '#ff0000' })));
    const keepRoot = placements.getObject('keep');
    const dropRoot = placements.getObject('drop');
    const keep = spyDisposals(keepRoot);
    const drop = spyDisposals(dropRoot);

    placements.removeRecord('drop');

    expect(placements.getObject('keep')).toBe(keepRoot);
    expect(placements.getObject('drop')).toBeNull();
    expect(dropRoot?.parent).toBeNull();
    // The removed object's own geometry and its colour clones are released.
    for (const spy of [...drop.geometry, ...drop.material]) expect(spy).toHaveBeenCalledOnce();
    // The surviving object's geometry and shared prefab materials are untouched.
    for (const spy of [...keep.geometry, ...keep.material]) expect(spy).not.toHaveBeenCalled();
    expect(meshes(placements.getObject('keep')).every((mesh) => mesh.geometry.attributes.position)).toBe(true);
    expect(placements.captureManifest().objects.map((item) => item.id)).toEqual(['keep']);
    placements.dispose();
    for (const spy of keep.geometry) expect(spy).toHaveBeenCalledOnce();
  });

  it('rebuilds only the placement whose definition changed', () => {
    const placements = new MuseumPlacements(manifest(record('stable'), record('edited', { color: '#00ff00' })));
    const stableRoot = placements.getObject('stable');
    const editedRoot = placements.getObject('edited');
    const stable = spyDisposals(stableRoot);
    const edited = spyDisposals(editedRoot);

    placements.setRecord(record('edited', { color: '#0000ff', prefab: 'artifact-table' }));

    expect(placements.getObject('stable')).toBe(stableRoot);
    const replacement = placements.getObject('edited');
    expect(replacement).not.toBe(editedRoot);
    expect(replacement?.userData.workshopPrefab).toBe('artifact-table');
    for (const spy of [...edited.geometry, ...edited.material]) expect(spy).toHaveBeenCalledOnce();
    for (const spy of [...stable.geometry, ...stable.material]) expect(spy).not.toHaveBeenCalled();
    const colour = (meshes(replacement)[0].material as THREE.MeshStandardMaterial).color.getHexString();
    expect(colour).toBe('0000ff');
    placements.dispose();
  });

  it('keeps unrelated solid collision bound and removes only the deleted collider', () => {
    const placements = new MuseumPlacements(manifest(
      record('solid-a', { collision: 'solid' }),
      record('solid-b', { collision: 'solid', position: [260, 0, 260] }),
      record('soft'),
    ));
    const exterior = new CollisionWorld();
    placements.syncWorld('exterior', exterior);
    expect(wallIds(exterior)).toEqual(['wall:solid-a', 'wall:solid-b']);

    placements.removeRecord('solid-b');
    expect(wallIds(exterior)).not.toContain('wall:solid-b');
    placements.syncWorld('exterior', exterior);
    expect(wallIds(exterior)).toEqual(['wall:solid-a']);

    // Removing a non-solid object leaves the bound solid collision untouched.
    placements.removeRecord('soft');
    expect(wallIds(exterior)).toEqual(['wall:solid-a']);
    placements.dispose();
    expect(wallIds(exterior)).toEqual([]);
  });

  it('releases the interaction of a removed placement and keeps the others registered', () => {
    const releases = new Map<string, ReturnType<typeof vi.fn>>();
    const manager = {
      register: vi.fn((id: string) => { const release = vi.fn(); releases.set(id, release); return release; }),
    } as unknown as InteractionManager;
    const placements = new MuseumPlacements(manifest(
      record('kiosk-a', { event: 'announce' }), record('kiosk-b', { event: 'announce' }),
    ));
    placements.bindInteractions(manager, () => undefined);
    expect(manager.register).toHaveBeenCalledTimes(2);

    placements.removeRecord('kiosk-b');
    expect(releases.get('workshop:kiosk-b')).toHaveBeenCalledOnce();
    expect(releases.get('workshop:kiosk-a')).not.toHaveBeenCalled();
    expect(manager.register).toHaveBeenCalledTimes(2);
    placements.dispose();
    expect(releases.get('workshop:kiosk-a')).toHaveBeenCalledOnce();
  });

  it('disposes a late eager model whose placement was removed while keeping a sibling load', async () => {
    const pending = new Map<string, (object: THREE.Object3D) => void>();
    const loader = vi.fn((assetId: string) => new Promise<THREE.Object3D>((done) => pending.set(assetId, done)));
    const model = (id: string, assetId: string) => record(id, { prefab: 'catalog-model', assetId, collision: 'solid' });
    const placements = new MuseumPlacements(manifest(
      model('kept', 'openlife:park_bench'), model('gone', 'openlife:movie_prop_statue'),
    ), null, loader);
    placements.removeRecord('gone');

    const late = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const lateDispose = vi.spyOn(late.geometry, 'dispose');
    pending.get('openlife:movie_prop_statue')?.(late);
    const kept = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const keptDispose = vi.spyOn(kept.geometry, 'dispose');
    pending.get('openlife:park_bench')?.(kept);
    await tick();

    expect(lateDispose).toHaveBeenCalledOnce();
    expect(late.parent).toBeNull();
    expect(placements.getObject('kept')?.children[0]).toBe(kept);
    expect(keptDispose).not.toHaveBeenCalled();
    placements.dispose();
    expect(keptDispose).toHaveBeenCalledOnce();
  });
});

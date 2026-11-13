import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ModelHandleReleasedError, ModelTemplateCache } from '../src/workshop/ModelTemplateCache';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import type { WorkshopPlacementRecord } from '../src/workshop/schema';

const tick = () => new Promise<void>((done) => setTimeout(done, 0));
function template() {
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(geometry, material));
  return { root, geometry, material,
    geometryDispose: vi.spyOn(geometry, 'dispose'), materialDispose: vi.spyOn(material, 'dispose') };
}

describe('ModelTemplateCache', () => {
  it('decodes once, hands out clones sharing resources, and disposes on the last release', async () => {
    const source = template();
    const loader = vi.fn(async () => source.root);
    const cache = new ModelTemplateCache(loader);
    const a = cache.acquire('m'), b = cache.acquire('m');
    const [cloneA, cloneB] = await Promise.all([a.ready, b.ready]);
    expect(loader).toHaveBeenCalledOnce();
    expect(cloneA).not.toBe(source.root);
    expect(cloneA).not.toBe(cloneB);
    expect((cloneA.children[0] as THREE.Mesh).geometry).toBe(source.geometry);
    expect(cache.refCount('m')).toBe(2);
    a.release();
    a.release();
    expect(cache.refCount('m')).toBe(1);
    expect(source.geometryDispose).not.toHaveBeenCalled();
    b.release();
    expect(source.geometryDispose).toHaveBeenCalledOnce();
    expect(source.materialDispose).toHaveBeenCalledOnce();
    expect(cache.size).toBe(0);
  });

  it('disposes a template whose every holder released before it decoded', async () => {
    const source = template();
    let resolve!: (object: THREE.Object3D) => void;
    const cache = new ModelTemplateCache(() => new Promise((done) => { resolve = done; }));
    const handle = cache.acquire('m');
    handle.release();
    resolve(source.root);
    await expect(handle.ready).rejects.toBeInstanceOf(ModelHandleReleasedError);
    expect(source.geometryDispose).toHaveBeenCalledOnce();
    expect(cache.size).toBe(0);
  });

  it('forgets a failed load so a later acquisition retries it', async () => {
    const source = template();
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(source.root);
    const cache = new ModelTemplateCache(loader);
    await expect(cache.acquire('m').ready).rejects.toThrow('network');
    expect(cache.size).toBe(0);
    await expect(cache.acquire('m').ready).resolves.toBeDefined();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('disposes a template that finishes decoding after the cache itself was disposed', async () => {
    const source = template();
    let resolve!: (object: THREE.Object3D) => void;
    const cache = new ModelTemplateCache(() => new Promise((done) => { resolve = done; }));
    const handle = cache.acquire('m');
    cache.dispose();
    resolve(source.root);
    await expect(handle.ready).rejects.toBeInstanceOf(ModelHandleReleasedError);
    expect(source.geometryDispose).toHaveBeenCalledOnce();
  });
});

describe('Workshop shared model placements', () => {
  const solidModel = (id: string, extra: Partial<WorkshopPlacementRecord> = {}): WorkshopPlacementRecord => ({
    id, label: id, prefab: 'catalog-model', assetId: 'openlife:park_bench', anchor: 'floor',
    position: [250, 0, 250 + id.length], rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'exterior',
    collision: 'solid', ...extra,
  });

  it('keeps one placement finish private and never disposes shared resources still in use', async () => {
    const source = template();
    const loader = vi.fn(async () => source.root);
    const placements = new MuseumPlacements({ schemaVersion: 2, objects: [
      solidModel('tinted', { color: '#ff0000' }), solidModel('plain-bench'),
    ] }, null, loader);
    await tick();
    expect(loader).toHaveBeenCalledOnce();
    const tintedMesh = placements.getObject('tinted')!.children[0].children[0] as THREE.Mesh;
    const plainMesh = placements.getObject('plain-bench')!.children[0].children[0] as THREE.Mesh;
    expect(tintedMesh.geometry).toBe(source.geometry);
    expect(plainMesh.geometry).toBe(source.geometry);
    expect(tintedMesh.material).not.toBe(source.material);
    expect((tintedMesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff0000');
    expect(plainMesh.material).toBe(source.material);
    expect(source.material.color.getHexString()).toBe('ffffff');
    const tintDispose = vi.spyOn(tintedMesh.material as THREE.Material, 'dispose');

    placements.removeRecord('tinted');
    expect(tintDispose).toHaveBeenCalledOnce();
    expect(source.geometryDispose).not.toHaveBeenCalled();
    expect(source.materialDispose).not.toHaveBeenCalled();
    expect(plainMesh.material).toBe(source.material);

    placements.removeRecord('plain-bench');
    expect(source.geometryDispose).toHaveBeenCalledOnce();
    expect(source.materialDispose).toHaveBeenCalledOnce();
    placements.dispose();
    expect(source.geometryDispose).toHaveBeenCalledOnce();
  });
});

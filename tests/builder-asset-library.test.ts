import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as THREE from 'three';
import {
  BUILDER_MODELS, BUILDER_FINISHES, builderFinishAllowed, builderModelAllowed,
  searchBuilderLibrary,
} from '../src/workshop/builderAssetCatalog';
import { WorkshopSurfaces } from '../src/workshop/WorkshopSurfaces';
import { validateWorkshopManifest } from '../src/workshop/schema';
import { hasValidLocalGLB, isLocalWorkshopHost, validateLocalWorkshopModels, writeWorkshopManifest } from '../scripts/workshop-save-plugin';

const base = {
  id: 'art-asset-1',
  label: 'Library model',
  prefab: 'catalog-model',
  assetId: 'openlife:park_bench',
  anchor: 'floor',
  position: [260, 0, 240], rotation: [0, 0, 0], scale: [1, 1, 1],
  worldId: 'exterior',
};

describe('Museum Builder owned asset library and finish persistence', () => {
  it('rejects DNS-rebound Host headers even when requests reach loopback', () => {
    for (const host of ['127.0.0.1:5173', 'localhost:5173', '[::1]:5173', 'localhost']) {
      expect(isLocalWorkshopHost(host), host).toBe(true);
    }
    for (const host of ['evil.test', 'evil.test:5173', 'localhost.evil.test:5173',
      '127.0.0.1.evil.test', '0.0.0.0:5173', '127x0x0x1:5173',
      '127.0.0.1:5173@evil.test', 'http://localhost:5173', '', undefined]) {
      expect(isLocalWorkshopHost(host), String(host)).toBe(false);
    }
  });


  it('provides the complete 119-model licensed OpenLife library and 13 real finishes', async () => {
    expect(BUILDER_MODELS).toHaveLength(119);
    expect(BUILDER_FINISHES).toHaveLength(13);
    expect(new Set(BUILDER_MODELS.map((item) => item.id)).size).toBe(119);
    expect(new Set(BUILDER_FINISHES.map((item) => item.id)).size).toBe(13);
    expect(searchBuilderLibrary('statue').some((item) => item.id === 'openlife:movie_prop_statue')).toBe(true);
    expect(searchBuilderLibrary('plant', 'Nature').length).toBeGreaterThan(0);
    expect(searchBuilderLibrary('sim', 'Characters').length).toBeGreaterThan(10);
    expect(searchBuilderLibrary('kitchen', 'Appliances').length).toBeGreaterThan(0);
    expect(searchBuilderLibrary('horse', 'Animals').length).toBeGreaterThan(0);
    expect(builderModelAllowed('openlife:park_bench')).toBe(true);
    expect(builderModelAllowed('openlife:vehicle_compact')).toBe(true);
    expect(builderModelAllowed('https://example.com/asset.glb')).toBe(false);
    expect(builderFinishAllowed('wallpaper-cream')).toBe(true);
    expect(builderFinishAllowed('terrain-grass-lush')).toBe(true);
    expect(builderFinishAllowed('file:///private/secret.png')).toBe(false);
    for (const item of BUILDER_MODELS) {
      expect(item.srcRevision).toBe('2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b');
      expect(item.path).toMatch(/^builder-assets\\/openlife\\/[a-z0-9_]+\\.glb$/);
      const bytes = await readFile(join(process.cwd(), 'public', item.path));
      expect(bytes.byteLength).toBe(item.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.sha256);
      expect(hasValidLocalGLB(bytes)).toBe(true);
      expect(item.license).toMatch(/MIT/);
    }
    for (const finish of BUILDER_FINISHES) {
      expect(finish.srcRevision).toBe('2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b');
      expect(finish.path).toMatch(/^builder-assets\\/openlife\\/[a-z0-9_]+\\.png$/);
      const bytes = await readFile(join(process.cwd(), 'public', finish.path));
      expect(bytes.byteLength).toBe(finish.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(finish.sha256);
      expect(bytes.toString('ascii', 1, 4)).toBe('PNG');
      expect(finish.license).toMatch(/MIT/);
    }
  });

  it('preserves old schema while validating model ids, wall finishes and safe mesh paths', () => {
    const accepted = validateWorkshopManifest({ schemaVersion: 1, objects: [{
      ...base, texture: 'wallpaper-cream', color: '#ff9933',
    }], surfaceOverrides: [
      { id: 'exterior:3/8/2', worldId: 'exterior', color: '#aabbcc', texture: 'stone-paver' },
    ] });
    expect(accepted.ok).toBe(true);
    expect(accepted.value?.objects[0]?.assetId).toBe('openlife:park_bench');
    expect(accepted.value?.surfaceOverrides?.[0]?.id).toBe('exterior:3/8/2');
    expect(validateWorkshopManifest({ schemaVersion: 1, objects: [{ ...base,
      assetId: 'https://untrusted.test/object.glb' }] }).ok).toBe(false);
    expect(validateWorkshopManifest({ schemaVersion: 1, objects: [{ ...base,
      texture: '../../secrets.txt' }] }).ok).toBe(false);
    expect(validateWorkshopManifest({ schemaVersion: 1, objects: [base], surfaceOverrides: [{
      id: 'exterior:../../bad', worldId: 'exterior', color: '#000000',
    }] }).ok).toBe(false);
  });

  it('paints existing walls with isolated material clones, then safely reveals original', () => {
    const root = new THREE.Group();
    const original = new THREE.MeshStandardMaterial({ color: '#445566' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), original);
    mesh.name = 'Museum wall';
    root.add(mesh);
    const surfaces = new WorkshopSurfaces();
    surfaces.bind('interior', root);
    const selection = surfaces.selectionFor(mesh, 'interior');
    expect(selection?.id).toBe('interior:0');
    surfaces.apply([{ id: selection!.id, worldId: 'interior', color: '#ff0000' }]);
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff0000');
    expect(original.color.getHexString()).toBe('445566');
    surfaces.setRevealOriginal(true);
    expect(mesh.material).toBe(original);
    surfaces.setRevealOriginal(false);
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff0000');
    surfaces.dispose();
    expect(mesh.material).toBe(original);
    original.dispose();
    mesh.geometry.dispose();
  });

  it('requires content-hashed, local imported models before a valid saved placement', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-owned-glb-'));
    try {
      const manifestPath = join(directory, 'data/workshop-placements.json');
      const modelDir = join(directory, 'public/workshop-models');
      const bytes = await readFile(join(process.cwd(), 'public/builder-assets/openlife/park_bench.glb'));
      const hash = createHash('sha256').update(bytes).digest('hex');
      const id = 'workshop-models/' + hash + '.glb';
      const manifest = { schemaVersion: 1, objects: [{ ...base, assetId: id }] };
      expect(await validateLocalWorkshopModels(validateWorkshopManifest(manifest).value!, manifestPath)).toHaveLength(1);
      await mkdir(modelDir, { recursive: true });
      await writeFile(join(modelDir, hash + '.glb'), bytes);
      expect((await writeWorkshopManifest(manifest, manifestPath)).ok).toBe(true);
      const corrupt = Buffer.from(bytes);
      corrupt[corrupt.length - 1] ^= 1;
      await writeFile(join(modelDir, hash + '.glb'), corrupt);
      expect((await writeWorkshopManifest(manifest, manifestPath)).ok).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

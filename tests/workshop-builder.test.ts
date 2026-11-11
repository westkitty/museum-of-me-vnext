import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hasValidWebPContainer, writeWorkshopManifest } from '../scripts/workshop-save-plugin';
import { AuthorableSceneRegistry } from '../src/workshop/AuthorableSceneRegistry';
import * as THREE from 'three';
import { validateWorkshopManifest } from '../src/workshop/schema';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { CollisionWorld } from '../src/world/CollisionWorld';

const base = {
  id: 'wall-art-01', label: 'Gallery portrait', prefab: 'wall-art',
  anchor: 'wall', position: [30, 2.5, 42], rotation: [0, 0, 0],
  scale: [2, 3, 0.5], depth: 0.04, color: '#abcdef',
  worldId: 'interior', collision: 'none', event: 'announce',
} as const;

describe('Unified Museum Builder', () => {
  it('accepts typed, portable local wall art with independent dimensions', () => {
    const image = 'workshop-media/' + 'a'.repeat(64) + '.webp';
    const parsed = validateWorkshopManifest({ schemaVersion: 1, objects: [{ ...base, image }] });
    expect(parsed.ok).toBe(true);
    expect(parsed.value?.objects[0]).toMatchObject({ anchor: 'wall', color: '#abcdef', depth: 0.04, image });
    expect(parsed.value?.objects[0]?.scale).toEqual([2, 3, 0.5]);
  });

  it('rejects remote image URLs, non-wall mounting and oversized or degenerate dimensions', () => {
    const variants = [
      { ...base, image: 'https://example.com/track.gif' },
      { ...base, image: '../private/photo.webp' },
      { ...base, color: 'red' },
      { ...base, depth: 0 },
      { ...base, scale: [0, 1, 1] },
      { ...base, scale: [101, 1, 1] },
      { ...base, worldId: 'foreign-world' },
      { ...base, prefab: 'museum-bench' },
    ];
    for (const object of variants) {
      expect(validateWorkshopManifest({ schemaVersion: 1, objects: [object] }).ok).toBe(false);
    }
  });

  it('conserves the protected exhibit paths even when a sculpture is enlarged', () => {
    const object = { ...base, id: 'sphere-01', prefab: 'sculpture-sphere',
      anchor: 'free', position: [10, 0, 0], scale: [15, 15, 15], collision: 'solid' };
    expect(validateWorkshopManifestForMuseum({ schemaVersion: 1, objects: [object] }).ok).toBe(false);
  });

  it('creates a real THREE sphere and independently painted wall, then disposes its scene', () => {
    const manifest = { schemaVersion: 1, objects: [
      { ...base, id: 'sphere-01', prefab: 'sculpture-sphere', anchor: 'free',
        position: [30, 1, 42], scale: [4, 4, 4], color: '#114488', collision: 'solid', event: 'none', worldId: 'exterior' },
      { ...base, id: 'panel-01', prefab: 'wall-panel', image: undefined,
        position: [35, 2, 45], worldId: 'interior' },
    ] };
    const placements = new MuseumPlacements(manifest);
    const sphere = placements.getObject('sphere-01')!;
    expect(sphere.scale.x).toBe(4);
    const mesh = sphere.children[0] as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('114488');
    const panel = placements.getObject('panel-01')!;
    const panelMesh = panel.children[0] as THREE.Mesh;
    expect((panelMesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('abcdef');
    placements.dispose();
  });

  it('toggles authored dynamic wall collisions without modifying static architecture', () => {
    const world = new CollisionWorld();
    world.addBox([0, 1, 0], [1, 1, 1]);
    const staticCount = world.size;
    world.setDynamicWall('art-1', { kind: 'wall',
      minX: 8, maxX: 10, minY: 0, maxY: 3, minZ: 8, maxZ: 10 });
    expect(world.size).toBe(staticCount + 1);
    const inside = { x: 9, y: 0, z: 9 };
    expect(world.resolveHorizontal(inside, 0.35, 1.78)).toBe(true);
    world.setDynamicWall('art-1', null);
    expect(world.size).toBe(staticCount);
    expect(world.resolveHorizontal({ x: 9, y: 0, z: 9 }, 0.35, 1.78)).toBe(false);
  });

  it('reveals the original scene without mutating authored transforms or placement source', () => {
    const shrub = new THREE.Group();
    const registry = new AuthorableSceneRegistry([{ id: 'arrival-garden-shrub-01', root: shrub }]);
    const manifest = {
      schemaVersion: 1,
      objects: [{ ...base, id: 'panel-01', prefab: 'wall-panel', image: undefined }],
      sceneOverrides: [{
        id: 'arrival-garden-shrub-01',
        position: [30, 0, 42], rotation: [0, 0, 0], scale: [1, 1, 1],
      }],
    };
    const placements = new MuseumPlacements(manifest, registry);
    const before = JSON.stringify(placements.captureManifest());
    expect(shrub.position.x).toBe(30);
    placements.setOriginalComparison(true);
    expect(shrub.position.x).toBe(0);
    expect(placements.group.visible).toBe(false);
    expect(placements.isComparingOriginal).toBe(true);
    expect(JSON.stringify(placements.captureManifest())).toBe(before);
    placements.setOriginalComparison(false);
    expect(shrub.position.x).toBe(30);
    expect(placements.group.visible).toBe(true);
    expect(JSON.stringify(placements.captureManifest())).toBe(before);
    placements.dispose();
  });

  it('refuses orphaned or tampered artwork on save; accepts hash-verified local WebP bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-builder-media-'));
    const target = join(directory, 'data', 'workshop-placements.json');
    const mediaDir = join(directory, 'public', 'workshop-media');
    const bytes = Buffer.alloc(20);
    bytes.write('RIFF', 0);
    bytes.writeUInt32LE(12, 4);
    bytes.write('WEBP', 8);
    bytes.write('VP8 ', 12);
    expect(hasValidWebPContainer(bytes)).toBe(true);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const file = join(mediaDir, `${hash}.webp`);
    const manifest = { schemaVersion: 1, objects: [{
      ...base, position: [300, 2.5, 300],
      image: `workshop-media/${hash}.webp`,
    }] };
    try {
      await mkdir(mediaDir, { recursive: true });
      expect((await writeWorkshopManifest(manifest, target)).ok).toBe(false);
      await writeFile(file, bytes);
      expect((await writeWorkshopManifest(manifest, target)).ok).toBe(true);
      const persisted = await readFile(target, 'utf8');
      expect(JSON.parse(persisted).objects[0].image).toBe(`workshop-media/${hash}.webp`);
      const corrupt = Buffer.from(bytes);
      corrupt[19] = 1;
      await writeFile(file, corrupt);
      const rejected = await writeWorkshopManifest(manifest, target);
      expect(rejected.ok).toBe(false);
      expect(rejected.errors?.join(' ')).toMatch(/missing|invalid|replaced/);
      expect(await readFile(target, 'utf8')).toBe(persisted);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

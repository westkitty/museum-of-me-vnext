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
import { measureWall, snapWallPoint } from '../src/workshop/WallSketch';
import { wallOpeningSegments } from '../src/workshop/WallOpenings';

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

  it('updates solid authored collision at the new position after a gizmo transform', () => {
    const record = {
      ...base, id: 'sphere-collider', label: 'Moveable solid sphere',
      prefab: 'sculpture-sphere', anchor: 'free', image: undefined,
      position: [30, 1, 42], scale: [1, 1, 1],
      worldId: 'exterior', collision: 'solid', event: 'none',
    };
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [record] });
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world);
    expect(world.size).toBe(1);
    expect(world.resolveHorizontal({ x: 30, y: 0, z: 42 }, 0.35, 1.78)).toBe(true);

    // The transform gizmo modifies the live THREE root without a rebuild.
    placements.getObject('sphere-collider')!.position.x = 40;
    placements.invalidateCollisions();
    expect(world.size).toBe(0);
    placements.syncWorld('exterior', world);
    expect(world.size).toBe(1);
    expect(world.resolveHorizontal({ x: 30, y: 0, z: 42 }, 0.35, 1.78)).toBe(false);
    expect(world.resolveHorizontal({ x: 40, y: 0, z: 42 }, 0.35, 1.78)).toBe(true);

    placements.dispose();
    expect(world.size).toBe(0);
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

  it('snaps a two-click wall to the grid with exact position, yaw and length', () => {
    const start = snapWallPoint([0.14, 0, 0.12], 0.5);
    const end = snapWallPoint([3.24, 0, 0.2], 0.5);
    expect(start).toEqual([0, 0, 0]);
    expect(end).toEqual([3, 0, 0]);
    expect(measureWall(start, end)).toEqual({
      position: [1.5, 0, 0], rotation: [0, 0, 0], scale: [3, 1, 1],
    });
    const north = measureWall([0, 2, 0], [0, 2, 4]);
    expect(north?.rotation[1]).toBeCloseTo(-Math.PI / 2);
    expect(measureWall([0, 0, 0], [0.1, 0, 0])).toBeNull();
    expect(measureWall([0, 0, 0], [101, 0, 0])).toBeNull();
  });

  it('adds independently paintable wall, walkable floor and roof geometry', () => {
    const base = {
      anchor: 'floor', worldId: 'exterior', collision: 'solid', event: 'none',
      rotation: [0, 0, 0], scale: [1, 1, 1],
    };
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [
      { ...base, id: 'wall-1', label: 'Partition wall', prefab: 'partition-wall',
        position: [240, 0, 240], scale: [3, 1, 1], color: '#cc5533' },
      { ...base, id: 'floor-1', label: 'Floor slab', prefab: 'floor-slab',
        position: [250, 2, 250], rotation: [0, Math.PI / 4, 0], scale: [2, 1, 1] },
      { ...base, id: 'roof-1', label: 'Roof panel', prefab: 'roof-panel',
        position: [260, 3, 260], collision: 'none' },
    ] });
    const wall = placements.getObject('wall-1')!;
    const wallMesh = wall.children[0] as THREE.Mesh;
    expect(wall.scale.x).toBe(3);
    expect(wallMesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect((wallMesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('cc5533');
    expect(placements.getObject('roof-1')?.position.y).toBe(3);
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world);
    expect(world.size).toBe(2);
    expect(world.supportHeight(250, 250, 1.6, 0.5)).toBeCloseTo(2);
    // The point lies within the rotated floor's world-space bounding box but
    // OUTSIDE its real rectangle; it must not receive invisible support.
    expect(world.supportHeight(252, 250, 1.6, 0.5)).toBeNull();
    expect(world.resolveHorizontal({ x: 240, y: 0, z: 240 }, 0.35, 1.78)).toBe(true);
    placements.dispose();
    expect(world.size).toBe(0);
    expect(world.supportHeight(250, 250, 1.6, 0.5)).toBeNull();
  });

  it('rejects tilted walkable floors but permits yaw rotation and roof pitch', () => {
    const floor = {
      id: 'floor-test', label: 'Floor', prefab: 'floor-slab', anchor: 'floor',
      position: [250, 0, 250], rotation: [Math.PI / 6, 0, 0], scale: [1, 1, 1],
    };
    expect(validateWorkshopManifest({ schemaVersion: 1, objects: [floor] }).ok).toBe(false);
    expect(validateWorkshopManifest({ schemaVersion: 1, objects: [
      { ...floor, rotation: [0, Math.PI / 4, 0] },
    ] }).ok).toBe(true);
    expect(validateWorkshopManifest({ schemaVersion: 1, objects: [
      { ...floor, prefab: 'roof-panel' },
    ] }).ok).toBe(true);
  });

  it('physically cuts a doorway instead of drawing a fake dark doorway texture', () => {
    const wall = { id: 'door-wall', label: 'Doorway wall', prefab: 'partition-wall',
      anchor: 'floor', position: [250, 0, 250], rotation: [0, 0, 0],
      scale: [3, 1, 1], opening: 'door', openingWidth: 0.42, openingHeight: 0.73,
      openingSill: 0, collision: 'solid', worldId: 'exterior' };
    const parsed = validateWorkshopManifest({ schemaVersion: 1, objects: [wall] });
    expect(parsed.ok).toBe(true);
    const placements = new MuseumPlacements(parsed.value!);
    const root = placements.getObject('door-wall')!;
    expect(root.children).toHaveLength(3);
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world);
    expect(world.size).toBe(3);
    // Centre stays navigable (1.26 m opening) while both jambs are solid.
    expect(world.resolveHorizontal({ x: 250, y: 0, z: 250 }, 0.35, 1.78)).toBe(false);
    expect(world.resolveHorizontal({ x: 248.95, y: 0, z: 250 }, 0.35, 1.78)).toBe(true);
    expect(world.ceilingHeight(250, 250, 2)).toBeCloseTo(3 * 0.73);
    placements.dispose();
    expect(world.size).toBe(0);
  });

  it('keeps the door truly open in a rotated wall; broad AABB does not fill the gap', () => {
    const angle = Math.PI / 4;
    const wall = { id: 'angled-door', label: 'Angled doorway', prefab: 'partition-wall',
      anchor: 'floor', position: [245, 0, 245], rotation: [0, angle, 0],
      scale: [3, 1, 1], opening: 'door', collision: 'solid', worldId: 'exterior' };
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [wall] });
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world);
    expect(world.resolveHorizontal({ x: 245, y: 0, z: 245 }, 0.35, 1.78)).toBe(false);
    // A visitor standing on the left jamb is pushed out.
    const x = 245 + Math.cos(angle) * 1.02;
    const z = 245 - Math.sin(angle) * 1.02;
    expect(world.resolveHorizontal({ x, y: 0, z }, 0.35, 1.78)).toBe(true);
    placements.invalidateCollisions();
    expect(world.size).toBe(0);
    placements.dispose();
  });

  it('makes a window a real elevated aperture, with solid sill and upper lintel', () => {
    const segments = wallOpeningSegments('window', { width: 0.5, height: 0.35, sill: 0.32 });
    expect(segments).toHaveLength(4);
    const wall = { id: 'window-wall', label: 'Window wall', prefab: 'partition-wall',
      anchor: 'floor', position: [255, 0, 255], rotation: [0, 0, 0],
      scale: [3, 1, 1], opening: 'window', openingWidth: 0.5,
      openingHeight: 0.35, openingSill: 0.32, collision: 'solid', worldId: 'exterior' };
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [wall] });
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world);
    expect(world.resolveHorizontal({ x: 255, y: 0, z: 255 }, 0.35, 1.78)).toBe(true);
    // A small airborne probe at window height sees the void.
    expect(world.resolveHorizontal({ x: 255, y: 1.1, z: 255 }, 0.15, 0.25)).toBe(false);
    placements.dispose();
  });

  it('rejects unsupported wall holes, too-narrow doors, tilted structural walls, and invalid sill geometry', () => {
    const wall = { id: 'bad-door', label: 'Door', prefab: 'partition-wall',
      anchor: 'floor', position: [250, 0, 250], rotation: [0, 0, 0],
      scale: [3, 1, 1], opening: 'door' };
    for (const bad of [
      { ...wall, openingWidth: 0.1 },
      { ...wall, openingSill: 0.2 },
      { ...wall, openingHeight: 0.3 },
      { ...wall, scale: [1, 1, 1] },
      { ...wall, rotation: [0.1, 0, 0] },
      { ...wall, prefab: 'museum-bench' },
      { ...wall, opening: 'window', openingSill: 0.6, openingHeight: 0.4 },
      { ...wall, opening: 'window', openingSill: 0 },
    ]) {
      expect(validateWorkshopManifest({ schemaVersion: 1, objects: [bad] }).ok).toBe(false);
    }
    const passed = validateWorkshopManifest({ schemaVersion: 1, objects: [wall] });
    expect(passed.ok).toBe(true);
    expect(passed.value?.objects[0].opening).toBe('door');
    expect(passed.value?.objects[0].openingWidth).toBeUndefined();
  });
});

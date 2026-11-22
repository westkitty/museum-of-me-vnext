import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { LoadedAsset } from '../src/assets/AssetManager';
import { ResourceScope } from '../src/assets/ResourceScope';
import { HOT_DOG_MAN_BYTES, HOT_DOG_MAN_SHA256, registerHotDogManAssets } from '../src/assets/hotDogManAssets';
import { registerIslandVisitorAssets } from '../src/assets/islandVisitorAssets';
import { assetsInGroup } from '../src/assets/manifest';
import { HotDogMan } from '../src/world/exterior/HotDogMan';
import { HOT_DOG_MAN_BONE_NAMES } from '../src/world/exterior/HotDogManPose';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { ISLAND_VISITORS } from '../src/world/exterior/IslandVisitors';
import type { Vec3 } from '../src/world/layout';

describe('ISLAND-04 assets and residency', () => {
  it('locks the delivered files, source provenance, required rig bones and triangle counts', () => {
    registerIslandVisitorAssets();
    registerHotDogManAssets();
    const assets = assetsInGroup('exterior-npc');
    expect(assets.map((asset) => asset.id)).toEqual([...ISLAND_VISITORS.map((p) => p.id), 'hotdog-man']);
    const triangles = [3496, 3616, 3712, 4290, 3330, 4358, 4248, 5324];
    for (const [index, asset] of assets.entries()) {
      const file = readFileSync(`src/assets/npc/${asset.id}.glb`);
      expect(file.toString('ascii', 0, 4)).toBe('glTF');
      expect(file.readUInt32LE(8)).toBe(file.length);
      expect(createHash('sha256').update(file).digest('hex')).toBe(asset.processedHash);
      expect(asset.sourceHash).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.license).toMatch(/CC0/);
      expect(file.length).toBeLessThanOrEqual(asset.budgetKB * 1024);
      const model = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)));
      expect(model.skins[0].joints).toHaveLength(asset.id === 'island-cactusboy' ? 64 : 65);
      const jointNames = model.skins[0].joints.map((joint: number) => model.nodes[joint].name);
      expect(jointNames).toEqual(expect.arrayContaining(Object.values(HOT_DOG_MAN_BONE_NAMES)));
      expect(model.animations ?? []).toHaveLength(0);
      expect(model.meshes.flatMap((mesh: { primitives: [] }) => mesh.primitives)
        .reduce((total: number, primitive: { indices: number }) => total + model.accessors[primitive.indices].count / 3, 0))
        .toBe(triangles[index]);
      if (asset.id === 'hotdog-man') {
        expect(file.length).toBe(HOT_DOG_MAN_BYTES);
        expect(asset.processedHash).toBe(HOT_DOG_MAN_SHA256);
        expect(asset.sourceHash).toBe(HOT_DOG_MAN_SHA256);
      }
    }
  });

  it('places the cast on supported terrain and acquires, cancels and reacquires proximity leases', async () => {
    const requests: Array<{ scope: ResourceScope; resolve: (asset: LoadedAsset) => void }> = [];
    const load = vi.fn((_id: string, scope: ResourceScope) =>
      new Promise<LoadedAsset>((resolve) => requests.push({ scope, resolve })));
    const world = new ExteriorWorld('low', { load });
    world.variableUpdate(0, world.spawnPosition, 'plaza');
    expect(load).not.toHaveBeenCalled();
    for (const { id, spot: [x, y, z] } of ISLAND_VISITORS) {
      expect(world.collision.supportHeight(x, z, y), id).toBeCloseTo(y, 1);
      expect(world.collision.resolveHorizontal({ x, y, z }, 0.28, 1.5), id).toBe(false);
    }
    const eye: Vec3 = [130.5, 1.14, 44];
    world.variableUpdate(0, eye, 'plaza');
    world.variableUpdate(0, eye, 'plaza');
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('island-froggy', requests[0].scope);
    world.variableUpdate(0, world.spawnPosition, 'plaza');
    expect(requests[0].scope.isDisposed).toBe(true);
    requests[0].resolve({ id: 'island-froggy', object: new THREE.Group(), animations: [], bytes: 0, loadMs: 0 });
    await Promise.resolve();
    expect(world.islandVisitors.group.children).toHaveLength(0);
    world.variableUpdate(0, eye, 'plaza');
    expect(load).toHaveBeenCalledTimes(2);
    world.dispose();
    expect(requests[1].scope.isDisposed).toBe(true);
    expect(world.scope.size).toBe(0);
  });

  it('releases an unusable hot dog lease and keeps the actor detached', async () => {
    const scope = new ResourceScope('rooftop');
    const actor = new HotDogMan(scope, [0, 0, 0], [0, 0, 1]);
    const load = vi.fn(async (id: string, lease: ResourceScope) => {
      const object = new THREE.Group();
      lease.track({ dispose: () => object.removeFromParent() });
      return { id, object, animations: [], bytes: 0, loadMs: 0 };
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      actor.setLoader({ load });
      await actor.load();
      expect(actor.state).toBe('failed');
      expect(actor.group.children).toHaveLength(0);
      expect(load.mock.calls[0][1].isDisposed).toBe(true);
      expect(scope.size).toBe(0);
    } finally {
      warn.mockRestore();
      scope.dispose();
    }
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetManager } from '../src/assets/AssetManager';
import { ResourceScope } from '../src/assets/ResourceScope';
import {
  registerProcedural, registerAsset, getAsset, allAssets, _resetAssetRegistry,
} from '../src/assets/manifest';
import {
  buildPlinth, buildCase, buildBench, lathe, polygonPrism, tubeAlong,
  fibonacciSphere, ringTransforms, rng, instanced,
} from '../src/assets/generators';
import { FULL_WEASEL_TREE_SHA256 } from '../src/assets/fullWeaselArtifact';

function treeFiles(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? treeFiles(root, absolute) : [relative(root, absolute).split(sep).join('/')];
  });
}

beforeEach(() => {
  _resetAssetRegistry();
});

describe('asset manifest governance', () => {
  it('refuses a duplicate asset id', () => {
    registerProcedural('t.one', 'One', 'shell');
    expect(() => registerProcedural('t.one', 'One again', 'shell')).toThrow(/twice/);
  });

  it('records provenance for every asset', () => {
    registerProcedural('t.plinth', 'Plinth', 'shell', 'P001');
    const record = getAsset('t.plinth')!;
    expect(record.source).toBe('original-museum');
    expect(record.license).toMatch(/owned by the project/i);
    expect(record.creator).toBeTruthy();
    expect(record.project).toBe('P001');
    expect(record.attribution).toBeNull();
  });

  it('carries attribution and hashes for a file-backed asset', () => {
    registerAsset({
      id: 't.glb', title: 'Test model', kind: 'glb',
      source: 'authentic:P003', project: 'P003',
      creator: 'Orbital Tomb', license: 'Owned by the project.',
      url: './assets/test.glb', sourceHash: 'abc', processedHash: 'def',
      budgetKB: 512, streamingGroup: 'exhibit:E03', attribution: null,
    });
    const record = getAsset('t.glb')!;
    expect(record.sourceHash).toBe('abc');
    expect(record.processedHash).toBe('def');
    expect(allAssets()).toHaveLength(1);
  });

  it('pins the exact governed Full Weasel artifact tree', () => {
    const root = join(process.cwd(), 'public', 'embedded', 'full-weasel');
    const hash = createHash('sha256');
    for (const file of treeFiles(root).sort()) {
      hash.update(file);
      hash.update(Buffer.from([0]));
      hash.update(readFileSync(join(root, file)));
    }
    expect(hash.digest('hex')).toBe(FULL_WEASEL_TREE_SHA256);
  });
});

describe('AssetManager (Phase 4 gate)', () => {
  it('defers file-loader construction until the first file-backed load', () => {
    const am = new AssetManager();
    am.attachRenderer({} as THREE.WebGLRenderer);
    const state = am as unknown as {
      gltf: unknown; ktx2: unknown; draco: unknown; fileLoaderReady: unknown;
    };
    expect(state.gltf).toBeNull();
    expect(state.ktx2).toBeNull();
    expect(state.draco).toBeNull();
    expect(state.fileLoaderReady).toBeNull();
    am.dispose();
  });

  it('refuses a generator for an asset with no manifest record', () => {
    const am = new AssetManager();
    expect(() => am.registerGenerator('t.missing', () => new THREE.Group())).toThrow(/unknown asset/);
  });

  it('refuses to load an asset with no manifest record', async () => {
    const am = new AssetManager();
    const scope = new ResourceScope('t');
    await expect(am.load('t.nope', scope)).rejects.toThrow(/Unknown asset/);
  });

  it('loads, displays, unloads and reloads without leaking', async () => {
    registerProcedural('t.hero', 'Hero object', 'exhibit:E01', 'P001');
    const am = new AssetManager();
    am.registerGenerator('t.hero', (scope) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(
        scope.track(new THREE.TorusKnotGeometry(1, 0.3, 64, 12)),
        scope.track(new THREE.MeshStandardMaterial({ color: 0xc9a227 })),
      ));
      g.add(buildPlinth(scope));
      return g;
    });

    const parent = new THREE.Group();
    let firstCount = 0;

    for (let cycle = 0; cycle < 3; cycle++) {
      const scope = new ResourceScope(`cycle-${cycle}`);
      const loaded = await am.load('t.hero', scope, { detail: 1 });

      // display
      parent.add(loaded.object);
      expect(parent.children).toHaveLength(1);
      expect(scope.size).toBeGreaterThan(0);
      if (cycle === 0) firstCount = scope.size;
      expect(scope.size, `cycle ${cycle} allocated differently`).toBe(firstCount);
      expect(loaded.bytes, 'procedural assets transfer nothing').toBe(0);

      // unload
      loaded.object.removeFromParent();
      scope.dispose();
      expect(parent.children, 'scene object left behind').toHaveLength(0);
      expect(scope.size, 'resources left behind').toBe(0);
    }
  });

  it('honours an abort signal without leaving a partial object behind', async () => {
    registerProcedural('t.cancel', 'Cancellable', 'shell');
    const am = new AssetManager();
    am.registerGenerator('t.cancel', (scope) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(scope.track(new THREE.BoxGeometry()), scope.track(new THREE.MeshBasicMaterial())));
      return g;
    });
    const controller = new AbortController();
    controller.abort();
    const scope = new ResourceScope('t');
    await expect(am.load('t.cancel', scope, { signal: controller.signal })).rejects.toThrow(/cancelled/i);
    expect(scope.size, 'aborted load allocated anyway').toBe(0);
  });

  it('passes the quality detail multiplier to the generator', async () => {
    registerProcedural('t.detail', 'Detail', 'shell');
    const am = new AssetManager();
    const seen: number[] = [];
    am.registerGenerator('t.detail', (_scope, detail) => {
      seen.push(detail);
      return new THREE.Group();
    });
    const scope = new ResourceScope('t');
    await am.load('t.detail', scope, { detail: 0.4 });
    await am.load('t.detail', scope, { detail: 1 });
    expect(seen).toEqual([0.4, 1]);
  });

  it('keeps verified glTF animation clips on a file-backed loaded asset', async () => {
    registerAsset({
      id: 't.animated', title: 'Animated', kind: 'glb', source: 'external',
      project: null, creator: 'Test', license: 'CC0', url: './animated.glb',
      budgetKB: 100, streamingGroup: 'shell', attribution: 'Test, CC0',
    });
    const am = new AssetManager();
    const walk = new THREE.AnimationClip('Walk', 1, []);
    (am as unknown as { gltf: { load: (url: string, onLoad: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void) => void } }).gltf = {
      load: (_url, onLoad) => onLoad({ scene: new THREE.Group(), animations: [walk] }),
    };
    const scope = new ResourceScope('animated');
    const loaded = await am.load('t.animated', scope);
    expect(loaded.animations).toEqual([walk]);
    scope.dispose();
  });
});

describe('file asset consumer ownership', () => {
  function fixture() {
    registerAsset({
      id: 't.shared', title: 'Shared rig', kind: 'glb', source: 'external', project: null,
      creator: 'Test', license: 'CC0', url: './shared.glb', budgetKB: 1,
      streamingGroup: 'shell', attribution: 'Test, CC0',
    });
    const manager = new AssetManager();
    const scene = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.SkinnedMesh(geometry, material);
    const bone = new THREE.Bone();
    bone.name = 'hip';
    mesh.add(bone);
    mesh.bind(new THREE.Skeleton([bone]));
    scene.add(mesh);
    const clip = new THREE.AnimationClip('Walk', 1, [new THREE.NumberKeyframeTrack('hip.position[x]', [0, 1], [0, 2])]);
    let resolve!: (gltf: GLTF) => void;
    let reject!: (error: Error) => void;
    const load = vi.fn((...[_url, onLoad, onProgress, onError]: Parameters<GLTFLoader['load']>) => {
      resolve = onLoad;
      reject = onError!;
      onProgress!({ total: 4096, loaded: 4096 } as ProgressEvent);
    });
    (manager as unknown as { gltf: unknown }).gltf = { load };
    const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
    return { manager, load, scene, geometry, material, texture, clip, flush,
      succeed: () => resolve({ scene, animations: [clip] } as GLTF), fail: () => reject(new Error('fixture load failed')) };
  }

  for (const first of [0, 1]) it(`keeps independent skeletons and shared GPU resources alive when consumer ${first} unloads first`, async () => {
    const f = fixture();
    const scopes = [new ResourceScope('a'), new ResourceScope('b')];
    const requests = scopes.map((scope) => f.manager.load('t.shared', scope));
    await f.flush();
    f.succeed();
    const assets = await Promise.all(requests);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(assets[0].object).not.toBe(assets[1].object);
    expect(assets[0].object).not.toBe(f.scene);
    const meshes = assets.map((asset) => asset.object.children[0] as THREE.SkinnedMesh);
    expect(meshes[0].skeleton).not.toBe(meshes[1].skeleton);
    expect(meshes[0].skeleton.bones[0]).not.toBe(meshes[1].skeleton.bones[0]);
    const disposals = [f.geometry, f.material, f.texture].map((r) => vi.spyOn(r, 'dispose'));
    const boneDisposals = meshes.map((mesh) => vi.spyOn(mesh.skeleton, 'dispose'));
    for (const asset of assets) {
      expect(asset.id).toBe('t.shared');
      expect(asset.bytes).toBe(4096);
      expect(asset.animations).toEqual([f.clip]);
    }
    scopes[first].dispose();
    for (const spy of disposals) expect(spy).not.toHaveBeenCalled();
    expect(boneDisposals[first]).toHaveBeenCalledTimes(1);
    const survivor = 1 - first;
    const mixer = new THREE.AnimationMixer(assets[survivor].object);
    mixer.clipAction(assets[survivor].animations[0]).play();
    mixer.update(0.25);
    expect(meshes[survivor].skeleton.bones[0].position.x).toBeCloseTo(0.5);
    mixer.stopAllAction();
    mixer.uncacheRoot(assets[survivor].object);
    scopes[survivor].dispose();
    for (const spy of disposals) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of boneDisposals) expect(spy).toHaveBeenCalledTimes(1);
    expect(scopes.map((scope) => scope.size)).toEqual([0, 0]);
    f.manager.dispose();
  });

  it('cancels either pending consumer without cancelling the other or allocating into the cancelled scope', async () => {
    for (const first of [0, 1]) {
      _resetAssetRegistry();
      const f = fixture();
      const scopes = [new ResourceScope('a'), new ResourceScope('b')];
      const controllers = [new AbortController(), new AbortController()];
      const loads = scopes.map((scope, index) => f.manager.load('t.shared', scope, { signal: controllers[index].signal }));
      const cancelled = expect(loads[first]).rejects.toThrow(/cancelled/i);
      await f.flush();
      controllers[first].abort();
      f.succeed();
      await cancelled;
      const survivor = await loads[1 - first];
      expect(survivor.object.children).toHaveLength(1);
      expect(scopes[first].size).toBe(0);
      expect(f.load).toHaveBeenCalledTimes(1);
      scopes.forEach((scope) => scope.dispose());
      f.manager.dispose();
    }
  });

  it('handles pre-abort and manager teardown without leaking pending prototypes', async () => {
    const f = fixture();
    const early = new AbortController();
    early.abort();
    const scopes = [new ResourceScope('pre-abort'), new ResourceScope('manager-gone')];
    await expect(f.manager.load('t.shared', scopes[0], { signal: early.signal })).rejects.toThrow(/cancelled/i);
    expect(f.load).not.toHaveBeenCalled();
    const request = f.manager.load('t.shared', scopes[1]);
    const cancelled = expect(request).rejects.toThrow(/cancelled/i);
    await f.flush();
    const disposed = vi.spyOn(f.geometry, 'dispose');
    f.manager.dispose();
    await cancelled;
    f.succeed();
    await f.flush();
    expect(disposed).toHaveBeenCalledOnce();
    expect(scopes.map((scope) => scope.size)).toEqual([0, 0]);
    scopes.forEach((scope) => scope.dispose());
  });

  it('retains an active lease through manager teardown until its consumer releases it', async () => {
    const f = fixture();
    const scope = new ResourceScope('active');
    const request = f.manager.load('t.shared', scope);
    await f.flush();
    f.succeed();
    const asset = await request;
    const disposed = vi.spyOn(f.geometry, 'dispose');
    f.manager.dispose();
    expect(disposed).not.toHaveBeenCalled();
    expect(asset.object.children).toHaveLength(1);
    scope.dispose();
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('releases late results after scope teardown and retries a failed shared load', async () => {
    const f = fixture();
    const scope = new ResourceScope('gone');
    const request = f.manager.load('t.shared', scope);
    const cancelled = expect(request).rejects.toThrow(/cancelled|disposed/i);
    await f.flush();
    scope.dispose();
    const released = vi.spyOn(f.geometry, 'dispose');
    f.succeed();
    await cancelled;
    expect(released).toHaveBeenCalledTimes(1);
    const a = new ResourceScope('retry-a');
    const b = new ResourceScope('retry-b');
    const failed = [f.manager.load('t.shared', a), f.manager.load('t.shared', b)];
    const assertions = failed.map((promise) => expect(promise).rejects.toThrow('fixture load failed'));
    await f.flush();
    f.fail();
    await Promise.all(assertions);
    expect(a.size + b.size).toBe(0);
    const retry = f.manager.load('t.shared', a);
    await f.flush();
    f.succeed();
    expect((await retry).id).toBe('t.shared');
    a.dispose(); b.dispose(); f.manager.dispose();
  });
});

describe('procedural generators', () => {
  it('are deterministic for a given seed', () => {
    const a = Array.from({ length: 8 }, rng(1234));
    const b = Array.from({ length: 8 }, rng(1234));
    const c = Array.from({ length: 8 }, rng(5678));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('build real geometry with volume, not planes', () => {
    const scope = new ResourceScope('t');
    const shapes = [
      lathe(scope, { points: [[1, 0], [1, 1], [0, 1]] }),
      polygonPrism(scope, 6, 1, 0.5),
      tubeAlong(scope, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 0), new THREE.Vector3(2, 0, 0)], 0.1),
    ];
    for (const geo of shapes) {
      geo.computeBoundingBox();
      const size = new THREE.Vector3();
      geo.boundingBox!.getSize(size);
      expect(Math.min(size.x, size.y, size.z), 'geometry is flat').toBeGreaterThan(0.001);
      expect(geo.getAttribute('position').count).toBeGreaterThan(20);
    }
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('builds shared furniture that disposes cleanly', () => {
    const scope = new ResourceScope('t');
    const objects = [buildPlinth(scope), buildCase(scope), buildBench(scope)];
    for (const o of objects) scope.trackObject(o);
    expect(scope.size).toBeGreaterThan(3);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('distributes points evenly on a sphere', () => {
    const points = fibonacciSphere(64, 5);
    expect(points).toHaveLength(64);
    for (const p of points) expect(p.length()).toBeCloseTo(5, 1);
  });

  it('arranges transforms around a ring', () => {
    const ms = ringTransforms(6, 3, 1);
    expect(ms).toHaveLength(6);
    const p = new THREE.Vector3();
    for (const m of ms) {
      p.setFromMatrixPosition(m);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(3, 4);
      expect(p.y).toBeCloseTo(1, 4);
    }
  });

  it('creates instanced meshes with every transform applied', () => {
    const scope = new ResourceScope('t');
    const mesh = instanced(
      scope,
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshBasicMaterial(),
      ringTransforms(12, 2),
    );
    expect(mesh.count).toBe(12);
    // In three r185 `needsUpdate` is write-only; the observable effect is the
    // attribute's version having been bumped.
    expect(mesh.instanceMatrix.version).toBeGreaterThan(0);
    scope.dispose();
  });
});

describe('budget governance', () => {
  it('flags a file-backed asset that exceeds its declared budget', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerAsset({
      id: 't.big', title: 'Oversized', kind: 'glb', source: 'external',
      project: null, creator: 'Third party', license: 'CC0',
      url: './assets/big.glb', budgetKB: 100, streamingGroup: 'shell',
      attribution: 'Third party, CC0',
    });
    const am = new AssetManager();
    // Exercise the budget check directly: the network path is not available here.
    (am as unknown as { checkBudget(r: unknown, b: number): void }).checkBudget(getAsset('t.big'), 300 * 1024);
    expect(am.budgetViolations).toHaveLength(1);
    expect(am.budgetViolations[0]).toMatchObject({ id: 't.big', budgetKB: 100, actualKB: 300 });
    spy.mockRestore();
  });
});

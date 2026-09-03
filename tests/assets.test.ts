import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { AssetManager } from '../src/assets/AssetManager';
import { ResourceScope } from '../src/assets/ResourceScope';
import {
  registerProcedural, registerAsset, getAsset, allAssets, _resetAssetRegistry,
} from '../src/assets/manifest';
import {
  buildPlinth, buildCase, buildBench, lathe, polygonPrism, tubeAlong,
  fibonacciSphere, ringTransforms, rng, instanced,
} from '../src/assets/generators';

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
});

describe('AssetManager (Phase 4 gate)', () => {
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

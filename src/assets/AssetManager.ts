import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { ResourceScope } from './ResourceScope';
import { getAsset, type AssetRecord } from './manifest';

/**
 * A procedural asset is a pure function from a scope to an Object3D. It is the
 * museum's primary asset kind: nothing is fetched, ownership is unambiguous,
 * and the output is deterministic for a given seed.
 */
export type ProceduralGenerator = (scope: ResourceScope, detail: number) => THREE.Object3D;

export interface LoadedAsset {
  readonly id: string;
  readonly object: THREE.Object3D;
  /** Verified glTF clips. Procedural assets intentionally return an empty list. */
  readonly animations: readonly THREE.AnimationClip[];
  /** Bytes transferred. Zero for procedural assets. */
  readonly bytes: number;
  readonly loadMs: number;
}

class CancelledError extends Error {
  constructor(id: string) {
    super(`Asset load cancelled: ${id}`);
    this.name = 'CancelledError';
  }
}

export interface LoadOptions {
  /** Aborting a load must leave no partially-built object behind. */
  readonly signal?: AbortSignal;
  /** Detail multiplier from the quality tier. */
  readonly detail?: number;
}

/**
 * Governed manifest-backed asset loading (plan §23, §26, §27).
 * Direct world builders also create scoped procedural geometry; this manager
 * owns registered generators and file-backed model loading.
 */
export interface AssetLoadTiming {
  readonly id: string;
  readonly kind: string;
  readonly elapsedMs: number;
  readonly reportedBytes: number;
}

interface SharedFile {
  readonly scope: ResourceScope;
  readonly promise: Promise<LoadedAsset>;
  users: number;
  settled: boolean;
}

export class AssetManager {
  private readonly history: AssetLoadTiming[] = [];
  get loadTimings(): readonly AssetLoadTiming[] { return this.history; }

  private recordTiming(id: string, kind: string, elapsedMs: number, reportedBytes: number): void {
    this.history.push({ id, kind, elapsedMs, reportedBytes });
    if (this.history.length > 64) this.history.shift();
  }

  private readonly generators = new Map<string, ProceduralGenerator>();
  // One decoded prototype per live asset, owned independently of any caller.
  private readonly inFlight = new Map<string, SharedFile>();
  private readonly pendingLoads = new Set<() => void>();
  private disposed = false;
  private readonly bytesById = new Map<string, number>();

  private renderer: THREE.WebGLRenderer | null = null;
  private transcoderPath = './ktx2/';
  private gltf: GLTFLoader | null = null;
  private ktx2: KTX2Loader | null = null;
  private draco: DRACOLoader | null = null;
  private fileLoaderReady: Promise<void> | null = null;

  /** Assets whose declared budget was exceeded at runtime. */
  readonly budgetViolations: { id: string; budgetKB: number; actualKB: number }[] = [];

  /**
   * Wire the file-backed loaders. Optional: a museum built entirely from
   * procedural assets never needs them, which is the default.
   */
  attachRenderer(renderer: THREE.WebGLRenderer, transcoderPath = './ktx2/'): void {
    // File-backed assets are not needed for the first shell frame. Remember the
    // renderer now and import/construct decoder modules only on the first file load.
    this.renderer = renderer;
    this.transcoderPath = transcoderPath;
  }

  private async ensureFileLoaders(): Promise<void> {
    if (this.gltf) return;
    if (!this.renderer) throw new Error('AssetManager.attachRenderer must be called before loading files');
    if (!this.fileLoaderReady) {
      this.fileLoaderReady = Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/KTX2Loader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ]).then(([gltfModule, ktx2Module, dracoModule, meshoptModule]) => {
        if (!this.renderer) throw new Error('AssetManager renderer was disposed during loader warmup');
        this.ktx2 = new ktx2Module.KTX2Loader()
          .setTranscoderPath(this.transcoderPath)
          .detectSupport(this.renderer);
        this.draco = new dracoModule.DRACOLoader().setDecoderPath('./draco/');
        this.gltf = new gltfModule.GLTFLoader();
        this.gltf.setKTX2Loader(this.ktx2);
        this.gltf.setMeshoptDecoder(meshoptModule.MeshoptDecoder);
        this.gltf.setDRACOLoader(this.draco);
      }).finally(() => {
        this.fileLoaderReady = null;
      });
    }
    await this.fileLoaderReady;
  }

  /** Register a procedural generator against a manifest asset id. */
  registerGenerator(id: string, generator: ProceduralGenerator): void {
    if (!getAsset(id)) {
      throw new Error(`Generator registered for unknown asset "${id}" — add a manifest record first`);
    }
    if (this.generators.has(id)) throw new Error(`Generator for "${id}" registered twice`);
    this.generators.set(id, generator);
  }

  hasGenerator(id: string): boolean {
    return this.generators.has(id);
  }

  /**
   * Load an asset into a caller-owned scope. The caller disposes the scope; the
   * manager releases a file prototype after its last consumer leaves. File
   * objects/skeletons are independent; their GPU resources are leased together.
   * Do not trackObject() the returned file object into another scope.
   */
  async load(id: string, scope: ResourceScope, opts: LoadOptions = {}): Promise<LoadedAsset> {
    if (this.disposed || scope.isDisposed || opts.signal?.aborted) throw new CancelledError(id);
    const record = getAsset(id);
    if (!record) throw new Error(`Unknown asset "${id}" — every asset needs a manifest record`);

    const started = performance.now();
    const detail = opts.detail ?? 1;

    if (record.kind === 'procedural') {
      const generator = this.generators.get(id);
      if (!generator) throw new Error(`Asset "${id}" is procedural but has no registered generator`);
      if (opts.signal?.aborted) throw new CancelledError(id);
      const object = generator(scope, detail);
      scope.trackObject(object);
      object.name = object.name || id;
      const loadMs = performance.now() - started;
      this.recordTiming(id, 'procedural', loadMs, 0);
      return { id, object, animations: [], bytes: 0, loadMs };
    }

    const loaded = await this.loadFile(record, scope, opts);
    const bytes = this.bytesById.get(id) ?? 0;
    this.checkBudget(record, bytes);
    const loadMs = performance.now() - started;
    this.recordTiming(id, record.kind, loadMs, bytes);
    return { ...loaded, id, bytes, loadMs };
  }

  private async loadFile(record: AssetRecord, scope: ResourceScope, opts: LoadOptions): Promise<LoadedAsset> {
    if (!record.url) throw new Error(`Asset "${record.id}" is ${record.kind} but declares no url`);
    await this.ensureFileLoaders();
    if (this.disposed || scope.isDisposed || opts.signal?.aborted) throw new CancelledError(record.id);

    const entry = this.inFlight.get(record.id) ?? this.startFile(record);
    entry.users++;
    return new Promise<LoadedAsset>((resolve, reject) => {
      const instanceScope = new ResourceScope(`asset-instance:${record.id}`);
      let object: THREE.Object3D | null = null;
      let released = false;
      const stopWaiting = (): void => {
        opts.signal?.removeEventListener('abort', cancel);
        this.pendingLoads.delete(cancel);
      };
      const lease = { dispose: (): void => {
        if (released) return;
        released = true;
        stopWaiting();
        object?.removeFromParent();
        instanceScope.dispose();
        entry.users--;
        this.releaseFile(record.id, entry);
        reject(new CancelledError(record.id));
      } };
      const cancel = (): void => {
        lease.dispose();
        scope.untrack(lease);
      };
      scope.track(lease);
      this.pendingLoads.add(cancel);
      opts.signal?.addEventListener('abort', cancel, { once: true });

      void entry.promise.then((source) => {
        if (released) return;
        try {
          object = cloneSkeleton(source.object);
          object.traverse((node) => {
            // Geometry/materials/textures belong to the shared prototype. Each
            // clone owns its skeleton (including a renderer-created bone texture)
            // and any per-object instancing buffers.
            const mesh = node as THREE.SkinnedMesh;
            if (mesh.isSkinnedMesh) instanceScope.track(mesh.skeleton);
            if ((node as THREE.InstancedMesh).isInstancedMesh) instanceScope.track(node);
          });
          stopWaiting();
          resolve({ ...source, object });
        } catch (error) {
          reject(error);
          cancel();
        }
      }, (error: unknown) => {
        if (released) return;
        // Preserve the loader failure for this consumer; teardown must not
        // replace it with a cancellation error.
        reject(error);
        cancel();
      });
    });
  }

  private startFile(record: AssetRecord): SharedFile {
    const scope = new ResourceScope(`asset-prototype:${record.id}`);
    this.bytesById.delete(record.id);
    const source = new Promise<LoadedAsset>((resolve, reject) => {
      this.gltf!.load(record.url!, (gltf) => {
        scope.trackObject(gltf.scene);
        resolve({ id: record.id, object: gltf.scene, animations: gltf.animations,
          bytes: this.bytesById.get(record.id) ?? 0, loadMs: 0 });
      }, (event) => {
        if (event.total > 0) this.bytesById.set(record.id, event.loaded);
      }, (error) => reject(error instanceof Error ? error : new Error(String(error))));
    });
    const entry: SharedFile = { scope, users: 0, settled: false,
      promise: source.finally(() => {
        entry.settled = true;
        this.releaseFile(record.id, entry);
      }),
    };
    this.inFlight.set(record.id, entry);
    return entry;
  }

  private releaseFile(id: string, entry: SharedFile): void {
    if (entry.users !== 0 || !entry.settled) return;
    entry.scope.dispose();
    if (this.inFlight.get(id) === entry) this.inFlight.delete(id);
  }

  private checkBudget(record: AssetRecord, bytes: number): void {
    if (record.budgetKB <= 0 || bytes <= 0) return;
    const actualKB = Math.round(bytes / 1024);
    if (actualKB > record.budgetKB) {
      this.budgetViolations.push({ id: record.id, budgetKB: record.budgetKB, actualKB });
      console.warn(`[Assets] "${record.id}" is ${actualKB} KB, over its ${record.budgetKB} KB budget`);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cancel of this.pendingLoads) cancel();
    this.ktx2?.dispose();
    this.draco?.dispose();
    this.generators.clear();
    this.inFlight.clear();
    this.bytesById.clear();
    this.history.length = 0;
    this.fileLoaderReady = null;
    this.renderer = null;
    this.ktx2 = null;
    this.draco = null;
    this.gltf = null;
  }
}

/** Dispose an object graph that no scope owns — used on cancelled loads. */
export function disposeSubtree(root: THREE.Object3D): void {
  const scope = new ResourceScope('unowned-subtree');
  scope.trackObject(root);
  scope.dispose();
  root.removeFromParent();
  root.clear();
}

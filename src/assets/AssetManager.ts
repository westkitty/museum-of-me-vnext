import * as THREE from 'three';
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
 * The museum's one asset entry point (plan §23, §26, §27).
 *
 * Every asset is fetched or generated through here, so every asset has a
 * manifest record, a provenance entry, a budget, and a disposal path. There is
 * no second way to get geometry into the scene.
 */
export class AssetManager {
  private readonly generators = new Map<string, ProceduralGenerator>();
  private readonly inFlight = new Map<string, Promise<LoadedAsset>>();
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
   * manager never holds a reference, so there is no cache to leak.
   */
  async load(id: string, scope: ResourceScope, opts: LoadOptions = {}): Promise<LoadedAsset> {
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
      return { id, object, animations: [], bytes: 0, loadMs: performance.now() - started };
    }

    const loaded = await this.loadFile(record, scope, opts);
    const bytes = this.bytesById.get(id) ?? 0;
    this.checkBudget(record, bytes);
    return { ...loaded, id, bytes, loadMs: performance.now() - started };
  }

  private async loadFile(record: AssetRecord, scope: ResourceScope, opts: LoadOptions): Promise<LoadedAsset> {
    if (!record.url) throw new Error(`Asset "${record.id}" is ${record.kind} but declares no url`);
    await this.ensureFileLoaders();

    const existing = this.inFlight.get(record.id);
    if (existing) {
      const done = await existing;
      return done;
    }

    const promise = new Promise<LoadedAsset>((resolve, reject) => {
      const onAbort = () => reject(new CancelledError(record.id));
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      this.gltf!.load(
        record.url!,
        (gltf) => {
          opts.signal?.removeEventListener('abort', onAbort);
          if (opts.signal?.aborted) {
            disposeSubtree(gltf.scene);
            reject(new CancelledError(record.id));
            return;
          }
          scope.trackObject(gltf.scene);
          resolve({
            id: record.id,
            object: gltf.scene,
            animations: gltf.animations,
            bytes: this.bytesById.get(record.id) ?? 0,
            loadMs: 0,
          });
        },
        (event) => {
          if (event.total > 0) this.bytesById.set(record.id, event.loaded);
        },
        (err) => {
          opts.signal?.removeEventListener('abort', onAbort);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    }).finally(() => this.inFlight.delete(record.id));

    this.inFlight.set(record.id, promise);
    const done = await promise;
    return done;
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
    this.ktx2?.dispose();
    this.draco?.dispose();
    this.generators.clear();
    this.inFlight.clear();
    this.bytesById.clear();
    this.fileLoaderReady = null;
    this.renderer = null;
    this.ktx2 = null;
    this.draco = null;
    this.gltf = null;
  }
}

/** Dispose an object graph that no scope owns — used on cancelled loads. */
export function disposeSubtree(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(m as unknown as Record<string, unknown>)) {
        if (value && typeof value === 'object' && (value as { isTexture?: boolean }).isTexture) {
          (value as THREE.Texture).dispose();
        }
      }
      m.dispose();
    }
  });
  root.removeFromParent();
  root.clear();
}

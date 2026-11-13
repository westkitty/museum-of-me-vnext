import type * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ResourceScope } from '../assets/ResourceScope';

interface TemplateEntry {
  readonly promise: Promise<THREE.Object3D>;
  readonly scope: ResourceScope;
  refs: number;
  loaded: boolean;
}

export interface ModelHandle {
  /** Resolves to a placement-owned clone that shares the template's geometry and materials. */
  readonly ready: Promise<THREE.Object3D>;
  /** Idempotent. The template's GPU resources are disposed when its last handle is released. */
  release(): void;
}

/**
 * Decodes each model asset once and shares its geometry, materials and
 * textures across every placement that uses it, with reference counting.
 *
 * The template itself never enters the scene: each placement receives a clone,
 * so per-placement finishes and event materials replace materials on that
 * clone's meshes only and can never leak into another placement.
 * Placements must not dispose a clone's geometry or materials directly; they
 * release their handle instead.
 */
export class ModelTemplateCache {
  private readonly entries = new Map<string, TemplateEntry>();

  constructor(private readonly loader: (assetId: string) => Promise<THREE.Object3D>) {}

  /** Number of distinct model templates currently held. */
  get size(): number { return this.entries.size; }

  refCount(assetId: string): number { return this.entries.get(assetId)?.refs ?? 0; }

  acquire(assetId: string): ModelHandle {
    let entry = this.entries.get(assetId);
    if (!entry) {
      const scope = new ResourceScope(`workshop-model-template:${assetId}`);
      const created: TemplateEntry = {
        scope,
        refs: 0,
        loaded: false,
        promise: this.loader(assetId).then((template) => {
          created.loaded = true;
          if (scope.isDisposed) {
            // The cache was disposed while this model was decoding.
            const stale = new ResourceScope('stale-workshop-model-template');
            stale.trackObject(template);
            stale.dispose();
            throw new ModelHandleReleasedError(assetId);
          }
          scope.trackObject(template);
          // Every holder released before decoding finished.
          if (created.refs === 0) this.evict(assetId, created);
          return template;
        }, (error: unknown) => {
          // Forget a failed load so a later acquisition can retry it.
          if (this.entries.get(assetId) === created) this.entries.delete(assetId);
          throw error;
        }),
      };
      entry = created;
      this.entries.set(assetId, entry);
    }
    const held = entry;
    held.refs++;
    let released = false;
    return {
      ready: held.promise.then((template) => {
        if (released) throw new ModelHandleReleasedError(assetId);
        return cloneSkinned(template);
      }),
      release: () => {
        if (released) return;
        released = true;
        held.refs--;
        if (held.refs === 0 && held.loaded) this.evict(assetId, held);
      },
    };
  }

  /** Dispose every template regardless of outstanding handles. */
  dispose(): void {
    for (const [assetId, entry] of this.entries) this.evict(assetId, entry);
  }

  private evict(assetId: string, entry: TemplateEntry): void {
    if (this.entries.get(assetId) === entry) this.entries.delete(assetId);
    entry.scope.dispose();
  }
}

/** Raised by a handle's `ready` when the handle was released before the model resolved. */
export class ModelHandleReleasedError extends Error {
  constructor(assetId: string) {
    super(`Model handle for ${assetId} was released before it loaded`);
    this.name = 'ModelHandleReleasedError';
  }
}

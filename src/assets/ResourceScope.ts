import type * as THREE from 'three';

/** Anything Three.js requires us to dispose explicitly. */
interface Disposable {
  dispose(): void;
}

function isDisposable(v: unknown): v is Disposable {
  return typeof (v as Disposable)?.dispose === 'function';
}

/**
 * Tracks every GPU-backed resource a subsystem allocates so it can be released
 * deterministically and, crucially, so release can be *asserted*.
 *
 * PRODUCT LAW 15: assets are governed with explicit disposal rules.
 * INV-008: every exhibit's scope drains to zero on unmount.
 */
export class ResourceScope {
  readonly name: string;
  private readonly tracked = new Set<Disposable>();
  private disposed = false;

  constructor(name: string) {
    this.name = name;
  }

  /** Track a disposable resource and return it unchanged. */
  track<T>(resource: T): T {
    if (this.disposed) {
      throw new Error(`ResourceScope "${this.name}": track() after dispose()`);
    }
    if (isDisposable(resource)) this.tracked.add(resource);
    return resource;
  }

  /** Track several at once. */
  trackAll<T extends readonly unknown[]>(...resources: T): T {
    for (const r of resources) this.track(r);
    return resources;
  }

  /**
   * Stop tracking one already-disposed resource. `size` (and every "the scope
   * settles back to N resources" lifecycle assertion built on it) counts
   * whatever is in the tracked set, disposed or not -- a subsystem that
   * disposes and replaces one of its own resources at runtime (a lectern
   * retexture, a wall-label swap) but never calls this leaves a dead entry
   * behind on every replacement, so the count climbs forever even though the
   * GPU/canvas memory itself was freed correctly.
   */
  untrack(resource: unknown): void {
    if (isDisposable(resource)) this.tracked.delete(resource);
  }

  /**
   * Walk an Object3D and track every geometry, material, material-owned texture
   * and self-disposing object beneath it. Anything shared is tracked once.
   */
  trackObject(root: THREE.Object3D): THREE.Object3D {
    root.traverse((node) => {
      // Some objects own GPU buffers of their own beyond their geometry and
      // materials — an InstancedMesh holds instanceMatrix and instanceColor,
      // and those leak unless the mesh itself is disposed. track() ignores
      // anything without a dispose method, so this is safe for plain meshes.
      this.track(node);
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) this.track(mesh.geometry);
      const mat = mesh.material;
      if (!mat) return;
      const materials = Array.isArray(mat) ? mat : [mat];
      for (const m of materials) {
        this.track(m);
        for (const value of Object.values(m as unknown as Record<string, unknown>)) {
          if (value && typeof value === 'object' && (value as { isTexture?: boolean }).isTexture) {
            this.track(value);
          }
        }
      }
    });
    return root;
  }

  /** How many resources are still held. Zero after a correct dispose(). */
  get size(): number {
    return this.tracked.size;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Release everything. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    for (const r of this.tracked) {
      try {
        r.dispose();
      } catch (err) {
        console.error(`ResourceScope "${this.name}": dispose failed`, err);
      }
    }
    this.tracked.clear();
    this.disposed = true;
  }

  /**
   * Release everything but keep the scope usable. Used by exhibits that rebuild
   * their contents on reset without going through a full unmount.
   */
  releaseAll(): void {
    for (const r of this.tracked) {
      try {
        r.dispose();
      } catch (err) {
        console.error(`ResourceScope "${this.name}": dispose failed`, err);
      }
    }
    this.tracked.clear();
  }
}

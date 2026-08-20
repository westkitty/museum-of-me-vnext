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
   * Walk an Object3D and track every geometry, material and material-owned
   * texture beneath it. Materials shared with other objects are tracked once.
   */
  trackObject(root: THREE.Object3D): THREE.Object3D {
    root.traverse((node) => {
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

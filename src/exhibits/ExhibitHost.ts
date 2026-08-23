import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import type { ExhibitModule, ExhibitContext, ExhibitState, ExhibitControl } from './contract';
import type { ExhibitRecord } from '../content/types';
import { PROJECTS_BY_ID } from '../content/collection.generated';

export interface HostServices {
  readonly addControl: (exhibitId: string, control: ExhibitControl) => () => void;
  readonly announce: (exhibitId: string, message: string) => void;
  readonly reducedMotion: () => boolean;
  readonly detailScale: () => number;
  /** Load a governed asset into the exhibit's own scope. */
  readonly loadAsset: (assetId: string, scope: ResourceScope, detail: number) => Promise<THREE.Object3D>;
  /** Open a locally bundled finished artifact through the Museum UI. */
  readonly openEmbeddedExperience?: (id: 'full-weasel') => void;
}

class IllegalTransition extends Error {
  constructor(id: string, from: ExhibitState, action: string) {
    super(`Exhibit ${id}: cannot ${action} from state "${from}"`);
    this.name = 'IllegalTransition';
  }
}

/**
 * Owns one exhibit module's lifecycle and its resources.
 *
 * The host is the only thing that calls the module's lifecycle methods, and it
 * enforces the state machine so a module cannot be updated while unmounted or
 * mounted twice. On unmount it asserts the module's ResourceScope drained to
 * zero (INV-008) — this is what makes "memory settles" testable.
 */
export class ExhibitHost {
  readonly module: ExhibitModule;
  readonly record: ExhibitRecord;
  readonly group: THREE.Group;

  private scope: ResourceScope;
  private state: ExhibitState = 'unloaded';
  private context: ExhibitContext | null = null;
  private preloadPromise: Promise<void> | null = null;
  private activeSince = 0;
  /** Resource count at the end of the last unmount. Non-zero is a leak. */
  lastLeakCount = 0;

  constructor(
    module: ExhibitModule,
    record: ExhibitRecord,
    private readonly services: HostServices,
  ) {
    this.module = module;
    this.record = record;
    this.group = new THREE.Group();
    this.group.name = `exhibit-content:${record.id}`;
    this.group.visible = false;
    this.scope = new ResourceScope(record.id);
  }

  get id(): string {
    return this.record.id;
  }

  get currentState(): ExhibitState {
    return this.state;
  }

  get isActive(): boolean {
    return this.state === 'active';
  }

  get resourceCount(): number {
    return this.scope.size;
  }

  private makeContext(): ExhibitContext {
    return {
      group: this.group,
      scope: this.scope,
      record: this.record,
      projects: this.record.projectIds.map((id) => PROJECTS_BY_ID.get(id)!).filter(Boolean),
      reducedMotion: this.services.reducedMotion(),
      detailScale: this.services.detailScale(),
      addControl: (control) => this.services.addControl(this.record.id, control),
      announce: (message) => this.services.announce(this.record.id, message),
      loadAsset: (assetId) => this.services.loadAsset(assetId, this.scope, this.services.detailScale()),
      openEmbeddedExperience: this.services.openEmbeddedExperience,
    };
  }

  /** Idempotent and concurrency-safe: repeated calls share one promise. */
  async preload(): Promise<void> {
    if (this.state !== 'unloaded') return;
    if (this.preloadPromise) return this.preloadPromise;
    if (this.scope.isDisposed) this.scope = new ResourceScope(this.record.id);
    this.context = this.makeContext();
    this.preloadPromise = this.module
      .preload(this.context)
      .then(() => {
        this.state = 'loaded';
      })
      .finally(() => {
        this.preloadPromise = null;
      });
    return this.preloadPromise;
  }

  mount(): void {
    if (this.state === 'mounted' || this.state === 'active') return;
    if (this.state !== 'loaded') throw new IllegalTransition(this.id, this.state, 'mount');
    // Refresh the context so quality and accessibility changes take effect.
    this.context = this.makeContext();
    this.module.mount(this.context);
    this.state = 'mounted';
  }

  activate(now: number): void {
    if (this.state === 'active') return;
    if (this.state !== 'mounted') throw new IllegalTransition(this.id, this.state, 'activate');
    this.group.visible = true;
    this.activeSince = now;
    this.module.activate();
    this.state = 'active';
  }

  update(dt: number, eye: readonly [number, number, number], now: number): void {
    if (this.state !== 'active') return;
    const dx = eye[0] - this.module.def.anchor[0];
    const dy = eye[1] - this.module.def.anchor[1];
    const dz = eye[2] - this.module.def.anchor[2];
    this.module.update(dt, {
      eye,
      distance: Math.sqrt(dx * dx + dy * dy + dz * dz),
      elapsed: now - this.activeSince,
    });
  }

  deactivate(): void {
    if (this.state !== 'active') return;
    this.module.deactivate();
    this.group.visible = false;
    this.state = 'mounted';
  }

  unmount(): void {
    if (this.state === 'active') this.deactivate();
    if (this.state !== 'mounted') return;
    this.module.unmount();
    this.group.clear();
    this.scope.releaseAll();
    this.lastLeakCount = this.scope.size;
    if (this.lastLeakCount !== 0) {
      console.error(`[ExhibitHost] ${this.id} leaked ${this.lastLeakCount} resources on unmount`);
    }
    this.state = 'loaded';
  }

  /** Full teardown. After this the host can be preloaded again from scratch. */
  dispose(): void {
    if (this.state === 'active') this.deactivate();
    if (this.state === 'mounted') this.unmount();
    this.module.dispose();
    this.scope.dispose();
    this.group.removeFromParent();
    this.group.clear();
    this.state = 'unloaded';
  }

  reset(): void {
    if (this.state !== 'active' && this.state !== 'mounted') return;
    this.module.reset();
  }
}

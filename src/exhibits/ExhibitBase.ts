import * as THREE from 'three';
import type {
  ExhibitModule, ExhibitDefinition, ExhibitContext, ExhibitUpdateContext,
  AccessibleExhibitContent, ExhibitControl,
} from './contract';

/**
 * Shared implementation of the boring half of the contract: lifecycle
 * bookkeeping, control registration, and interpretation text assembled from the
 * collection. Concrete exhibits override `build`, `onUpdate` and `onReset`.
 *
 * Subclasses never touch the scene outside `this.group`, never allocate outside
 * `this.scope`, and never own a frame loop.
 */
export abstract class ExhibitBase implements ExhibitModule {
  protected ctx!: ExhibitContext;
  protected group!: THREE.Group;
  protected elapsed = 0;
  protected built = false;

  private readonly disposers: (() => void)[] = [];
  private controls: ExhibitControl[] = [];
  private readonly trackedLists: { length: number }[] = [];

  constructor(readonly def: ExhibitDefinition) {}

  // ── contract ────────────────────────────────────────────────────────────

  async preload(ctx: ExhibitContext): Promise<void> {
    this.ctx = ctx;
    await this.onPreload();
  }

  mount(ctx: ExhibitContext): void {
    this.ctx = ctx;
    this.group = ctx.group;
    // Streaming mounts and unmounts an exhibit many times in a visit, and the
    // module instance survives across cycles. Any array a subclass fills during
    // build() must therefore be emptied first, or the second mount builds twice
    // as much as the first. `tracked()` makes that automatic.
    for (const list of this.trackedLists) list.length = 0;
    this.build();
    this.built = true;
  }

  activate(): void {
    this.elapsed = 0;
    this.onActivate();
  }

  update(dt: number, ctx: ExhibitUpdateContext): void {
    this.elapsed += dt;
    this.onUpdate(dt, ctx);
  }

  deactivate(): void {
    this.onDeactivate();
  }

  unmount(): void {
    for (const d of this.disposers.splice(0)) d();
    this.controls = [];
    this.onUnmount();
    if (this.group) this.group.clear();
    this.built = false;
  }

  dispose(): void {
    for (const d of this.disposers.splice(0)) d();
    this.controls = [];
    this.onDispose();
  }

  reset(): void {
    this.elapsed = 0;
    this.onReset();
  }

  getAccessibleContent(): AccessibleExhibitContent {
    const r = this.ctx.record;
    const projects = this.ctx.projects;
    const body = [
      r.copy.problem,
      r.copy.made,
      r.copy.interaction,
      r.copy.explore,
      ...projects.map((p) => `${p.name} — ${p.summary} ${p.brief}`),
    ];
    return {
      heading: `${r.title} — ${r.copy.subtitle}`,
      plaque: r.copy.plaque,
      body,
      state: this.describeState(),
      controls: this.controls.map((c) => ({
        label: c.label,
        description: c.description ?? c.label,
      })),
    };
  }

  // ── hooks for subclasses ────────────────────────────────────────────────

  /** Load anything asynchronous. Most procedural exhibits need nothing here. */
  protected async onPreload(): Promise<void> {}
  /** Construct the exhibit's contents into `this.group`. Required. */
  protected abstract build(): void;
  protected onActivate(): void {}
  protected onUpdate(_dt: number, _ctx: ExhibitUpdateContext): void {}
  protected onDeactivate(): void {}
  protected onUnmount(): void {}
  protected onDispose(): void {}
  /** Return to the initial interactive state. Required to be idempotent. */
  protected abstract onReset(): void;
  /** One sentence describing the exhibit's current interactive state. */
  protected abstract describeState(): string;

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Register a control and remember its disposer. */
  protected control(c: ExhibitControl): void {
    this.controls.push(c);
    this.disposers.push(this.ctx.addControl(c));
  }

  protected get reducedMotion(): boolean {
    return this.ctx.reducedMotion;
  }

  /**
   * Declare an array that build() fills. It is emptied automatically before
   * every mount, so an exhibit cannot accumulate across streaming cycles.
   *
   *     private machines = this.tracked<THREE.Group>();
   */
  protected tracked<T>(): T[] {
    const list: T[] = [];
    this.trackedLists.push(list);
    return list;
  }

  /** Scale a count by the quality tier, never below 1. */
  protected scaled(count: number): number {
    return Math.max(1, Math.round(count * this.ctx.detailScale));
  }

  protected mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(this.ctx.scope.track(geometry), this.ctx.scope.track(material));
    this.group.add(m);
    return m;
  }

  protected standard(color: number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
    return this.ctx.scope.track(new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts }));
  }

  protected emissive(color: number, intensity = 1.4): THREE.MeshStandardMaterial {
    return this.ctx.scope.track(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 0.35,
      }),
    );
  }

  /** Motion helper that collapses to a constant when reduced motion is on. */
  protected oscillate(period: number, amplitude = 1): number {
    if (this.reducedMotion) return 0;
    return Math.sin((this.elapsed / period) * Math.PI * 2) * amplitude;
  }
}

import type * as THREE from 'three';
import { ExhibitHost, type HostServices } from './ExhibitHost';
import { createExhibit, hasExhibit } from './registry';
import { EXHIBITS_BY_ID } from '../content/collection.generated';
import { PLACEMENT_BY_EXHIBIT, ZONE_BY_ID, type Vec3, type ZoneId } from '../world/layout';

export interface StreamingBudget {
  /** Metres at which an exhibit payload starts loading. */
  loadRadius: number;
  /** Metres at which it is released. Hysteresis prevents thrash at the edge. */
  unloadRadius: number;
  /** Metres at which a mounted exhibit becomes active and starts updating. */
  activateRadius: number;
  /** How many exhibits may be constructed per frame. Keeps streaming silent. */
  mountsPerFrame: number;
}

export interface StreamingTelemetry {
  resident: number;
  active: number;
  pendingLoads: number;
  lastLoadMs: number;
  totalMounts: number;
  totalUnmounts: number;
}

/**
 * Layer-3 exhibit streaming (plan §22). Exhibits load as the visitor approaches
 * and are released as they leave, so the museum is continuous but never fully
 * resident. There is no loading screen because Layer 1 — the shell — never
 * unloads and construction is spread across frames.
 */
export class StreamingManager {
  readonly hosts = new Map<string, ExhibitHost>();
  readonly telemetry: StreamingTelemetry = {
    resident: 0, active: 0, pendingLoads: 0, lastLoadMs: 0, totalMounts: 0, totalUnmounts: 0,
  };

  private readonly mountQueue: string[] = [];
  private readonly loading = new Set<string>();
  private now = 0;

  constructor(
    private readonly mounts: ReadonlyMap<string, THREE.Group>,
    private readonly services: HostServices,
    public budget: StreamingBudget,
  ) {}

  /** Create hosts for every exhibit that has an implementation registered. */
  initialise(): void {
    for (const record of EXHIBITS_BY_ID.values()) {
      if (!hasExhibit(record.id)) continue;
      const module = createExhibit(record.id);
      if (!module) continue;
      const host = new ExhibitHost(module, record, this.services);
      const mount = this.mounts.get(record.id);
      if (!mount) {
        console.error(`[Streaming] no mount point for ${record.id}`);
        continue;
      }
      mount.add(host.group);
      this.hosts.set(record.id, host);
    }
  }

  /** Distance from the visitor to an exhibit's anchor, ignoring nothing. */
  private distanceTo(id: string, eye: Vec3): number {
    const p = PLACEMENT_BY_EXHIBIT.get(id);
    if (!p) return Infinity;
    const dx = eye[0] - p.anchor[0];
    const dy = eye[1] - p.anchor[1];
    const dz = eye[2] - p.anchor[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Evaluate residency. Called once per frame from the single loop; never
   * allocates more than `mountsPerFrame` exhibits in one frame.
   */
  evaluate(eye: Vec3, dt: number, zone: ZoneId): void {
    this.now += dt;
    let resident = 0;
    let active = 0;

    const here = ZONE_BY_ID.get(zone);
    const nearbyZones = new Set<string>([zone, ...(here?.neighbours ?? [])]);

    for (const [id, host] of this.hosts) {
      const distance = this.distanceTo(id, eye);
      const state = host.currentState;
      // Distance alone is not enough: bays in different wings and on different
      // levels can be metres apart through a floor. An exhibit is only relevant
      // while the visitor is in its wing or somewhere adjoining it.
      const inRelevantZone = nearbyZones.has(host.record.wing);
      const inOwnWing = zone === host.record.wing;

      if (inRelevantZone && distance <= this.budget.loadRadius) {
        if (state === 'unloaded' && !this.loading.has(id)) {
          this.loading.add(id);
          const started = performance.now();
          void host
            .preload()
            .then(() => {
              this.telemetry.lastLoadMs = performance.now() - started;
              if (!this.mountQueue.includes(id)) this.mountQueue.push(id);
            })
            .catch((err) => console.error(`[Streaming] preload failed for ${id}`, err))
            .finally(() => this.loading.delete(id));
        } else if (state === 'loaded' && !this.mountQueue.includes(id)) {
          this.mountQueue.push(id);
        }
      } else if (!inRelevantZone || distance > this.budget.unloadRadius) {
        if (state === 'active' || state === 'mounted') {
          host.unmount();
          this.telemetry.totalUnmounts++;
        }
        const queued = this.mountQueue.indexOf(id);
        if (queued >= 0) this.mountQueue.splice(queued, 1);
      }

      if (state === 'mounted' || state === 'active') resident++;
      if (host.currentState === 'active') {
        if (!inOwnWing || distance > this.budget.activateRadius * 1.25) {
          host.deactivate();
        } else {
          active++;
        }
      } else if (host.currentState === 'mounted' && inOwnWing && distance <= this.budget.activateRadius) {
        host.activate(this.now);
        active++;
      }
    }

    // Spread construction across frames so approaching a wing never hitches.
    let budgetLeft = this.budget.mountsPerFrame;
    while (budgetLeft > 0 && this.mountQueue.length > 0) {
      const id = this.mountQueue.shift()!;
      const host = this.hosts.get(id);
      if (!host || host.currentState !== 'loaded') continue;
      if (!nearbyZones.has(host.record.wing)) continue;
      if (this.distanceTo(id, eye) > this.budget.unloadRadius) continue;
      try {
        host.mount();
        this.telemetry.totalMounts++;
      } catch (err) {
        console.error(`[Streaming] mount failed for ${id}`, err);
      }
      budgetLeft--;
    }

    this.telemetry.resident = resident;
    this.telemetry.active = active;
    this.telemetry.pendingLoads = this.loading.size + this.mountQueue.length;
  }

  /** Step every active exhibit. Called from the fixed-step phase of the loop. */
  updateActive(dt: number, eye: Vec3): void {
    for (const host of this.hosts.values()) {
      if (host.isActive) host.update(dt, eye, this.now);
    }
  }

  get(id: string): ExhibitHost | undefined {
    return this.hosts.get(id);
  }

  activeHosts(): ExhibitHost[] {
    return [...this.hosts.values()].filter((h) => h.isActive);
  }

  /** Total resources currently held across every exhibit. */
  totalResourceCount(): number {
    let n = 0;
    for (const h of this.hosts.values()) n += h.resourceCount;
    return n;
  }

  dispose(): void {
    for (const h of this.hosts.values()) h.dispose();
    this.hosts.clear();
    this.mountQueue.length = 0;
    this.loading.clear();
  }
}

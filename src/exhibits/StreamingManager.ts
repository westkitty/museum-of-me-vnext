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
  private readonly queued = new Set<string>();
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

  /** Squared distance avoids a square root for every host on every evaluation. */
  private distanceSqTo(id: string, eye: Vec3): number {
    const p = PLACEMENT_BY_EXHIBIT.get(id);
    if (!p) return Infinity;
    const dx = eye[0] - p.anchor[0];
    const dy = eye[1] - p.anchor[1];
    const dz = eye[2] - p.anchor[2];
    return dx * dx + dy * dy + dz * dz;
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
    const neighbours = here?.neighbours ?? [];
    const loadRadiusSq = this.budget.loadRadius * this.budget.loadRadius;
    const unloadRadiusSq = this.budget.unloadRadius * this.budget.unloadRadius;
    const activateRadiusSq = this.budget.activateRadius * this.budget.activateRadius;
    const deactivateRadiusSq = activateRadiusSq * 1.25 * 1.25;

    for (const [id, host] of this.hosts) {
      const distanceSq = this.distanceSqTo(id, eye);
      const state = host.currentState;
      // Distance alone is not enough: bays in different wings and on different
      // levels can be metres apart through a floor. An exhibit is only relevant
      // while the visitor is in its wing or somewhere adjoining it.
      const inRelevantZone = zone === host.record.wing || neighbours.includes(host.record.wing);
      const inOwnWing = zone === host.record.wing;

      if (inRelevantZone && distanceSq <= loadRadiusSq) {
        if (state === 'unloaded' && !this.loading.has(id)) {
          this.loading.add(id);
          const started = performance.now();
          void host
            .preload()
            .then(() => {
              this.telemetry.lastLoadMs = performance.now() - started;
              if (!this.queued.has(id)) {
                this.queued.add(id);
                this.mountQueue.push(id);
              }
            })
            .catch((err) => console.error(`[Streaming] preload failed for ${id}`, err))
            .finally(() => this.loading.delete(id));
        } else if (state === 'loaded' && !this.queued.has(id)) {
          this.queued.add(id);
          this.mountQueue.push(id);
        }
      } else if (!inRelevantZone || distanceSq > unloadRadiusSq) {
        if (state === 'active' || state === 'mounted') {
          host.unmount();
          this.telemetry.totalUnmounts++;
        }
        if (this.queued.delete(id)) {
          const queued = this.mountQueue.indexOf(id);
          if (queued >= 0) this.mountQueue.splice(queued, 1);
        }
      }

      if (state === 'mounted' || state === 'active') resident++;
      if (host.currentState === 'active') {
        if (!inOwnWing || distanceSq > deactivateRadiusSq) {
          host.deactivate();
        } else {
          active++;
        }
      } else if (host.currentState === 'mounted' && inOwnWing && distanceSq <= activateRadiusSq) {
        host.activate(this.now);
        active++;
      }
    }

    // Spread construction across frames so approaching a wing never hitches.
    let budgetLeft = this.budget.mountsPerFrame;
    while (budgetLeft > 0 && this.mountQueue.length > 0) {
      const id = this.mountQueue.shift()!;
      this.queued.delete(id);
      const host = this.hosts.get(id);
      if (!host || host.currentState !== 'loaded') continue;
      if (zone !== host.record.wing && !neighbours.includes(host.record.wing)) continue;
      if (this.distanceSqTo(id, eye) > unloadRadiusSq) continue;
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

  nearestActiveId(eye: Vec3, maxDistanceSq = Infinity): string | null {
    let nearest: ExhibitHost | null = null;
    let best = maxDistanceSq;
    for (const host of this.hosts.values()) {
      if (!host.isActive) continue;
      const anchor = host.module.def.anchor;
      const dx = eye[0] - anchor[0];
      const dy = eye[1] - anchor[1];
      const dz = eye[2] - anchor[2];
      const distanceSq = dx * dx + dy * dy + dz * dz;
      if (distanceSq < best) {
        best = distanceSq;
        nearest = host;
      }
    }
    return nearest?.id ?? null;
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
    this.queued.clear();
    this.loading.clear();
  }
}

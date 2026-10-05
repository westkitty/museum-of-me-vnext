import type * as THREE from 'three';
import { ExhibitHost, type HostServices } from './ExhibitHost';
import { createExhibit, hasExhibit } from './registry';
import { EXHIBITS_BY_ID } from '../content/collection.generated';
import { PLACEMENT_BY_EXHIBIT, ZONE_BY_ID, type Vec3, type ZoneId } from '../world/layout';

const RELEVANT_WINGS_BY_ZONE = new Map<ZoneId, ReadonlySet<string>>(
  [...ZONE_BY_ID].map(([id, zone]) => [id, new Set<string>([id, ...zone.neighbours])]),
);
const NO_RELEVANT_WINGS: ReadonlySet<string> = new Set();

/** Arrival order from the plaza: outer south pair first, then the next pair inward. */
export const ENTRANCE_PREWARM_IDS = ['E32', 'E33', 'E30', 'E31'] as const;
export const ENTRANCE_CRITICAL_PREWARM_IDS = ['E32', 'E33'] as const;
/** Planned title screen dwell. The UI is not implemented yet; the hook is. */
export const TITLE_PREWARM_MIN_DWELL_MS = 4_000;

export interface StreamingBudget {
  /** Metres at which an exhibit payload starts loading. */
  loadRadius: number;
  /** Metres at which it is released. Hysteresis prevents thrash at the edge. */
  unloadRadius: number;
  /** Metres at which a mounted exhibit becomes active and starts updating. */
  activateRadius: number;
  /** Maximum number of exhibits constructed per frame. */
  mountsPerFrame: number;
  /** Soft CPU budget for synchronous mount work in one frame. */
  mountBudgetMs?: number;
  /** Maximum number of asynchronous GPU warmups started per frame. */
  warmupsPerFrame?: number;
  /** Maximum exhibits made visible/active per frame. */
  activationsPerFrame?: number;
  /** Soft CPU budget for activation work in one frame. */
  activationBudgetMs?: number;
}

export interface StreamingTelemetry {
  resident: number;
  active: number;
  pendingLoads: number;
  pendingWarms: number;
  pendingActivations: number;
  lastLoadMs: number;
  lastMountMs: number;
  lastWarmMs: number;
  lastActivationMs: number;
  totalMounts: number;
  totalUnmounts: number;
  totalWarms: number;
  totalActivations: number;
  prewarmTotal: number;
  prewarmMounted: number;
  prewarmWarmed: number;
  prewarmCriticalTotal: number;
  prewarmCriticalWarmed: number;
  prewarmReady: boolean;
}

export interface StreamingHostTiming {
  readonly id: string;
  readonly preloadMs: number;
  readonly mountMs: number;
  readonly gpuWarmMs: number;
  readonly activationMs: number;
  readonly mountQueueMs: number;
  readonly warmQueueMs: number;
  readonly activationQueueMs: number;
  readonly gpuReady: boolean;
}

export interface EntrancePrewarmStatus {
  readonly ids: readonly string[];
  readonly total: number;
  readonly mounted: number;
  readonly warmed: number;
  readonly criticalTotal: number;
  readonly criticalWarmed: number;
  readonly ready: boolean;
  readonly startedAtMs: number | null;
  readonly readyAtMs: number | null;
}

interface Candidate {
  id: string;
  host: ExhibitHost;
  distanceSq: number;
}

/**
 * Layer-3 exhibit streaming.
 *
 * r62 separates four costs that used to collapse onto the doorway:
 * preload -> hidden mount/prepare -> GPU warm -> visible activation.
 * The entrance-facing south exhibits are prepared in arrival order while the
 * visitor is still on the title/plaza path. Activation is budgeted separately,
 * so two heavy exhibits never become visible on the same frame.
 */
export class StreamingManager {
  readonly hosts = new Map<string, ExhibitHost>();
  readonly telemetry: StreamingTelemetry = {
    resident: 0,
    active: 0,
    pendingLoads: 0,
    pendingWarms: 0,
    pendingActivations: 0,
    lastLoadMs: 0,
    lastMountMs: 0,
    lastWarmMs: 0,
    lastActivationMs: 0,
    totalMounts: 0,
    totalUnmounts: 0,
    totalWarms: 0,
    totalActivations: 0,
    prewarmTotal: 0,
    prewarmMounted: 0,
    prewarmWarmed: 0,
    prewarmCriticalTotal: 0,
    prewarmCriticalWarmed: 0,
    prewarmReady: false,
  };

  private readonly mountQueue: string[] = [];
  private mountQueueHead = 0;
  private readonly priorityMountQueue: string[] = [];
  private priorityMountQueueHead = 0;
  private readonly queued = new Set<string>();
  private readonly loading = new Set<string>();

  private readonly warmQueue: string[] = [];
  private warmQueueHead = 0;
  private readonly priorityWarmQueue: string[] = [];
  private priorityWarmQueueHead = 0;
  private readonly warmQueued = new Set<string>();
  private readonly warming = new Set<string>();

  private readonly activeHosts = new Set<ExhibitHost>();
  private readonly activationEligibleSince = new Map<string, number>();
  private readonly activationCandidates: Candidate[] = [];

  private readonly prewarmTargets = new Set<string>();
  private readonly prewarmRank = new Map<string, number>();
  private prewarmStartedAtMs: number | null = null;
  private prewarmReadyAtMs: number | null = null;

  private readonly mountQueuedAt = new Map<string, number>();
  private readonly warmQueuedAt = new Map<string, number>();
  private readonly queueTiming = new Map<string, {
    mountQueueMs: number;
    warmQueueMs: number;
    activationQueueMs: number;
  }>();

  private readonly loadRadiusSq: number;
  private readonly unloadRadiusSq: number;
  private readonly activateRadiusSq: number;
  private readonly deactivateRadiusSq: number;
  /** Changes only when an exhibit crosses the mounted/unmounted residency boundary. */
  residencyRevision = 0;
  private now = 0;

  constructor(
    private readonly mounts: ReadonlyMap<string, THREE.Group>,
    private readonly services: HostServices,
    public readonly budget: StreamingBudget,
  ) {
    this.loadRadiusSq = budget.loadRadius * budget.loadRadius;
    this.unloadRadiusSq = budget.unloadRadius * budget.unloadRadius;
    this.activateRadiusSq = budget.activateRadius * budget.activateRadius;
    this.deactivateRadiusSq = this.activateRadiusSq * 1.25 * 1.25;
  }

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
      this.queueTiming.set(record.id, { mountQueueMs: 0, warmQueueMs: 0, activationQueueMs: 0 });
    }
  }

  /**
   * Start the future-title-screen prewarm contract immediately at app boot.
   * Idempotent: title-screen code can call this again without duplicating work.
   */
  beginEntrancePrewarm(ids: readonly string[] = ENTRANCE_PREWARM_IDS): void {
    if (this.prewarmStartedAtMs === null) this.prewarmStartedAtMs = performance.now();
    ids.forEach((id, index) => {
      if (!this.hosts.has(id)) return;
      this.prewarmTargets.add(id);
      if (!this.prewarmRank.has(id)) this.prewarmRank.set(id, index);
      this.requestPreload(id, true);
    });
    this.updatePrewarmTelemetry();
  }

  get entrancePrewarmStatus(): EntrancePrewarmStatus {
    return {
      ids: [...this.prewarmTargets].sort(
        (a, b) => (this.prewarmRank.get(a) ?? Infinity) - (this.prewarmRank.get(b) ?? Infinity),
      ),
      total: this.telemetry.prewarmTotal,
      mounted: this.telemetry.prewarmMounted,
      warmed: this.telemetry.prewarmWarmed,
      criticalTotal: this.telemetry.prewarmCriticalTotal,
      criticalWarmed: this.telemetry.prewarmCriticalWarmed,
      ready: this.telemetry.prewarmReady,
      startedAtMs: this.prewarmStartedAtMs,
      readyAtMs: this.prewarmReadyAtMs,
    };
  }

  timingFor(id: string): StreamingHostTiming | null {
    const host = this.hosts.get(id);
    const queue = this.queueTiming.get(id);
    if (!host || !queue) return null;
    return {
      id,
      preloadMs: host.timing.preloadMs,
      mountMs: host.timing.mountMs,
      gpuWarmMs: host.timing.gpuWarmMs,
      activationMs: host.timing.activationMs,
      mountQueueMs: queue.mountQueueMs,
      warmQueueMs: queue.warmQueueMs,
      activationQueueMs: queue.activationQueueMs,
      gpuReady: host.isGpuWarm,
    };
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

  private isPrewarmHold(id: string, zone: ZoneId): boolean {
    return this.prewarmTargets.has(id) && (zone === 'plaza' || zone === 'south');
  }

  private requestPreload(id: string, priority: boolean): void {
    const host = this.hosts.get(id);
    if (!host) return;

    if (host.currentState === 'loaded') {
      this.enqueueMount(id, priority);
      return;
    }
    if (host.currentState === 'mounted' || host.currentState === 'active') {
      if (!host.isGpuWarm) this.enqueueWarm(id, priority);
      return;
    }
    if (host.currentState !== 'unloaded' || this.loading.has(id)) return;

    this.loading.add(id);
    const started = performance.now();
    void host
      .preload()
      .then(() => {
        this.telemetry.lastLoadMs = performance.now() - started;
        this.enqueueMount(id, priority || this.prewarmTargets.has(id));
      })
      .catch((err) => console.error(`[Streaming] preload failed for ${id}`, err))
      .finally(() => {
        this.loading.delete(id);
        this.updatePrewarmTelemetry();
      });
  }

  private enqueueMount(id: string, priority: boolean): void {
    if (this.queued.has(id)) return;
    this.queued.add(id);
    this.mountQueuedAt.set(id, performance.now());
    if (priority) {
      let insertAt = this.priorityMountQueue.length;
      const rank = this.prewarmRank.get(id) ?? Infinity;
      for (let i = this.priorityMountQueueHead; i < this.priorityMountQueue.length; i++) {
        if (rank < (this.prewarmRank.get(this.priorityMountQueue[i]) ?? Infinity)) {
          insertAt = i;
          break;
        }
      }
      this.priorityMountQueue.splice(insertAt, 0, id);
    } else {
      this.mountQueue.push(id);
    }
  }

  private enqueueWarm(id: string, priority: boolean): void {
    const host = this.hosts.get(id);
    if (!host || host.currentState !== 'mounted' || host.isGpuWarm) return;
    if (this.warmQueued.has(id) || this.warming.has(id)) return;
    this.warmQueued.add(id);
    this.warmQueuedAt.set(id, performance.now());
    if (priority) {
      let insertAt = this.priorityWarmQueue.length;
      const rank = this.prewarmRank.get(id) ?? Infinity;
      for (let i = this.priorityWarmQueueHead; i < this.priorityWarmQueue.length; i++) {
        if (rank < (this.prewarmRank.get(this.priorityWarmQueue[i]) ?? Infinity)) {
          insertAt = i;
          break;
        }
      }
      this.priorityWarmQueue.splice(insertAt, 0, id);
    } else {
      this.warmQueue.push(id);
    }
  }

  private dequeue(
    priority: string[],
    priorityHead: 'priorityMountQueueHead' | 'priorityWarmQueueHead',
    ordinary: string[],
    ordinaryHead: 'mountQueueHead' | 'warmQueueHead',
    membership: Set<string>,
  ): string | null {
    while (this[priorityHead] < priority.length) {
      const id = priority[this[priorityHead]++];
      if (membership.delete(id)) return id;
    }
    while (this[ordinaryHead] < ordinary.length) {
      const id = ordinary[this[ordinaryHead]++];
      if (membership.delete(id)) return id;
    }
    return null;
  }

  private compactQueues(): void {
    if (this.mountQueueHead > 64 && this.mountQueueHead * 2 > this.mountQueue.length) {
      this.mountQueue.splice(0, this.mountQueueHead);
      this.mountQueueHead = 0;
    }
    if (
      this.priorityMountQueueHead > 32
      && this.priorityMountQueueHead * 2 > this.priorityMountQueue.length
    ) {
      this.priorityMountQueue.splice(0, this.priorityMountQueueHead);
      this.priorityMountQueueHead = 0;
    }
    if (this.warmQueueHead > 64 && this.warmQueueHead * 2 > this.warmQueue.length) {
      this.warmQueue.splice(0, this.warmQueueHead);
      this.warmQueueHead = 0;
    }
    if (
      this.priorityWarmQueueHead > 32
      && this.priorityWarmQueueHead * 2 > this.priorityWarmQueue.length
    ) {
      this.priorityWarmQueue.splice(0, this.priorityWarmQueueHead);
      this.priorityWarmQueueHead = 0;
    }
  }

  /**
   * Evaluate residency. Called once per frame from the single loop.
   * CPU construction, GPU warmup and activation are independently bounded.
   */
  evaluate(eye: Vec3, dt: number, zone: ZoneId): void {
    this.now += dt;
    const relevantWings = RELEVANT_WINGS_BY_ZONE.get(zone) ?? NO_RELEVANT_WINGS;
    this.activationCandidates.length = 0;

    for (const [id, host] of this.hosts) {
      const distanceSq = this.distanceSqTo(id, eye);
      const state = host.currentState;
      const inRelevantZone = relevantWings.has(host.record.wing);
      const inOwnWing = zone === host.record.wing;
      const prewarmHold = this.isPrewarmHold(id, zone);

      if (inRelevantZone && distanceSq <= this.loadRadiusSq) {
        if (state === 'unloaded') {
          this.requestPreload(id, this.prewarmTargets.has(id));
        } else if (state === 'loaded') {
          this.enqueueMount(id, this.prewarmTargets.has(id));
        }
      } else if (!inRelevantZone || (distanceSq > this.unloadRadiusSq && !prewarmHold)) {
        if (state === 'active' || state === 'mounted') {
          this.activeHosts.delete(host);
          host.unmount();
          this.telemetry.totalUnmounts++;
          this.residencyRevision++;
        }
        this.queued.delete(id);
        this.warmQueued.delete(id);
        this.activationEligibleSince.delete(id);
        continue;
      }

      if (
        host.currentState === 'mounted'
        && !host.isGpuWarm
        && (prewarmHold || (inRelevantZone && distanceSq <= this.loadRadiusSq))
      ) {
        // Also acts as the retry path if a previous asynchronous warm failed.
        this.enqueueWarm(id, this.prewarmTargets.has(id));
      }

      if (host.currentState === 'active') {
        if (!inOwnWing || distanceSq > this.deactivateRadiusSq) {
          host.deactivate();
          this.activeHosts.delete(host);
          this.activationEligibleSince.delete(id);
        } else {
          this.activeHosts.add(host);
        }
      } else if (
        host.currentState === 'mounted'
        && inOwnWing
        && distanceSq <= this.activateRadiusSq
      ) {
        if (!this.activationEligibleSince.has(id)) this.activationEligibleSince.set(id, performance.now());
        if (host.isGpuWarm) {
          this.activationCandidates.push({ id, host, distanceSq });
        } else {
          this.enqueueWarm(id, this.prewarmTargets.has(id));
        }
      } else {
        this.activationEligibleSince.delete(id);
      }
    }

    this.drainMountQueue(eye, zone, relevantWings);
    this.drainWarmQueue();
    this.drainActivationQueue();
    this.compactQueues();
    this.refreshTelemetry();
  }

  private drainMountQueue(
    eye: Vec3,
    zone: ZoneId,
    relevantWings: ReadonlySet<string>,
  ): void {
    let countLeft = Math.max(1, this.budget.mountsPerFrame);
    const budgetMs = Math.max(0.5, this.budget.mountBudgetMs ?? 6);
    const frameStarted = performance.now();

    while (countLeft > 0 && performance.now() - frameStarted <= budgetMs) {
      const id = this.dequeue(
        this.priorityMountQueue,
        'priorityMountQueueHead',
        this.mountQueue,
        'mountQueueHead',
        this.queued,
      );
      if (!id) break;
      const host = this.hosts.get(id);
      if (!host || host.currentState !== 'loaded') continue;
      const prewarmHold = this.isPrewarmHold(id, zone);
      if (!prewarmHold && !relevantWings.has(host.record.wing)) continue;
      if (!prewarmHold && this.distanceSqTo(id, eye) > this.unloadRadiusSq) continue;

      const queuedAt = this.mountQueuedAt.get(id);
      if (queuedAt !== undefined) {
        this.queueTiming.get(id)!.mountQueueMs = performance.now() - queuedAt;
        this.mountQueuedAt.delete(id);
      }

      try {
        host.mount();
        this.telemetry.lastMountMs = host.timing.mountMs;
        this.telemetry.totalMounts++;
        this.residencyRevision++;
        this.enqueueWarm(id, this.prewarmTargets.has(id));
      } catch (err) {
        console.error(`[Streaming] mount failed for ${id}`, err);
      }
      countLeft--;
    }
  }

  private drainWarmQueue(): void {
    const startsPerFrame = Math.max(1, this.budget.warmupsPerFrame ?? 1);
    // Parallel shader compilation is already asynchronous; serializing host
    // dispatch prevents four large exhibits from all submitting compile work at once.
    if (this.warming.size > 0) return;

    let startsLeft = startsPerFrame;
    while (startsLeft > 0 && this.warming.size === 0) {
      const id = this.dequeue(
        this.priorityWarmQueue,
        'priorityWarmQueueHead',
        this.warmQueue,
        'warmQueueHead',
        this.warmQueued,
      );
      if (!id) break;
      const host = this.hosts.get(id);
      if (!host || host.currentState !== 'mounted' || host.isGpuWarm) continue;

      const queuedAt = this.warmQueuedAt.get(id);
      if (queuedAt !== undefined) {
        this.queueTiming.get(id)!.warmQueueMs = performance.now() - queuedAt;
        this.warmQueuedAt.delete(id);
      }

      this.warming.add(id);
      void host
        .warmGpu()
        .then(() => {
          this.telemetry.lastWarmMs = host.timing.gpuWarmMs;
          if (host.isGpuWarm) this.telemetry.totalWarms++;
        })
        .catch((err) => console.error(`[Streaming] GPU warm failed for ${id}`, err))
        .finally(() => {
          this.warming.delete(id);
          this.updatePrewarmTelemetry();
        });
      startsLeft--;
    }
  }

  private drainActivationQueue(): void {
    if (this.activationCandidates.length === 0) return;
    this.activationCandidates.sort((a, b) => {
      const d = a.distanceSq - b.distanceSq;
      if (Math.abs(d) > 1e-6) return d;
      return (this.prewarmRank.get(a.id) ?? Infinity) - (this.prewarmRank.get(b.id) ?? Infinity);
    });

    let countLeft = Math.max(1, this.budget.activationsPerFrame ?? 1);
    const budgetMs = Math.max(0.25, this.budget.activationBudgetMs ?? 3);
    const frameStarted = performance.now();

    for (const candidate of this.activationCandidates) {
      if (countLeft <= 0 || performance.now() - frameStarted > budgetMs) break;
      const { id, host } = candidate;
      if (host.currentState !== 'mounted' || !host.isGpuWarm) continue;

      const eligibleAt = this.activationEligibleSince.get(id);
      if (eligibleAt !== undefined) {
        this.queueTiming.get(id)!.activationQueueMs = performance.now() - eligibleAt;
      }

      try {
        host.activate(this.now);
        this.telemetry.lastActivationMs = host.timing.activationMs;
        this.telemetry.totalActivations++;
        this.activeHosts.add(host);
        this.activationEligibleSince.delete(id);
      } catch (err) {
        console.error(`[Streaming] activation failed for ${id}`, err);
      }
      countLeft--;
    }
  }

  private updatePrewarmTelemetry(): void {
    let mounted = 0;
    let warmed = 0;
    let criticalWarmed = 0;
    for (const id of this.prewarmTargets) {
      const host = this.hosts.get(id);
      if (!host) continue;
      if (host.currentState === 'mounted' || host.currentState === 'active') mounted++;
      if (host.isGpuWarm) {
        warmed++;
        if ((ENTRANCE_CRITICAL_PREWARM_IDS as readonly string[]).includes(id)) criticalWarmed++;
      }
    }
    const total = this.prewarmTargets.size;
    const criticalTotal = ENTRANCE_CRITICAL_PREWARM_IDS.filter((id) => this.prewarmTargets.has(id)).length;
    const ready = criticalTotal > 0 && criticalWarmed === criticalTotal;
    if (ready && this.prewarmReadyAtMs === null) this.prewarmReadyAtMs = performance.now();
    if (!ready) this.prewarmReadyAtMs = null;

    this.telemetry.prewarmTotal = total;
    this.telemetry.prewarmMounted = mounted;
    this.telemetry.prewarmWarmed = warmed;
    this.telemetry.prewarmCriticalTotal = criticalTotal;
    this.telemetry.prewarmCriticalWarmed = criticalWarmed;
    this.telemetry.prewarmReady = ready;
  }

  private refreshTelemetry(): void {
    let resident = 0;
    let active = 0;
    for (const host of this.hosts.values()) {
      if (host.currentState === 'mounted' || host.currentState === 'active') resident++;
      if (host.currentState === 'active') active++;
    }
    this.telemetry.resident = resident;
    this.telemetry.active = active;
    this.telemetry.pendingLoads = this.loading.size + this.queued.size;
    this.telemetry.pendingWarms = this.warmQueued.size + this.warming.size;
    this.telemetry.pendingActivations = this.activationEligibleSince.size;
    this.updatePrewarmTelemetry();
  }

  /** Step only active exhibits; inactive hosts never enter the fixed-step loop. */
  updateActive(dt: number, eye: Vec3): void {
    for (const host of this.activeHosts) host.update(dt, eye, this.now);
  }

  get(id: string): ExhibitHost | undefined {
    return this.hosts.get(id);
  }

  nearestActiveId(eye: Vec3, maxDistanceSq = Infinity): string | null {
    let nearest: ExhibitHost | null = null;
    let best = maxDistanceSq;
    for (const host of this.activeHosts) {
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
    this.priorityMountQueue.length = 0;
    this.warmQueue.length = 0;
    this.priorityWarmQueue.length = 0;
    this.queued.clear();
    this.loading.clear();
    this.warmQueued.clear();
    this.warming.clear();
    this.activeHosts.clear();
    this.activationEligibleSince.clear();
    this.prewarmTargets.clear();
    this.prewarmRank.clear();
    this.mountQueuedAt.clear();
    this.warmQueuedAt.clear();
    this.queueTiming.clear();
  }
}

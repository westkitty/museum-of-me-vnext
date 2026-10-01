import type { QualityTier } from './QualityTiers';

export const TIER_LADDER: readonly QualityTier[] = ['low', 'medium', 'high'];

export type GovernorDecision = 'none' | 'degrade' | 'restore';

export interface GovernorThresholds {
  /** p95 frame time, milliseconds, above which the museum is missing frames. */
  readonly overBudgetMs: number;
  /** p95 frame time, milliseconds, below which there is provable headroom. */
  readonly underBudgetMs: number;
  /** Seconds between p95 evaluations. */
  readonly windowSeconds: number;
  /** Consecutive agreeing windows before a downgrade. */
  readonly windowsBeforeDegrade: number;
  /** Consecutive agreeing windows before an upgrade. Deliberately longer. */
  readonly windowsBeforeRestore: number;
  /** Seconds after any change during which nothing else happens. */
  readonly cooldownSeconds: number;
  /** Maximum frame samples in the rolling p95 window (240 by default). */
  readonly historyFrames: number;
}

/**
 * A 60 Hz frame period is 16.7 ms. 21 ms means the display demonstrably missed
 * a frame rather than merely being close to one; 14.5 ms means the frame
 * finished with room to spare. The p95 uses a rolling sample of up to 240
 * recent frames (four seconds at 60 Hz and shorter on high-refresh displays);
 * evaluations happen every three seconds, and two consecutive over-budget
 * evaluations are required to change the tier. A single garbage collection or
 * mount should not change it.
 */
export const DEFAULT_THRESHOLDS: GovernorThresholds = {
  overBudgetMs: 21,
  underBudgetMs: 14.5,
  windowSeconds: 3,
  windowsBeforeDegrade: 2,
  windowsBeforeRestore: 4,
  cooldownSeconds: 10,
  historyFrames: 240,
};

export interface GovernorSnapshot {
  /** Tier the renderer should currently be using. */
  readonly tier: QualityTier;
  /** Best tier this device is allowed to reach, from the boot detection. */
  readonly ceiling: QualityTier;
  /** Recent p95 frame time in milliseconds. */
  readonly recentP95Ms: number;
  /** How many times the museum has adapted this session. */
  readonly changes: number;
  /** Last adaptation, for the settings panel and the visitor notice. */
  readonly lastReason: string;
  readonly enabled: boolean;
}

/**
 * Adaptive quality (build plan §24 "quality tiers"; the performance pass's
 * "adaptive quality" lever).
 *
 * The museum picks an initial tier from `hardwareConcurrency`, `deviceMemory`
 * and screen width — three cheap signals that are frequently wrong in both
 * directions on real devices, and completely blind to what else the machine is
 * doing. This watches what the renderer actually achieves and steps the tier
 * down when the museum is missing frames, then back up when it demonstrably is
 * not.
 *
 * Deliberate constraints:
 * - it never exceeds the tier the boot detection allowed, so a machine never
 *   drifts into a configuration its own hardware signal refused;
 * - it is disabled entirely when the visitor pins a tier by hand, because an
 *   explicit choice must not be overruled by a heuristic;
 * - it is fed only when the render loop is uncapped, because a frame cap makes
 *   a healthy machine look slow;
 * - its state is never written to preferences: the visitor stays on
 *   "Automatic" and the museum re-measures on the next visit.
 */
export class QualityGovernor {
  private readonly samples: Float32Array;
  private sampleCount = 0;
  private sampleCursor = 0;

  private ceiling: QualityTier;
  private current: QualityTier;
  private enabledFlag: boolean;

  private elapsed = 0;
  private cooldown = 0;
  private degradeStreak = 0;
  private restoreStreak = 0;
  private changeCount = 0;
  private reason = 'measuring';
  private p95 = 0;

  constructor(
    ceiling: QualityTier,
    enabled = true,
    private readonly thresholds: GovernorThresholds = DEFAULT_THRESHOLDS,
  ) {
    this.ceiling = ceiling;
    this.current = ceiling;
    this.enabledFlag = enabled;
    this.samples = new Float32Array(Math.max(60, thresholds.historyFrames));
  }

  get tier(): QualityTier {
    return this.current;
  }

  get enabled(): boolean {
    return this.enabledFlag;
  }

  /**
   * Point the governor at a new hardware ceiling. Called when the visitor
   * changes the Quality setting: pinning a tier disables adaptation, choosing
   * Automatic re-enables it at the freshly detected level.
   */
  configure(ceiling: QualityTier, enabled: boolean): void {
    this.ceiling = ceiling;
    this.current = ceiling;
    this.enabledFlag = enabled;
    // A new configuration has no history: the visitor changed the setting, so
    // "adapted twice this session" would describe a museum that no longer
    // exists.
    this.changeCount = 0;
    this.reset();
  }

  /**
   * Adopt a tier chosen outside the governor — used after the governor itself
   * asks for a change, so the applied tier and the recorded tier agree.
   */
  forceTier(tier: QualityTier): void {
    this.current = tier;
  }

  reset(): void {
    this.sampleCount = 0;
    this.sampleCursor = 0;
    this.elapsed = 0;
    this.cooldown = 0;
    this.degradeStreak = 0;
    this.restoreStreak = 0;
    this.p95 = 0;
    this.reason = 'measuring';
  }

  /**
   * One rendered frame. `frameMs` is the wall-clock frame duration and `dt` is
   * the same duration in seconds. Returns what the caller should do about it.
   */
  observe(frameMs: number, dt: number): GovernorDecision {
    if (!this.enabledFlag) return 'none';
    if (!Number.isFinite(frameMs) || frameMs <= 0) return 'none';
    if (dt > 0 && this.cooldown > 0) this.cooldown -= dt;

    this.samples[this.sampleCursor] = frameMs;
    this.sampleCursor = (this.sampleCursor + 1) % this.samples.length;
    if (this.sampleCount < this.samples.length) this.sampleCount++;

    this.elapsed += dt;
    if (this.elapsed < this.thresholds.windowSeconds) return 'none';
    this.elapsed = 0;
    this.p95 = this.percentile(0.95);

    if (this.p95 > this.thresholds.overBudgetMs) {
      this.degradeStreak++;
      this.restoreStreak = 0;
      if (this.degradeStreak >= this.thresholds.windowsBeforeDegrade && this.cooldown <= 0) {
        this.degradeStreak = 0;
        const next = this.step(-1);
        if (next) return this.commit(next, `sustained ${this.p95.toFixed(1)} ms frames`);
      }
      return 'none';
    }

    if (this.p95 < this.thresholds.underBudgetMs) {
      this.restoreStreak++;
      this.degradeStreak = 0;
      if (this.restoreStreak >= this.thresholds.windowsBeforeRestore && this.cooldown <= 0) {
        this.restoreStreak = 0;
        const next = this.step(1);
        if (next) return this.commit(next, `headroom at ${this.p95.toFixed(1)} ms frames`);
      }
      return 'none';
    }

    // Between the two thresholds: the museum is neither failing nor free.
    // Neither streak survives, so a machine hovering at the boundary settles
    // instead of oscillating between tiers.
    this.degradeStreak = 0;
    this.restoreStreak = 0;
    this.reason = `steady at ${this.p95.toFixed(1)} ms frames`;
    return 'none';
  }

  get snapshot(): GovernorSnapshot {
    return {
      tier: this.current,
      ceiling: this.ceiling,
      recentP95Ms: this.p95,
      changes: this.changeCount,
      lastReason: this.reason,
      enabled: this.enabledFlag,
    };
  }

  private commit(next: QualityTier, reason: string): GovernorDecision {
    const direction: GovernorDecision =
      TIER_LADDER.indexOf(next) > TIER_LADDER.indexOf(this.current) ? 'restore' : 'degrade';
    this.current = next;
    this.changeCount++;
    this.cooldown = this.thresholds.cooldownSeconds;
    this.reason = reason;
    return direction;
  }

  /**
   * The neighbouring tier in `direction`, or null at a limit. Upgrades are
   * clamped to the ceiling: `current` starts there, so this is what stops a
   * recovery from outrunning the device's own hardware signal.
   */
  private step(direction: number): QualityTier | null {
    const target = TIER_LADDER.indexOf(this.current) + direction;
    if (target < 0 || target >= TIER_LADDER.length) return null;
    const next = TIER_LADDER[target];
    if (direction > 0 && TIER_LADDER.indexOf(next) > TIER_LADDER.indexOf(this.ceiling)) return null;
    return next;
  }

  private percentile(fraction: number): number {
    if (this.sampleCount === 0) return 0;
    const sorted = Array.from(this.samples.subarray(0, this.sampleCount)).sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
    return sorted[index];
  }
}

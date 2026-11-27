/** Yield one main-thread task so the browser can paint and process input. */
export function yieldToEventLoop(): Promise<void> {
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(undefined);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Waits longer than this count as a slow frame (60 and 30 Hz frames stay below it). */
const SLOW_FRAME_WAIT_MS = 40;
/** Consecutive slow waits needed before a work slice grows. */
const SUSTAINED_SLOW_WAITS = 3;

/**
 * Chooses a cooperative work slice from recent frame waits.
 *
 * A slice grows only when frames are slow *consistently* (a software renderer,
 * a struggling device): the last three waits must all exceed 40 ms, and the
 * slice is half of the fastest of them, capped. One isolated hitch on 60 Hz
 * hardware (a module evaluation, a GC pause, a busy frame) must not hand the
 * next slices tens of milliseconds each: every such slice misses a vsync while
 * the visitor is walking, and the misses then feed further growth.
 */
export class SustainedFrameWait {
  private readonly recent: number[] = [];

  constructor(private readonly minSliceMs: number, private readonly maxSliceMs: number) {}

  /** Slices grown beyond the minimum, and the largest, for telemetry. */
  grownCount = 0;
  largestSliceMs = 0;

  /** Records one measured wait and returns the slice to use next. */
  observe(waitedMs: number): number {
    this.recent.push(waitedMs);
    if (this.recent.length > SUSTAINED_SLOW_WAITS) this.recent.shift();
    const fastest = Math.min(...this.recent);
    const slice = this.recent.length === SUSTAINED_SLOW_WAITS && fastest > SLOW_FRAME_WAIT_MS
      ? Math.min(this.maxSliceMs, Math.max(this.minSliceMs, fastest * 0.5))
      : this.minSliceMs;
    if (slice > this.minSliceMs) this.grownCount++;
    this.largestSliceMs = Math.max(this.largestSliceMs, slice);
    return slice;
  }
}

/**
 * Batches small synchronous build steps but yields before a slice grows long.
 *
 * Each yield lets a frame run. When frames are themselves slow (a software
 * renderer, a struggling device), a fixed 8 ms slice would hand the build only
 * a sliver of the main thread and stretch a few seconds of work into minutes.
 * So once frames are consistently slow the slice grows to half of what the
 * yields actually waited, capped (see SustainedFrameWait): on a 60 Hz device
 * the slice stays at the minimum and frames stay smooth.
 */
export class EventLoopYieldBudget {
  private lastYieldAt = performance.now();
  private sliceMs: number;
  private readonly waits: SustainedFrameWait;

  constructor(
    minSliceMs = 8,
    maxSliceMs = 250,
    private readonly yieldOnce: () => Promise<void> = yieldToEventLoop,
  ) {
    this.sliceMs = minSliceMs;
    this.waits = new SustainedFrameWait(minSliceMs, maxSliceMs);
  }

  /** Slices grown beyond the minimum, and the largest slice used. */
  get growth(): { grown: number; largestMs: number } {
    return { grown: this.waits.grownCount, largestMs: this.waits.largestSliceMs };
  }

  /** The current slice length, for tests and telemetry. */
  get currentSliceMs(): number {
    return this.sliceMs;
  }

  async checkpoint(): Promise<void> {
    if (performance.now() - this.lastYieldAt < this.sliceMs) return;
    const waitStarted = performance.now();
    await this.yieldOnce();
    this.lastYieldAt = performance.now();
    this.sliceMs = this.waits.observe(this.lastYieldAt - waitStarted);
  }
}

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

/**
 * Batches small synchronous build steps but yields before a slice grows long.
 *
 * Each yield lets a frame run. When frames are themselves slow (a software
 * renderer, a struggling device), a fixed 8 ms slice would hand the build only
 * a sliver of the main thread and stretch a few seconds of work into minutes.
 * So the slice grows to half of what the last yield actually waited, capped:
 * on a 60 Hz device the slice stays at the minimum and frames stay smooth.
 */
export class EventLoopYieldBudget {
  private lastYieldAt = performance.now();
  private sliceMs: number;

  constructor(
    private readonly minSliceMs = 8,
    private readonly maxSliceMs = 250,
    private readonly yieldOnce: () => Promise<void> = yieldToEventLoop,
  ) {
    this.sliceMs = minSliceMs;
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
    const waited = this.lastYieldAt - waitStarted;
    this.sliceMs = Math.min(this.maxSliceMs, Math.max(this.minSliceMs, waited * 0.5));
  }
}

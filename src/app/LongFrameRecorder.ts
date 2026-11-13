/** One frame the browser reported as long, with what the museum was doing. */
export interface LongFrame {
  /** performance.now() when the frame started. */
  readonly at: number;
  readonly durationMs: number;
  /** Time input would have waited (long-animation-frame only). */
  readonly blockingMs: number;
  readonly world: string;
  readonly phase: string;
  /** The longest script in the frame: invoker, function and source, when the browser reports it. */
  readonly script: string;
}

interface ScriptTiming {
  readonly duration: number;
  readonly invoker?: string;
  readonly sourceFunctionName?: string;
  readonly sourceURL?: string;
  readonly sourceCharPosition?: number;
}

interface LongAnimationFrameTiming extends PerformanceEntry {
  readonly blockingDuration?: number;
  readonly scripts?: readonly ScriptTiming[];
}

const CAPACITY = 50;

/**
 * Records frames over 50 ms (the browser's own long-animation-frame threshold)
 * with the world and transition phase they happened in and the script that
 * took longest. Local only: nothing is sent anywhere. Used by the diagnostics
 * overlay, QA capture and the performance harness to point at a stall's cause.
 */
export class LongFrameRecorder {
  private readonly frames: LongFrame[] = [];
  private observer: PerformanceObserver | null = null;
  private total = 0;
  private worst: LongFrame | null = null;

  constructor(private readonly context: () => { world: string; phase: string }) {}

  start(): boolean {
    if (this.observer || typeof PerformanceObserver === 'undefined') return Boolean(this.observer);
    const types = PerformanceObserver.supportedEntryTypes ?? [];
    const type = types.includes('long-animation-frame') ? 'long-animation-frame'
      : types.includes('longtask') ? 'longtask' : null;
    if (!type) return false;
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) this.record(entry as LongAnimationFrameTiming);
    });
    this.observer.observe({ type, buffered: false });
    return true;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Exposed for tests; the observer calls this for each reported frame. */
  record(entry: LongAnimationFrameTiming): void {
    const { world, phase } = this.context();
    const top = entry.scripts?.reduce<ScriptTiming | null>((best, script) => (!best || script.duration > best.duration ? script : best), null);
    const frame: LongFrame = {
      at: Math.round(entry.startTime),
      durationMs: Math.round(entry.duration),
      blockingMs: Math.round(entry.blockingDuration ?? 0),
      world,
      phase,
      script: top
        ? `${top.invoker ?? '?'} ${Math.round(top.duration)}ms ${top.sourceFunctionName ?? ''} ${(top.sourceURL ?? '').split('/').pop()?.split('?')[0] ?? ''}:${top.sourceCharPosition ?? ''}`.replace(/\s+/g, ' ').trim()
        : '',
    };
    this.total++;
    if (!this.worst || frame.durationMs > this.worst.durationMs) this.worst = frame;
    this.frames.push(frame);
    if (this.frames.length > CAPACITY) this.frames.shift();
  }

  get count(): number { return this.total; }
  get worstFrame(): LongFrame | null { return this.worst; }
  /** The most recent long frames, oldest first. */
  get recent(): readonly LongFrame[] { return this.frames; }

  summary(): string {
    if (!this.worst) return 'none';
    return `${this.total}, worst ${this.worst.durationMs} ms (${this.worst.world}/${this.worst.phase})`;
  }

  clear(): void {
    this.frames.length = 0;
    this.total = 0;
    this.worst = null;
  }
}

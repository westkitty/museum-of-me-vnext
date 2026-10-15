/**
 * A conservative, hysteresis-controlled resolution policy. It never touches
 * physics or quality-dependent content; sampling is driven by the existing loop.
 * GPU pressure must be confirmed separately before crediting a speedup.
 */
export class AdaptiveResolution {
  private readonly window = new Float32Array(90);
  private cursor = 0;
  private count = 0;
  private elapsed = 0;
  private scale = 1;

  constructor(private readonly targetMs = 1000 / 60) {}

  reset(): void {
    this.cursor = 0;
    this.count = 0;
    this.elapsed = 0;
    this.scale = 1;
  }

  get currentScale(): number { return this.scale; }

  /** Returns null unless a stable window warrants one small resolution change. */
  update(frameMs: number, cpuMs = 0): number | null {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return null;
    // CPU-dominated frames cannot be cured by lowering render resolution.
    // This is a conservative heuristic, not a substitute for GPU timer data.
    if (cpuMs > this.targetMs * 0.9) return null;
    this.window[this.cursor] = frameMs;
    this.cursor = (this.cursor + 1) % this.window.length;
    this.count = Math.min(this.window.length, this.count + 1);
    this.elapsed += frameMs;
    if (this.count < 45 || this.elapsed < 1300) return null;
    this.elapsed = 0;

    const sorted = Array.from(this.window.subarray(0, this.count)).sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    const old = this.scale;
    if (p95 > this.targetMs * 1.18) this.scale = Math.max(0.75, this.scale - 0.05);
    else if (p95 < this.targetMs * 0.78) this.scale = Math.min(1, this.scale + 0.025);
    return this.scale !== old ? this.scale : null;
  }
}

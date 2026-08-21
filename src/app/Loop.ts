/**
 * THE SINGLE FRAME LOOP.
 *
 * PRODUCT LAW 13 / plan §20: this file is the only owner of requestAnimationFrame
 * in the entire codebase. Enforced by ESLint (`no-restricted-globals`) and by
 * `npm run validate:frameloop`, which is part of `npm run gate`.
 *
 * Order per frame:
 *   fixed steps  → input, player + collision, active exhibit update
 *   variable     → audio, streaming, interaction focus, UI
 *   render       → interpolated camera, then draw
 */
export interface LoopCallbacks {
  /** Fixed-timestep simulation. Called 0..n times per frame with a constant dt. */
  fixedUpdate(dt: number): void;
  /** Once per frame, real elapsed time. Systems that must not be stepped twice. */
  variableUpdate(dt: number): void;
  /** Interpolation factor 0..1 between the last two fixed states, then draw. */
  render(alpha: number): void;
}

export const FIXED_STEP = 1 / 60;
/** Never simulate more than this much wall-clock in one frame (tab restore). */
const MAX_FRAME_DELTA = 0.1;
/** Bail out of the catch-up loop rather than spiral. */
const MAX_STEPS_PER_FRAME = 5;

export class Loop {
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  /** Optional render-rate cap in Hz. Simulation still uses the fixed step. */
  private frameCapHz = 0;
  private lastRenderTime = Number.NEGATIVE_INFINITY;

  private frameCount = 0;
  private fpsWindowStart = 0;
  private measuredFps = 0;

  constructor(private readonly cb: LoopCallbacks) {}

  setFrameCap(hz: number): void {
    this.frameCapHz = Number.isFinite(hz) && hz > 0 ? hz : 0;
  }

  get fps(): number {
    return this.measuredFps;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.fpsWindowStart = this.lastTime;
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    let delta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    if (delta > MAX_FRAME_DELTA) delta = MAX_FRAME_DELTA;

    this.accumulator += delta;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      this.cb.fixedUpdate(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.cb.variableUpdate(delta);
    if (this.frameCapHz > 0 && now - this.lastRenderTime < 1000 / this.frameCapHz) {
      return;
    }
    this.lastRenderTime = now;
    this.cb.render(this.accumulator / FIXED_STEP);

    this.frameCount++;
    if (now - this.fpsWindowStart >= 500) {
      this.measuredFps = (this.frameCount * 1000) / (now - this.fpsWindowStart);
      this.frameCount = 0;
      this.fpsWindowStart = now;
    }
  };
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Loop, FIXED_STEP } from '../src/app/Loop';

/** Drives requestAnimationFrame manually so loop behaviour is deterministic. */
function installRafHarness() {
  let now = 0;
  let queued: ((t: number) => void) | null = null;
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    queued = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => { queued = null; });
  return {
    advance(ms: number) {
      now += ms;
      const cb = queued;
      queued = null;
      cb?.(now);
    },
    get pending() { return queued !== null; },
  };
}

describe('Loop', () => {
  let harness: ReturnType<typeof installRafHarness>;

  beforeEach(() => { harness = installRafHarness(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('runs exactly one fixed step for one step of elapsed time', () => {
    const fixedUpdate = vi.fn();
    const loop = new Loop({ fixedUpdate, variableUpdate: vi.fn(), render: vi.fn() });
    loop.start();
    harness.advance(FIXED_STEP * 1000);
    expect(fixedUpdate).toHaveBeenCalledTimes(1);
    expect(fixedUpdate).toHaveBeenCalledWith(FIXED_STEP);
    loop.stop();
  });

  it('calls variableUpdate and render exactly once per frame', () => {
    const variableUpdate = vi.fn();
    const render = vi.fn();
    const loop = new Loop({ fixedUpdate: vi.fn(), variableUpdate, render });
    loop.start();
    harness.advance(50);
    harness.advance(50);
    expect(variableUpdate).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenCalledTimes(2);
    loop.stop();
  });

  it('clamps a huge delta so a restored tab cannot simulate minutes at once', () => {
    const fixedUpdate = vi.fn();
    const loop = new Loop({ fixedUpdate, variableUpdate: vi.fn(), render: vi.fn() });
    loop.start();
    harness.advance(60_000);
    // 0.1 s clamp / (1/60) = 6 steps, capped at MAX_STEPS_PER_FRAME = 5.
    expect(fixedUpdate.mock.calls.length).toBeLessThanOrEqual(5);
    loop.stop();
  });

  it('passes an interpolation alpha in [0,1)', () => {
    const render = vi.fn();
    const loop = new Loop({ fixedUpdate: vi.fn(), variableUpdate: vi.fn(), render });
    loop.start();
    harness.advance(25);
    const alpha = render.mock.calls[0][0] as number;
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
    loop.stop();
  });

  it('stops cleanly and does not reschedule', () => {
    const render = vi.fn();
    const loop = new Loop({ fixedUpdate: vi.fn(), variableUpdate: vi.fn(), render });
    loop.start();
    harness.advance(16);
    loop.stop();
    expect(loop.isRunning).toBe(false);
    const callsAfterStop = render.mock.calls.length;
    harness.advance(16);
    expect(render.mock.calls.length).toBe(callsAfterStop);
  });
});

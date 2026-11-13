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

  it('does not carry a stale frame count into a fresh FPS window after restart (regression)', () => {
    // frameCount only zeroes inside tick() once a 500ms window elapses, so
    // stopping mid-window used to leave it non-zero; a much shorter window
    // after restart then divided by that leftover count, briefly reporting
    // an inflated, bogus FPS.
    const loop = new Loop({ fixedUpdate: vi.fn(), variableUpdate: vi.fn(), render: vi.fn() });
    loop.start();
    for (let i = 0; i < 25; i++) harness.advance(4); // 100ms elapsed, well under the 500ms window
    loop.stop();
    loop.start();
    harness.advance(20); // a single short frame in the new window
    expect(loop.fps).toBe(0); // no window has closed yet -- not an inflated reading
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

  it('presents every frame under a 60 fps cap when the 60 Hz display delivers frames a little early', () => {
    const render = vi.fn();
    const loop = new Loop({ fixedUpdate: vi.fn(), variableUpdate: vi.fn(), render });
    loop.setFrameCap(60);
    loop.start();
    // A real display jitters around 16.67 ms; 16.6 ms used to be skipped and
    // shown 33 ms late.
    for (let i = 0; i < 120; i++) harness.advance(i % 2 ? 16.6 : 16.74);
    expect(render).toHaveBeenCalledTimes(120);
    loop.stop();
  });

  it('keeps a 30 fps cap at every other frame of a slightly fast 60 Hz display', () => {
    const render = vi.fn();
    const loop = new Loop({ fixedUpdate: vi.fn(), variableUpdate: vi.fn(), render });
    loop.setFrameCap(30);
    loop.start();
    for (let i = 0; i < 240; i++) harness.advance(16.6);
    expect(render.mock.calls.length).toBeGreaterThanOrEqual(119);
    expect(render.mock.calls.length).toBeLessThanOrEqual(121);
    loop.stop();
  });
});

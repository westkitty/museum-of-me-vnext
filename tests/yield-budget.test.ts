import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventLoopYieldBudget, SustainedFrameWait } from '../src/util/yieldToEventLoop';

describe('EventLoopYieldBudget', () => {
  afterEach(() => vi.restoreAllMocks());

  function clock() {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    return { advance: (ms: number) => { now += ms; } };
  }

  it('keeps the minimum slice when frames are fast', async () => {
    const time = clock();
    const budget = new EventLoopYieldBudget(8, 250, async () => time.advance(4));
    for (let i = 0; i < 20; i++) {
      time.advance(3);
      await budget.checkpoint();
    }
    expect(budget.currentSliceMs).toBe(8);
  });

  it('grows the slice with slow frames, so a slow device still finishes the build', async () => {
    const time = clock();
    const budget = new EventLoopYieldBudget(8, 250, async () => time.advance(1000));
    for (let i = 0; i < 3; i++) {
      time.advance(10);
      await budget.checkpoint();
    }
    expect(budget.currentSliceMs).toBe(250);
    // Work under the grown slice does not yield.
    time.advance(200);
    const yielded = vi.fn(async () => time.advance(1000));
    (budget as unknown as { yieldOnce: () => Promise<void> }).yieldOnce = yielded;
    await budget.checkpoint();
    expect(yielded).not.toHaveBeenCalled();
  });

  it('returns to the minimum slice once frames are fast again', async () => {
    const time = clock();
    let frame = 1000;
    const budget = new EventLoopYieldBudget(8, 250, async () => time.advance(frame));
    for (let i = 0; i < 3; i++) {
      time.advance(10);
      await budget.checkpoint();
    }
    expect(budget.currentSliceMs).toBe(250);
    frame = 16;
    time.advance(300);
    await budget.checkpoint();
    expect(budget.currentSliceMs).toBe(8);
  });

  it('does not inflate the slice on 60 Hz or 30 Hz frame waits (<= 40 ms)', async () => {
    const time = clock();
    let frame = 17;
    const budget = new EventLoopYieldBudget(6, 250, async () => time.advance(frame));
    time.advance(7);
    await budget.checkpoint();
    expect(budget.currentSliceMs).toBe(6);
    frame = 34;
    time.advance(10);
    await budget.checkpoint();
    expect(budget.currentSliceMs).toBe(6);
    frame = 100;
    for (let i = 0; i < 3; i++) {
      time.advance(10);
      await budget.checkpoint();
    }
    expect(budget.currentSliceMs).toBe(50);
  });

  it('keeps the minimum slice after an isolated hitch on 60 Hz hardware', async () => {
    const time = clock();
    const waits = [17, 102, 17, 17, 60, 17, 45, 17];
    let k = 0;
    const budget = new EventLoopYieldBudget(3, 250, async () => time.advance(waits[k++]));
    for (let i = 0; i < waits.length; i++) {
      time.advance(4);
      await budget.checkpoint();
      expect(budget.currentSliceMs).toBe(3);
    }
  });
});

describe('SustainedFrameWait', () => {
  it('grows from the fastest of three consecutive slow waits', () => {
    const waits = new SustainedFrameWait(5, 250);
    expect(waits.observe(400)).toBe(5);
    expect(waits.observe(120)).toBe(5);
    expect(waits.observe(300)).toBe(60);
    expect(waits.observe(16)).toBe(5);
  });
});

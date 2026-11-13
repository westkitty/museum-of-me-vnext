import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventLoopYieldBudget } from '../src/util/yieldToEventLoop';

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
    time.advance(10);
    await budget.checkpoint();
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
    time.advance(10);
    await budget.checkpoint();
    expect(budget.currentSliceMs).toBe(250);
    frame = 16;
    time.advance(300);
    await budget.checkpoint();
    expect(budget.currentSliceMs).toBe(8);
  });
});

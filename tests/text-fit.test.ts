import { describe, expect, it } from 'vitest';
import { largestFittingTitleSize } from '../src/assets/TextTexture';

/** The original linear step-down the binary search replaces. */
function stepDown(start: number, fitsAt: (size: number) => boolean): number {
  let size = start;
  while (size > 22 && !fitsAt(size)) size -= 2;
  return size;
}

describe('label title fitting', () => {
  it('chooses exactly the size the old 2 px step-down chose, in far fewer measurements', () => {
    for (const start of [22, 23, 24, 46, 54, 108, 216, 217]) {
      for (let limit = 0; limit <= 240; limit += 1) {
        let calls = 0;
        const fits = (size: number) => { calls++; return size <= limit; };
        expect(largestFittingTitleSize(start, fits), `start ${start}, fits up to ${limit}`).toBe(stepDown(start, (s) => s <= limit));
        expect(calls).toBeLessThanOrEqual(8);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { CenterTapTracker } from '../src/app/CenterTapTracker';
const finger = (identifier: number, clientX: number, clientY: number) => ({ identifier, clientX, clientY });
describe('center touch interaction', () => {
  it('accepts a stationary single-finger center tap', () => {
    const t = new CenterTapTracker();
    t.start([finger(1, 500, 400)], 1, 1000, 800);
    expect(t.end([finger(1, 507, 405)])).toBe(true);
    expect(t.end([finger(1, 507, 405)])).toBe(false);
  });
  it('rejects look swipes that end over the reticle', () => {
    const t = new CenterTapTracker();
    t.start([finger(1, 500, 400)], 1, 1000, 800);
    t.move([finger(1, 530, 400)], 1);
    expect(t.end([finger(1, 500, 400)])).toBe(false);
  });
  it('rejects touches that start outside the center', () => {
    const t = new CenterTapTracker();
    t.start([finger(1, 200, 400)], 1, 1000, 800);
    expect(t.end([finger(1, 500, 400)])).toBe(false);
  });
  it('rejects multi-touch and cancelled gestures', () => {
    const t = new CenterTapTracker();
    t.start([finger(1, 500, 400)], 1, 1000, 800);
    t.start([finger(2, 510, 400)], 2, 1000, 800);
    expect(t.end([finger(1, 500, 400)])).toBe(false);
    t.start([finger(3, 500, 400)], 1, 1000, 800);
    t.cancel();
    expect(t.end([finger(3, 500, 400)])).toBe(false);
  });
});

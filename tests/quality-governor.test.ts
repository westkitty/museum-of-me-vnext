import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, QualityGovernor } from '../src/render/QualityGovernor';
import { QUALITY } from '../src/render/QualityTiers';

/**
 * Drives the governor with a synthetic frame trace.
 *
 * `frameMs` is what every observed frame lasted; `seconds` is how much
 * wall-clock time it represents, advanced in 1/60 s steps the way the real
 * loop feeds it. Returns every change the governor asked for, in order.
 */
function feed(governor: QualityGovernor, frameMs: number, seconds: number): string[] {
  const changes: string[] = [];
  const stepSeconds = 1 / 60;
  const steps = Math.round(seconds / stepSeconds);
  for (let i = 0; i < steps; i++) {
    const decision = governor.observe(frameMs, stepSeconds);
    if (decision !== 'none') changes.push(`${decision}:${governor.tier}`);
  }
  return changes;
}

describe('adaptive quality governor', () => {
  it('does nothing at all when the visitor pinned a tier', () => {
    const governor = new QualityGovernor('high', false);
    expect(feed(governor, 48, 120)).toEqual([]);
    expect(governor.tier).toBe('high');
    expect(governor.snapshot.enabled).toBe(false);
  });

  it('never changes tier because of a single bad frame', () => {
    const governor = new QualityGovernor('high');
    // A third of a second of stutter — fewer frames than one evaluation window
    // contains — then two minutes of steady 8 ms frames.
    for (let i = 0; i < 20; i++) governor.observe(140, 1 / 60);
    expect(feed(governor, 8, 120)).toEqual([]);
    expect(governor.tier).toBe('high');
  });

  it('steps down when the museum is demonstrably missing frames', () => {
    const governor = new QualityGovernor('high');
    const changes = feed(governor, 34, 8);
    expect(changes).toEqual(['degrade:medium']);
    expect(governor.snapshot.changes).toBe(1);
  });

  it('keeps stepping down while the frames stay over budget, and stops at low', () => {
    const governor = new QualityGovernor('high');
    // Two downgrades are separated by the cooldown, so this needs long enough
    // to cover both windows and both cooldowns.
    const changes = feed(governor, 34, 90);
    expect(changes).toEqual(['degrade:medium', 'degrade:low']);
    expect(governor.tier).toBe('low');
  });

  it('does not climb above the tier the boot detection allowed', () => {
    const governor = new QualityGovernor('medium');
    governor.forceTier('low');
    const changes = feed(governor, 6, 120);
    expect(changes).toEqual(['restore:medium']);
    expect(governor.tier).toBe('medium');
    expect(governor.snapshot.ceiling).toBe('medium');
  });

  it('recovers more slowly than it degrades', () => {
    const governor = new QualityGovernor('high');
    feed(governor, 34, 8);
    expect(governor.tier).toBe('medium');

    // A single three-second window of headroom is not enough to come back.
    expect(feed(governor, 8, 3)).toEqual([]);
    expect(governor.tier).toBe('medium');

    // Four consecutive windows are.
    expect(feed(governor, 8, 20)).toEqual(['restore:high']);
    expect(governor.tier).toBe('high');
  });

  it('settles instead of oscillating on a machine hovering at the boundary', () => {
    const governor = new QualityGovernor('high');
    // 17.5 ms sits between the under-budget and over-budget thresholds: neither
    // headroom nor failure. The museum must stay where it is indefinitely.
    expect(feed(governor, 17.5, 180)).toEqual([]);
    expect(governor.tier).toBe('high');
    expect(governor.snapshot.changes).toBe(0);
  });

  it('waits out its cooldown before acting again', () => {
    const governor = new QualityGovernor('high');
    feed(governor, 34, 8);
    expect(governor.tier).toBe('medium');
    // Two more windows of failure inside the cooldown window change nothing.
    const duringCooldown = feed(governor, 34, DEFAULT_THRESHOLDS.cooldownSeconds - 1);
    expect(duringCooldown).toEqual([]);
    expect(governor.tier).toBe('medium');
  });

  it('ignores non-finite and zero frame durations', () => {
    const governor = new QualityGovernor('high');
    for (let i = 0; i < 600; i++) {
      expect(governor.observe(Number.NaN, 1 / 60)).toBe('none');
      expect(governor.observe(0, 1 / 60)).toBe('none');
      expect(governor.observe(-5, 1 / 60)).toBe('none');
    }
    expect(governor.tier).toBe('high');
    expect(governor.snapshot.changes).toBe(0);
  });

  it('re-pointing at a new ceiling resets its history', () => {
    const governor = new QualityGovernor('high');
    feed(governor, 34, 8);
    expect(governor.tier).toBe('medium');
    governor.configure('low', true);
    expect(governor.tier).toBe('low');
    expect(governor.snapshot.changes).toBe(0);
  });

  it('describes itself for the settings panel', () => {
    const governor = new QualityGovernor('high');
    feed(governor, 34, 8);
    const snapshot = governor.snapshot;
    expect(snapshot.tier).toBe('medium');
    expect(snapshot.ceiling).toBe('high');
    expect(snapshot.changes).toBe(1);
    expect(snapshot.lastReason).toContain('ms frames');
    expect(snapshot.recentP95Ms).toBeGreaterThan(30);
  });
});

describe('quality tiers the governor can reach', () => {
  it('every ladder tier has a real settings record', () => {
    for (const tier of ['low', 'medium', 'high'] as const) {
      expect(QUALITY[tier].tier).toBe(tier);
    }
  });

  it('downgrading reduces measured cost, not just the label', () => {
    // If a downgrade did not actually buy anything, adapting would be theatre.
    expect(QUALITY.low.shadows).toBe(false);
    expect(QUALITY.medium.shadows).toBe(true);
    expect(QUALITY.low.maxPixelRatio).toBeLessThan(QUALITY.medium.maxPixelRatio);
    expect(QUALITY.medium.maxPixelRatio).toBeLessThan(QUALITY.high.maxPixelRatio);
    expect(QUALITY.medium.shadowMapSize).toBeLessThan(QUALITY.high.shadowMapSize);
    expect(QUALITY.low.detailScale).toBeLessThan(QUALITY.medium.detailScale);
    expect(QUALITY.medium.exhibitStreamRadius).toBeLessThan(QUALITY.high.exhibitStreamRadius);
  });
});

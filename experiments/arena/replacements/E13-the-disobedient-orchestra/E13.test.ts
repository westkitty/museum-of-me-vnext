import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCandidateContract, createCandidateHarness } from '../_shared/candidateChecks';
import { createCandidate } from './index';
import {
  createInitialOrchestraState,
  cycleDirective,
  generateNextTake,
  toggleSteeringMode,
} from './model';

const CANDIDATE_DIR = dirname(fileURLToPath(import.meta.url));

describe('E13 candidate — The Disobedient Orchestra', () => {
  it('passes frozen contract, 0-leak remount, plinth exclusion, and low-detail checks', async () => {
    const metrics = await assertCandidateContract(createCandidate, 'E13', CANDIDATE_DIR);
    expect(metrics.plinthIntersections).toBe(0);
    expect(metrics.controls).toBe(5);
  });

  it('reduces observed-vs-intended drift sharply when switching from raw prompt to strict meta-tag cues', () => {
    let s = createInitialOrchestraState();
    expect(s.audioEnabled).toBe(false);
    expect(s.steering).toBe('loose');
    const rawDrift = s.totalDrift;
    expect(rawDrift).toBeGreaterThanOrEqual(4);

    s = toggleSteeringMode(s);
    expect(s.steering).toBe('strict_cues');
    expect(s.totalDrift).toBeLessThan(rawDrift);
    expect(s.totalDrift).toBeLessThanOrEqual(1);

    s = cycleDirective(s);
    expect(s.directive).toBe('chorus');
    s = generateNextTake(s);
    expect(s.takeNumber).toBe(2);
  });

  it('handles audio toggle gracefully without AudioContext, supports full reset, and leaks 0 resources', async () => {
    const { host, controls } = createCandidateHarness(createCandidate, 'E13');
    await host.preload();
    host.mount();
    host.activate(0);

    expect(host.module.getAccessibleContent().state).toContain('Audio=MUTED');
    controls[1].activate(); // strict_cues
    controls[2].activate(); // Take #2
    controls[3].activate(); // unmute probe (no throw in Node!)
    for (let i = 0; i < 12; i++) host.update(0.05, [0, 1.7, 3], i * 0.05);

    const active = host.module.getAccessibleContent().state;
    expect(active).toContain('Steering=strict_cues');
    expect(active).toContain('Take=#2');
    expect(active).toContain('Audio=UNMUTED_SYNTH');

    host.reset();
    expect(host.module.getAccessibleContent().state).toContain('Audio=MUTED');
    expect(host.module.getAccessibleContent().state).toContain('Take=#1');

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

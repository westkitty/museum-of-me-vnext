import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCandidateContract, createCandidateHarness } from '../_shared/candidateChecks';
import { createCandidate } from './index';
import { advanceCrisisPhase, createInitialCrisisState, type StationCrisisState } from './model';

const CANDIDATE_DIR = dirname(fileURLToPath(import.meta.url));

describe('E28 candidate — Ninety Seconds to Vacuum', () => {
  it('passes frozen contract, 0-leak remount, plinth exclusion, and low-detail budget checks', async () => {
    const metrics = await assertCandidateContract(createCandidate, 'E28', CANDIDATE_DIR);
    expect(metrics.plinthIntersections).toBe(0);
    expect(metrics.controls).toBe(5);
  });

  it('produces three distinct deterministic crisis endings and identical timed vs untimed results', () => {
    const runThreePhases = (preset: 'balanced' | 'defense' | 'evac', sealed: boolean) => {
      let s: StationCrisisState = { ...createInitialCrisisState(), preset, outerBulkheadSealed: sealed };
      s = advanceCrisisPhase(s);
      s = advanceCrisisPhase(s);
      s = advanceCrisisPhase(s);
      return s;
    };

    const fail = runThreePhases('balanced', false);
    const evac = runThreePhases('evac', false);
    const hold = runThreePhases('defense', true);

    expect(fail.ending).toBe('CONTAINMENT_FAILURE');
    expect(evac.ending).toBe('CREW_EVACUATED_CORE_LOST');
    expect(hold.ending).toBe('STATION_HELD_OUTER_VENTED');
    expect(evac.survivors).toBe(12);

    // Timed mode and untimed step mode must resolve identically
    const untimed = runThreePhases('defense', true);
    let timed: StationCrisisState = { ...createInitialCrisisState(), timingMode: 'timed', preset: 'defense', outerBulkheadSealed: true };
    timed = advanceCrisisPhase(timed);
    timed = advanceCrisisPhase(timed);
    timed = advanceCrisisPhase(timed);
    expect(timed.ending).toBe(untimed.ending);
    expect(timed.hullIntegrity).toBe(untimed.hullIntegrity);
    expect(timed.survivors).toBe(untimed.survivors);
  });

  it('supports live timed progression, untimed parity, and clean reset in mounted host', async () => {
    const { host, controls } = createCandidateHarness(createCandidate, 'E28');
    await host.preload();
    host.mount();
    host.activate(0);

    // Select Shield & Core [2/2/0/0], seal bulkhead, toggle timed mode, and let 3 timed windows elapse
    controls[0].activate();
    controls[1].activate();
    controls[2].activate();

    let now = 0;
    for (let i = 0; i < 80; i++) {
      now += 0.1;
      host.update(0.1, [0, 1.7, 3], now);
    }
    expect(host.module.getAccessibleContent().state).toContain('Ending=STATION_HELD_OUTER_VENTED');

    host.reset();
    expect(host.module.getAccessibleContent().state).toContain('T-90s (step)');
    expect(host.module.getAccessibleContent().state).toContain('Ending=NONE');

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

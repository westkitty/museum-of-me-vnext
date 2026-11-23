import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCandidateContract, createCandidateHarness } from '../_shared/candidateChecks';
import { createCandidate } from './index';
import {
  createInitialFramingState,
  cycleEmphasis,
  cyclePinnedObservation,
  SHARED_OBSERVATIONS,
  toggleDissolveToSource,
  toggleStripInferences,
} from './model';

const CANDIDATE_DIR = dirname(fileURLToPath(import.meta.url));

describe('E12 candidate — The Headline That Built Two Cities', () => {
  it('passes frozen contract, 0-leak remount, plinth exclusion, and low-detail checks', async () => {
    const metrics = await assertCandidateContract(createCandidate, 'E12', CANDIDATE_DIR);
    expect(metrics.plinthIntersections).toBe(0);
    expect(metrics.controls).toBe(5);
  });

  it('keeps shared observations immutable while contrasting rhetorical moves per pinned timestamp', () => {
    let s = createInitialFramingState();
    const snapshotLogs = JSON.stringify(s.observations);

    s = cycleEmphasis(s);
    expect(s.emphasis).toBe('frameA');
    expect(JSON.stringify(s.observations)).toBe(snapshotLogs);

    // Sweeping optical InDEX lens across 08:00 reveals different framing/move assignments on identical datum
    s = cyclePinnedObservation(s);
    expect(s.pinned).toBe('obs_flow');
    expect(s.lastAction).toContain('08:00 Valve Flow 420 L/s');
    expect(s.lastAction).toContain('evidence');
    expect(s.lastAction).toContain('interpretation');

    s = toggleStripInferences(s);
    expect(s.inferencesStripped).toBe(true);
    expect(JSON.stringify(s.observations)).toBe(snapshotLogs);

    s = toggleDissolveToSource(s);
    expect(s.dissolvedToSource).toBe(true);
    expect(s.observations).toEqual(SHARED_OBSERVATIONS);
  });

  it('operates all framing controls through mounted host with clean reset and 0 leaks', async () => {
    const { host, controls } = createCandidateHarness(createCandidate, 'E12');
    await host.preload();
    host.mount();
    host.activate(0);

    controls[0].activate(); // frameA emphasis
    controls[1].activate(); // pin obs_flow
    controls[2].activate(); // strip inferences
    controls[3].activate(); // dissolve to shared source
    for (let i = 0; i < 12; i++) host.update(0.05, [0, 1.7, 3], i * 0.05);

    const state = host.module.getAccessibleContent().state;
    expect(state).toContain('Pinned=obs_flow');
    expect(state).toContain('InferencesStripped=true');
    expect(state).toContain('Dissolved=true');
    expect(state).toContain('SourceLogs=3 (immutable)');

    host.reset();
    const resetState = host.module.getAccessibleContent().state;
    expect(resetState).toContain('Emphasis=balanced');
    expect(resetState).toContain('Pinned=all');
    expect(resetState).toContain('Dissolved=false');

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

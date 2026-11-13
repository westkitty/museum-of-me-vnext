import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCandidateContract, createCandidateHarness } from '../_shared/candidateChecks';
import { createCandidate } from './index';
import {
  createInitialCartridgeState,
  cycleOverlayMode,
  moveRunnerStep,
  toggleCartridgeMode,
} from './model';

const CANDIDATE_DIR = dirname(fileURLToPath(import.meta.url));

describe('E26 candidate — Reality Becomes a Cartridge', () => {
  it('passes frozen contract, 0-leak remount, plinth exclusion, and Tier-C low-detail checks', async () => {
    const metrics = await assertCandidateContract(createCandidate, 'E26', CANDIDATE_DIR);
    expect(metrics.plinthIntersections).toBe(0);
    expect(metrics.controls).toBe(5);
  });

  it('folds between diorama and playable 5-stage platformer cartridge with independent click-through overlay', () => {
    let s = createInitialCartridgeState();
    expect(s.mode).toBe('diorama');
    expect(s.overlay).toBe('off');

    s = cycleOverlayMode(s);
    expect(s.overlay).toBe('telemetry');

    s = toggleCartridgeMode(s);
    expect(s.mode).toBe('cartridge');
    expect(s.overlay).toBe('telemetry');

    // Step across 0 -> 1 cleanly, then fail gap without jump -> slip respawn to 0
    s = moveRunnerStep(s, false);
    expect(s.runnerIndex).toBe(1);
    s = moveRunnerStep(s, false);
    expect(s.runnerIndex).toBe(0);
    expect(s.slips).toBe(1);

    // Clear full 5-stage course using leap over gap stages
    s = moveRunnerStep(s, false); // 0 -> 1
    s = moveRunnerStep(s, true);  // 1 -> 2
    s = moveRunnerStep(s, false); // 2 -> 3
    s = moveRunnerStep(s, true);  // 3 -> 4 (goal!)
    expect(s.goalReached).toBe(true);
    expect(s.clears).toBe(1);

    // Reverse cleanly back to diorama while keeping overlay intact
    s = toggleCartridgeMode(s);
    expect(s.mode).toBe('diorama');
    expect(s.overlay).toBe('telemetry');
  });

  it('plays through mounted controls, respects reset, and leaves 0 leaked resources', async () => {
    const { host, controls } = createCandidateHarness(createCandidate, 'E26');
    await host.preload();
    host.mount();
    host.activate(0);

    controls[0].activate(); // unfold cartridge
    controls[1].activate(); // enable overlay
    controls[2].activate(); // 0 -> 1
    controls[3].activate(); // 1 -> 2
    controls[2].activate(); // 2 -> 3
    controls[3].activate(); // 3 -> 4 goal

    for (let i = 0; i < 20; i++) host.update(0.05, [0, 1.7, 3], i * 0.05);
    const state = host.module.getAccessibleContent().state;
    expect(state).toContain('Mode=cartridge');
    expect(state).toContain('Overlay=telemetry (click-through)');
    expect(state).toContain('Goal=true');

    host.reset();
    expect(host.module.getAccessibleContent().state).toContain('Mode=diorama');
    expect(host.module.getAccessibleContent().state).toContain('Overlay=off');

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

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

  it('proves P037 causal rule: opaque overlay intercepts inputs until click-through is enabled', () => {
    let s = createInitialCartridgeState();
    expect(s.mode).toBe('diorama');
    expect(s.overlay).toBe('off');

    // First toggle -> OPAQUE (blocking obstacle)
    s = cycleOverlayMode(s);
    expect(s.overlay).toBe('blocking');

    // Folding to cartridge still exposes the opaque broadcast obstacle
    s = toggleCartridgeMode(s);
    expect(s.mode).toBe('cartridge');

    // Falsifier: attempting Step while overlay is opaque must be intercepted onto live poll
    s = moveRunnerStep(s, false);
    expect(s.runnerIndex).toBe(0);
    expect(s.misclicksBlocked).toBe(1);
    expect(s.pollClicks).toBe(1);
    expect(s.lastInputBlocked).toBe(true);

    // Second toggle -> CLICK-THROUGH (passes inputs cleanly while remaining on top)
    s = cycleOverlayMode(s);
    expect(s.overlay).toBe('click_through');

    // Step 0 -> 1 cleanly, then fail tidal gap without Leap -> slip respawn to 0
    s = moveRunnerStep(s, false);
    expect(s.runnerIndex).toBe(1);
    expect(s.lastInputBlocked).toBe(false);
    s = moveRunnerStep(s, false);
    expect(s.runnerIndex).toBe(0);
    expect(s.slips).toBe(1);

    // Clear full 5-stage Vancouver Island coastal course using Leap over tidal cuts
    s = moveRunnerStep(s, false); // 0 -> 1 (Harbour Rail Spur)
    s = moveRunnerStep(s, true);  // 1 -> 2 (Tidal Narrows Stack)
    s = moveRunnerStep(s, false); // 2 -> 3 (Cedar Ridge Bluff)
    s = moveRunnerStep(s, true);  // 3 -> 4 (Point Beacon)
    expect(s.goalReached).toBe(true);
    expect(s.clears).toBe(1);

    // Reverse cleanly back to diorama while keeping click-through overlay intact
    s = toggleCartridgeMode(s);
    expect(s.mode).toBe('diorama');
    expect(s.overlay).toBe('click_through');
  });

  it('plays through mounted controls, respects reset, and leaves 0 leaked resources', async () => {
    const { host, controls } = createCandidateHarness(createCandidate, 'E26');
    await host.preload();
    host.mount();
    host.activate(0);

    controls[0].activate(); // unfold cartridge
    controls[1].activate(); // overlay -> blocking
    controls[2].activate(); // intercepted misclick!
    expect(host.module.getAccessibleContent().state).toContain('MisclicksBlocked=1');

    controls[1].activate(); // overlay -> click_through
    controls[2].activate(); // 0 -> 1
    controls[3].activate(); // 1 -> 2
    controls[2].activate(); // 2 -> 3
    controls[3].activate(); // 3 -> 4 goal

    for (let i = 0; i < 20; i++) host.update(0.05, [0, 1.7, 3], i * 0.05);
    const state = host.module.getAccessibleContent().state;
    expect(state).toContain('Mode=cartridge');
    expect(state).toContain('Overlay=click_through');
    expect(state).toContain('MisclicksBlocked=1');
    expect(state).toContain('Goal=true');

    host.reset();
    const resetState = host.module.getAccessibleContent().state;
    expect(resetState).toContain('Mode=diorama');
    expect(resetState).toContain('Overlay=off');
    expect(resetState).toContain('MisclicksBlocked=0');

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

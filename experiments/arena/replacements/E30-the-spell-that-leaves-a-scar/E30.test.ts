import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCandidateContract, createCandidateHarness } from '../_shared/candidateChecks';
import { createCandidate } from './index';
import {
  applyCast,
  countActiveScars,
  createInitialArenaState,
  previewCastOutcome,
  undoLastCast,
} from './model';

const CANDIDATE_DIR = dirname(fileURLToPath(import.meta.url));

describe('E30 candidate — The Spell That Leaves a Scar', () => {
  it('passes frozen contract, 0-leak remount, plinth exclusion, and low-detail budget checks', async () => {
    const metrics = await assertCandidateContract(createCandidate, 'E30', CANDIDATE_DIR);
    expect(metrics.plinthIntersections).toBe(0);
    expect(metrics.controls).toBe(5);
    expect(metrics.meshes).toBeGreaterThanOrEqual(20);
  });

  it('produces persistent scars that causally transform subsequent spells', () => {
    let state = createInitialArenaState();
    expect(countActiveScars(state)).toBe(0);

    // Bare cinder leaves a glassified crater
    state = applyCast(state);
    expect(state.zones.conduit.scar).toBe('crater');
    expect(state.reactionCount).toBe(0);

    // Rime onto crater triggers thermal quench fissure
    state = { ...state, selectedSpell: 'rime' };
    expect(previewCastOutcome(state).reaction).toBe('quench');
    state = applyCast(state);
    expect(state.zones.conduit.scar).toBe('quench');
    expect(state.reactionCount).toBe(1);

    // Prism on bare rim leaves a resonant crystal spire, then Cinder refracts onto conduit!
    state = { ...state, selectedZone: 'rim', selectedSpell: 'prism' };
    state = applyCast(state);
    expect(state.zones.rim.scar).toBe('spire');

    state = { ...state, selectedSpell: 'cinder' };
    const beforeNeighbors = state.zones.conduit.intensity;
    state = applyCast(state);
    expect(state.refractionCount).toBe(1);
    expect(state.lastOutcome?.refractedTargets).toEqual(['conduit']);
    expect(state.zones.conduit.intensity).toBeGreaterThan(beforeNeighbors);
  });

  it('supports atomic undo and deterministic reset across the mounted exhibit', async () => {
    const { host, controls, announcements } = createCandidateHarness(createCandidate, 'E30');
    await host.preload();
    host.mount();
    host.activate(0);

    let now = 0;
    const step = (frames = 15) => {
      for (let i = 0; i < frames; i++) {
        now += 0.06;
        host.update(0.06, [0, 1.7, 3], now);
      }
    };

    const baselineState = host.module.getAccessibleContent().state;
    // Cast cinder on central conduit (ctrl 2)
    controls[2].activate();
    step();
    const afterFirstCast = host.module.getAccessibleContent().state;
    expect(afterFirstCast).toContain('Casts=1');
    expect(afterFirstCast).toContain('ActiveScars=1/3');

    // Switch to Rime (ctrl 0) and cast again on same crater -> causal quench
    controls[0].activate();
    controls[2].activate();
    step();
    expect(host.module.getAccessibleContent().state).toContain('Reactions=1');

    // Undo restores exact prior state
    controls[3].activate();
    expect(host.module.getAccessibleContent().state).toContain('Casts=1');
    expect(host.module.getAccessibleContent().state).toContain('Reactions=0');

    // Undo again returns to 0 scars
    controls[3].activate();
    expect(host.module.getAccessibleContent().state).toContain('Casts=0');
    expect(host.module.getAccessibleContent().state).toContain('ActiveScars=0/3');

    // Cast then reset deterministically
    controls[2].activate();
    step();
    host.reset();
    expect(host.module.getAccessibleContent().state).toBe(baselineState);
    expect(announcements.length).toBeGreaterThanOrEqual(4);

    // Model undo matches idempotent boundary when empty
    expect(undoLastCast(createInitialArenaState()).castCount).toBe(0);

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

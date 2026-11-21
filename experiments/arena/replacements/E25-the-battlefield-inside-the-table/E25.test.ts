import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCandidateContract, createCandidateHarness } from '../_shared/candidateChecks';
import { createCandidate } from './index';
import { simulateFullEncounter } from './model';

const CANDIDATE_DIR = dirname(fileURLToPath(import.meta.url));

describe('E25 candidate — The Battlefield Inside the Table', () => {
  it('passes frozen contract, 0-leak remount, plinth exclusion, and low-detail checks', async () => {
    const metrics = await assertCandidateContract(createCandidate, 'E25', CANDIDATE_DIR);
    expect(metrics.plinthIntersections).toBe(0);
    expect(metrics.controls).toBe(5);
  });

  it('proves a 1-square position change flips encounter outcome from DEFEAT to VICTORY', () => {
    const exposed = simulateFullEncounter('center_exposed', 'strike');
    const covered = simulateFullEncounter('west_cover', 'strike');
    const ridge = simulateFullEncounter('east_ridge', 'strike');

    expect(exposed.outcome).toBe('DEFEAT');
    expect(exposed.playerHp).toBe(0);

    expect(covered.outcome).toBe('VICTORY');
    expect(covered.playerHp).toBeGreaterThan(10);
    expect(covered.enemyHp).toBe(0);

    expect(ridge.outcome).toBe('VICTORY');
  });

  it('plays deterministic rounds through mounted host and resets cleanly with 0 leaks', async () => {
    const { host, controls } = createCandidateHarness(createCandidate, 'E25');
    await host.preload();
    host.mount();
    host.activate(0);

    // Move 1 square left to West Cover Pillar and resolve 3 turns
    controls[0].activate();
    controls[2].activate();
    controls[2].activate();
    controls[2].activate();
    for (let i = 0; i < 12; i++) host.update(0.05, [0, 1.7, 3], i * 0.05);

    expect(host.module.getAccessibleContent().state).toContain('Sightline=blocked');
    expect(host.module.getAccessibleContent().state).toContain('Outcome=VICTORY');

    host.reset();
    expect(host.module.getAccessibleContent().state).toContain('Turn=0/3');
    expect(host.module.getAccessibleContent().state).toContain('Outcome=IN_PROGRESS');

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

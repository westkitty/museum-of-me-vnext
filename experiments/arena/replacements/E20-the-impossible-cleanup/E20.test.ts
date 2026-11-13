import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCandidateContract, createCandidateHarness } from '../_shared/candidateChecks';
import { createCandidate } from './index';
import {
  assembleSafePlan,
  createInitialCleanupState,
  toggleAuditGate,
  TOTAL_SYNTHETIC_CLAIMED_MB,
} from './model';

const CANDIDATE_DIR = dirname(fileURLToPath(import.meta.url));

describe('E20 candidate — The Impossible Cleanup', () => {
  it('passes frozen contract, 0-leak remount, plinth exclusion, and Tier-C low-detail checks', async () => {
    const metrics = await assertCandidateContract(createCandidate, 'E20', CANDIDATE_DIR);
    expect(metrics.plinthIntersections).toBe(0);
    expect(metrics.controls).toBe(6);
  });

  it('conserves exact byte arithmetic as headline savings shrink under safety inspections', () => {
    let s = createInitialCleanupState();
    expect(s.netReclaimableMB).toBe(64_000);
    expect(s.protectedMB).toBe(0);

    s = toggleAuditGate(s, 'backup');
    expect(s.netReclaimableMB).toBe(42_500);
    expect(s.protectedMB).toBe(21_500);
    expect(s.netReclaimableMB + s.protectedMB).toBe(TOTAL_SYNTHETIC_CLAIMED_MB);

    s = toggleAuditGate(s, 'hardlinks');
    expect(s.netReclaimableMB).toBe(30_500);

    s = assembleSafePlan(s);
    expect(s.safePlanAssembled).toBe(true);
    expect(s.netReclaimableMB).toBe(14_500);
    expect(s.protectedMB).toBe(49_500);
    expect(s.netReclaimableMB + s.protectedMB).toBe(TOTAL_SYNTHETIC_CLAIMED_MB);
  });

  it('operates audit levers and safe-plan staging through mounted host with reset and 0 leaks', async () => {
    const { host, controls } = createCandidateHarness(createCandidate, 'E20');
    await host.preload();
    host.mount();
    host.activate(0);

    controls[0].activate(); // backup
    controls[1].activate(); // hardlinks
    controls[4].activate(); // assemble safe plan
    for (let i = 0; i < 12; i++) host.update(0.05, [0, 1.7, 3], i * 0.05);

    const state = host.module.getAccessibleContent().state;
    expect(state).toContain('NetReclaimable=14500MB');
    expect(state).toContain('Protected=49500MB');
    expect(state).toContain('SafePlan=true');

    host.reset();
    expect(host.module.getAccessibleContent().state).toContain('NetReclaimable=64000MB');
    expect(host.module.getAccessibleContent().state).toContain('SafePlan=false');

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

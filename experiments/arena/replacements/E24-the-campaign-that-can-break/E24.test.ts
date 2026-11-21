import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCandidateContract, createCandidateHarness } from '../_shared/candidateChecks';
import { createCandidate } from './index';
import {
  createInitialCampaignState,
  fortifyCurrentRegion,
  injectBrokenReferenceId,
  marchUnitNext,
  repairBrokenReferenceId,
} from './model';

const CANDIDATE_DIR = dirname(fileURLToPath(import.meta.url));

describe('E24 candidate — The Campaign That Can Break', () => {
  it('passes frozen contract, 0-leak remount, plinth exclusion, and low-detail checks', async () => {
    const metrics = await assertCandidateContract(createCandidate, 'E24', CANDIDATE_DIR);
    expect(metrics.plinthIntersections).toBe(0);
    expect(metrics.controls).toBe(5);
  });

  it('breaks Saltfen->Thornwood traversal on injected missing ID and restores cleanly upon repair', () => {
    let s = createInitialCampaignState();
    s = marchUnitNext(s); // Westmarch -> Saltfen
    expect(s.unitRegion).toBe('loc_saltfen');

    s = injectBrokenReferenceId(s);
    expect(s.fault?.missingId).toBe('loc_thornwood_MISSING');

    // Attempted march across broken route halts safely at Saltfen
    const blocked = marchUnitNext(s);
    expect(blocked.unitRegion).toBe('loc_saltfen');
    expect(blocked.lastLog).toContain('MARCH BLOCKED');

    // Repair relinks canonical ID and restores march to Thornwood -> Last Keep
    s = repairBrokenReferenceId(blocked);
    expect(s.fault).toBeNull();
    s = marchUnitNext(s);
    expect(s.unitRegion).toBe('loc_thornwood');
    s = fortifyCurrentRegion(s);
    expect(s.fortified.loc_thornwood).toBe(true);
    s = marchUnitNext(s);
    expect(s.unitRegion).toBe('loc_last_keep');
  });

  it('executes fault injection, blocked march, repair, and reset in mounted host', async () => {
    const { host, controls } = createCandidateHarness(createCandidate, 'E24');
    await host.preload();
    host.mount();
    host.activate(0);

    controls[0].activate(); // march to Saltfen
    controls[2].activate(); // inject fault
    expect(host.module.getAccessibleContent().state).toContain('Schema=FAULT(loc_thornwood_MISSING)');

    controls[0].activate(); // try march across severed bridge -> stays at Saltfen
    expect(host.module.getAccessibleContent().state).toContain('Region=loc_saltfen');

    controls[3].activate(); // repair ID
    expect(host.module.getAccessibleContent().state).toContain('Schema=INTACT');

    controls[0].activate(); // march cleanly into Thornwood
    for (let i = 0; i < 12; i++) host.update(0.05, [0, 1.7, 3], i * 0.05);
    expect(host.module.getAccessibleContent().state).toContain('Region=loc_thornwood');

    host.reset();
    expect(host.module.getAccessibleContent().state).toContain('Region=loc_westmarch');
    expect(host.module.getAccessibleContent().state).toContain('Schema=INTACT');

    host.deactivate();
    host.unmount();
    expect(host.lastLeakCount).toBe(0);
    host.dispose();
  });
});

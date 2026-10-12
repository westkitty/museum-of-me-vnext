import { describe, expect, it } from 'vitest';
import {
  HELIOCIDE_EVIDENCE,
  clampEvidenceIndex,
  evidenceLoss,
  reconstructedLoss,
  reconstructionRecordIndex,
} from '../src/exhibits/starsilk/heliocideEvidence';

describe('E08: canon-grounded witness chain', () => {
  it('orders only established anchors without inventing an extra war year', () => {
    expect(HELIOCIDE_EVIDENCE.map((entry) => entry.era)).toEqual([
      'YEAR 0', 'YEAR 3', 'YEAR 121', 'YEAR 170', 'AFTER THE GATE', 'CONSEQUENCE',
    ]);
    expect(new Set(HELIOCIDE_EVIDENCE.map((entry) => entry.id)).size).toBe(6);
    expect(HELIOCIDE_EVIDENCE[3].finding).toContain('Aureal Gate');
    expect(HELIOCIDE_EVIDENCE[4].finding).toContain('Hal\'Ven Cluster');
    expect(HELIOCIDE_EVIDENCE[5].finding).toContain('absence');
  });

  it('lets visitors investigate the cause in any order without a score or gate', () => {
    expect(clampEvidenceIndex(-9)).toBe(0);
    expect(clampEvidenceIndex(999)).toBe(5);
    expect(clampEvidenceIndex(Number.NaN)).toBe(0);
    expect(evidenceLoss(5)).toBe(1);
    expect(evidenceLoss(2)).toBe(0);
  });

  it('keeps the sky fully present through the Aureal Gate breach', () => {
    for (let stage = 0; stage < 4; stage++) expect(evidenceLoss(stage)).toBe(0);
    for (const t of [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6]) {
      expect(reconstructedLoss(t)).toBe(0);
    }
  });

  it('makes the irreversible absence arrive only after the consequence is known', () => {
    expect(reconstructedLoss(5 / 6)).toBeCloseTo(0.68);
    expect(reconstructedLoss(1)).toBe(1);
    expect(reconstructedLoss(Number.NaN)).toBe(0);
    expect(reconstructedLoss(-1)).toBe(0);
    expect(reconstructedLoss(2)).toBe(1);
    let last = 0;
    for (let i = 0; i <= 120; i++) {
      const next = reconstructedLoss(i / 120);
      expect(next).toBeGreaterThanOrEqual(last);
      last = next;
    }
  });

  it('reconstructs six discrete records without skipping the final absent sky', () => {
    expect(reconstructionRecordIndex(0)).toBe(0);
    expect(reconstructionRecordIndex(0.3)).toBe(1);
    expect(reconstructionRecordIndex(0.7)).toBe(4);
    expect(reconstructionRecordIndex(1)).toBe(5);
    expect(reconstructionRecordIndex(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

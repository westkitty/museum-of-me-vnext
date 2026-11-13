import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { checkBudgets, resolvePath, withDerived } from '../scripts/check-perf-budgets.mjs';

const recorded = {
  ...JSON.parse(readFileSync('docs/evidence/device-performance-2026-11-12/device-results.json', 'utf8')),
  transitions: JSON.parse(readFileSync('docs/evidence/device-performance-2026-11-12/transition-results.json', 'utf8')),
};
const { budgets } = JSON.parse(readFileSync('tests/perf/budgets.json', 'utf8'));

describe('device performance budgets', () => {
  it('resolves fan-out paths', () => {
    expect(resolvePath({ a: [{ b: [5, 9] }, { b: [7] }] }, 'a[*].b[0]')).toEqual([5, 7]);
    expect(resolvePath({ a: { b: 3 } }, 'a.c')).toEqual([]);
  });

  it('accepts the recorded M1 baseline, flagging only the known first-entry hitch as a missed target', () => {
    const rows = checkBudgets(budgets, withDerived(recorded)) as { id: string; status: string }[];
    expect(rows.filter((row) => row.status === 'FAIL' || row.status === 'MISSING')).toEqual([]);
    expect(rows.filter((row) => row.status === 'WARN').map((row) => row.id)).toEqual(['first-entry-worst-frame']);
  });

  it('fails a regression and reports missing measurements', () => {
    const slower = withDerived({ ...recorded, exteriorIdleAtSpawn: { frames: { p99: 41 } } });
    const rows = checkBudgets(budgets, slower) as { id: string; status: string }[];
    expect(rows.find((row) => row.id === 'exterior-idle-p99')?.status).toBe('FAIL');
    expect((checkBudgets(budgets, {}) as { status: string }[]).every((row) => row.status === 'MISSING')).toBe(true);
  });
});

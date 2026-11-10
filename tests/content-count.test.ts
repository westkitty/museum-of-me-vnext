import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM script library without type declarations
import { countClaims, spokenNumber } from '../scripts/content-count-lib.mjs';

const totals = { projects: 73, exhibits: 35 };
const verdicts = (line: string) => (countClaims(line, totals) as { ok: boolean }[]).map((claim) => claim.ok);

describe('visitor-facing collection totals', () => {
  it('reads spelled and numeric totals', () => {
    expect(spokenNumber('sixty-four')).toBe(64);
    expect(spokenNumber('seventy three')).toBe(73);
    expect(spokenNumber('35')).toBe(35);
  });

  it('rejects a stale current total in any spelling', () => {
    expect(verdicts('Among sixty-four projects, this one is complete and playable.')).toEqual([false]);
    expect(verdicts('A museum of 64 projects across six wings.')).toEqual([false]);
    expect(verdicts('The 64-project collection is presented through thirty-six exhibits.')).toEqual([false, false]);
    expect(verdicts('64 current project identities are mapped.')).toEqual([false]);
  });

  it('accepts the living totals', () => {
    expect(verdicts('Among seventy-three projects, this one is complete.')).toEqual([true]);
    expect(verdicts('73 current project identities, presented through 35 exhibits.')).toEqual([true, true]);
  });

  it('accepts an explicitly historical reference to the earlier collection', () => {
    expect(verdicts('The original collection held sixty-four projects.')).toEqual([true]);
    expect(verdicts('The frozen 2026-08-19 snapshot mapped 64 projects.')).toEqual([true]);
    expect(verdicts('It grew from sixty-four projects to seventy-three projects.')).toEqual([true, true]);
  });

  it('does not let a historical sentence excuse a stale total in the next sentence', () => {
    expect(verdicts('The earlier mapping was smaller. Today the museum holds sixty-four projects.')).toEqual([false]);
  });

  it('ignores small counts that describe one exhibit', () => {
    expect(verdicts('Five voice projects, one requirement.')).toEqual([]);
  });
});

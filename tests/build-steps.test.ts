import { describe, expect, it } from 'vitest';
import { runStepsCooperatively, runStepsSync, type BuildSteps } from '../src/util/buildSteps';

function* counted(log: string[]): BuildSteps<number> {
  try {
    log.push('a'); yield;
    log.push('b'); yield;
    log.push('c');
    return 3;
  } finally {
    log.push('finally');
  }
}

describe('build steps', () => {
  it('drains synchronously to the same result', () => {
    const log: string[] = [];
    expect(runStepsSync(counted(log))).toBe(3);
    expect(log).toEqual(['a', 'b', 'c', 'finally']);
  });

  it('yields at every boundary on the cooperative path and reports routine CPU', async () => {
    const log: string[] = [];
    let yields = 0;
    let cpu = -1;
    const result = await runStepsCooperatively(counted(log), async () => { yields++; log.push('yield'); }, (ms) => { cpu = ms; });
    expect(result).toBe(3);
    expect(yields).toBe(2);
    expect(log).toEqual(['a', 'yield', 'b', 'yield', 'c', 'finally']);
    expect(cpu).toBeGreaterThanOrEqual(0);
  });

  it('stops at a cancelled yield and still runs the routine cleanup', async () => {
    const log: string[] = [];
    await expect(runStepsCooperatively(counted(log), async () => { throw new Error('disposed'); })).rejects.toThrow('disposed');
    expect(log).toEqual(['a', 'finally']);
  });
});

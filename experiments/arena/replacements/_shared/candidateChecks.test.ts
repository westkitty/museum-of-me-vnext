import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WestCatSystems } from '../../../../src/exhibits/games/WestCatSystems';
import { assertCandidateContract } from './candidateChecks';

const here = dirname(fileURLToPath(import.meta.url));
const incumbentDir = resolve(here, '../../../../src/exhibits/games');

describe('shared candidate harness', () => {
  it('verifies lifecycle, disposal, bay bounds, and reset against an incumbent module', async () => {
    const metrics = await assertCandidateContract(
      (def) => new WestCatSystems(def),
      'E26',
      incumbentDir,
    );
    expect(metrics.id).toBe('E26');
    expect(metrics.resources).toBeGreaterThan(0);
    expect(metrics.plinthIntersections).toBe(0);
  });
});

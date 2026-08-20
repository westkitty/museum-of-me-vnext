import { describe, expect, it } from 'vitest';
import { DRAKKEN_REFERENCE_STATIONS, DRAKKEN_SOURCE_BASIS } from '../src/exhibits/starsilk/drakkenSource';

describe('E02 Drakken source grounding', () => {
  it('keeps the preserved 37-entry taxonomy frame intact', () => {
    expect(DRAKKEN_SOURCE_BASIS).toMatchObject({
      entryCount: 37, eggCount: 1, strainCount: 35, archetypeCount: 5, strainsPerArchetype: 7, motherCount: 1,
    });
  });

  it('labels named references as process functions and reserves abstraction for the unresolved taxonomy', () => {
    expect(DRAKKEN_REFERENCE_STATIONS.map((station) => station.name)).toEqual([
      'Fault-Tongue', 'Cloudmaw', 'Gorevault', 'Ringthroat', 'Five-archetype frame',
    ]);
    expect(DRAKKEN_REFERENCE_STATIONS.slice(0, 4).every(
      (station) => station.semanticType === 'canonical process function',
    )).toBe(true);
    expect(DRAKKEN_REFERENCE_STATIONS[4].semanticType).toBe('museum taxonomy abstraction');
  });

  it('retains the source-locked Gorevault-to-Ringthroat order', () => {
    const [gorevault, ringthroat] = DRAKKEN_REFERENCE_STATIONS.slice(2, 4);
    expect(gorevault.note).toContain('prepared feedstock');
    expect(ringthroat.note).toContain('Downstream of prepared feedstock');
  });
});

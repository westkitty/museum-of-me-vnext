import { describe, expect, it } from 'vitest';
import { normalizePlanningPin } from '../src/workbench3d/annotations';

describe('world-qualified Workbench annotations', () => {
  it('classifies old 2D plan pins as interior and preserves their floor and coordinates', () => {
    expect(normalizePlanningPin({
      id: 'legacy-pin', floor: 1, position: [12.25, -8.5], title: 'Older pin', body: 'Keep this.',
    })).toEqual({
      id: 'legacy-pin', worldId: 'interior', floor: 1,
      position: [12.25, -8.5], title: 'Older pin', body: 'Keep this.',
    });
  });

  it('preserves an exterior pin exact X/Z/Y without assigning it to a museum floor', () => {
    expect(normalizePlanningPin({
      id: 'site-pin', worldId: 'exterior', floor: null,
      position: [-103.625, -81.25], y: 0.375, featureId: 'spire-northwest',
      title: 'Spire court', body: 'Site note.',
    })).toEqual({
      id: 'site-pin', worldId: 'exterior', floor: null,
      position: [-103.625, -81.25], y: 0.375, featureId: 'spire-northwest',
      title: 'Spire court', body: 'Site note.',
    });
  });

  it('fails closed on ambiguous world IDs, invalid floors, and out-of-range points', () => {
    expect(normalizePlanningPin({ id: 'unknown-world', worldId: 'other', floor: 0, position: [0, 0] })).toBeNull();
    expect(normalizePlanningPin({ id: 'floorless-interior', worldId: 'interior', position: [0, 0] })).toBeNull();
    expect(normalizePlanningPin({ id: 'outside', worldId: 'exterior', position: [301, 0] })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { EXTERIOR_PLAZA_LABEL, WINGS, ZONE_BY_ID, exteriorLocationLabel, faceDirection, place, zoneAtXYZ } from '../src/world/layout';

describe('exterior location labels', () => {
  it('names the side of the building, never an interior wing, behind the museum', () => {
    const north = WINGS.find((wing) => wing.id === 'north')!;
    const [x, y, z] = place(faceDirection(north.face), north.hallTo - 2);
    // The bug: the same X/Z inside the North Wing used to be reported outside.
    expect(zoneAtXYZ(x, y + 0.1, z)).toBe('north');
    expect(exteriorLocationLabel(x, y + 0.1, z)).toBe('Exterior · north side');
  });

  it('labels each compass side and the arrival plaza', () => {
    expect(exteriorLocationLabel(80, 0, 0)).toBe('Exterior · east side');
    expect(exteriorLocationLabel(-80, 0, 0)).toBe('Exterior · west side');
    expect(exteriorLocationLabel(60, 0, -60)).toBe('Exterior · north-east side');
    const plaza = ZONE_BY_ID.get('plaza')!.center;
    expect(exteriorLocationLabel(plaza[0], plaza[1] + 0.1, plaza[2])).toBe(EXTERIOR_PLAZA_LABEL);
    // The exterior arrival point, far down the drive, is still the arrival.
    expect(exteriorLocationLabel(0, -0.5, 196)).toBe(EXTERIOR_PLAZA_LABEL);
    expect(exteriorLocationLabel(120, 0, 196)).toBe('Exterior · south-east side');
  });
});

import { describe, expect, it } from 'vitest';
import {
  isAtEntrancePortal,
  isApproachingEntrance,
  isExitingEntrance,
} from '../src/app/WorldDirector';
import {
  ENTRANCE_PORTAL_Z, PORTAL_WIDTH, PORTAL_HEIGHT,
  PORTAL_VESTIBULE_DEPTH, THRESHOLD_PREPARE_Z,
} from '../src/world/layout';

describe('exterior-to-interior doorway aperture', () => {
  it('keeps a visitor on outside side paths in the exterior world across z=128', () => {
    for (const x of [-50, -20, -9, -5, 5, 9, 20, 50]) {
      const pos = { x, y: 0, z: ENTRANCE_PORTAL_Z - 1 };
      expect(isAtEntrancePortal(pos), `outside x=${x}`).toBe(false);
      expect(isExitingEntrance({ ...pos, z: ENTRANCE_PORTAL_Z + 1 })).toBe(false);
    }
  });

  it('admits only an actual doorway crossing, including a prepared vestibule', () => {
    expect(isAtEntrancePortal({ x: 0, y: 0, z: ENTRANCE_PORTAL_Z })).toBe(true);
    expect(isAtEntrancePortal({ x: 0, y: 0, z: ENTRANCE_PORTAL_Z - 2 })).toBe(true);
    expect(isAtEntrancePortal({ x: 0, y: 0, z: ENTRANCE_PORTAL_Z + 0.05 })).toBe(true);
    expect(isAtEntrancePortal({ x: PORTAL_WIDTH / 2, y: 0, z: ENTRANCE_PORTAL_Z - 1 })).toBe(false);
    expect(isAtEntrancePortal({ x: 0, y: 0, z: ENTRANCE_PORTAL_Z - PORTAL_VESTIBULE_DEPTH - 1 })).toBe(false);
    expect(isAtEntrancePortal({ x: 0, y: 0, z: ENTRANCE_PORTAL_Z + 1 })).toBe(false);
    expect(isExitingEntrance({ x: 0, y: 0, z: ENTRANCE_PORTAL_Z + 4 })).toBe(true);
    expect(isExitingEntrance({ x: 0, y: 0, z: THRESHOLD_PREPARE_Z + 4 })).toBe(false);
  });

  it('rejects elevated free flight and positions below the portal floor', () => {
    expect(isAtEntrancePortal({ x: 0, y: PORTAL_HEIGHT + 2, z: ENTRANCE_PORTAL_Z })).toBe(false);
    expect(isAtEntrancePortal({ x: 0, y: -2, z: ENTRANCE_PORTAL_Z })).toBe(false);
    expect(isExitingEntrance({ x: 0, y: PORTAL_HEIGHT + 2, z: ENTRANCE_PORTAL_Z + 1 })).toBe(false);
  });

  it('prewarms invisibly only near the real entrance, never from a side-path Z crossing', () => {
    expect(isApproachingEntrance({ x: 0, y: 0, z: THRESHOLD_PREPARE_Z })).toBe(true);
    expect(isApproachingEntrance({ x: 0, y: 0, z: THRESHOLD_PREPARE_Z + 5 })).toBe(true);
    expect(isApproachingEntrance({ x: 35, y: 0, z: THRESHOLD_PREPARE_Z })).toBe(false);
    expect(isApproachingEntrance({ x: 35, y: 0, z: ENTRANCE_PORTAL_Z - 1 })).toBe(false);
    expect(isApproachingEntrance({ x: 0, y: 9, z: THRESHOLD_PREPARE_Z })).toBe(false);
    expect(isApproachingEntrance({ x: 0, y: 0, z: ENTRANCE_PORTAL_Z - 10 })).toBe(false);
  });
});

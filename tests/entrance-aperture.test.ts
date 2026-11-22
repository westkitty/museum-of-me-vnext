import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import type { App } from '../src/app/App';
import {
  WorldDirector,
  isAtEntrancePortal,
  isApproachingEntrance,
  isExitingEntrance,
} from '../src/app/WorldDirector';
import {
  ENTRANCE_PORTAL_Z, GROUND_Y, PORTAL_WIDTH, PORTAL_HEIGHT,
  PORTAL_VESTIBULE_DEPTH, THRESHOLD_PREPARE_Z, ATRIUM_FRONT_Z, SEAM_OFFSET_Z,
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
    // Leaving is through the atrium's front door, in interior coordinates.
    expect(isExitingEntrance({ x: 0, y: 0, z: ENTRANCE_PORTAL_Z + 4 })).toBe(false);
    expect(isExitingEntrance({ x: 0, y: 0, z: ATRIUM_FRONT_Z + 4 })).toBe(true);
    expect(isExitingEntrance({ x: 0, y: 0, z: ATRIUM_FRONT_Z + 10 })).toBe(false);
    expect(isExitingEntrance({ x: 9, y: 0, z: ATRIUM_FRONT_Z + 1 })).toBe(false);
  });

  it('rejects elevated free flight and positions below the portal floor', () => {
    expect(isAtEntrancePortal({ x: 0, y: PORTAL_HEIGHT + 2, z: ENTRANCE_PORTAL_Z })).toBe(false);
    expect(isAtEntrancePortal({ x: 0, y: -2, z: ENTRANCE_PORTAL_Z })).toBe(false);
    expect(isExitingEntrance({ x: 0, y: PORTAL_HEIGHT + 2, z: ATRIUM_FRONT_Z + 1 })).toBe(false);
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

describe('doorway hold while a constructed interior is still prewarming', () => {
  function stubDirector() {
    const telemetry = { prewarmReady: false };
    const app = {
      renderer: { isContextLost: false },
      interiorLoadTelemetry: { entranceReadyAtMs: null as number | null, transitionCommittedAtMs: 0 },
      interiorWorld: {
        streaming: { telemetry },
        root: { visible: false },
        collision: {},
        setActive: () => undefined,
      },
      exteriorWorld: { root: { visible: true }, collision: {}, islandVisitors: { clear: () => undefined } },
      ticket: { number: '0001', date: 'today', issuedAtMs: 0 } as { number: string; date: string; issuedAtMs: number } | null,
      player: {
        position: { x: 0, y: GROUND_Y, z: ENTRANCE_PORTAL_Z },
        acquireFreeze: () => () => undefined,
        setCollisionWorld: () => undefined,
        shift(_x: number, _y: number, dz: number) { this.position.z += dz; },
      },
      ui: undefined,
    };
    const director = new WorldDirector(app as unknown as App);
    director.interiorConstructed = true;
    return { director, app, telemetry };
  }

  it('holds the visitor in the doorway, then admits them once the entrance is ready', () => {
    const { director, app, telemetry } = stubDirector();
    const pos = app.player.position as unknown as THREE.Vector3;

    // Walking forward against an unready entrance must not carry the visitor
    // past the portal window in the exterior world.
    for (let i = 0; i < 600; i++) {
      pos.z -= 0.1;
      director.update(pos);
    }
    expect(director.activeWorld).toBe('exterior');
    expect(pos.z).toBeGreaterThan(ENTRANCE_PORTAL_Z);
    expect(isAtEntrancePortal(pos)).toBe(true);

    telemetry.prewarmReady = true;
    pos.z -= 0.1;
    director.update(pos);
    expect(director.activeWorld).toBe('interior');
    // The exterior door opens into the atrium's front door, 34 m further on.
    expect(pos.z).toBeGreaterThan(ATRIUM_FRONT_Z - 1);
    expect(pos.z).toBeLessThanOrEqual(ATRIUM_FRONT_Z + 0.1);
  });

  it('admits by ticket: without one the doorway holds the visitor even when ready', () => {
    const { director, app, telemetry } = stubDirector();
    const pos = app.player.position as unknown as THREE.Vector3;
    app.ticket = null;
    telemetry.prewarmReady = true;
    for (let i = 0; i < 100; i++) { pos.z -= 0.1; director.update(pos); }
    expect(director.activeWorld).toBe('exterior');
    expect(pos.z).toBeGreaterThan(ENTRANCE_PORTAL_Z);

    app.ticket = { number: '0002', date: 'today', issuedAtMs: 0 };
    pos.z -= 0.1;
    director.update(pos);
    expect(director.activeWorld).toBe('interior');

    // Out through the atrium's front door: carried back to the exterior door.
    pos.z = ATRIUM_FRONT_Z + 0.5;
    director.update(pos);
    expect(director.activeWorld).toBe('exterior');
    expect(pos.z).toBeCloseTo(ATRIUM_FRONT_Z + 0.5 - SEAM_OFFSET_Z, 5);
    expect(pos.z).toBeGreaterThan(ENTRANCE_PORTAL_Z);
  });
});

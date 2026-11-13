import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import type { App } from '../src/app/App';
import { WORLD_TRANSITIONS, WorldDirector, isLegalWorldTransition, type WorldPhase } from '../src/app/WorldDirector';
import { ENTRANCE_PORTAL_Z, GROUND_Y } from '../src/world/layout';

/** A minimal App stand-in exposing exactly what WorldDirector touches. */
function harness(options: { loadFails?: boolean } = {}) {
  const telemetry = { prewarmReady: false };
  const interiorWorld = {
    streaming: { telemetry },
    root: { visible: false },
    collision: {},
    setActive: vi.fn(),
  };
  const app = {
    renderer: { isContextLost: false },
    interiorLoadTelemetry: { entranceReadyAtMs: null as number | null, transitionCommittedAtMs: 0 },
    interiorWorld: null as typeof interiorWorld | null,
    exteriorWorld: { root: { visible: true }, collision: {} },
    player: {
      position: { x: 0, y: GROUND_Y, z: ENTRANCE_PORTAL_Z + 20 },
      acquireFreeze: () => () => undefined,
      setCollisionWorld: vi.fn(),
    },
    ui: { hud: { setThresholdStatus: vi.fn() } },
    ensureInteriorLoaded: vi.fn(async () => {
      if (options.loadFails) throw new Error('module transfer failed');
      app.interiorWorld = interiorWorld;
    }),
  };
  const director = new WorldDirector(app as unknown as App);
  const pos = app.player.position as unknown as THREE.Vector3;
  // Record every phase change as it happens, including transient committing phases.
  const phases: WorldPhase[] = [director.phase];
  const inner = director as unknown as { transition(to: WorldPhase): void };
  const original = inner.transition.bind(director);
  inner.transition = (to: WorldPhase) => { if (phases.at(-1) !== to) phases.push(to); original(to); };
  const step = () => director.update(pos);
  const note = () => undefined;
  return { app, director, telemetry, pos, phases, step, note };
}

describe('world-switch state machine', () => {
  it('declares a destination list for every phase, and only known phases', () => {
    const phases = Object.keys(WORLD_TRANSITIONS) as WorldPhase[];
    for (const targets of Object.values(WORLD_TRANSITIONS)) for (const to of targets) expect(phases).toContain(to);
    expect(isLegalWorldTransition('EXTERIOR_ACTIVE', 'INTERIOR_ACTIVE')).toBe(false); // must commit first
    expect(isLegalWorldTransition('AT_THRESHOLD', 'AT_THRESHOLD')).toBe(true);
  });

  it('walks in through preparation, waits for the entrance, commits, leaves and re-enters', async () => {
    const { director, telemetry, pos, phases, step, note } = harness();
    await director.prepareInterior();
    note();
    expect(director.phase).toBe('PREPARING_RENDER_RESOURCES');

    // Entrance not ready: the doorway holds the visitor outside.
    for (let i = 0; i < 400; i++) { pos.z -= 0.1; step(); }
    expect(director.activeWorld).toBe('exterior');

    telemetry.prewarmReady = true;
    pos.z -= 0.1; // the visitor keeps walking forward
    step();
    expect(director.activeWorld).toBe('interior');

    // Walk back out through the doorway, then in again.
    pos.z = ENTRANCE_PORTAL_Z + 2;
    step();
    expect(director.activeWorld).toBe('exterior');
    pos.z = ENTRANCE_PORTAL_Z;
    step();
    expect(director.activeWorld).toBe('interior');

    expect(phases).toEqual([
      'EXTERIOR_ACTIVE', 'PREPARING_INTERIOR', 'PREPARING_RENDER_RESOURCES', 'AT_THRESHOLD',
      'COMMITTING_INTERIOR', 'INTERIOR_ACTIVE', 'COMMITTING_EXTERIOR', 'EXTERIOR_ACTIVE',
      'COMMITTING_INTERIOR', 'INTERIOR_ACTIVE',
    ]);
    expect(director.illegalTransitions).toEqual([]);
  });

  it('reports a failed preparation, keeps the visitor outside, and recovers on retry', async () => {
    const h = harness({ loadFails: true });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(h.director.prepareInterior()).rejects.toThrow('module transfer failed');
    expect(h.director.phase).toBe('PREPARATION_FAILED');
    h.pos.z = ENTRANCE_PORTAL_Z;
    h.step();
    expect(h.director.activeWorld).toBe('exterior');

    // Retry after the module becomes available.
    h.app.ensureInteriorLoaded.mockImplementation(async () => { h.app.interiorWorld = {
      streaming: { telemetry: h.telemetry }, root: { visible: false }, collision: {}, setActive: vi.fn(),
    }; });
    h.telemetry.prewarmReady = true;
    await h.director.switchToInterior();
    expect(h.director.activeWorld).toBe('interior');
    expect(h.director.illegalTransitions).toEqual([]);
    quiet.mockRestore();
  });

  it('records, rather than silently accepts, a transition outside the table', () => {
    const { director } = harness();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Leaving the interior while already outside is a no-op, not a transition.
    expect(director.switchToExterior()).toBe(true);
    expect(director.illegalTransitions).toEqual([]);
    (director as unknown as { transition(to: WorldPhase): void }).transition('INTERIOR_ACTIVE');
    expect(director.illegalTransitions).toEqual([{ from: 'EXTERIOR_ACTIVE', to: 'INTERIOR_ACTIVE' }]);
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });
});

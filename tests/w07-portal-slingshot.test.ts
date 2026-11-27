import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS, PlayerController } from '../src/player/PlayerController';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext, PocketWorldInstance } from '../src/world/pocket/types';
import { createW07WorldFactory, type W07PreviewHandle } from '../src/world/pocket/w07/createW07World';
import { registerW07Preview } from '../src/world/pocket/w07/registerW07Preview';
import { shotTarget } from '../src/world/pocket/w07/w07Portals';
import {
  CORE_POS, exitPoint, GATE_POS, LEDGE, LEDGE_Y, MAX_EXIT_SPEED, PANEL_A1, PANEL_A2, PANEL_A3, PANEL_B1, PANEL_B2, PANEL_C1,
  PANEL_C2, PANEL_C3, PANELS, PLATE_POS, ROUTE, SPAWN, type Vec3,
} from '../src/world/pocket/w07/w07Layout';

const STEP = 1 / 60;

/** A real PlayerController on the world's collision, driven by a fake keyboard. */
function makeWorld(quality: 'low' | 'high' = 'high', reducedMotion = false) {
  const scope = new ResourceScope('test-w07');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const keys = new Set<string>();
  const input = { isDown: (a: string) => keys.has(a), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
  const player = new PlayerController(collision, input as never);
  player.teleport([...SPAWN]);
  const controls = new Map<string, { activate(): void; label: string | (() => string) }>();
  const counts = { saves: 0, resets: 0, complete: 0, eligible: 0 };
  let saved: { p: [number, number, number]; yaw: number } = { p: [...SPAWN], yaw: 0 };
  const messages: string[] = [];
  const ctx = {
    scope, collision, root, quality: QUALITY[quality], player, camera: new THREE.PerspectiveCamera(),
    interaction: { register: (id: string, control: { activate(): void; label: string | (() => string) }) => { controls.set(id, control); return () => controls.delete(id); } },
    saveCheckpoint: () => { counts.saves++; saved = { p: [player.position.x, player.position.y, player.position.z], yaw: player.yaw }; return true; },
    resetToCheckpoint: () => { counts.resets++; player.restorePose(saved.p, saved.yaw, 0); return true; },
    requestComplete: () => { counts.complete++; },
    markCompletionEligible: () => { counts.eligible++; },
    reducedMotion: () => reducedMotion,
    announce: (m: string) => { messages.push(m); },
  } as unknown as PocketWorldContext;
  return { ctx, scope, collision, root, controls, player, keys, counts, messages };
}
type World = ReturnType<typeof makeWorld>;

async function build(world: World) {
  let handle: W07PreviewHandle | undefined;
  const instance = await createW07WorldFactory((h) => { handle = h; })(world.ctx, new AbortController().signal);
  return { instance, handle: handle! };
}

function step(world: World, instance: PocketWorldInstance) {
  world.player.fixedUpdate(STEP);
  instance.fixedUpdate?.(STEP, [0, 0, 0]);
}
function idle(world: World, instance: PocketWorldInstance, seconds: number) {
  world.keys.clear();
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(world, instance);
}
function idleUntil(world: World, instance: PocketWorldInstance, pred: () => boolean, maxSeconds = 15) {
  world.keys.clear();
  for (let i = 0; i < maxSeconds / STEP && !pred(); i++) step(world, instance);
  expect(pred()).toBe(true);
}
/** Walk toward (x, z) until within 0.35 m, or until `stop()` (e.g. a portal transit). */
function walkTo(world: World, instance: PocketWorldInstance, x: number, z: number, stop: () => boolean = () => false, maxSeconds = 20) {
  for (let i = 0; i < maxSeconds / STEP; i++) {
    const p = world.player.position;
    const dx = x - p.x, dz = z - p.z;
    if (Math.hypot(dx, dz) < 0.35 || stop()) break;
    world.player.yaw = Math.atan2(-dx, -dz);
    world.keys.add('forward');
    step(world, instance);
  }
  world.keys.clear();
}
function walkPath(world: World, instance: PocketWorldInstance, path: readonly (readonly [number, number])[]) {
  for (const [x, z] of path) walkTo(world, instance, x, z);
}
/** Aim the view at a world point. */
function aim(world: World, target: Vec3) {
  const p = world.player.position;
  const dx = target[0] - p.x, dy = target[1] - (p.y + EYE_HEIGHT), dz = target[2] - p.z;
  world.player.yaw = Math.atan2(-dx, -dz);
  world.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}
function fireAt(world: World, target: Vec3) {
  aim(world, target);
  world.controls.get('w07-slingshot')!.activate();
}
const label = (world: World, id: string) => {
  const l = world.controls.get(id)!.label;
  return typeof l === 'function' ? l() : l;
};
const transitsBy = (handle: W07PreviewHandle) => {
  const before = handle.getSnapshot().transits;
  return () => handle.getSnapshot().transits > before;
};

/** Act I: slingshot, Chamber One's linked passage. */
function chamberOne(world: World, instance: PocketWorldInstance, handle: W07PreviewHandle) {
  walkPath(world, instance, ROUTE.toSlingshot.slice(1));
  world.controls.get('w07-slingshot-stand')!.activate();
  expect(handle.getSnapshot().gateOpen).toBe(true);
  walkPath(world, instance, ROUTE.intoChamberOne);
  expect(handle.getSnapshot().zone).toBe('A');
  fireAt(world, PANEL_A2.centre);
  fireAt(world, PANEL_A1.centre);
  expect(handle.getSnapshot().portals.map((p) => p.panel)).toEqual(['A2', 'A1']);
  expect(handle.getSnapshot().linked).toBe(true);
  walkPath(world, instance, ROUTE.nearA1);
  walkTo(world, instance, -9.5, 12, transitsBy(handle));
  const [ex, , ez] = exitPoint(PANEL_A2);
  expect(world.player.position.x).toBeCloseTo(ex, 5);
  expect(world.player.position.z).toBeCloseTo(ez, 5);
  idle(world, instance, 0.5);
  expect(handle.getSnapshot().roomsCleared).toEqual(['A']);
}

/** Act II: carry the block through the portals onto the gallery plate. */
function chamberTwo(world: World, instance: PocketWorldInstance, handle: W07PreviewHandle) {
  walkPath(world, instance, ROUTE.toChamberTwo);
  expect(handle.getSnapshot().zone).toBe('B');
  expect(handle.getSnapshot().portals).toEqual([]);
  walkPath(world, instance, ROUTE.toDispenser);
  fireAt(world, PANEL_B1.centre);
  fireAt(world, PANEL_B2.centre);
  aim(world, [-7.5, 0.4, -8]);
  world.controls.get('w07-block')!.activate();
  expect(handle.getSnapshot().blockCarried).toBe(true);
  walkPath(world, instance, ROUTE.toB1);
  walkTo(world, instance, -11, -17, transitsBy(handle));
  expect(handle.getSnapshot().blockCarried).toBe(true);
  walkPath(world, instance, ROUTE.toPlate);
  aim(world, [PLATE_POS[0], 0, PLATE_POS[2]]);
  expect(label(world, 'w07-slingshot')).toBe('Set Down the Block');
  world.controls.get('w07-slingshot')!.activate();
  const snap = handle.getSnapshot();
  expect(snap.plateLatched).toBe(true);
  expect(snap.doorBOpen).toBe(true);
  expect(Math.hypot(snap.blockPos[0] - PLATE_POS[0], snap.blockPos[2] - PLATE_POS[2])).toBeLessThan(0.9);
  walkPath(world, instance, ROUTE.toB2);
  walkTo(world, instance, 11, -17, transitsBy(handle));
  expect(world.player.position.x).toBeLessThan(-8);
  walkPath(world, instance, ROUTE.toDoorB);
  expect(handle.getSnapshot().zone).toBe('C');
  expect(handle.getSnapshot().roomsCleared).toEqual(['A', 'B']);
}

/** Act III: link the pylon and the shaft floor, then fall through to the ledge. */
function chamberThree(world: World, instance: PocketWorldInstance, handle: W07PreviewHandle) {
  walkPath(world, instance, ROUTE.toWalkway);
  fireAt(world, PANEL_C2.centre);
  walkPath(world, instance, ROUTE.toShaftLip);
  fireAt(world, PANEL_C1.centre);
  expect(handle.getSnapshot().portals.map((p) => p.panel)).toEqual(['C2', 'C1']);
  const through = transitsBy(handle);
  walkTo(world, instance, ...ROUTE.offShaftLip[0], through);
  idleUntil(world, instance, through, 3);
  expect(handle.getSnapshot().flings).toBe(1);
  idleUntil(world, instance, () => world.player.grounded);
  const p = world.player.position;
  expect(p.y).toBeCloseTo(LEDGE_Y, 5);
  expect(p.z).toBeLessThan(LEDGE.maxZ - 0.5);
  idle(world, instance, 0.2);
  expect(handle.getSnapshot().ledgeReached).toBe(true);
  expect(handle.getSnapshot().roomsCleared).toEqual(['A', 'B', 'C']);
}

describe('W07 Portal Slingshot Trials preview', () => {
  it('keeps the production world dormant and confines the factory to preview registration', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.get('W07')?.readiness).toBe('dormant');
    expect(registry.get('W07')?.load).toBeUndefined();
    registerW07Preview(registry);
    expect(registry.isPlayable('W07')).toBe(true);
  });

  it('places every exit clear of walls, on support (except the high pylon panel), and each panel shootable from its areas', async () => {
    const world = makeWorld();
    try {
      await build(world);
      for (const panel of PANELS) {
        const [x, y, z] = exitPoint(panel);
        const probe = { x, y, z };
        expect(world.collision.resolveHorizontal(probe, PLAYER_RADIUS, PLAYER_HEIGHT), panel.id).toBe(false);
        const support = world.collision.supportHeight(x, z, y, 0.1);
        if (panel.id === 'C2' || panel.id === 'C1') continue;
        expect(support, panel.id).toBe(0);
      }
      // Every panel can be hit from the centre of its first shooting area.
      for (const panel of PANELS) {
        const r = panel.shootFrom[0];
        const eye: Vec3 = [(r.minX + r.maxX) / 2, 1.64, (r.minZ + r.maxZ) / 2];
        const d = [panel.centre[0] - eye[0], panel.centre[1] - eye[1], panel.centre[2] - eye[2]];
        const l = Math.hypot(d[0], d[1], d[2]);
        expect(shotTarget(eye, [d[0] / l, d[1] / l, d[2] / l])?.id, panel.id).toBe(panel.id);
      }
      // A panel behind the eye, or seen from outside its areas, is never hit; a near miss snaps to the panel.
      expect(shotTarget([0, 1.64, 12], [0, 0, 1])).toBeNull();
      expect(shotTarget([0, 1.64, -17.4], [-1, 0, 0])?.id).toBe('B1');
      expect(shotTarget([0, 1.64, 24], [-1, 0, 0])).toBeNull();
      const off = new THREE.Vector3(-8 - -5.6, 1.3 + 0.35 - 1.64, 12 - 12 + 0.35).normalize();
      expect(shotTarget([-5.6, 1.64, 12], [off.x, off.y, off.z])?.id).toBe('A1');
    } finally {
      world.scope.dispose();
    }
  });

  it('plays all three chambers by real controller physics, then calibrates and completes once', async () => {
    for (const quality of ['high', 'low'] as const) {
      const world = makeWorld(quality);
      try {
        const { instance, handle } = await build(world);
        idle(world, instance, 0.2);
        // The gate holds until the slingshot is taken.
        walkTo(world, instance, 0, 14, () => false, 4);
        expect(world.player.position.z).toBeGreaterThan(18);
        chamberOne(world, instance, handle);
        chamberTwo(world, instance, handle);
        chamberThree(world, instance, handle);
        expect(label(world, 'w07-exit')).toBe('Exit Portal (closed)');
        walkPath(world, instance, ROUTE.toCore);
        expect(Math.hypot(world.player.position.x - CORE_POS[0], world.player.position.z - CORE_POS[2])).toBeLessThan(3.4);
        world.controls.get('w07-core')!.activate();
        expect(handle.getSnapshot().finaleStarted).toBe(true);
        world.controls.get('w07-exit')!.activate();
        expect(world.counts.complete).toBe(0);
        idle(world, instance, 8.2);
        const done = handle.getSnapshot();
        expect(done.finaleProgress).toBe(1);
        expect(done.completionEligible).toBe(true);
        expect(world.counts.eligible).toBe(1);
        walkPath(world, instance, ROUTE.toGate);
        expect(Math.hypot(world.player.position.x - GATE_POS[0], world.player.position.z - GATE_POS[2])).toBeLessThan(3.6);
        world.controls.get('w07-exit')!.activate();
        world.controls.get('w07-exit')!.activate();
        expect(world.counts.complete).toBe(1);
        expect(done.netResets).toBe(0);
        expect(done.checkpoints).toEqual(['chamber-one-far', 'chamber-two', 'chamber-three', 'ledge']);
        // Instance-local visual sync never throws.
        instance.variableUpdate?.(0.016, [0, 0, 0]);
      } finally {
        world.scope.dispose();
      }
    }
  });

  it('a walking-speed exit from the pylon cannot cross: the safety net returns the visitor gently', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w07-slingshot-stand')!.activate();
      world.player.teleport([0, 0, -33], 0);
      idle(world, instance, 0.3);
      expect(handle.getSnapshot().zone).toBe('C');
      walkPath(world, instance, ROUTE.toWalkway);
      fireAt(world, PANEL_C2.centre);
      walkTo(world, instance, -6, -42);
      fireAt(world, PANEL_C3.centre);
      expect(handle.getSnapshot().linked).toBe(true);
      walkTo(world, instance, -11, -42, transitsBy(handle));
      expect(handle.getSnapshot().flings).toBe(0);
      idleUntil(world, instance, () => handle.getSnapshot().netResets === 1);
      expect(world.player.position.y).toBe(0);
      expect(world.player.position.z).toBeGreaterThan(-46);
      expect(handle.getSnapshot().ledgeReached).toBe(false);
      // Sprinting into a wall portal is damped: still too slow.
      world.player.teleport([-6, 0, -42], Math.PI / 2);
      world.keys.add('forward');
      world.keys.add('run');
      const before = handle.getSnapshot().transits;
      for (let i = 0; i < 120 && handle.getSnapshot().transits === before; i++) step(world, instance);
      world.keys.clear();
      idleUntil(world, instance, () => handle.getSnapshot().netResets === 2);
      expect(handle.getSnapshot().ledgeReached).toBe(false);
      // Falling into the shaft with no portal there: lifted back out after a moment.
      fireAt(world, PANEL_C3.centre);
      expect(handle.getSnapshot().linked).toBe(false);
      walkPath(world, instance, ROUTE.toShaftLip.slice(1));
      walkTo(world, instance, ...ROUTE.offShaftLip[0]);
      idleUntil(world, instance, () => handle.getSnapshot().netResets === 3);
      expect(world.player.position.y).toBe(0);
    } finally {
      world.scope.dispose();
    }
  });

  it('applies the slingshot rules: white panels only, two portals, oldest replaced, a shot on a portal closes it, chambers close behind', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      expect(label(world, 'w07-slingshot')).toMatch(/Portal Slingshot/);
      world.controls.get('w07-slingshot')!.activate();
      expect(handle.getSnapshot().shots).toBe(0);
      world.controls.get('w07-slingshot-stand')!.activate();
      world.player.teleport([0, 0, 12], 0);
      idle(world, instance, 0.2);
      fireAt(world, [0, 3, 6.4]);
      expect(handle.getSnapshot().invalidShots).toBe(1);
      expect(handle.getSnapshot().portals).toEqual([]);
      fireAt(world, PANEL_A1.centre);
      fireAt(world, PANEL_A2.centre);
      world.player.teleport([6.4, 0, 11.5], 0);
      fireAt(world, PANEL_A3.centre);
      expect(handle.getSnapshot().portals).toEqual([{ panel: 'A2', colour: 'teal' }, { panel: 'A3', colour: 'amber' }]);
      aim(world, PANEL_A3.centre);
      expect(label(world, 'w07-slingshot')).toBe('Close the Portal on This Panel');
      world.controls.get('w07-slingshot')!.activate();
      expect(handle.getSnapshot().portals.map((p) => p.panel)).toEqual(['A2']);
      expect(handle.getSnapshot().linked).toBe(false);
      // Optional closet: link A2 and A3, walk in from the far side and examine the prototype.
      fireAt(world, PANEL_A3.centre);
      world.player.teleport([5.4, 0, 1], -Math.PI / 2);
      idle(world, instance, 0.4);
      walkTo(world, instance, 9.5, 1, transitsBy(handle));
      expect(world.player.position.x).toBeCloseTo(exitPoint(PANEL_A3)[0], 5);
      world.controls.get('w07-prototype')!.activate();
      expect(handle.getSnapshot().optionalFound).toBe(true);
      // Leaving the chamber closes its portals.
      world.player.teleport([0, 0, 24], 0);
      idle(world, instance, 0.2);
      expect(handle.getSnapshot().zone).toBe('foyer');
      expect(handle.getSnapshot().portals).toEqual([]);
      // The reset button closes portals; Chamber Two's also returns the block.
      world.player.teleport([-6.2, 0, -8], 0);
      idle(world, instance, 0.2);
      aim(world, [-7.5, 0.4, -8]);
      world.controls.get('w07-block')!.activate();
      fireAt(world, PANEL_B1.centre);
      expect(handle.getSnapshot().portals).toEqual([]);
      world.controls.get('w07-slingshot')!.activate();
      expect(handle.getSnapshot().blockCarried).toBe(false);
      fireAt(world, PANEL_B1.centre);
      fireAt(world, PANEL_B2.centre);
      world.controls.get('w07-reset-b')!.activate();
      const snap = handle.getSnapshot();
      expect(snap.portals).toEqual([]);
      expect(snap.blockReturns).toBe(1);
      // Carrying the block out of Chamber Two returns it to its dispenser.
      aim(world, [-7.5, 0.4, -8]);
      world.controls.get('w07-block')!.activate();
      world.player.teleport([-3, 0, -2], 0);
      idle(world, instance, 0.2);
      expect(handle.getSnapshot().blockCarried).toBe(false);
      expect(handle.getSnapshot().blockReturns).toBe(2);
      expect(handle.getSnapshot().plateLatched).toBe(false);
    } finally {
      world.scope.dispose();
    }
  });

  it('transforms exit velocity deterministically and clamps it', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w07-slingshot-stand')!.activate();
      world.player.teleport([0, 0, -20], 0);
      idle(world, instance, 0.2);
      fireAt(world, PANEL_B1.centre);
      fireAt(world, PANEL_B2.centre);
      const results: number[][] = [];
      for (let k = 0; k < 2; k++) {
        world.player.teleport([-8.4, 0, -17], Math.PI / 2);
        idle(world, instance, 0.5);
        walkTo(world, instance, -11, -17, transitsBy(handle));
        const p = world.player.position, v = world.player.velocity;
        results.push([p.x, p.y, p.z, v.x, v.z, world.player.yaw]);
      }
      expect(results[0]).toEqual(results[1]);
      const [x, , z, vx, vz, yaw] = results[0];
      expect(x).toBeCloseTo(exitPoint(PANEL_B2)[0], 6);
      expect(z).toBeCloseTo(exitPoint(PANEL_B2)[2], 6);
      expect(vx).toBeLessThan(-3);
      expect(Math.abs(vz)).toBeLessThan(1e-6);
      expect(yaw).toBeCloseTo(Math.PI / 2, 6);
      expect(MAX_EXIT_SPEED).toBeLessThanOrEqual(20);
    } finally {
      world.scope.dispose();
    }
  });

  it('reduced motion: the fall-and-fling resolves at once onto the ledge', async () => {
    const world = makeWorld('high', true);
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w07-slingshot-stand')!.activate();
      world.player.teleport([0, 0, -33], 0);
      idle(world, instance, 0.3);
      walkPath(world, instance, ROUTE.toWalkway);
      fireAt(world, PANEL_C2.centre);
      walkPath(world, instance, ROUTE.toShaftLip);
      fireAt(world, PANEL_C1.centre);
      const through = transitsBy(handle);
      walkTo(world, instance, ...ROUTE.offShaftLip[0], through);
      idleUntil(world, instance, through, 3);
      expect(world.player.grounded).toBe(true);
      expect(world.player.position.y).toBeCloseTo(LEDGE_Y, 5);
      expect(handle.getSnapshot().flying).toBe(false);
      idle(world, instance, 0.1);
      expect(handle.getSnapshot().ledgeReached).toBe(true);
      world.controls.get('w07-core')!.activate();
      walkPath(world, instance, ROUTE.toCore);
      world.controls.get('w07-core')!.activate();
      expect(handle.getSnapshot().finaleProgress).toBe(1);
      idle(world, instance, 0.1);
      expect(handle.getSnapshot().completionEligible).toBe(true);
    } finally {
      world.scope.dispose();
    }
  });

  it('dispose releases its dynamic colliders and tracked resources', async () => {
    const world = makeWorld();
    const { instance } = await build(world);
    expect(world.collision.snapshot().filter((c) => c.ownership === 'dynamic').length).toBeGreaterThan(0);
    instance.dispose?.();
    expect(world.collision.snapshot().filter((c) => c.ownership === 'dynamic')).toEqual([]);
    world.scope.dispose();
    expect(world.scope.size).toBe(0);
  });
});

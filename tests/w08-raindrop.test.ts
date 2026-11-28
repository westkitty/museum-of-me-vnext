import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { EYE_HEIGHT, PlayerController } from '../src/player/PlayerController';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext, PocketWorldInstance } from '../src/world/pocket/types';
import { createW08WorldFactory, type W08PreviewHandle } from '../src/world/pocket/w08/createW08World';
import { registerW08Preview } from '../src/world/pocket/w08/registerW08Preview';
import {
  BUBBLE_TOP_Y, CROWN, DROP_CENTRE, EXIT_POS, LENS_HEIGHT, LENSES, MENISCUS_RADIUS, NUCLEUS_POS, PAD_DOCK_T1, PAD_DOCK_T2, PAD_X, PRISM_POS,
  ROUTE, SPAWN, T1, T2, T3, type Vec3,
} from '../src/world/pocket/w08/w08Layout';

const STEP = 1 / 60;
const REACH = 4.2;

/** A real PlayerController on the world's collision, driven by a fake keyboard. */
function makeWorld(quality: 'low' | 'high' = 'high', reducedMotion = false) {
  const scope = new ResourceScope('test-w08');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const keys = new Set<string>();
  const input = { isDown: (a: string) => keys.has(a), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
  const player = new PlayerController(collision, input as never);
  player.teleport([...SPAWN]);
  const controls = new Map<string, { activate(): void; label: string | (() => string) }>();
  const counts = { saves: 0, resets: 0, complete: 0, eligible: 0 };
  let saved: { p: [number, number, number]; yaw: number } | null = null;
  const messages: string[] = [];
  const ctx = {
    scope, collision, root, quality: QUALITY[quality], player, camera: new THREE.PerspectiveCamera(),
    interaction: { register: (id: string, control: { activate(): void; label: string | (() => string) }) => { controls.set(id, control); return () => controls.delete(id); } },
    saveCheckpoint: () => { counts.saves++; saved = { p: [player.position.x, player.position.y, player.position.z], yaw: player.yaw }; return true; },
    resetToCheckpoint: () => {
      counts.resets++;
      if (!saved) return false;
      player.restorePose(saved.p, saved.yaw, 0);
      return true;
    },
    requestComplete: () => { counts.complete++; },
    markCompletionEligible: () => { counts.eligible++; },
    reducedMotion: () => reducedMotion,
    announce: (m: string) => { messages.push(m); },
  } as unknown as PocketWorldContext;
  return { ctx, scope, collision, root, controls, player, keys, counts, messages };
}
type World = ReturnType<typeof makeWorld>;

async function build(world: World) {
  let handle: W08PreviewHandle | undefined;
  const instance = await createW08WorldFactory((h) => { handle = h; })(world.ctx, new AbortController().signal);
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
function walkTo(world: World, instance: PocketWorldInstance, x: number, z: number, maxSeconds = 20, stop: () => boolean = () => false) {
  for (let i = 0; i < maxSeconds / STEP; i++) {
    const p = world.player.position;
    const dx = x - p.x, dz = z - p.z;
    if (Math.hypot(dx, dz) < 0.3 || stop()) break;
    world.player.yaw = Math.atan2(-dx, -dz);
    world.keys.add('forward');
    step(world, instance);
  }
  world.keys.clear();
}
function walkPath(world: World, instance: PocketWorldInstance, path: readonly (readonly [number, number])[]) {
  for (const [x, z] of path) walkTo(world, instance, x, z);
}
/** Activate a control the visitor can actually reach from where they stand. */
function use(world: World, id: string, at: Vec3) {
  const p = world.player.position;
  const d = Math.hypot(at[0] - p.x, at[1] - (p.y + EYE_HEIGHT), at[2] - p.z);
  expect(d, `${id} within reach`).toBeLessThan(REACH);
  world.controls.get(id)!.activate();
}
const lensCentre = (i: number): Vec3 => [LENSES[i].pos[0], LENSES[i].pos[1] + LENS_HEIGHT, LENSES[i].pos[2]];
const label = (world: World, id: string) => {
  const l = world.controls.get(id)!.label;
  return typeof l === 'function' ? l() : l;
};
const near = (world: World, y: number) => Math.abs(world.player.position.y - y) < 0.05 && world.player.grounded;

/** Act I: the first lens sets the Glass Stair; climb it to the Glass Terrace. */
function actOne(world: World, instance: PocketWorldInstance, handle: W08PreviewHandle) {
  walkPath(world, instance, ROUTE.toLens1);
  expect(label(world, 'w08-lens-1')).toBe('Turn the Water Lens (light on the meniscus)');
  use(world, 'w08-lens-1', lensCentre(0));
  expect(handle.getSnapshot().litTargets[0]).toBe('stair');
  // The stair is not there until the seed has been lit for a moment.
  idle(world, instance, 0.5);
  expect(handle.getSnapshot().crystals).toEqual([]);
  idle(world, instance, 0.6);
  expect(handle.getSnapshot().crystals).toEqual(['stair']);
  walkPath(world, instance, ROUTE.toStairFoot);
  walkPath(world, instance, ROUTE.upStair);
  expect(near(world, T1.y)).toBe(true);
  idle(world, instance, 0.1);
  expect(handle.getSnapshot().checkpoints).toEqual(['glass-terrace']);
}

/** Act II: ride the drift pad across; the second lens sets the Glass Span to the Bubble Terrace. */
function actTwo(world: World, instance: PocketWorldInstance, handle: W08PreviewHandle) {
  expect(handle.getSnapshot().padZ).toBe(PAD_DOCK_T1);
  walkPath(world, instance, ROUTE.toPadT1);
  idleUntil(world, instance, () => handle.getSnapshot().padCrossings === 1 && !handle.getSnapshot().padMoving, 10);
  expect(handle.getSnapshot().padZ).toBe(PAD_DOCK_T2);
  expect(near(world, T1.y)).toBe(true);
  // Standing still after arriving does not carry the rider back.
  idle(world, instance, 2);
  expect(handle.getSnapshot().padZ).toBe(PAD_DOCK_T2);
  walkPath(world, instance, ROUTE.offPadT2);
  idle(world, instance, 0.1);
  expect(handle.getSnapshot().checkpoints.at(-1)).toBe('drift-terrace');
  walkPath(world, instance, ROUTE.toLens2);
  use(world, 'w08-lens-2', lensCentre(1));
  expect(label(world, 'w08-lens-2')).toBe('Turn the Water Lens (light on the drift dock)');
  idle(world, instance, 1.2);
  expect(handle.getSnapshot().crystals).toEqual(['stair']);
  use(world, 'w08-lens-2', lensCentre(1));
  idle(world, instance, 1.1);
  expect(handle.getSnapshot().crystals).toEqual(['stair', 'span']);
  walkPath(world, instance, ROUTE.toSpanFoot);
  walkPath(world, instance, ROUTE.upSpan);
  expect(near(world, T3.y)).toBe(true);
  idle(world, instance, 0.1);
  expect(handle.getSnapshot().checkpoints.at(-1)).toBe('bubble-terrace');
}

/** Act III: warm the bubble with the third lens and ride it up to the Crown. */
function actThree(world: World, instance: PocketWorldInstance, handle: W08PreviewHandle) {
  walkPath(world, instance, ROUTE.toLens3);
  expect(handle.getSnapshot().bubble).toBe('asleep');
  use(world, 'w08-lens-3', lensCentre(2));
  idleUntil(world, instance, () => handle.getSnapshot().bubble === 'waiting', 2);
  walkPath(world, instance, ROUTE.intoBubble);
  idleUntil(world, instance, () => handle.getSnapshot().bubble === 'docked', 14);
  expect(world.player.position.y).toBeCloseTo(BUBBLE_TOP_Y, 1);
  walkPath(world, instance, ROUTE.ontoCrown);
  idle(world, instance, 0.1);
  expect(near(world, CROWN.y)).toBe(true);
  expect(handle.getSnapshot().crownReached).toBe(true);
}

describe('W08 World Inside a Raindrop preview', () => {
  it('keeps the production world dormant and confines the factory to preview registration', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.get('W08')?.readiness).toBe('dormant');
    expect(registry.get('W08')?.load).toBeUndefined();
    registerW08Preview(registry);
    expect(registry.isPlayable('W08')).toBe(true);
  });

  it('plays all three acts by real controller physics, then falls, splashes and completes once', async () => {
    for (const quality of ['high', 'low'] as const) {
      const world = makeWorld(quality);
      try {
        const { instance, handle } = await build(world);
        idle(world, instance, 0.2);
        expect(near(world, 0)).toBe(true);
        actOne(world, instance, handle);
        actTwo(world, instance, handle);
        actThree(world, instance, handle);
        expect(label(world, 'w08-exit')).toBe('Surface Ring (closed)');
        walkPath(world, instance, ROUTE.toNucleus);
        use(world, 'w08-nucleus', [NUCLEUS_POS[0], NUCLEUS_POS[1] + 1.4, NUCLEUS_POS[2]]);
        expect(handle.getSnapshot().finaleStarted).toBe(true);
        world.controls.get('w08-exit')!.activate();
        expect(world.counts.complete).toBe(0);
        expect(world.counts.eligible).toBe(0);
        idle(world, instance, 12.2);
        const done = handle.getSnapshot();
        expect(done.finaleProgress).toBe(1);
        expect(done.completionEligible).toBe(true);
        expect(world.counts.eligible).toBe(1);
        walkPath(world, instance, ROUTE.toExit);
        use(world, 'w08-exit', [EXIT_POS[0], EXIT_POS[1] + 1.5, EXIT_POS[2]]);
        world.controls.get('w08-exit')!.activate();
        expect(world.counts.complete).toBe(1);
        expect(done.softFalls).toBe(0);
        expect(done.checkpoints).toEqual(['glass-terrace', 'drift-terrace', 'bubble-terrace', 'crown']);
        expect(done.bubbleRides).toBe(1);
        expect(done.optionalFound).toBe(false);
        // Instance-local visual sync never throws, before and after the splash.
        instance.variableUpdate?.(0.016, [0, 0, 0]);
      } finally {
        world.scope.dispose();
      }
    }
  });

  it('lights the far prism for the optional rainbow seed; set walkways stay set when a lens turns away', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      idle(world, instance, 0.2);
      walkPath(world, instance, ROUTE.toLens1);
      use(world, 'w08-lens-1', lensCentre(0));
      idle(world, instance, 1.1);
      expect(handle.getSnapshot().crystals).toEqual(['stair']);
      use(world, 'w08-lens-1', lensCentre(0));
      expect(handle.getSnapshot().prismLit).toBe(true);
      idle(world, instance, 0.2);
      expect(handle.getSnapshot().crystals).toEqual(['stair']);
      walkPath(world, instance, ROUTE.toPrism);
      use(world, 'w08-rainbow-seed', [PRISM_POS[0], 1.65, PRISM_POS[2]]);
      expect(handle.getSnapshot().optionalFound).toBe(true);
      expect(label(world, 'w08-rainbow-seed')).toBe('Rainbow Seed Gathered');
      // A full turn brings the lens back to its harmless pool.
      world.controls.get('w08-lens-1')!.activate();
      expect(handle.getSnapshot().lensAims[0]).toBe(0);
      // The seed cannot be gathered in the dark (fresh visit).
      const fresh = makeWorld();
      try {
        const second = await build(fresh);
        fresh.controls.get('w08-rainbow-seed')!.activate();
        expect(second.handle.getSnapshot().optionalFound).toBe(false);
        expect(fresh.messages.at(-1)).toMatch(/prism is dark/);
      } finally {
        fresh.scope.dispose();
      }
    } finally {
      world.scope.dispose();
    }
  });

  it('forgives falls and missteps: soft landings return to the terrace, the pad comes to the visitor, the bubble returns', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      idle(world, instance, 0.2);
      // The meniscus ring holds the visitor inside the drop.
      walkTo(world, instance, DROP_CENTRE[0] + 40, DROP_CENTRE[2], 12);
      expect(Math.hypot(world.player.position.x - DROP_CENTRE[0], world.player.position.z - DROP_CENTRE[2])).toBeLessThan(MENISCUS_RADIUS);
      world.player.teleport([...SPAWN], 0);
      idle(world, instance, 0.2);
      // A sleeping bubble cannot be ridden; a walkway cannot be walked before it sets.
      actOne(world, instance, handle);
      // Walking off the terrace edge: a soft landing back on the Glass Terrace.
      walkTo(world, instance, -21.5, -2, 6, () => handle.getSnapshot().softFalls === 1);
      expect(handle.getSnapshot().softFalls).toBe(1);
      expect(near(world, T1.y)).toBe(true);
      // Walking down the stair is not a fall.
      walkPath(world, instance, [[-11.5, 0], [-2, 0]]);
      expect(near(world, 0)).toBe(true);
      expect(handle.getSnapshot().softFalls).toBe(1);
      // From the meniscus the pad waits at the Glass Terrace; from the Drift Terrace it comes over on its own.
      expect(handle.getSnapshot().padZ).toBe(PAD_DOCK_T1);
      world.player.teleport([-14.5, T2.y, -21], 0);
      idleUntil(world, instance, () => handle.getSnapshot().padZ === PAD_DOCK_T2, 8);
      expect(handle.getSnapshot().padCrossings).toBe(0);
      // Stepping off the pad mid-crossing is a soft fall, never a dead end.
      walkTo(world, instance, PAD_X, PAD_DOCK_T2);
      idleUntil(world, instance, () => handle.getSnapshot().padMoving, 2);
      idle(world, instance, 1.5);
      walkTo(world, instance, -11, handle.getSnapshot().padZ, 3, () => handle.getSnapshot().softFalls === 2);
      idleUntil(world, instance, () => handle.getSnapshot().softFalls === 2, 3);
      expect(world.player.position.y).toBeGreaterThan(3.9);
      // The bubble: asleep until lit, then up, then back down for a visitor left below.
      world.player.teleport([9, T3.y, -26], 0);
      idle(world, instance, 1.5);
      expect(handle.getSnapshot().bubble).toBe('asleep');
      expect(handle.getSnapshot().bubbleRides).toBe(0);
      world.player.teleport([4.6, T3.y, -22.2], 0);
      idle(world, instance, 0.2);
      use(world, 'w08-lens-3', lensCentre(2));
      walkPath(world, instance, ROUTE.intoBubble);
      idleUntil(world, instance, () => handle.getSnapshot().bubble === 'docked', 14);
      world.player.teleport([5, T3.y, -24], 0);
      idleUntil(world, instance, () => handle.getSnapshot().bubble === 'waiting', 10);
      expect(handle.getSnapshot().bubbleY).toBe(T3.y);
      // Touching the mote before reaching the Crown does nothing.
      world.controls.get('w08-nucleus')!.activate();
      expect(handle.getSnapshot().finaleStarted).toBe(false);
    } finally {
      world.scope.dispose();
    }
  });

  it('is deterministic: two identical runs of Act I and II end in the same pose', async () => {
    const poses: number[][] = [];
    for (let k = 0; k < 2; k++) {
      const world = makeWorld();
      try {
        const { instance, handle } = await build(world);
        idle(world, instance, 0.2);
        actOne(world, instance, handle);
        actTwo(world, instance, handle);
        const p = world.player.position;
        poses.push([p.x, p.y, p.z, handle.getSnapshot().padZ]);
      } finally {
        world.scope.dispose();
      }
    }
    expect(poses[0]).toEqual(poses[1]);
  });

  it('reduced motion: the pad crosses, the bubble rises and the drop falls at once', async () => {
    const world = makeWorld('high', true);
    try {
      const { instance, handle } = await build(world);
      idle(world, instance, 0.2);
      actOne(world, instance, handle);
      walkPath(world, instance, ROUTE.toPadT1);
      idle(world, instance, 0.7);
      expect(handle.getSnapshot().padZ).toBe(PAD_DOCK_T2);
      expect(handle.getSnapshot().padCrossings).toBe(1);
      walkPath(world, instance, ROUTE.offPadT2);
      walkPath(world, instance, ROUTE.toLens2);
      use(world, 'w08-lens-2', lensCentre(1));
      use(world, 'w08-lens-2', lensCentre(1));
      idle(world, instance, 1.1);
      walkPath(world, instance, ROUTE.toSpanFoot);
      walkPath(world, instance, ROUTE.upSpan);
      walkPath(world, instance, ROUTE.toLens3);
      use(world, 'w08-lens-3', lensCentre(2));
      idle(world, instance, 1.3);
      walkPath(world, instance, ROUTE.intoBubble);
      idle(world, instance, 0.9);
      expect(handle.getSnapshot().bubble).toBe('docked');
      expect(near(world, BUBBLE_TOP_Y)).toBe(true);
      walkPath(world, instance, ROUTE.ontoCrown);
      walkPath(world, instance, ROUTE.toNucleus);
      idle(world, instance, 0.1);
      use(world, 'w08-nucleus', [NUCLEUS_POS[0], NUCLEUS_POS[1] + 1.4, NUCLEUS_POS[2]]);
      expect(handle.getSnapshot().finaleProgress).toBe(1);
      idle(world, instance, 0.1);
      expect(handle.getSnapshot().completionEligible).toBe(true);
      expect(handle.getSnapshot().softFalls).toBe(0);
      instance.variableUpdate?.(0.016, [0, 0, 0]);
    } finally {
      world.scope.dispose();
    }
  });

  it('dispose releases its dynamic floors and tracked resources', async () => {
    const world = makeWorld();
    const { instance } = await build(world);
    expect(world.collision.snapshot().filter((c) => c.ownership === 'dynamic').length).toBeGreaterThan(0);
    instance.dispose?.();
    expect(world.collision.snapshot().filter((c) => c.ownership === 'dynamic')).toEqual([]);
    world.scope.dispose();
    expect(world.scope.size).toBe(0);
  });
});

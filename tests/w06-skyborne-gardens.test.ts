import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { PlayerController } from '../src/player/PlayerController';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext, PocketWorldInstance } from '../src/world/pocket/types';
import { createW06WorldFactory, type W06PreviewHandle } from '../src/world/pocket/w06/createW06World';
import { registerW06Preview } from '../src/world/pocket/w06/registerW06Preview';
import {
  CAIRN_POS, GATE_APPROACH, GATE_POS, GLIDE_SINK, GREAT_THERMAL, HOVER, LANTERN_POS, MEADOW, ORCHARD, PARASOL_POS, PAVILION,
  ROUTE, SPAWN, SPIRE, SUMMIT, TERRACE, UPDRAFT_A,
} from '../src/world/pocket/w06/w06Layout';

const STEP = 1 / 60;

/** A real PlayerController on the world's collision, driven by a fake keyboard. */
function makeWorld(quality: 'low' | 'high' = 'high', reducedMotion = false) {
  const scope = new ResourceScope('test-w06');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const keys = new Set<string>();
  const input = { isDown: (a: string) => keys.has(a), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
  const player = new PlayerController(collision, input as never);
  player.teleport([...SPAWN]);
  const controls = new Map<string, { activate(): void; label: string | (() => string) }>();
  const counts = { saves: 0, resets: 0, complete: 0, eligible: 0 };
  const ctx = {
    scope, collision, root, quality: QUALITY[quality], player,
    interaction: { register: (id: string, control: { activate(): void; label: string | (() => string) }) => { controls.set(id, control); return () => controls.delete(id); } },
    saveCheckpoint: () => { counts.saves++; return true; },
    resetToCheckpoint: () => { counts.resets++; player.teleport([...SPAWN]); return true; },
    requestComplete: () => { counts.complete++; },
    markCompletionEligible: () => { counts.eligible++; },
    reducedMotion: () => reducedMotion,
    announce: () => {},
  } as unknown as PocketWorldContext;
  return { ctx, scope, collision, root, controls, player, keys, counts };
}
type World = ReturnType<typeof makeWorld>;

async function build(world: World) {
  let handle: W06PreviewHandle | undefined;
  const instance = await createW06WorldFactory((h) => { handle = h; })(world.ctx, new AbortController().signal);
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
/** Walk (real physics, real wind) toward (x, z) until within 0.4 m; returns the worst sink speed seen. */
function walkTo(world: World, instance: PocketWorldInstance, x: number, z: number, maxSeconds = 20): number {
  let worstSink = 0;
  for (let i = 0; i < maxSeconds / STEP; i++) {
    const p = world.player.position;
    const dx = x - p.x, dz = z - p.z;
    if (Math.hypot(dx, dz) < 0.4) break;
    world.player.yaw = Math.atan2(-dx, -dz);
    world.keys.add('forward');
    step(world, instance);
    worstSink = Math.min(worstSink, world.player.velocity.y);
  }
  world.keys.clear();
  return worstSink;
}
function idleUntil(world: World, instance: PocketWorldInstance, pred: () => boolean, maxSeconds = 15) {
  world.keys.clear();
  for (let i = 0; i < maxSeconds / STEP && !pred(); i++) step(world, instance);
  expect(pred()).toBe(true);
}
const settled = (world: World, y: number) => world.player.grounded && Math.abs(world.player.position.y - y) < 0.02;

/** Acts I–III by real controller physics: parasol, glide, updrafts, thermal, summit. */
function playRoute(world: World, instance: PocketWorldInstance, handle: W06PreviewHandle) {
  for (const [x, z] of ROUTE.toParasol.slice(1)) walkTo(world, instance, x, z);
  expect(Math.hypot(world.player.position.x - PARASOL_POS[0], world.player.position.z - PARASOL_POS[2])).toBeLessThan(3.6);
  world.controls.get('w06-parasol')!.activate();
  walkTo(world, instance, ...ROUTE.toLip[0]);
  const sink = walkTo(world, instance, ...ROUTE.glideToOrchard[0]);
  expect(sink).toBeGreaterThanOrEqual(-GLIDE_SINK - 1e-6);
  idleUntil(world, instance, () => settled(world, ORCHARD.y));
  walkTo(world, instance, ...ROUTE.intoUpdraftA[0]);
  idleUntil(world, instance, () => world.player.position.y > UPDRAFT_A.top);
  for (const [x, z] of ROUTE.ontoTerrace) walkTo(world, instance, x, z);
  idleUntil(world, instance, () => settled(world, TERRACE.y));
  walkTo(world, instance, ...ROUTE.intoUpdraftB[0]);
  idleUntil(world, instance, () => world.player.position.y > PAVILION.y);
  for (const [x, z] of ROUTE.ontoPavilion) walkTo(world, instance, x, z);
  idleUntil(world, instance, () => settled(world, PAVILION.y));
  walkTo(world, instance, ...ROUTE.toPavilionLip[0]);
  walkTo(world, instance, ...ROUTE.glideIntoThermal[0]);
  idleUntil(world, instance, () => world.player.position.y > GREAT_THERMAL.top);
  for (const [x, z] of ROUTE.ontoSummit) walkTo(world, instance, x, z);
  idleUntil(world, instance, () => settled(world, SUMMIT.y));
  expect(handle.getSnapshot().checkpoints).toEqual(['cloud-orchard', 'wind-terrace', 'sky-pavilion', 'summit-garden']);
}

describe('W06 Skyborne Gardens preview', () => {
  it('keeps the production world dormant and confines the factory to preview registration', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.get('W06')?.readiness).toBe('dormant');
    expect(registry.get('W06')?.load).toBeUndefined();
    registerW06Preview(registry);
    expect(registry.isPlayable('W06')).toBe(true);
  });

  it('gates the meadow lip until a parasol is taken; with it, a walk off the lip is a slow glide onto the orchard', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      idle(world, instance, 0.2);
      world.player.teleport([0, 0, 13]);
      walkTo(world, instance, 0, 2, 3);
      expect(world.player.position.y).toBe(MEADOW.y);
      expect(world.player.position.z).toBeGreaterThan(11);
      world.controls.get('w06-parasol')!.activate();
      expect(handle.getSnapshot().lipOpen).toBe(true);
      const sink = walkTo(world, instance, ...ROUTE.glideToOrchard[0]);
      expect(sink).toBeGreaterThanOrEqual(-GLIDE_SINK - 1e-6);
      idleUntil(world, instance, () => settled(world, ORCHARD.y));
      expect(handle.getSnapshot().checkpoints).toEqual(['cloud-orchard']);
      expect(world.counts.resets).toBe(0);
    } finally {
      world.scope.dispose();
    }
  });

  it('lifts a rider in an updraft to a hover level with the upper island, then steers them onto it', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w06-parasol')!.activate();
      world.player.teleport([UPDRAFT_A.cx, ORCHARD.y, UPDRAFT_A.cz]);
      idle(world, instance, 1);
      expect(handle.getSnapshot().updraft).toBe('orchard-updraft');
      expect(world.player.grounded).toBe(false);
      idle(world, instance, 3.5);
      expect(world.player.position.y).toBeGreaterThan(UPDRAFT_A.top);
      expect(world.player.position.y).toBeLessThan(UPDRAFT_A.top + HOVER + 0.05);
      for (const [x, z] of ROUTE.ontoTerrace) walkTo(world, instance, x, z);
      idleUntil(world, instance, () => settled(world, TERRACE.y));
      expect(handle.getSnapshot().checkpoints).toContain('wind-terrace');
    } finally {
      world.scope.dispose();
    }
  });

  it('plays every leg of the route with real controller physics on both tiers, and the spire leg returns to the terrace', async () => {
    for (const tier of ['low', 'high'] as const) {
      const world = makeWorld(tier);
      try {
        const { instance, handle } = await build(world);
        playRoute(world, instance, handle);
        expect(Math.hypot(world.player.position.x - CAIRN_POS[0], world.player.position.z - CAIRN_POS[2])).toBeLessThan(3.6);
        walkTo(world, instance, ...GATE_APPROACH);
        expect(Math.hypot(GATE_APPROACH[0] - GATE_POS[0], GATE_APPROACH[1] - GATE_POS[2])).toBeLessThan(3.6);
        expect(world.counts.resets).toBe(0);
      } finally {
        world.scope.dispose();
      }
    }
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w06-parasol')!.activate();
      world.player.teleport([0, TERRACE.y, -20]);
      idle(world, instance, 0.3);
      walkTo(world, instance, ...ROUTE.intoSpireUpdraft[0]);
      idleUntil(world, instance, () => world.player.position.y > SPIRE.y);
      walkTo(world, instance, ...ROUTE.ontoSpire[0]);
      idleUntil(world, instance, () => settled(world, SPIRE.y));
      expect(Math.hypot(world.player.position.x - LANTERN_POS[0], world.player.position.z - LANTERN_POS[2])).toBeLessThan(3.6);
      world.controls.get('w06-lantern')!.activate();
      expect(handle.getSnapshot().lanternFound).toBe(true);
      for (const [x, z] of ROUTE.backToTerrace) walkTo(world, instance, x, z);
      idleUntil(world, instance, () => settled(world, TERRACE.y));
      expect(world.counts.resets).toBe(0);
    } finally {
      world.scope.dispose();
    }
  });

  it('turns a missed glide into a soft return, and never glides without a parasol', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.player.teleport([30, 0, 0]);
      let worst = 0;
      for (let i = 0; i < 90; i++) { step(world, instance); worst = Math.min(worst, world.player.velocity.y); }
      expect(worst).toBeLessThan(-GLIDE_SINK - 1);
      idle(world, instance, 1);
      expect(world.counts.resets).toBe(1);
      expect(settled(world, MEADOW.y)).toBe(true);
      expect(handle.getSnapshot().fallResets).toBe(1);
    } finally {
      world.scope.dispose();
    }
  });

  it('starts the Great Migration only at the summit with the parasol, and completes once after the finale', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      const cairn = world.controls.get('w06-cairn')!;
      const gate = world.controls.get('w06-return-gate')!;
      world.player.teleport([0, SUMMIT.y, -68.2]);
      idle(world, instance, 0.2);
      expect(handle.getSnapshot().summitReached).toBe(true);
      cairn.activate();
      expect(handle.getSnapshot().finaleStarted).toBe(false); // no parasol
      world.controls.get('w06-parasol')!.activate();
      cairn.activate();
      expect(handle.getSnapshot().finaleStarted).toBe(true);
      gate.activate();
      idle(world, instance, 5);
      expect(world.counts.complete).toBe(0);
      idle(world, instance, 5.2);
      expect(handle.getSnapshot().completionEligible).toBe(true);
      gate.activate();
      gate.activate();
      expect(world.counts.complete).toBe(1);
      expect(world.counts.eligible).toBe(1);
    } finally {
      world.scope.dispose();
      expect(world.scope.size).toBe(0);
    }
  });

  it('reduced motion places an updraft rider at the hover height at once and completes the finale at once', async () => {
    const world = makeWorld('high', true);
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w06-parasol')!.activate();
      world.player.teleport([UPDRAFT_A.cx, ORCHARD.y, UPDRAFT_A.cz]);
      step(world, instance);
      expect(world.player.position.y).toBeCloseTo(UPDRAFT_A.top + HOVER, 5);
      world.player.teleport([0, SUMMIT.y, -68.2]);
      idle(world, instance, 0.1);
      world.controls.get('w06-cairn')!.activate();
      idle(world, instance, 0.05);
      expect(handle.getSnapshot().completionEligible).toBe(true);
    } finally {
      world.scope.dispose();
    }
  });

  it('scales scenery with the quality tier and releases every dynamic collider on dispose', async () => {
    const counts: number[] = [];
    for (const tier of ['low', 'high'] as const) {
      const world = makeWorld(tier);
      const { instance } = await build(world);
      let n = 0;
      world.root.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) n += (o as THREE.InstancedMesh).count; });
      counts.push(n);
      instance.dispose?.();
      expect(world.collision.snapshot().filter((c) => c.ownership === 'dynamic')).toEqual([]);
      world.scope.dispose();
      expect(world.scope.size).toBe(0);
    }
    expect(counts[0]).toBeLessThan(counts[1]);
  });
});

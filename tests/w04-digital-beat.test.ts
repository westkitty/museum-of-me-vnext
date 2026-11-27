import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext, PocketWorldInstance } from '../src/world/pocket/types';
import { createW04WorldFactory, type W04PreviewHandle } from '../src/world/pocket/w04/createW04World';
import { registerW04Preview } from '../src/world/pocket/w04/registerW04Preview';
import { eqBarRect, GATE_APPROACH, MEZZANINE, PAD_POSITIONS, PAD_STAND, ROUTE, STAGE } from '../src/world/pocket/w04/w04Layout';

function makeWorld(quality: 'low' | 'high' = 'high', reducedMotion = false) {
  const scope = new ResourceScope('test-w04');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const controls = new Map<string, { activate(): void; label: string | (() => string) }>();
  const player = {
    position: new THREE.Vector3(0, 0, 24), grounded: true, yaw: 0,
    shift(dx: number, dy: number, dz: number) { this.position.x += dx; this.position.y += dy; this.position.z += dz; },
  };
  const counts = { saves: 0, resets: 0, complete: 0, eligible: 0 };
  const ctx = {
    scope, collision, root, quality: QUALITY[quality], player,
    interaction: { register: (id: string, control: { activate(): void; label: string | (() => string) }) => { controls.set(id, control); return () => controls.delete(id); } },
    saveCheckpoint: () => { counts.saves++; return true; },
    resetToCheckpoint: () => { counts.resets++; return true; },
    requestComplete: () => { counts.complete++; },
    markCompletionEligible: () => { counts.eligible++; },
    reducedMotion: () => reducedMotion,
    announce: () => {},
  } as unknown as PocketWorldContext;
  return { ctx, scope, collision, root, controls, player, counts };
}

async function build(world: ReturnType<typeof makeWorld>) {
  let handle: W04PreviewHandle | undefined;
  const instance = await createW04WorldFactory((h) => { handle = h; })(world.ctx, new AbortController().signal);
  return { instance, handle: handle! };
}

const STEP = 1 / 60;
function tick(instance: PocketWorldInstance, seconds: number) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) instance.fixedUpdate?.(STEP, [0, 0, 0]);
}

/** Walk a polyline in 0.25 m steps: every step supported within a step-up and wall-free. */
/** `probeDrop`: how far below support the wall-free probe sits (0.2 on slopes; flat steps keep feet on the step). */
function assertWalkable(collision: CollisionWorld, path: readonly (readonly [number, number])[], startY: number, probeDrop = 0.2) {
  let y = startY;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25);
    for (let s = 1; s <= steps; s++) {
      const x = ax + ((bx - ax) * s) / steps;
      const z = az + ((bz - az) * s) / steps;
      const support = collision.supportHeight(x, z, y);
      expect(support, `support at ${x.toFixed(2)},${z.toFixed(2)} from y=${y.toFixed(2)}`).not.toBeNull();
      expect(Math.abs(support! - y)).toBeLessThanOrEqual(0.55);
      y = support!;
      const probe = { x, y: y - probeDrop, z };
      collision.resolveHorizontal(probe, 0.35, 1.7);
      expect(Math.hypot(probe.x - x, probe.z - z), `wall-free at ${x.toFixed(2)},${z.toFixed(2)}`).toBeLessThan(1e-6);
    }
  }
  return y;
}

function blocked(collision: CollisionWorld, x: number, y: number, z: number): boolean {
  const probe = { x, y, z };
  collision.resolveHorizontal(probe, 0.35, 1.7);
  return Math.hypot(probe.x - x, probe.z - z) > 1e-3;
}


const PLAZA_TO_DECK: readonly (readonly [number, number])[] = [[0, 24], [0, 17], ...ROUTE.acrossBridge];

describe('W04 Digital Beat World preview', () => {
  it('keeps the production world dormant and confines the factory to preview registration', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.get('W04')?.readiness).toBe('dormant');
    expect(registry.get('W04')?.load).toBeUndefined();
    registerW04Preview(registry);
    expect(registry.isPlayable('W04')).toBe(true);
  });

  it('keeps the bridge gap unsupported and walled until beats are recorded; segments support only when fully risen', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      expect(world.collision.supportHeight(0, 12, 0)).toBeNull();
      expect(blocked(world.collision, 0, 0, 15.9)).toBe(true);
      world.controls.get('w04-pad-0')!.activate();
      expect(handle.getSnapshot().bridgeSegmentsUp).toBe(0);
      expect(world.collision.supportHeight(0, 15, 0)).toBeNull();
      tick(instance, 0.4);
      expect(world.collision.supportHeight(0, 15, 0)).toBeNull();
      tick(instance, 0.4);
      expect(handle.getSnapshot().bridgeSegmentsUp).toBe(2);
      expect(world.collision.supportHeight(0, 13, 0)).toBe(0);
      // The far end of the risen pair is walled while segment 2 is missing.
      expect(blocked(world.collision, 0, 0, 11.9)).toBe(true);
      // Recording out of order never opens a walkable gap.
      world.controls.get('w04-pad-2')!.activate();
      tick(instance, 1);
      expect(world.collision.supportHeight(0, 10, 0)).toBeNull();
      expect(blocked(world.collision, 0, 0, 11.9)).toBe(true);
      world.controls.get('w04-pad-1')!.activate();
      world.controls.get('w04-pad-3')!.activate();
      world.controls.get('w04-pad-3')!.activate();
      tick(instance, 1);
      const snap = handle.getSnapshot();
      expect(snap.bridgeComplete).toBe(true);
      expect(snap.beatsRecorded).toEqual([true, true, true, true]);
      assertWalkable(world.collision, PLAZA_TO_DECK, 0);
    } finally {
      world.scope.dispose();
    }
  });

  it('shapes the EQ bars from presets: only Rise forms a stair, and a rider is carried with a moving bar', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      const eq = world.controls.get('w04-eq-console')!;
      // Flat: the mezzanine face blocks the way up.
      expect(blocked(world.collision, 0, 0, MEZZANINE.maxZ + 0.2)).toBe(true);
      world.player.position.set(0, 0, (eqBarRect(3).minZ + eqBarRect(3).maxZ) / 2);
      eq.activate();
      tick(instance, 2);
      const wave = handle.getSnapshot();
      expect(wave.eqPreset).toBe('wave');
      expect(wave.eqSettled).toBe(true);
      expect(world.player.position.y).toBeCloseTo(wave.eqHeights[3], 5);
      // A wave bar taller than a step is a wall, never a hole.
      const tall = wave.eqHeights.findIndex((h, i) => i > 0 && h - wave.eqHeights[i - 1] > 0.6);
      expect(tall).toBeGreaterThan(0);
      const r = eqBarRect(tall);
      expect(blocked(world.collision, 0, wave.eqHeights[tall - 1], r.maxZ + 0.2)).toBe(true);
      eq.activate();
      tick(instance, 2);
      const rise = handle.getSnapshot();
      expect(rise.eqPreset).toBe('rise');
      expect(world.player.position.y).toBeCloseTo(2, 5);
      expect(assertWalkable(world.collision, [[0, -13], ...ROUTE.upStair.slice(1)], 0, 0.02)).toBe(MEZZANINE.y);
    } finally {
      world.scope.dispose();
    }
  });

  it('supports every leg of the route, the pad stand and the B-side alcove, step by step, on both tiers', async () => {
    for (const tier of ['low', 'high'] as const) {
      const world = makeWorld(tier, true);
      try {
        await build(world);
        for (let i = 0; i < 4; i++) world.controls.get(`w04-pad-${i}`)!.activate();
        world.controls.get('w04-eq-console')!.activate();
        world.controls.get('w04-eq-console')!.activate();
        assertWalkable(world.collision, ROUTE.toPads, 0);
        for (const [x, , z] of PAD_POSITIONS) expect(Math.hypot(x - PAD_STAND[0], z - PAD_STAND[1])).toBeLessThan(3.6);
        assertWalkable(world.collision, PLAZA_TO_DECK, 0);
        assertWalkable(world.collision, [[0, -2], ...ROUTE.toConsole, ...ROUTE.upStair], 0, 0.02);
        expect(assertWalkable(world.collision, [[0, -31], ...ROUTE.toStage, [GATE_APPROACH[0], GATE_APPROACH[1]]], MEZZANINE.y)).toBe(STAGE.y);
        assertWalkable(world.collision, [[0, -7], ...ROUTE.bside], 0);
      } finally {
        world.scope.dispose();
      }
    }
  });

  it('plays the Drop only on the Stage and completes once, after the finale', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      const master = world.controls.get('w04-master')!;
      const gate = world.controls.get('w04-return-gate')!;
      master.activate();
      gate.activate();
      expect(handle.getSnapshot().finaleStarted).toBe(false);
      world.player.position.set(0, 10, -57.5);
      tick(instance, 0.1);
      expect(handle.getSnapshot().stageReached).toBe(true);
      master.activate();
      tick(instance, 5);
      expect(handle.getSnapshot().completionEligible).toBe(false);
      gate.activate();
      expect(world.counts.complete).toBe(0);
      tick(instance, 5.5);
      expect(handle.getSnapshot().completionEligible).toBe(true);
      gate.activate();
      gate.activate();
      expect(world.counts.complete).toBe(1);
      expect(world.counts.eligible).toBe(1);
      world.player.position.y = -9;
      instance.fixedUpdate?.(STEP, [0, 0, 0]);
      expect(world.counts.resets).toBe(1);
    } finally {
      world.scope.dispose();
      expect(world.scope.size).toBe(0);
    }
  });

  it('reduced motion raises segments, sets the stair and plays the Drop at once', async () => {
    const world = makeWorld('high', true);
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w04-pad-0')!.activate();
      expect(handle.getSnapshot().bridgeSegmentsUp).toBe(2);
      world.controls.get('w04-eq-console')!.activate();
      world.controls.get('w04-eq-console')!.activate();
      expect(handle.getSnapshot().eqHeights[11]).toBe(6);
      world.player.position.set(0, 10, -57.5);
      tick(instance, 0.1);
      world.controls.get('w04-master')!.activate();
      tick(instance, 0.05);
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

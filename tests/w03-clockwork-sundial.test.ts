import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext, PocketWorldInstance } from '../src/world/pocket/types';
import { createW03WorldFactory, type W03PreviewHandle } from '../src/world/pocket/w03/createW03World';
import { registerW03Preview } from '../src/world/pocket/w03/registerW03Preview';
import {
  ARM_PERIOD, armAligned, armAngle, CROWN, GATE_APPROACH, LATCH_ROUTE, latchApproach, latchOpen, liftPhase, liftY,
  ROUTE, SHUTTLE_PERIOD, shuttleDock, shuttleZ, SUN_HAND_PERIOD,
} from '../src/world/pocket/w03/w03Layout';

function makeWorld(quality: 'low' | 'high' = 'high', reducedMotion = false) {
  const scope = new ResourceScope('test-w03');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const controls = new Map<string, { activate(): void; label: string | (() => string) }>();
  const player = {
    position: new THREE.Vector3(0, 0, 30), grounded: true, yaw: 0,
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
  let handle: W03PreviewHandle | undefined;
  const instance = await createW03WorldFactory((h) => { handle = h; })(world.ctx, new AbortController().signal);
  return { instance, handle: handle! };
}

const STEP = 1 / 60;
function tick(instance: PocketWorldInstance, seconds: number) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) instance.fixedUpdate?.(STEP, [0, 0, 0]);
}
function tickUntil(instance: PocketWorldInstance, done: () => boolean, maxSeconds = 60) {
  for (let i = 0; i < maxSeconds / STEP; i++) {
    if (done()) return;
    instance.fixedUpdate?.(STEP, [0, 0, 0]);
  }
  throw new Error('condition never reached');
}

/** Walk a polyline in 0.25 m steps: every step supported within a step-up and wall-free. */
function assertWalkable(collision: CollisionWorld, path: readonly (readonly [number, number])[], startY: number) {
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
      const probe = { x, y: y - 0.2, z };
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

describe('W03 Clockwork Sundial preview', () => {
  it('keeps the production world dormant and confines the factory to preview registration', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.get('W03')?.readiness).toBe('dormant');
    expect(registry.get('W03')?.load).toBeUndefined();
    registerW03Preview(registry);
    expect(registry.isPlayable('W03')).toBe(true);
  });

  it('anchors on the existing bronze gnomon without changing its geometry or dormant message', () => {
    const exterior = new ExteriorWorld('low');
    try {
      const messages: string[] = [];
      const control = exterior.getSundialPortalControl((message) => messages.push(message));
      const p = control.object.position;
      expect([p.x, p.z]).toEqual([-34, 134]);
      expect(p.y).toBeCloseTo(0.02, 5);
      expect((control.object as THREE.Mesh).geometry).toBeInstanceOf(THREE.CylinderGeometry);
      control.activate();
      expect(messages[0]).toContain('not open yet');
    } finally {
      exterior.dispose();
    }
  });

  it('runs a continuous, deterministic machine schedule with published safe windows', () => {
    for (let t = 0; t < 3 * ARM_PERIOD; t += STEP) {
      expect(Math.abs(armAngle(t + STEP) - armAngle(t))).toBeLessThan(0.02);
      if (armAligned(t)) expect(Math.abs(Math.sin(armAngle(t)))).toBeLessThan(1e-9);
      expect(Math.abs(liftY(t + STEP) - liftY(t))).toBeLessThan(0.05);
      expect(liftY(t)).toBeGreaterThanOrEqual(0);
      expect(liftY(t)).toBeLessThanOrEqual(5);
      expect(Math.abs(shuttleZ(t + STEP) - shuttleZ(t))).toBeLessThan(0.1);
      if (shuttleDock(t) === 'A') expect(shuttleZ(t)).toBe(-12);
      if (shuttleDock(t) === 'B') expect(shuttleZ(t)).toBe(-26);
      if (liftPhase(t) === 'bottom') expect(liftY(t)).toBe(0);
      if (liftPhase(t) === 'top') expect(liftY(t)).toBe(5);
    }
    // Each latch opens once per shadow sweep for a generous ~3.5 s.
    for (let i = 0; i < 3; i++) {
      let open = 0;
      for (let t = 0; t < SUN_HAND_PERIOD; t += STEP) if (latchOpen(t, i)) open += STEP;
      expect(open).toBeGreaterThan(3.3);
      expect(open).toBeLessThan(3.8);
    }
    void SHUTTLE_PERIOD;
  });

  it('supports the turnstile only while it is aligned, and gates both landings otherwise', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.player.position.set(0, 0, 30);
      expect(handle.getSnapshot().armAligned).toBe(true);
      assertWalkable(world.collision, [...ROUTE.toArm, ...ROUTE.acrossArm, ...ROUTE.toLift], 0);
      tickUntil(instance, () => !handle.getSnapshot().armAligned);
      tick(instance, 3);
      const turned = handle.getSnapshot();
      expect(turned.armAligned).toBe(false);
      expect(world.collision.supportHeight(0, 18, 0)).toBeNull();
      expect(blocked(world.collision, 0, 0, 22.2)).toBe(true);
      expect(blocked(world.collision, 0, 0, 3.8)).toBe(true);
    } finally {
      world.scope.dispose();
    }
  });

  it('carries a rider round with the turning arm, facing included, and keeps every edge walled', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.player.position.set(0, 0, 17);
      tickUntil(instance, () => !handle.getSnapshot().armAligned && Math.abs(Math.sin(handle.getSnapshot().armAngle) - 1) < 1e-9, 20);
      const p = world.player.position;
      expect(p.x).toBeCloseTo(4, 3);
      expect(p.z).toBeCloseTo(13, 3);
      expect(world.player.yaw).toBeCloseTo(Math.PI / 2, 3);
      expect(world.collision.supportHeight(p.x, p.z, 0)).toBe(0);
      // Both ends of the arm are closed while it points east–west.
      expect(blocked(world.collision, 8.9, 0, 13)).toBe(true);
      expect(blocked(world.collision, -8.9, 0, 13)).toBe(true);
    } finally {
      world.scope.dispose();
    }
  });

  it('lifts and shuttles riders with gates closed whenever a crossing is away', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.player.position.set(8, 0, -4);
      tickUntil(instance, () => handle.getSnapshot().liftPhase === 'rising');
      expect(blocked(world.collision, 5.8, 0, -4)).toBe(true);
      tickUntil(instance, () => handle.getSnapshot().liftPhase === 'top');
      expect(world.player.position.y).toBeCloseTo(5, 5);
      assertWalkable(world.collision, [[8, -4], ...ROUTE.offLift], 5);

      tickUntil(instance, () => handle.getSnapshot().shuttleDock === 'A');
      world.player.position.set(17, 5, -12);
      tickUntil(instance, () => handle.getSnapshot().shuttleDock === null);
      expect(blocked(world.collision, 17, 5, -9.9)).toBe(true);
      expect(blocked(world.collision, 17, 5, -28.1)).toBe(true);
      tickUntil(instance, () => handle.getSnapshot().shuttleDock === 'B');
      expect(world.player.position.z).toBeCloseTo(-26, 3);
      assertWalkable(world.collision, [[17, -26], ...ROUTE.offShuttle, ...ROUTE.ontoGearAndRamp, ...ROUTE.toCage], 5);
    } finally {
      world.scope.dispose();
    }
  });

  it('supports the crown latch circuit, the sun gate approach and the optional alcove, step by step', async () => {
    for (const tier of ['low', 'high'] as const) {
      const world = makeWorld(tier, true);
      try {
        await build(world);
        const path: [number, number][] = [[-15, -51]];
        for (const leg of LATCH_ROUTE) path.push(...leg.via.map(([x, z]) => [x, z] as [number, number]));
        path.push([GATE_APPROACH[0], GATE_APPROACH[1]]);
        expect(assertWalkable(world.collision, path, CROWN.y)).toBe(CROWN.y);
        for (const leg of LATCH_ROUTE) {
          const [ax, az] = latchApproach(leg.latch);
          const [vx, vz] = leg.via[leg.via.length - 1];
          expect(Math.hypot(ax - vx, az - vz)).toBeLessThan(0.05);
        }
        expect(assertWalkable(world.collision, [[17, -36], [26, -36]], 5)).toBe(5);
      } finally {
        world.scope.dispose();
      }
    }
  });

  it('releases a primed latch only under the shadow, completes only after the sunrise, once', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      const gate = world.controls.get('w03-return-gate')!;
      gate.activate();
      expect(world.counts.complete).toBe(0);
      world.player.position.set(-15, 12, -51);
      tick(instance, 0.1);
      expect(handle.getSnapshot().crownReached).toBe(true);
      // Prime latch 0 at a moment its window is closed: it waits, then releases.
      tickUntil(instance, () => !latchOpen(handle.getSnapshot().t, 0) && !latchOpen(handle.getSnapshot().t + 3, 0));
      world.controls.get('w03-latch-0')!.activate();
      tick(instance, 0.5);
      expect(handle.getSnapshot().latchesReleased[0]).toBe(false);
      tick(instance, SUN_HAND_PERIOD);
      expect(handle.getSnapshot().latchesReleased[0]).toBe(true);
      world.controls.get('w03-latch-1')!.activate();
      world.controls.get('w03-latch-2')!.activate();
      tickUntil(instance, () => handle.getSnapshot().latchesReleased.every(Boolean), SUN_HAND_PERIOD + 1);
      const freed = handle.getSnapshot();
      expect(freed.latchesReleased).toEqual([true, true, true]);
      expect(freed.finaleStarted).toBe(true);
      expect(freed.completionEligible).toBe(false);
      gate.activate();
      expect(world.counts.complete).toBe(0);
      tick(instance, 10.5);
      expect(handle.getSnapshot().completionEligible).toBe(true);
      expect(world.counts.eligible).toBe(1);
      gate.activate();
      gate.activate();
      expect(world.counts.complete).toBe(1);
      world.player.position.y = -9;
      instance.fixedUpdate?.(STEP, [0, 0, 0]);
      expect(world.counts.resets).toBe(1);
    } finally {
      world.scope.dispose();
      expect(world.scope.size).toBe(0);
    }
  });

  it('reduced motion holds the turnstile aligned, stops the gear, and releases latches and the sunrise at once', async () => {
    const world = makeWorld('high', true);
    try {
      const { instance, handle } = await build(world);
      for (let s = 0; s < 40; s++) {
        tick(instance, 0.5);
        expect(handle.getSnapshot().armAligned).toBe(true);
      }
      expect(world.collision.supportHeight(0, 18, 0)).toBe(0);
      world.player.position.set(-15, 12, -51);
      tick(instance, 0.1);
      for (let i = 0; i < 3; i++) world.controls.get(`w03-latch-${i}`)!.activate();
      tick(instance, 0.1);
      const snap = handle.getSnapshot();
      expect(snap.latchesReleased).toEqual([true, true, true]);
      expect(snap.finaleProgress).toBe(1);
      expect(snap.completionEligible).toBe(true);
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
      world.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
      counts.push(n);
      instance.dispose?.();
      expect(world.collision.snapshot().filter((c) => c.ownership === 'dynamic')).toEqual([]);
      world.scope.dispose();
      expect(world.scope.size).toBe(0);
    }
    expect(counts[0]).toBeLessThan(counts[1]);
  });
});

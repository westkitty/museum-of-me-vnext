import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext, PocketWorldInstance } from '../src/world/pocket/types';
import { createW05WorldFactory, type W05PreviewHandle } from '../src/world/pocket/w05/createW05World';
import { registerW05Preview } from '../src/world/pocket/w05/registerW05Preview';
import {
  CANOPY_MIRROR_POS, CANOPY_Y, DECK_CALL_POS, DEW_VALVE_POS, GALLERY, GATE_APPROACH, GATE_POS, LILY_PADS, MIRROR_STAND, ORCHID_POS,
  RAFT_TOP, RAFT_VALVE_XZ, ROUTE, SUN_MIRROR_POS,
} from '../src/world/pocket/w05/w05Layout';

function makeWorld(quality: 'low' | 'high' = 'high', reducedMotion = false) {
  const scope = new ResourceScope('test-w05');
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
  let handle: W05PreviewHandle | undefined;
  const instance = await createW05WorldFactory((h) => { handle = h; })(world.ctx, new AbortController().signal);
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



const ATRIUM_TO_DECK: readonly (readonly [number, number])[] = [[0, 24], ...ROUTE.toPond, ...ROUTE.acrossPond];
const growAll = (world: ReturnType<typeof makeWorld>) => { for (let i = 0; i < 3; i++) world.controls.get('w05-sun-mirror')!.activate(); };
const near = (a: readonly [number, number], b: readonly [number, number] | readonly [number, number, number], reach = 3.6) =>
  Math.hypot(a[0] - b[0], a[1] - (b.length === 3 ? b[2] : b[1])) < reach;

describe('W05 Impossible Greenhouse preview', () => {
  it('keeps the production world dormant and confines the factory to preview registration', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.get('W05')?.readiness).toBe('dormant');
    expect(registry.get('W05')?.load).toBeUndefined();
    registerW05Preview(registry);
    expect(registry.isPlayable('W05')).toBe(true);
  });

  it('keeps the pond closed until light grows the pads; growth completes once begun and never regresses', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      const mirror = world.controls.get('w05-sun-mirror')!;
      expect(world.collision.supportHeight(0.6, 11, 0)).toBeNull();
      expect(blocked(world.collision, 0, 0, 13.1)).toBe(true);
      mirror.activate();
      expect(handle.getSnapshot().mirrorTarget).toBe(0);
      tick(instance, 1);
      expect(world.collision.supportHeight(0.6, 11, 0)).toBeNull();
      // Turning the mirror on before pad 0 finishes does not stop it growing.
      mirror.activate();
      tick(instance, 1.3);
      let snap = handle.getSnapshot();
      expect(snap.padGrowth[0]).toBe(1);
      expect(world.collision.supportHeight(0.6, 11, 0)).toBe(0);
      expect(blocked(world.collision, 0, 0, 13.1)).toBe(false);
      // The far bank stays closed while pad 2 is missing.
      expect(blocked(world.collision, 0, 0, 0.9)).toBe(true);
      mirror.activate();
      tick(instance, 2.4);
      snap = handle.getSnapshot();
      expect(snap.pondComplete).toBe(true);
      expect(snap.padsGrown).toBe(3);
      mirror.activate();
      expect(handle.getSnapshot().padsGrown).toBe(3);
      assertWalkable(world.collision, ATRIUM_TO_DECK, 0);
      // The lily notch is open water.
      const [cx, cz] = LILY_PADS[0];
      expect(world.collision.supportHeight(cx + 2.2, cz, 0)).toBeNull();
    } finally {
      world.scope.dispose();
    }
  });

  it('lifts a rider with the flooding cistern and gates each landing unless the raft is level with it', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      growAll(world);
      tick(instance, 3);
      const valve = world.controls.get('w05-raft-valve')!;
      // At the bottom: the Fern Hall opens onto the raft; the gallery edge is gated.
      expect(blocked(world.collision, 0, 0, -13.9)).toBe(false);
      expect(blocked(world.collision, 0, GALLERY.y, -21.9)).toBe(true);
      world.player.position.set(0, 0, -17.6);
      valve.activate();
      tick(instance, 3);
      let snap = handle.getSnapshot();
      expect(snap.raftY).toBeCloseTo(3, 1);
      expect(snap.raftRiding).toBe(true);
      expect(world.player.position.y).toBeCloseTo(snap.raftY, 5);
      // Mid-rise both landings are gated, so nobody steps off or under.
      expect(blocked(world.collision, 0, 0, -13.9)).toBe(true);
      expect(blocked(world.collision, 0, snap.raftY, -14.1)).toBe(true);
      expect(blocked(world.collision, 0, snap.raftY, -21.9)).toBe(true);
      tick(instance, 3.2);
      snap = handle.getSnapshot();
      expect(snap.raftY).toBe(RAFT_TOP);
      expect(world.player.position.y).toBeCloseTo(RAFT_TOP, 5);
      expect(blocked(world.collision, 0, RAFT_TOP, -21.9)).toBe(false);
      expect(assertWalkable(world.collision, [[0, -17.6], ...ROUTE.offRaft], RAFT_TOP)).toBe(GALLERY.y);
      // With the raft up, the Fern Hall opening is closed; the lever calls it down.
      expect(blocked(world.collision, 0, 0, -13.9)).toBe(true);
      world.player.position.set(0, GALLERY.y, -26);
      world.controls.get('w05-deck-call')!.activate();
      tick(instance, 6.2);
      expect(handle.getSnapshot().raftY).toBe(0);
      expect(blocked(world.collision, 0, 0, -13.9)).toBe(false);
      expect(world.player.position.y).toBe(GALLERY.y);
    } finally {
      world.scope.dispose();
    }
  });

  it('supports every leg of the route, the stands and the orchid alcove, step by step, on both tiers', async () => {
    for (const tier of ['low', 'high'] as const) {
      const world = makeWorld(tier, true);
      try {
        await build(world);
        growAll(world);
        assertWalkable(world.collision, ROUTE.toMirror, 0);
        expect(near(MIRROR_STAND, SUN_MIRROR_POS)).toBe(true);
        assertWalkable(world.collision, [[MIRROR_STAND[0], MIRROR_STAND[1]], ...ROUTE.toPond, ...ROUTE.acrossPond], 0);
        assertWalkable(world.collision, [[0, -1], ...ROUTE.toRaft], 0);
        expect(near(ROUTE.toRaft[1], RAFT_VALVE_XZ)).toBe(true);
        assertWalkable(world.collision, [[0, -8], ...ROUTE.toDeckCall], 0);
        expect(near(ROUTE.toDeckCall[0], DECK_CALL_POS)).toBe(true);
        assertWalkable(world.collision, [[0, -1], ...ROUTE.orchid], 0);
        expect(near(ROUTE.orchid[1], ORCHID_POS)).toBe(true);
        world.controls.get('w05-raft-valve')!.activate();
        assertWalkable(world.collision, [[0, -17.6], ...ROUTE.offRaft], RAFT_TOP);
        const top = assertWalkable(world.collision, [[0, -26], ...ROUTE.toCanopy, ...ROUTE.toCanopyMirror, ...ROUTE.toDewValve, GATE_APPROACH], GALLERY.y);
        expect(top).toBe(CANOPY_Y);
        expect(near(ROUTE.toCanopyMirror[0], CANOPY_MIRROR_POS)).toBe(true);
        expect(near(ROUTE.toDewValve[1], DEW_VALVE_POS)).toBe(true);
        expect(near(GATE_APPROACH, GATE_POS)).toBe(true);
        // The canopy edge is railed everywhere except the ramp.
        expect(blocked(world.collision, 9.9, CANOPY_Y, -60)).toBe(true);
        expect(blocked(world.collision, 0, CANOPY_Y, -69.9)).toBe(true);
      } finally {
        world.scope.dispose();
      }
    }
  });

  it('wakes the Bloom only with light and water on the canopy, and completes once after the finale', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      const mirror = world.controls.get('w05-canopy-mirror')!;
      const dew = world.controls.get('w05-dew-valve')!;
      const gate = world.controls.get('w05-return-gate')!;
      mirror.activate();
      mirror.activate();
      dew.activate();
      tick(instance, 0.1);
      // Not on the canopy yet: nothing wakes.
      expect(handle.getSnapshot().canopyTarget).toBe('bud');
      expect(handle.getSnapshot().finaleStarted).toBe(false);
      dew.activate();
      world.player.position.set(0, CANOPY_Y, -52.5);
      tick(instance, 0.1);
      expect(handle.getSnapshot().canopyReached).toBe(true);
      expect(handle.getSnapshot().finaleStarted).toBe(false); // light alone
      mirror.activate();
      dew.activate();
      tick(instance, 0.1);
      expect(handle.getSnapshot().finaleStarted).toBe(false); // water alone
      mirror.activate();
      mirror.activate();
      tick(instance, 0.1);
      expect(handle.getSnapshot().finaleStarted).toBe(true);
      // The finale locks the mirror and valve.
      mirror.activate();
      dew.activate();
      expect(handle.getSnapshot().canopyTarget).toBe('bud');
      expect(handle.getSnapshot().dewOn).toBe(true);
      gate.activate();
      tick(instance, 5);
      expect(world.counts.complete).toBe(0);
      expect(handle.getSnapshot().completionEligible).toBe(false);
      tick(instance, 5.2);
      expect(handle.getSnapshot().completionEligible).toBe(true);
      gate.activate();
      gate.activate();
      expect(world.counts.complete).toBe(1);
      expect(world.counts.eligible).toBe(1);
      expect(handle.getSnapshot().checkpoints).toEqual(['canopy']);
      world.player.position.y = -5;
      instance.fixedUpdate?.(STEP, [0, 0, 0]);
      expect(world.counts.resets).toBe(1);
    } finally {
      world.scope.dispose();
      expect(world.scope.size).toBe(0);
    }
  });

  it('reduced motion grows pads, moves the raft and opens the Bloom at once', async () => {
    const world = makeWorld('high', true);
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w05-sun-mirror')!.activate();
      expect(handle.getSnapshot().padGrowth[0]).toBe(1);
      world.player.position.set(0, 0, -17.6);
      world.controls.get('w05-raft-valve')!.activate();
      expect(handle.getSnapshot().raftY).toBe(RAFT_TOP);
      expect(world.player.position.y).toBe(RAFT_TOP);
      world.player.position.set(0, CANOPY_Y, -52.5);
      world.controls.get('w05-canopy-mirror')!.activate();
      world.controls.get('w05-canopy-mirror')!.activate();
      world.controls.get('w05-dew-valve')!.activate();
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

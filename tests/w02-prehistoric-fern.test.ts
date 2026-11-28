import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { LAND_SUPPORT_Y } from '../src/world/exterior/IslandSiteLayout';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext, PocketWorldInstance } from '../src/world/pocket/types';
import { createW02WorldFactory, type W02PreviewHandle } from '../src/world/pocket/w02/createW02World';
import { registerW02Preview } from '../src/world/pocket/w02/registerW02Preview';
import {
  BALCONY, EAST_SHELF, FOSSIL_LOOP, GORGE_EAST, GORGE_WEST, MAIN_ROUTE, SADDLE, SUMMIT,
} from '../src/world/pocket/w02/w02Layout';

function makeWorld(quality: 'low' | 'high' = 'high', reducedMotion = false) {
  const scope = new ResourceScope('test-w02');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const controls = new Map<string, { activate(): void; label: string | (() => string) }>();
  const player = { position: new THREE.Vector3(-10, 2, 6), grounded: true };
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
  let handle: W02PreviewHandle | undefined;
  const instance = await createW02WorldFactory((h) => { handle = h; })(world.ctx, new AbortController().signal);
  return { instance, handle: handle! };
}

function tick(instance: PocketWorldInstance, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) instance.fixedUpdate?.(1 / 60, [0, 0, 0]);
}

/** Walk a polyline in 0.25 m steps: every step must be supported within a step-up and wall-free. */
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
      // Probe with feet slightly low, as a capsule arriving up a slope really is.
      const probe = { x, y: y - 0.2, z };
      collision.resolveHorizontal(probe, 0.35, 1.7);
      expect(Math.hypot(probe.x - x, probe.z - z), `wall-free at ${x.toFixed(2)},${z.toFixed(2)}`).toBeLessThan(1e-6);
    }
  }
  return y;
}

describe('W02 Prehistoric Fern Island preview', () => {
  it('keeps the production world dormant and confines the factory to preview registration', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.get('W02')?.readiness).toBe('dormant');
    expect(registry.get('W02')?.load).toBeUndefined();
    registerW02Preview(registry);
    expect(registry.isPlayable('W02')).toBe(true);
  });

  it('uses the supported Fern Ravine inspection position without changing its dormant message', () => {
    const exterior = new ExteriorWorld('low');
    try {
      const messages: string[] = [];
      const control = exterior.getFernPortalControl((message) => messages.push(message));
      const p = control.object.position;
      expect([p.x, p.y, p.z]).toEqual([-134.5, LAND_SUPPORT_Y, -5.1]);
      expect(exterior.collision.supportHeight(p.x, p.z, p.y)).toBe(LAND_SUPPORT_Y);
      control.activate();
      expect(messages[0]).toContain('not open yet');
    } finally {
      exterior.dispose();
    }
  });

  it('keeps the gorge unsupported and the shelf edge guarded until the seed is woken', async () => {
    const world = makeWorld();
    try {
      const { instance } = await build(world);
      expect(instance.spawnPosition).toEqual([-42, 0, 8]);
      expect(world.collision.supportHeight(-42, 8, 0)).toBe(0);
      expect(world.collision.supportHeight(-24, 8, 1.1)).not.toBeNull();
      expect(world.collision.supportHeight(-10, 6, 2)).toBe(2);
      for (const z of [-40, -10, 6, 30]) expect(world.collision.supportHeight(2, z, 2)).toBeNull();
      // A visitor walking east on the shelf is held back by the root lip.
      const probe = { x: -4.5, y: 2, z: 6 };
      world.collision.resolveHorizontal(probe, 0.35, 1.7);
      expect(probe.x).toBeLessThanOrEqual(-4.64);
    } finally {
      world.scope.dispose();
    }
  });

  it('grows the bridge visibly with the collider never ahead of grown planks', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      world.controls.get('w02-root-seed')!.activate();
      expect(world.counts.saves).toBe(1);
      expect(handle.getSnapshot().bridgeOpen).toBe(true);
      expect(world.collision.supportHeight(2, 6, 2)).toBeNull();
      let lastMax = GORGE_WEST;
      let sawPartial = false;
      for (let i = 0; i < 60 * 5; i++) {
        instance.fixedUpdate?.(1 / 60, [0, 0, 0]);
        const snap = handle.getSnapshot();
        expect(snap.bridgeSupportedMaxX).toBeGreaterThanOrEqual(lastMax);
        lastMax = snap.bridgeSupportedMaxX;
        if (lastMax > GORGE_WEST && lastMax < GORGE_EAST) {
          sawPartial = true;
          // supported up to the front, and a wall stops the visitor stepping past it
          expect(world.collision.supportHeight(lastMax - 0.2, 6, 2)).toBe(2);
          expect(world.collision.supportHeight(lastMax + 0.2, 6, 2)).toBeNull();
          const probe = { x: lastMax - 0.1, y: 2, z: 6 };
          world.collision.resolveHorizontal(probe, 0.35, 1.7);
          expect(probe.x).toBeLessThan(lastMax);
        }
      }
      expect(sawPartial).toBe(true);
      const done = handle.getSnapshot();
      expect(done.bridgeComplete).toBe(true);
      expect(done.bridgeSupportedMaxX).toBe(GORGE_EAST);
      expect(world.collision.supportHeight(2, 6, 2)).toBe(2);
      world.controls.get('w02-root-seed')!.activate();
      expect(world.counts.saves).toBe(1);
      expect(world.counts.complete).toBe(0);
      world.player.position.y = -9;
      instance.fixedUpdate?.(1 / 60, [0, 0, 0]);
      expect(world.counts.resets).toBe(1);
    } finally {
      world.scope.dispose();
      expect(world.scope.size).toBe(0);
    }
  });

  it('gives reduced motion the identical final bridge state immediately', async () => {
    const world = makeWorld('high', true);
    try {
      const { handle } = await build(world);
      world.controls.get('w02-root-seed')!.activate();
      const snap = handle.getSnapshot();
      expect(snap.bridgeComplete).toBe(true);
      expect(snap.bridgeSupportedMaxX).toBe(GORGE_EAST);
      expect(world.collision.supportHeight(2, 6, 2)).toBe(2);
    } finally {
      world.scope.dispose();
    }
  });

  it('supports the whole three-act route and the fossil loop, step by step and wall-free', async () => {
    for (const tier of ['low', 'high'] as const) {
      const world = makeWorld(tier, true);
      try {
        await build(world);
        world.controls.get('w02-root-seed')!.activate();
        const top = assertWalkable(world.collision, MAIN_ROUTE, 0);
        expect(top).toBe(SUMMIT.y);
        expect(assertWalkable(world.collision, FOSSIL_LOOP, 0)).toBe(2);
      } finally {
        world.scope.dispose();
      }
    }
  });

  it('completes only after crossing, summit and finale; completion is idempotent and early exits award nothing', async () => {
    const world = makeWorld();
    try {
      const { instance, handle } = await build(world);
      const heart = world.controls.get('w02-elder-heart')!;
      const gate = world.controls.get('w02-return-gate')!;
      heart.activate();
      gate.activate();
      expect(handle.getSnapshot().finaleStarted).toBe(false);
      expect(world.counts.complete).toBe(0);

      world.controls.get('w02-root-seed')!.activate();
      tick(instance, 5);
      const stand = (x: number, z: number, y: number) => { world.player.position.set(x, y, z); tick(instance, 0.1); };
      stand(12, 6, EAST_SHELF.y);
      expect(handle.getSnapshot().crossed).toBe(true);
      stand(15, -19, BALCONY.y);
      stand(40, -19, SADDLE.y);
      heart.activate();
      expect(handle.getSnapshot().finaleStarted).toBe(false);
      stand(40, 6, SUMMIT.y);
      expect(handle.getSnapshot().checkpoints).toEqual(['east-shelf', 'fern-balcony', 'root-saddle', 'elder-summit']);
      expect(handle.getSnapshot().summitReached).toBe(true);
      heart.activate();
      expect(handle.getSnapshot().finaleStarted).toBe(true);
      gate.activate();
      expect(world.counts.complete).toBe(0);
      tick(instance, 9.5);
      expect(handle.getSnapshot().completionEligible).toBe(true);
      expect(world.counts.eligible).toBe(1);
      gate.activate();
      gate.activate();
      expect(world.counts.complete).toBe(1);
      tick(instance, 1);
      expect(world.counts.eligible).toBe(1);
    } finally {
      world.scope.dispose();
    }
  });

  it('marks the optional fossil without gating the route', async () => {
    const world = makeWorld();
    try {
      const { handle } = await build(world);
      world.controls.get('w02-fossil')!.activate();
      world.controls.get('w02-fossil')!.activate();
      expect(handle.getSnapshot().fossilFound).toBe(true);
      expect(handle.getSnapshot().crossed).toBe(false);
    } finally {
      world.scope.dispose();
    }
  });

  it('scales vegetation by tier while keeping the same collision-supported route', async () => {
    const low = makeWorld('low');
    const high = makeWorld('high');
    try {
      await build(low);
      await build(high);
      const instances = (root: THREE.Group) => {
        let n = 0;
        root.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) n += (o as THREE.InstancedMesh).count; });
        return n;
      };
      expect(instances(low.root)).toBeLessThan(instances(high.root));
      for (const [x, z, y] of [[-42, 8, 0], [-17, 6, 2], [-10, 6, 2], [13, 6, 2], [15, -19, 6], [40, -19, 10], [40, 9, 14]]) {
        expect(low.collision.supportHeight(x, z, y)).toBe(high.collision.supportHeight(x, z, y));
      }
    } finally {
      low.scope.dispose();
      high.scope.dispose();
    }
  });
});

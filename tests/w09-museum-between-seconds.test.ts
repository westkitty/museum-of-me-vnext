import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { PlayerController } from '../src/player/PlayerController';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import type { PocketWorldContext } from '../src/world/pocket/types';
import { createW09WorldFactory, type W09PreviewHandle } from '../src/world/pocket/w09/createW09World';

function makeWorld(reduced = false) {
  const scope = new ResourceScope('test-w09');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const keys = new Set<string>();
  const input = { isDown: (key: string) => keys.has(key), touchMoveX: 0, touchMoveY: 0, uiCaptured: false, on: () => () => undefined };
  const player = new PlayerController(collision, input as never);
  player.teleport([0, 0, 25], 0);
  const controls = new Map<string, { activate(): void }>();
  let saved: [number, number, number] = [0, 0, 25];
  const counts = { eligible: 0, complete: 0, resets: 0 };
  const ctx = {
    scope, collision, root, player, input, quality: QUALITY.low,
    interaction: { register: (id: string, control: { activate(): void }) => { controls.set(id, control); return () => controls.delete(id); } },
    reducedMotion: () => reduced,
    announce: () => undefined,
    saveCheckpoint: () => { saved = [player.position.x, player.position.y, player.position.z]; return true; },
    resetToCheckpoint: () => { counts.resets++; player.teleport(saved, 0); return true; },
    markCompletionEligible: () => { counts.eligible++; },
    requestComplete: () => { counts.complete++; },
  } as unknown as PocketWorldContext;
  let handle: W09PreviewHandle | undefined;
  const instance = createW09WorldFactory((h) => { handle = h; })(ctx, new AbortController().signal);
  if (instance instanceof Promise) throw new Error('Unexpected async W09 factory');
  const step = (n = 1) => { for (let i = 0; i < n; i++) { player.fixedUpdate(1 / 60); instance.fixedUpdate?.(1 / 60, [0, 0, 0]); } };
  return { scope, collision, player, keys, controls, counts, instance, step, snapshot: () => handle!.getSnapshot() };
}

describe('W09 Museum Between Seconds', () => {
  it('freezes environmental time at rest and during camera-only or involuntary travel', () => {
    const w = makeWorld();
    w.step(120);
    expect(w.snapshot().localTime).toBe(0);
    w.player.teleport([2, 0, 25], 0);
    w.step();
    expect(w.snapshot().localTime).toBe(0);
    w.keys.add('forward');
    w.step(120);
    expect(w.snapshot().localTime).toBeGreaterThan(0);
    w.keys.clear();
    const frozen = w.snapshot().localTime;
    w.step(120);
    expect(w.snapshot().localTime).toBe(frozen);
    w.instance.dispose?.(); w.scope.dispose();
  });

  it('supports stationary advancement, latches both constellations, traverses finale and completes once', () => {
    const w = makeWorld(true);
    expect(w.collision.snapshot().some((c) => c.id === 'floor:w09-orrery-bridge')).toBe(false);
    for (let i = 0; i < 4; i++) w.controls.get('w09-time-dial')!.activate();
    w.step();
    expect(w.snapshot().orreryBridge).toBe(true);
    expect(w.collision.snapshot().some((c) => c.id === 'floor:w09-orrery-bridge')).toBe(true);
    // Both alignment stations can advance time while the visitor remains still.
    for (let i = 0; i < 30 && !w.snapshot().aligned[0]; i++) w.controls.get('w09-constellation-0')!.activate();
    for (let i = 0; i < 30 && !w.snapshot().aligned[1]; i++) w.controls.get('w09-constellation-1')!.activate();
    w.step();
    expect(w.snapshot().aligned).toEqual([true, true]);
    expect(w.snapshot().meteorBridge).toBe(true);
    w.controls.get('w09-discovery')!.activate();
    expect(w.snapshot().optionalFound).toBe(true);
    w.player.teleport([0, 5, -70], 0);
    w.step(30);
    expect(w.counts.eligible).toBe(1);
    w.controls.get('w09-exit')!.activate();
    w.controls.get('w09-exit')!.activate();
    expect(w.counts.complete).toBe(1);
    w.instance.dispose?.(); w.scope.dispose();
  });
});

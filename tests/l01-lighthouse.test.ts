import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { PlayerController } from '../src/player/PlayerController';
import { QUALITY } from '../src/render/QualityTiers';
import { Passport } from '../src/state/Passport';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext } from '../src/world/pocket/types';
import { createL01WorldFactory, type L01PreviewHandle } from '../src/world/pocket/l01/createL01World';
import { registerL01Preview } from '../src/world/pocket/l01/registerL01Preview';

function setup(reduced = false) {
  const scope = new ResourceScope('test-l01');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const input = { isDown: () => false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
  const player = new PlayerController(collision, input as never);
  player.teleport([0, 0, 26], 0);
  const controls = new Map<string, { activate(): void }>();
  const counts = { eligible: 0, complete: 0 };
  let saved: [number, number, number] = [0, 0, 26];
  const ctx = {
    scope, collision, root, player, input, quality: QUALITY.low, reducedMotion: () => reduced, announce: () => undefined,
    interaction: { register: (id: string, control: { activate(): void }) => { controls.set(id, control); return () => controls.delete(id); } },
    saveCheckpoint: () => { saved = [player.position.x, player.position.y, player.position.z]; return true; },
    resetToCheckpoint: () => { player.teleport(saved, 0); return true; },
    markCompletionEligible: () => { counts.eligible++; },
    requestComplete: () => { counts.complete++; },
  } as unknown as PocketWorldContext;
  let handle: L01PreviewHandle | undefined;
  const instance = createL01WorldFactory((h) => { handle = h; })(ctx, new AbortController().signal);
  if (instance instanceof Promise) throw new Error('Unexpected async L01 factory');
  const step = (n = 1) => { for (let i = 0; i < n; i++) { player.fixedUpdate(1 / 60); instance.fixedUpdate?.(1 / 60, [0, 0, 0]); } };
  return { scope, collision, player, controls, counts, instance, step, snapshot: () => handle!.getSnapshot() };
}

describe('L01 Lighthouse at World’s End', () => {
  it('reveals each supported light path in order and finishes without an eleventh stamp', () => {
    const registry = new PocketWorldRegistry();
    registerL01Preview(registry);
    expect(registry.get('L01')).toMatchObject({ stampSlot: null, isBonus: true, readiness: 'verified' });
    expect(registry.stampedDefinitions()).toHaveLength(10);
    const w = setup(true);
    w.step();
    expect(w.snapshot().revealed).toEqual([true, false, false]);
    expect(w.collision.snapshot().some((c) => c.id === 'floor:l01-light-path-0')).toBe(true);
    w.player.teleport([0, 0, 0], 0); w.step();
    expect(w.snapshot().revealed).toEqual([true, true, false]);
    w.player.teleport([22, 0, 0], 0); w.step();
    expect(w.snapshot().revealed).toEqual([true, true, true]);
    w.player.teleport([22, 0, -30], 0); w.step();
    w.controls.get('l01-beacon')!.activate();
    w.step(30);
    expect(w.counts.eligible).toBe(1);
    w.controls.get('l01-exit')!.activate(); w.controls.get('l01-exit')!.activate();
    expect(w.counts.complete).toBe(1);
    const passport = new Passport(null);
    expect(passport.recordExit('L01', true).bonusCompleted).toBe(true);
    expect(passport.earnedCount).toBe(0);
    expect(passport.hasStamp('L01')).toBe(false);
    w.instance.dispose?.(); w.scope.dispose();
  });

  it('keeps a revealed path supported when the beam sweeps away', () => {
    const w = setup();
    w.step(180);
    expect(w.snapshot().revealed[0]).toBe(true);
    w.step(900);
    expect(w.snapshot().revealed[0]).toBe(true);
    expect(w.collision.snapshot().some((c) => c.id === 'floor:l01-light-path-0')).toBe(true);
    w.instance.dispose?.(); w.scope.dispose();
  });
});

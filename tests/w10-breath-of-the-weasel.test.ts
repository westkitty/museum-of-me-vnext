import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { PlayerController } from '../src/player/PlayerController';
import { QUALITY } from '../src/render/QualityTiers';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import type { PocketWorldContext } from '../src/world/pocket/types';
import { createW10WorldFactory, type W10PreviewHandle } from '../src/world/pocket/w10/createW10World';
import { registerW10Preview } from '../src/world/pocket/w10/registerW10Preview';

function setup() {
  const scope = new ResourceScope('test-w10');
  const collision = new CollisionWorld();
  const root = new THREE.Group();
  const keys = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  const input = { isDown: (key: string) => keys.has(key), uiCaptured: false, touchMoveX: 0, touchMoveY: 0,
    on: (key: string, cb: () => void) => { const set = listeners.get(key) ?? new Set(); set.add(cb); listeners.set(key, set); return () => set.delete(cb); } };
  const player = new PlayerController(collision, input as never);
  player.teleport([0, 12, 36], 0);
  const counts = { eligible: 0, complete: 0, resets: 0 };
  let saved: [number, number, number] = [0, 12, 36];
  const ctx = {
    scope, collision, root, player, input, quality: QUALITY.low, reducedMotion: () => false,
    announce: () => undefined,
    saveCheckpoint: () => { saved = [player.position.x, player.position.y, player.position.z]; return true; },
    resetToCheckpoint: () => { counts.resets++; player.teleport(saved, 0); return true; },
    markCompletionEligible: () => { counts.eligible++; },
    requestComplete: () => { counts.complete++; },
  } as unknown as PocketWorldContext;
  let handle: W10PreviewHandle | undefined;
  const instance = createW10WorldFactory((h) => { handle = h; })(ctx, new AbortController().signal);
  if (instance instanceof Promise) throw new Error('Unexpected async W10 factory');
  const step = (n = 1) => { for (let i = 0; i < n; i++) { player.fixedUpdate(1 / 60); instance.fixedUpdate?.(1 / 60, [0, 0, 0]); } };
  const press = () => { for (const fn of listeners.get('interact') ?? []) fn(); };
  return { scope, collision, root, keys, player, counts, instance, step, press, snapshot: () => handle!.getSnapshot() };
}

describe('W10 Breath of the Weasel mechanics', () => {
  it('keeps the canonical stamp gate and uses an explicitly test-only rig', () => {
    const registry = new PocketWorldRegistry();
    registerW10Preview(registry);
    expect(registry.get('W10')).toMatchObject({ requiresStampCount: 1, stampSlot: 9, cameraMode: 'third-person-dexter' });
    const w = setup();
    expect(w.instance.cameraMode).toBe('third-person-dexter');
    expect(w.snapshot().rigStatus).toBe('TEST_ONLY_NOT_APPROVED_DEXTER');
    expect(w.root.getObjectByName('W10 TEST-ONLY RIG — NOT APPROVED DEXTER')).toBeDefined();
    w.instance.dispose?.(); w.scope.dispose();
  });

  it('takes glider, climbs with stamina, solves movable stones, reaches panorama and completes once', () => {
    const w = setup();
    w.player.teleport([0, 12, 32], 0);
    w.press(); expect(w.snapshot().hasGlider).toBe(true);
    w.player.teleport([15, 0, -28], 0); w.step(); w.press();
    expect(w.snapshot().climbing).toBe(true);
    w.keys.add('forward'); w.step(200); w.keys.clear();
    expect(w.snapshot().climbing).toBe(false);
    expect(w.snapshot().checkpoints).toContain('shrine-ledge');
    w.player.teleport([12, 8, -42], 0); w.step();
    for (let i = 0; i < 3; i++) w.press();
    w.player.teleport([18, 8, -42], 0); w.step();
    for (let i = 0; i < 3; i++) w.press();
    expect(w.snapshot().blockSteps).toEqual([3, 3]);
    expect(w.snapshot().shrineOpen).toBe(true);
    expect(w.collision.snapshot().some((c) => c.id === 'wall:w10-shrine-gate')).toBe(false);
    w.player.teleport([0, 3, -99], 0); w.step(); w.press(); w.step(500);
    expect(w.counts.eligible).toBe(1);
    w.press(); w.press(); expect(w.counts.complete).toBe(1);
    w.instance.dispose?.(); w.scope.dispose();
  });
});

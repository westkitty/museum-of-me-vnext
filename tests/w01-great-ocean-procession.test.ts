import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { AssetManager } from '../src/assets/AssetManager';
import { AudioManager } from '../src/audio/AudioManager';
import { WorldDirector } from '../src/app/WorldDirector';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { InputManager } from '../src/player/Input';
import { PlayerController, EYE_HEIGHT } from '../src/player/PlayerController';
import { QUALITY } from '../src/render/QualityTiers';
import { Passport } from '../src/state/Passport';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldHost } from '../src/world/pocket/PocketWorldHost';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import { registerW01Preview } from '../src/world/pocket/w01/registerW01Preview';
import type { W01ControllerHandle } from '../src/world/pocket/w01/createW01World';

function makeCanvas(): HTMLCanvasElement {
  if (typeof window === 'undefined') {
    vi.stubGlobal('window', {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }
  if (typeof document === 'undefined') {
    vi.stubGlobal('document', {
      activeElement: null,
      hidden: false,
      pointerLockElement: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      exitPointerLock: () => {},
    });
  }
  if (typeof HTMLElement === 'undefined') {
    vi.stubGlobal('HTMLElement', class {});
  }
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    requestPointerLock: () => Promise.resolve(),
  } as unknown as HTMLCanvasElement;
}

function makeHostEnv() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 500);
  const exteriorRoot = new THREE.Group();
  const exteriorCollision = new CollisionWorld();
  exteriorCollision.addFloor(40, 70, -10, 20, -0.5);
  const skyMesh = new THREE.Mesh();
  const lightingGroup = new THREE.Group();
  const input = new InputManager(makeCanvas());
  const player = new PlayerController(exteriorCollision, input);
  player.restorePose([53.5, -0.5, 4], -Math.PI / 2, 0.05);

  const audio = new AudioManager();
  const assets = new AssetManager();
  const interaction = new InteractionManager();
  const passport = new Passport();
  const registry = new PocketWorldRegistry();
  const announcements: string[] = [];

  let currentZone = 'plaza' as const;
  let reducedMotion = false;
  const director = new WorldDirector({
    player,
    exteriorWorld: { root: exteriorRoot, collision: exteriorCollision },
    getInteriorWorld: () => null,
    setCurrentZone: () => {},
  } as unknown as ConstructorParameters<typeof WorldDirector>[0]);
  const host = new PocketWorldHost({
    registry,
    passport,
    worldDirector: director,
    scene,
    camera,
    sky: { mesh: skyMesh, follow: () => {} },
    lighting: { group: lightingGroup },
    getMuseumPlacementsRoot: () => null,
    exteriorWorld: { root: exteriorRoot, collision: exteriorCollision },
    getInteriorWorld: () => null,
    player,
    input,
    interaction,
    audio,
    assets,
    getQuality: () => QUALITY.high,
    isContextLost: () => false,
    getCurrentZone: () => currentZone,
    setCurrentZone: (z) => { currentZone = z as 'plaza'; },
    reducedMotion: () => reducedMotion,
    announce: (msg) => { announcements.push(msg); },
  });

  if (typeof HTMLElement === 'undefined') {
    vi.stubGlobal('HTMLElement', class {});
  }
  return {
    scene,
    camera,
    input,
    player,
    audio,
    assets,
    interaction,
    passport,
    registry,
    host,
    announcements,
    setReducedMotion: (v: boolean) => { reducedMotion = v; },
    dispose: () => {
      host.dispose();
      interaction.dispose();
      audio.dispose();
      assets.dispose();
      input.dispose();
    },
  };
}

describe('W01: The Great Ocean Procession', () => {
  it('keeps canonical W01 dormant by default until preview/test registration', () => {
    const registry = new PocketWorldRegistry();
    const def = registry.get('W01');
    expect(def?.readiness).toBe('dormant');
    expect(def?.load).toBeUndefined();
    expect(registry.canEnter('W01').ok).toBe(false);
  });

  it('supports PlayerController guided transport with free look and render interpolation', () => {
    const env = makeHostEnv();
    try {
      const release = env.player.beginGuidedTransport();
      expect(env.player.isGuidedTransport).toBe(true);
      env.player.fixedUpdate(1 / 60);
      env.player.setGuidedPosition(10, 4, -20);
      env.player.applyLook(100, -50, 1, false);
      expect(env.player.yaw).not.toBe(-Math.PI / 2);

      // Render interpolation at alpha = 0.5 blends between prevPosition and guided position
      env.player.applyToCamera(env.camera, 0.5);
      expect(env.camera.position.x).toBeCloseTo((53.5 + 10) / 2, 2);
      expect(env.camera.position.y).toBeCloseTo((-0.5 + 4) / 2 + EYE_HEIGHT, 2);

      // Teleport cancels guided transport cleanly
      env.player.teleport([53.5, -0.5, 4], 0);
      expect(env.player.isGuidedTransport).toBe(false);
      release();
    } finally {
      env.dispose();
    }
  });

  it('completes the full W01 journey, awards stamp only at finale, and cleans up over 10 visits', async () => {
    const env = makeHostEnv();
    try {
      let handle: W01ControllerHandle | null = null;
      registerW01Preview(env.registry, {
        onReady: (h) => { handle = h; },
      });

      const entered = await env.host.enter('W01');
      expect(entered).toBe(true);
      expect(handle).not.toBeNull();
      const w01 = handle!;

      // Supported spawn on Central Station
      expect(env.player.position.toArray()).toEqual([0, 0, 7]);
      expect(env.player.grounded).toBe(true);
      expect(w01.getSnapshot().musicSourceMode).toBe('bundled-original');

      // Cannot assemble cathedral before awakening all 3 musicians
      expect(w01.activateCathedral()).toBe(false);

      // Ride to each reef, perform env interaction, awaken musician, and ride back
      const reefs = ['turtle', 'ray', 'whale'] as const;
      for (const reef of reefs) {
        expect(w01.rideCurrent(reef)).toBe(true);
        expect(env.player.isGuidedTransport).toBe(true);
        for (let step = 0; step < 360; step++) {
          env.player.fixedUpdate(1 / 60);
          env.host.fixedUpdate(1 / 60, env.player.eyePosition);
          env.host.variableUpdate(1 / 60, env.player.eyePosition);
          if (!env.player.isGuidedTransport) break;
        }
        expect(env.player.isGuidedTransport).toBe(false);
        expect(env.player.grounded).toBe(true);
        expect(w01.getSnapshot().station).toBe(reef);

        expect(w01.activateReefEnvironment(reef)).toBe(true);
        expect(w01.awakenMusician(reef)).toBe(true);
        expect(env.passport.hasStamp('W01')).toBe(false);

        expect(w01.rideCurrent('central')).toBe(true);
        for (let step = 0; step < 360; step++) {
          env.player.fixedUpdate(1 / 60);
          env.host.fixedUpdate(1 / 60, env.player.eyePosition);
          env.host.variableUpdate(1 / 60, env.player.eyePosition);
          if (!env.player.isGuidedTransport) break;
        }
        expect(w01.getSnapshot().station).toBe('central');
      }

      expect(w01.getSnapshot().activeStems).toEqual(['bass', 'drums', 'other']);

      // Assemble Coral Cathedral and verify new walkable passage colliders
      expect(w01.activateCathedral()).toBe(true);
      for (let step = 0; step < 300; step++) {
        env.host.variableUpdate(1 / 60, env.player.eyePosition);
        if (w01.getSnapshot().cathedralPhase === 'assembled') break;
      }
      expect(w01.getSnapshot().cathedralPhase).toBe('assembled');

      const activeSession = env.host as unknown as { activeSession: { collision: CollisionWorld } };
      const conductorSupport = activeSession.activeSession.collision.supportHeight(0, -46, 6, 0.5);
      expect(conductorSupport).toBe(6);

      // Stamp awarded ONLY when conducting finale
      expect(env.passport.hasStamp('W01')).toBe(false);
      expect(w01.conductFinale()).toBe(true);
      expect(env.passport.hasStamp('W01')).toBe(true);
      expect(env.passport.earnedCount).toBe(1);
      expect(env.host.isActive).toBe(false);
      expect(env.player.position.toArray()).toEqual([53.5, -0.5, 4]);
      expect(env.player.yaw).toBeCloseTo(-Math.PI / 2, 5);
      expect(env.player.pitch).toBeCloseTo(0.05, 5);

      // 10 repeated visits with reducedMotion & clean disposal
      env.setReducedMotion(true);
      for (let i = 0; i < 10; i++) {
        expect(await env.host.enter('W01')).toBe(true);
        env.host.fixedUpdate(1 / 60, env.player.eyePosition);
        env.host.variableUpdate(1 / 60, env.player.eyePosition);
        expect(env.host.exit({ viaVhsRewind: false })).toBe(true);
      }
      expect(env.passport.earnedCount).toBe(1);
      expect(env.scene.children.filter((c) => c.name.startsWith('pocket-world:'))).toHaveLength(0);
    } finally {
      env.dispose();
    }
  });
});

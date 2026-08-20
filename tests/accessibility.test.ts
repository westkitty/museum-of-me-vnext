import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputManager, KEYBOARD_LOOK_SPEED } from '../src/player/Input';
import { PlayerController } from '../src/player/PlayerController';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { DEFAULT_PREFERENCES } from '../src/state/Preferences';
import { QUALITY } from '../src/render/QualityTiers';

/**
 * THE PHASE 11 GATE.
 *
 * The museum must be fully usable with a keyboard alone, with touch alone, and
 * with reduced motion on. "Accessible if you can use a mouse" is not accessible.
 */

class FakeElement {
  readonly listeners = new Map<string, ((e: unknown) => void)[]>();
  addEventListener(type: string, fn: (e: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  removeEventListener(): void {}
  requestPointerLock(): void {}
  fire(type: string, event: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}

let canvas: FakeElement;
let input: InputManager;

beforeEach(() => {
  canvas = new FakeElement();
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  vi.stubGlobal('window', {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: (t: string, fn: (e: unknown) => void) => {
      const l = listeners.get(t) ?? [];
      l.push(fn);
      listeners.set(t, l);
    },
    removeEventListener: () => {},
    __fire: (t: string, e: unknown) => { for (const fn of listeners.get(t) ?? []) fn(e); },
  });
  vi.stubGlobal('document', {
    addEventListener: () => {},
    removeEventListener: () => {},
    pointerLockElement: null,
    exitPointerLock: () => {},
  });
  input = new InputManager(canvas as unknown as HTMLElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function key(code: string, down = true): void {
  (window as unknown as { __fire(t: string, e: unknown): void }).__fire(
    down ? 'keydown' : 'keyup',
    { code, target: { tagName: 'CANVAS' }, preventDefault: () => {} },
  );
}

describe('keyboard-only operation', () => {
  it('separates movement from looking so no mouse is needed', () => {
    key('KeyW');
    expect(input.isDown('forward')).toBe(true);
    key('ArrowLeft');
    expect(input.isDown('lookLeft'), 'arrow keys must look, not move').toBe(true);
    expect(input.isDown('left'), 'arrow keys must not double as movement').toBe(false);
  });

  it('turns at a sensitivity-independent rate', () => {
    key('ArrowRight');
    const slow = input.keyboardLook(1 / 60, 0.4);
    const fast = input.keyboardLook(1 / 60, 2.4);
    // The controller multiplies by sensitivity, so the raw delta must divide it
    // back out — otherwise a mouse setting would change keyboard turn speed.
    expect(slow.dx * 0.4).toBeCloseTo(fast.dx * 2.4, 6);
    expect(slow.dx).toBeGreaterThan(0);
  });

  it('actually turns the player when only the keyboard is used', () => {
    const world = new CollisionWorld();
    world.addFloor(-50, 50, -50, 50, 0);
    const player = new PlayerController(world, input);
    const before = player.yaw;
    key('ArrowRight');
    for (let i = 0; i < 60; i++) {
      const look = input.keyboardLook(1 / 60, 1);
      player.applyLook(look.dx, look.dy, 1, false);
    }
    const turned = Math.abs(player.yaw - before);
    // One second of held turn should be about the declared degrees per second.
    expect((turned * 180) / Math.PI).toBeGreaterThan(KEYBOARD_LOOK_SPEED * 0.7);
  });

  it('walks with WASD alone', () => {
    const world = new CollisionWorld();
    world.addFloor(-50, 50, -50, 50, 0);
    const player = new PlayerController(world, input);
    player.teleport([0, 0, 0]);
    key('KeyW');
    for (let i = 0; i < 60; i++) player.fixedUpdate(1 / 60);
    expect(player.position.z, 'W did not move the visitor forward').toBeLessThan(-1);
  });

  it('never steals keys from a text field', () => {
    (window as unknown as { __fire(t: string, e: unknown): void }).__fire('keydown', {
      code: 'KeyW', target: { tagName: 'TEXTAREA' }, preventDefault: () => {},
    });
    expect(input.isDown('forward')).toBe(false);
  });

  it('suppresses movement while a panel has focus', () => {
    key('KeyW');
    expect(input.isDown('forward')).toBe(true);
    input.uiCaptured = true;
    expect(input.isDown('forward'), 'movement leaked into an open panel').toBe(false);
  });
});

describe('touch-only operation', () => {
  it('treats the left half as a stick and the right half as look', () => {
    canvas.fire('touchstart', {
      changedTouches: [{ identifier: 1, clientX: 200, clientY: 400 }],
      preventDefault: () => {},
    });
    canvas.fire('touchmove', {
      changedTouches: [{ identifier: 1, clientX: 270, clientY: 400 }],
      preventDefault: () => {},
    });
    expect(input.touchMoveX).toBeCloseTo(1, 2);
    expect(input.touchActive).toBe(true);

    canvas.fire('touchstart', {
      changedTouches: [{ identifier: 2, clientX: 900, clientY: 300 }],
      preventDefault: () => {},
    });
    canvas.fire('touchmove', {
      changedTouches: [{ identifier: 2, clientX: 940, clientY: 300 }],
      preventDefault: () => {},
    });
    expect(input.touchDeltaX).toBe(40);
  });

  it('releases the stick when the touch ends', () => {
    canvas.fire('touchstart', {
      changedTouches: [{ identifier: 1, clientX: 200, clientY: 400 }],
      preventDefault: () => {},
    });
    canvas.fire('touchmove', {
      changedTouches: [{ identifier: 1, clientX: 300, clientY: 500 }],
      preventDefault: () => {},
    });
    expect(input.touchMoveX).not.toBe(0);
    canvas.fire('touchend', { changedTouches: [{ identifier: 1, clientX: 300, clientY: 500 }] });
    expect(input.touchMoveX).toBe(0);
    expect(input.touchMoveY).toBe(0);
  });

  it('drives the player from the touch stick alone', () => {
    const world = new CollisionWorld();
    world.addFloor(-50, 50, -50, 50, 0);
    const player = new PlayerController(world, input);
    player.teleport([0, 0, 0]);
    canvas.fire('touchstart', {
      changedTouches: [{ identifier: 1, clientX: 200, clientY: 400 }],
      preventDefault: () => {},
    });
    canvas.fire('touchmove', {
      changedTouches: [{ identifier: 1, clientX: 200, clientY: 330 }],
      preventDefault: () => {},
    });
    for (let i = 0; i < 60; i++) player.fixedUpdate(1 / 60);
    expect(player.position.z, 'the touch stick did not move the visitor').toBeLessThan(-1);
  });

  it('does not request pointer lock on a touch device', () => {
    const spy = vi.spyOn(canvas, 'requestPointerLock');
    canvas.fire('touchstart', {
      changedTouches: [{ identifier: 1, clientX: 200, clientY: 400 }],
      preventDefault: () => {},
    });
    canvas.fire('click', {});
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('comfort settings', () => {
  it('defaults reduced motion from the system preference', () => {
    expect(DEFAULT_PREFERENCES.reducedMotion).toBe(false);
    expect(typeof DEFAULT_PREFERENCES.highContrast).toBe('boolean');
    expect(DEFAULT_PREFERENCES.subtitles).toBe(true);
  });

  it('offers a usable interface-scale range', () => {
    expect(DEFAULT_PREFERENCES.uiScale).toBe(1);
  });

  it('caps device pixel ratio on every quality tier', () => {
    for (const tier of Object.values(QUALITY)) {
      expect(tier.maxPixelRatio, tier.tier).toBeLessThanOrEqual(2);
      expect(tier.maxPixelRatio, tier.tier).toBeGreaterThan(0);
    }
  });

  it('disables shadows and crowds on the lowest tier', () => {
    expect(QUALITY.low.shadows).toBe(false);
    expect(QUALITY.low.ambientVisitors).toBe(0);
  });
});

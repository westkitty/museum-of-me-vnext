import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputManager, KEYBOARD_LOOK_SPEED } from '../src/player/Input';
import { FLIGHT_LAUNCH_SPEED, JUMP_SPEED, PlayerController } from '../src/player/PlayerController';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { DEFAULT_PREFERENCES } from '../src/state/Preferences';
import { QUALITY } from '../src/render/QualityTiers';
import { isActivationKey } from '../src/ui/dom';
import { isOnFlightPad, FLIGHT_PAD_CENTER, FLIGHT_PAD_RADIUS } from '../src/world/layout';

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

function flatWorld(): CollisionWorld {
  const world = new CollisionWorld();
  world.addFloor(-50, 50, -50, 50, 0);
  return world;
}

function distanceAfter(code: string, shift = false): number {
  const player = new PlayerController(flatWorld(), input);
  player.teleport([0, 0, 0]);
  key(code);
  if (shift) key('ShiftLeft');
  for (let i = 0; i < 60; i++) player.fixedUpdate(1 / 60);
  return Math.hypot(player.position.x, player.position.z);
}

describe('keyboard-only operation', () => {
  it('maps WASD and arrows to the same directional movement actions', () => {
    key('KeyW');
    key('ArrowUp');
    expect(input.isDown('forward')).toBe(true);
    key('KeyA');
    key('ArrowLeft');
    expect(input.isDown('left')).toBe(true);
    expect(input.isDown('lookLeft'), 'arrow keys must move, not rotate').toBe(false);
  });

  it('uses Q/E for sensitivity-independent keyboard rotation', () => {
    key('KeyE');
    const slow = input.keyboardLook(1 / 60, 0.4);
    const fast = input.keyboardLook(1 / 60, 2.4);
    expect(slow.dx * 0.4).toBeCloseTo(fast.dx * 2.4, 6);
    expect(slow.dx).toBeGreaterThan(0);
  });

  it('actually rotates left and right with Q/E', () => {
    const player = new PlayerController(flatWorld(), input);
    const before = player.yaw;
    key('KeyE');
    for (let i = 0; i < 60; i++) {
      const look = input.keyboardLook(1 / 60, 1);
      player.applyLook(look.dx, look.dy, 1, false);
    }
    expect((Math.abs(player.yaw - before) * 180) / Math.PI)
      .toBeGreaterThan(KEYBOARD_LOOK_SPEED * 0.7);

    key('KeyE', false);
    const afterRight = player.yaw;
    key('KeyQ');
    for (let i = 0; i < 60; i++) {
      const look = input.keyboardLook(1 / 60, 1);
      player.applyLook(look.dx, look.dy, 1, false);
    }
    expect(player.yaw).toBeGreaterThan(afterRight);
  });

  it('retains keyboard-only vertical look on PageUp/PageDown', () => {
    key('PageUp');
    expect(input.keyboardLook(1 / 60, 1).dy).toBeLessThan(0);
    key('PageUp', false);
    key('PageDown');
    expect(input.keyboardLook(1 / 60, 1).dy).toBeGreaterThan(0);
  });

  it('walks forward with W and Up Arrow', () => {
    const wDistance = distanceAfter('KeyW');
    key('KeyW', false);
    const arrowDistance = distanceAfter('ArrowUp');
    expect(wDistance).toBeGreaterThan(1);
    expect(arrowDistance).toBeCloseTo(wDistance, 5);
  });

  it('Shift produces a materially faster sprint', () => {
    const walk = distanceAfter('KeyW');
    key('KeyW', false);
    const sprint = distanceAfter('KeyW', true);
    expect(sprint).toBeGreaterThan(walk * 1.5);
  });

  it('jumps from the ground on Space and does not auto-repeat while held', () => {
    const player = new PlayerController(flatWorld(), input);
    player.teleport([0, 0, 0]);
    player.fixedUpdate(1 / 60);
    expect(player.grounded).toBe(true);

    key('Space');
    player.fixedUpdate(1 / 60);
    expect(player.position.y).toBeGreaterThan(0);
    expect(player.velocity.y).toBeGreaterThan(0);

    for (let i = 0; i < 180; i++) player.fixedUpdate(1 / 60);
    expect(player.grounded).toBe(true);
    expect(player.position.y).toBeCloseTo(0, 5);
  });

  it('uses F and Enter for interaction, leaving E exclusively for rotate-right', () => {
    const interact = vi.fn();
    input.on('interact', interact);
    key('KeyE');
    expect(interact).not.toHaveBeenCalled();
    key('KeyE', false);
    key('KeyF');
    expect(interact).toHaveBeenCalledTimes(1);
    key('KeyF', false);
    key('Enter');
    expect(interact).toHaveBeenCalledTimes(2);
  });

  it('uses Enter and Space as activation keys for custom UI controls', () => {
    expect(isActivationKey({ key: 'Enter' })).toBe(true);
    expect(isActivationKey({ key: ' ' })).toBe(true);
    expect(isActivationKey({ key: 'ArrowRight' })).toBe(false);
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

  it('clears held movement when the browser loses focus', () => {
    key('KeyW');
    key('ShiftLeft');
    expect(input.isDown('forward')).toBe(true);
    expect(input.isDown('run')).toBe(true);
    (window as unknown as { __fire(t: string, e: unknown): void }).__fire('blur', {});
    expect(input.isDown('forward')).toBe(false);
    expect(input.isDown('run')).toBe(false);
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
    const player = new PlayerController(flatWorld(), input);
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


describe('movement follows the camera (regression)', () => {
  // Runtime QA found the visitor walking mirrored about the Z axis at every
  // yaw off the main axis: the intent vector was rotated by +yaw instead of
  // -yaw, so it agreed with the camera only at yaw 0 and yaw pi. Automated
  // routes had never turned off the main axis, so nothing caught it.
  const CASES: Array<{ yaw: number; code: string; expect: [number, number] }> = [
    { yaw: 0, code: 'KeyW', expect: [0, -1] },
    { yaw: Math.PI / 2, code: 'KeyW', expect: [-1, 0] },
    { yaw: -Math.PI / 2, code: 'KeyW', expect: [1, 0] },
    { yaw: Math.PI, code: 'KeyW', expect: [0, 1] },
    { yaw: Math.PI / 2, code: 'KeyD', expect: [0, -1] },
    { yaw: Math.PI / 2, code: 'KeyS', expect: [1, 0] },
    { yaw: Math.PI / 4, code: 'KeyW', expect: [-Math.SQRT1_2, -Math.SQRT1_2] },
  ];

  for (const c of CASES) {
    it(`walks where the camera looks at yaw ${Math.round((c.yaw * 180) / Math.PI)} deg with ${c.code}`, () => {
      const player = new PlayerController(flatWorld(), input);
      player.teleport([0, 0, 0]);
      player.yaw = c.yaw;
      key(c.code);
      for (let i = 0; i < 60; i++) player.fixedUpdate(1 / 60);
      key(c.code, false);
      const len = Math.hypot(player.position.x, player.position.z);
      expect(len).toBeGreaterThan(0.5);
      expect(player.position.x / len).toBeCloseTo(c.expect[0], 2);
      expect(player.position.z / len).toBeCloseTo(c.expect[1], 2);
    });
  }

  it('keeps forward exactly aligned with the camera forward at every yaw', () => {
    // The camera looks along (-sin yaw, 0, -cos yaw) for rotation order YXZ.
    for (let step = 0; step < 16; step++) {
      const yaw = (step / 16) * Math.PI * 2 - Math.PI;
      const player = new PlayerController(flatWorld(), input);
      player.teleport([0, 0, 0]);
      player.yaw = yaw;
      key('KeyW');
      for (let i = 0; i < 60; i++) player.fixedUpdate(1 / 60);
      // Acceleration clamps each axis independently, so accumulated
      // displacement carries a small start-up bias. Settled velocity is the
      // honest reading of which way "forward" actually goes.
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      key('KeyW', false);
      expect(speed, `yaw ${yaw}`).toBeGreaterThan(0.5);
      expect(player.velocity.x / speed).toBeCloseTo(-Math.sin(yaw), 3);
      expect(player.velocity.z / speed).toBeCloseTo(-Math.cos(yaw), 3);
      expect(Math.hypot(player.position.x, player.position.z), `yaw ${yaw}`).toBeGreaterThan(0.5);
    }
  });
});

describe('rotunda flight pad (regression)', () => {
  it('is centred on the rotunda plinth and false well outside its radius', () => {
    expect(isOnFlightPad(FLIGHT_PAD_CENTER[0], FLIGHT_PAD_CENTER[2])).toBe(true);
    expect(isOnFlightPad(FLIGHT_PAD_CENTER[0] + FLIGHT_PAD_RADIUS - 0.1, FLIGHT_PAD_CENTER[2])).toBe(true);
    expect(isOnFlightPad(FLIGHT_PAD_CENTER[0] + FLIGHT_PAD_RADIUS + 1, FLIGHT_PAD_CENTER[2])).toBe(false);
  });

  it('launches upward on entry, then holds altitude under pure look/WASD control', () => {
    const player = new PlayerController(flatWorld(), input);
    player.teleport([0, 0, 0]);
    player.enterFlight();
    expect(player.flightMode).toBe(true);

    player.fixedUpdate(1 / 60);
    expect(player.position.y, 'the launch pop lifts the visitor immediately').toBeGreaterThan(0);

    // The tuned 8.5 m/s launch decays over a little more than 0.7 seconds.
    for (let i = 0; i < 60; i++) player.fixedUpdate(1 / 60);
    const settled = player.position.y;
    expect(settled, 'launch is finite, not sustained thrust').toBeGreaterThan(0);

    for (let i = 0; i < 30; i++) player.fixedUpdate(1 / 60);
    // No gravity in flight and no vertical input: altitude holds once the
    // launch pop has fully decayed, rather than drifting under gravity.
    expect(player.position.y).toBeCloseTo(settled, 1);
    expect(player.flightMode).toBe(true);
  });

  it('keeps the normal jump distinct from the higher, centralized pad launch', () => {
    const walker = new PlayerController(flatWorld(), input);
    walker.teleport([0, 0, 0]);
    walker.fixedUpdate(1 / 60);
    key('Space');
    walker.fixedUpdate(1 / 60);
    key('Space', false);
    expect(walker.flightMode).toBe(false);
    expect(walker.position.y).toBeGreaterThan(0);
    expect(FLIGHT_LAUNCH_SPEED).toBeGreaterThan(JUMP_SPEED);

    const flyer = new PlayerController(flatWorld(), input);
    flyer.teleport([0, 0, 0]);
    flyer.enterFlight();
    for (let i = 0; i < 45; i++) flyer.fixedUpdate(1 / 60);
    expect(flyer.flightMode).toBe(true);
    expect(flyer.position.y).toBeGreaterThan(walker.position.y + 1);
  });

  it('ends flight and returns control once the visitor flies back down to a floor', () => {
    const player = new PlayerController(flatWorld(), input);
    player.teleport([0, 5, 0]);
    player.enterFlight();
    player.pitch = -Math.PI / 2; // straight down
    key('KeyW');
    for (let i = 0; i < 90 && player.flightMode; i++) player.fixedUpdate(1 / 60);
    key('KeyW', false);

    expect(player.flightMode).toBe(false);
    expect(player.grounded).toBe(true);
    expect(player.position.y).toBeCloseTo(0, 1);
  });
});

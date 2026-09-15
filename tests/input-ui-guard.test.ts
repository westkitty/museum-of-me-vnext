import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '../src/player/Input';

class FakeElement {
  readonly listeners = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, fn: (event: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(): void {}
  requestPointerLock(): void {}
}

let input: InputManager;
let fireWindow: (type: string, event: unknown) => void;

beforeEach(() => {
  const canvas = new FakeElement();
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  fireWindow = (type, event) => {
    for (const fn of listeners.get(type) ?? []) fn(event);
  };

  vi.stubGlobal('window', {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener: () => {},
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
  input.dispose();
  vi.unstubAllGlobals();
});

function keydown(code: string, target: {
  tagName: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}): void {
  fireWindow('keydown', {
    code,
    target,
    preventDefault: vi.fn(),
  });
}

function keyup(code: string, target: { tagName: string }): void {
  fireWindow('keyup', { code, target, preventDefault: vi.fn() });
}

describe('semantic UI input isolation', () => {
  it('does not fire museum interact or jump actions from native controls', () => {
    const interact = vi.fn();
    const jump = vi.fn();
    input.on('interact', interact);
    input.on('jump', jump);

    keydown('Enter', { tagName: 'BUTTON' });
    keydown('Space', { tagName: 'INPUT' });
    keydown('KeyF', { tagName: 'SELECT' });

    expect(interact).not.toHaveBeenCalled();
    expect(jump).not.toHaveBeenCalled();
  });

  it('does not fire global bindings from custom role=button controls', () => {
    const interact = vi.fn();
    input.on('interact', interact);

    keydown('Enter', {
      tagName: 'g',
      getAttribute: (name) => name === 'role' ? 'button' : null,
    });

    expect(interact).not.toHaveBeenCalled();
  });


  it('opens Visit Thread once per T press and never from a focused control', () => {
    const thread = vi.fn();
    input.on('thread', thread);

    keydown('KeyT', { tagName: 'CANVAS' });
    keydown('KeyT', { tagName: 'CANVAS' });
    expect(thread).toHaveBeenCalledTimes(1);
    keyup('KeyT', { tagName: 'CANVAS' });
    keydown('KeyT', { tagName: 'BUTTON' });
    expect(thread).toHaveBeenCalledTimes(1);
  });

  it('keeps the ordinary canvas/global interaction path intact', () => {
    const interact = vi.fn();
    input.on('interact', interact);

    keydown('Enter', { tagName: 'CANVAS' });

    expect(interact).toHaveBeenCalledTimes(1);
  });
});

/**
 * The restoration made installations operable by raw key code. That capture and
 * the semantic-control isolation contract must be gated by the SAME decision,
 * or a digit pressed inside a panel would mutate the installation behind it.
 */
describe('installation raw code capture respects semantic UI isolation', () => {
  it('does not reach raw capture from native semantic controls', () => {
    const captured: string[] = [];
    input.setCodeCapture((code, down) => { if (down) captured.push(code); return true; });

    for (const tag of ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A']) {
      keydown('Digit1', { tagName: tag });
      keydown('KeyR', { tagName: tag });
      keydown('Space', { tagName: tag });
    }

    expect(captured).toEqual([]);
  });

  it('does not reach raw capture from contenteditable or role=button controls', () => {
    const captured: string[] = [];
    input.setCodeCapture((code, down) => { if (down) captured.push(code); return true; });

    keydown('Digit2', { tagName: 'DIV', isContentEditable: true });
    keydown('Digit3', {
      tagName: 'g',
      getAttribute: (name) => name === 'role' ? 'button' : null,
    });

    expect(captured).toEqual([]);
  });

  it('does not reach raw capture while a modal surface holds input', () => {
    const captured: string[] = [];
    input.setCodeCapture((code, down) => { if (down) captured.push(code); return true; });

    input.uiCaptured = true;
    keydown('Digit1', { tagName: 'CANVAS' });
    keydown('KeyO', { tagName: 'BODY' });
    expect(captured).toEqual([]);

    input.uiCaptured = false;
    keydown('Digit1', { tagName: 'CANVAS' });
    expect(captured).toEqual(['Digit1']);
  });

  it('still captures legitimate world-level source installation codes', () => {
    const captured: string[] = [];
    input.setCodeCapture((code, down) => { if (down) captured.push(code); return true; });

    // Selector/reset codes that are NOT part of the ordinary museum bindings.
    keydown('Digit1', { tagName: 'CANVAS' });
    keydown('Digit5', { tagName: 'BODY' });
    keydown('KeyR', { tagName: 'CANVAS' });
    keydown('KeyB', { tagName: 'CANVAS' });
    keydown('KeyX', { tagName: 'CANVAS' });
    // ...and codes that ARE bound, which an engaged installation claims first.
    keydown('Space', { tagName: 'CANVAS' });
    keydown('KeyW', { tagName: 'CANVAS' });

    expect(captured).toEqual(['Digit1', 'Digit5', 'KeyR', 'KeyB', 'KeyX', 'Space', 'KeyW']);
  });

  it('lets a declined code fall through to the ordinary museum binding', () => {
    const interact = vi.fn();
    input.on('interact', interact);
    // Capture installed but declining everything, as when nothing is engaged.
    input.setCodeCapture(() => false);

    keydown('Enter', { tagName: 'CANVAS' });
    expect(interact).toHaveBeenCalledTimes(1);
  });

  it('claims a bound code away from movement while an installation is engaged', () => {
    input.setCodeCapture(() => true);
    keydown('KeyW', { tagName: 'CANVAS' });
    expect(input.isDown('forward')).toBe(false);
  });

  it('always releases on keyup so a key cannot be stranded as held', () => {
    const events: Array<[string, boolean]> = [];
    input.setCodeCapture((code, down) => { events.push([code, down]); return true; });

    keydown('KeyW', { tagName: 'CANVAS' });
    // Focus moved into a panel mid-press; the release must still be delivered.
    keyup('KeyW', { tagName: 'BUTTON' });

    expect(events).toEqual([['KeyW', true], ['KeyW', false]]);
  });

  it('leaves ordinary movement and interact intact when nothing is engaged', () => {
    const interact = vi.fn();
    input.on('interact', interact);

    keydown('KeyW', { tagName: 'CANVAS' });
    expect(input.isDown('forward')).toBe(true);
    keyup('KeyW', { tagName: 'CANVAS' });
    expect(input.isDown('forward')).toBe(false);

    keydown('KeyF', { tagName: 'CANVAS' });
    expect(interact).toHaveBeenCalledTimes(1);
  });
});

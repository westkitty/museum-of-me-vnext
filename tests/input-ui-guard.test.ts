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

  it('keeps the ordinary canvas/global interaction path intact', () => {
    const interact = vi.fn();
    input.on('interact', interact);

    keydown('Enter', { tagName: 'CANVAS' });

    expect(interact).toHaveBeenCalledTimes(1);
  });
});

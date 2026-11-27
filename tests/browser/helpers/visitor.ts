import { expect, type Page } from '@playwright/test';
import { TouchVisitor } from './touch-journey';
import {
  aimAt, enterFromAnchor, interact, pitchTo, turnTo, walkPath, walkTo, type Pose, type WalkOptions,
} from './world-journey';

/**
 * One visitor-facing input method for a world journey. A journey written
 * against this interface runs unchanged with the keyboard (W/Shift/Q/E,
 * PageUp/PageDown, F, clicks) and with touch (left-half stick, right-half look
 * drags, centre-dot taps, tapped buttons). Neither adapter writes to the page.
 */
export interface Visitor {
  readonly kind: 'keyboard' | 'touch';
  walkTo(x: number, z: number, opts?: WalkOptions): Promise<Pose>;
  walkPath(path: readonly (readonly [number, number])[], opts?: WalkOptions): Promise<Pose>;
  turnTo(yaw: number, tolerance?: number): Promise<void>;
  pitchTo(pitch: number, tolerance?: number): Promise<void>;
  aimAt(target: readonly [number, number, number], id: string): Promise<void>;
  interact(): Promise<void>;
  enterFromAnchor(title: RegExp, pocketId: string): Promise<void>;
  /** Hold forward (W, or the stick pushed fully forward) or let go. */
  holdForward(on: boolean): Promise<void>;
  /** Press a visible HUD button (click, or a finger tap). */
  pressButton(name: string | RegExp): Promise<void>;
}

export function keyboardVisitor(page: Page): Visitor {
  return {
    kind: 'keyboard',
    walkTo: (x, z, opts) => walkTo(page, x, z, opts),
    walkPath: (path, opts) => walkPath(page, path, opts),
    turnTo: (yaw, tolerance) => turnTo(page, yaw, tolerance),
    pitchTo: (pitch, tolerance) => pitchTo(page, pitch, tolerance),
    aimAt: (target, id) => aimAt(page, target, id),
    interact: () => interact(page),
    enterFromAnchor: (title, id) => enterFromAnchor(page, title, id),
    holdForward: (on) => (on ? page.keyboard.down('w') : page.keyboard.up('w')),
    pressButton: (name) => page.getByRole('button', { name, exact: typeof name === 'string' }).click(),
  };
}

export async function touchVisitor(page: Page): Promise<Visitor> {
  const touch = await TouchVisitor.attach(page);
  return {
    kind: 'touch',
    walkTo: (x, z, opts) => touch.walkTo(x, z, opts),
    walkPath: (path, opts) => touch.walkPath(path, opts),
    turnTo: (yaw, tolerance) => touch.turnTo(yaw, tolerance),
    pitchTo: (pitch, tolerance) => touch.pitchTo(pitch, tolerance),
    aimAt: (target, id) => touch.aimAt(target, id),
    interact: () => touch.interact(),
    enterFromAnchor: (title, id) => touch.enterFromAnchor(title, id),
    holdForward: (on) => touch.holdForward(on),
    pressButton: (name) => touch.tapButton(name),
  };
}

/**
 * The page is in touch mode and shows no keyboard-only instruction: no key
 * cap in the interaction cue and no visible <kbd> anywhere in the HUD.
 */
export async function expectTouchAffordances(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.__museum!.input.touchActive)).toBe(true);
  const visibleKeys = await page.evaluate(() => [...document.querySelectorAll('kbd')]
    .filter((el) => {
      const box = (el as HTMLElement).getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    })
    .map((el) => `${el.textContent} in ${(el.parentElement?.className || el.parentElement?.tagName) ?? '?'}`));
  expect(visibleKeys, 'touch mode must not show keyboard key caps').toEqual([]);
}

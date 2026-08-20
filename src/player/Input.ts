/**
 * Action-based input. Systems ask for actions, never for keys, so rebinding and
 * alternative input paths (touch, gamepad) plug in without touching consumers.
 */
export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'run' | 'interact' | 'map' | 'journal'
  | 'settings' | 'diagnostics' | 'accessibility';

const BINDINGS: Record<string, Action> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'interact', Enter: 'interact',
  KeyM: 'map',
  KeyJ: 'journal',
  KeyO: 'settings',
  Backquote: 'diagnostics',
  KeyH: 'accessibility',
};

/** Actions that fire once per press rather than being held. */
const EDGE_ACTIONS = new Set<Action>(['interact', 'map', 'journal', 'settings', 'diagnostics', 'accessibility']);

export class InputManager {
  private readonly held = new Set<Action>();
  private readonly pressedThisFrame = new Set<Action>();
  private readonly listeners = new Map<Action, Set<() => void>>();

  mouseDeltaX = 0;
  mouseDeltaY = 0;
  pointerLocked = false;

  /** True while any modal DOM surface has focus; movement is suppressed. */
  uiCaptured = false;

  private readonly canvas: HTMLElement;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onCanvasClick);
  }

  isDown(action: Action): boolean {
    return !this.uiCaptured && this.held.has(action);
  }

  /** Subscribe to an edge action. Returns an unsubscribe function. */
  on(action: Action, fn: () => void): () => void {
    let set = this.listeners.get(action);
    if (!set) this.listeners.set(action, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }

  /** Called once per frame by the loop, after systems have read input. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  requestPointerLock(): void {
    if (this.uiCaptured) return;
    void this.canvas.requestPointerLock?.();
  }

  releasePointerLock(): void {
    document.exitPointerLock?.();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('click', this.onCanvasClick);
    this.listeners.clear();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const action = BINDINGS[e.code];
    if (!action) return;
    // Never steal keys from a real text field.
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    if (EDGE_ACTIONS.has(action)) {
      if (this.pressedThisFrame.has(action) || this.held.has(action)) return;
      this.pressedThisFrame.add(action);
      this.held.add(action);
      for (const fn of this.listeners.get(action) ?? []) fn();
      e.preventDefault();
      return;
    }
    this.held.add(action);
    e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = BINDINGS[e.code];
    if (action) this.held.delete(action);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked) this.held.clear();
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };

  private readonly onCanvasClick = (): void => {
    if (!this.pointerLocked) this.requestPointerLock();
  };
}

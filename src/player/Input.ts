/**
 * Action-based input. Systems ask for actions, never for keys, so rebinding and
 * alternative input paths (touch, gamepad) plug in without touching consumers.
 */
export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'lookLeft' | 'lookRight' | 'lookUp' | 'lookDown'
  | 'run' | 'jump' | 'interact' | 'map' | 'journal'
  | 'settings' | 'diagnostics' | 'accessibility';

/**
 * Directional keys are movement. WASD and the arrow cluster are deliberately
 * redundant so either hand can drive the visitor. Q/E provide keyboard yaw;
 * PageUp/PageDown retain keyboard-only vertical look without stealing arrows
 * from movement. Mouse/touch look remain available in parallel.
 */
const BINDINGS: Record<string, Action> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyQ: 'lookLeft',
  KeyE: 'lookRight',
  PageUp: 'lookUp',
  PageDown: 'lookDown',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
  KeyF: 'interact', Enter: 'interact',
  KeyM: 'map',
  KeyJ: 'journal',
  KeyO: 'settings',
  Backquote: 'diagnostics',
  KeyH: 'accessibility',
};

/** Degrees per second when looking with the keyboard. */
export const KEYBOARD_LOOK_SPEED = 110;

/** Actions that fire once per physical key press rather than being held. */
const EDGE_ACTIONS = new Set<Action>([
  'jump', 'interact', 'map', 'journal', 'settings', 'diagnostics', 'accessibility',
]);

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class InputManager {
  private readonly held = new Set<Action>();
  /**
   * Edge actions can have more than one physical binding (for example F and
   * Enter both interact). Track the physical key code, not just the action, so
   * one binding never suppresses another and keyboard auto-repeat still fires
   * only once until that specific key is released.
   */
  private readonly edgeHeldCodes = new Set<string>();
  private readonly listeners = new Map<Action, Set<() => void>>();

  mouseDeltaX = 0;
  mouseDeltaY = 0;
  pointerLocked = false;
  /** Touch look delta, in the same units as the mouse delta. */
  touchDeltaX = 0;
  touchDeltaY = 0;
  /** Virtual stick, -1..1 on each axis. Zero when no touch is active. */
  touchMoveX = 0;
  touchMoveY = 0;
  /** True once any touch has been seen; switches the HUD to touch affordances. */
  touchActive = false;

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
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchcancel', this.onTouchEnd);
  }

  /** Keyboard look contribution for this frame, in mouse-delta units. */
  keyboardLook(dt: number, sensitivity: number): { dx: number; dy: number } {
    const step = (KEYBOARD_LOOK_SPEED * dt * Math.PI) / 180;
    // The player controller multiplies by LOOK_SCALE and sensitivity, so undo
    // both here to keep keyboard turning speed independent of mouse settings.
    const scale = 1 / (0.0022 * Math.max(0.0001, sensitivity));
    let dx = 0;
    let dy = 0;
    if (this.isDown('lookLeft')) dx -= step * scale;
    if (this.isDown('lookRight')) dx += step * scale;
    if (this.isDown('lookUp')) dy -= step * scale;
    if (this.isDown('lookDown')) dy += step * scale;
    return { dx, dy };
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
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.touchDeltaX = 0;
    this.touchDeltaY = 0;
  }

  requestPointerLock(): void {
    if (this.uiCaptured) return;
    void this.canvas.requestPointerLock?.();
  }

  releasePointerLock(): void {
    document.exitPointerLock?.();
  }

  dispose(): void {
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
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
      if (this.edgeHeldCodes.has(e.code)) return;
      this.edgeHeldCodes.add(e.code);
      for (const fn of this.listeners.get(action) ?? []) fn();
      e.preventDefault();
      return;
    }
    this.held.add(action);
    e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = BINDINGS[e.code];
    if (!action) return;
    if (EDGE_ACTIONS.has(action)) this.edgeHeldCodes.delete(e.code);
    else this.held.delete(action);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.edgeHeldCodes.clear();
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked) {
      this.held.clear();
      this.edgeHeldCodes.clear();
    }
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };

  private readonly onCanvasClick = (): void => {
    // Touch devices cannot hold a pointer lock and do not need one.
    if (this.touchActive) return;
    if (!this.pointerLocked) this.requestPointerLock();
  };

  // -- touch: left half is a virtual stick, right half looks --
  private moveTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };

  private readonly onTouchStart = (e: TouchEvent): void => {
    this.touchActive = true;
    if (this.uiCaptured) return;
    for (const touch of Array.from(e.changedTouches)) {
      const left = touch.clientX < window.innerWidth / 2;
      if (left && this.moveTouchId === null) {
        this.moveTouchId = touch.identifier;
        this.moveOrigin = { x: touch.clientX, y: touch.clientY };
      } else if (!left && this.lookTouchId === null) {
        this.lookTouchId = touch.identifier;
        this.lookLast = { x: touch.clientX, y: touch.clientY };
      }
    }
    e.preventDefault();
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    if (this.uiCaptured) return;
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === this.moveTouchId) {
        const radius = 70;
        this.touchMoveX = clamp((touch.clientX - this.moveOrigin.x) / radius, -1, 1);
        this.touchMoveY = clamp((touch.clientY - this.moveOrigin.y) / radius, -1, 1);
      } else if (touch.identifier === this.lookTouchId) {
        this.touchDeltaX += touch.clientX - this.lookLast.x;
        this.touchDeltaY += touch.clientY - this.lookLast.y;
        this.lookLast = { x: touch.clientX, y: touch.clientY };
      }
    }
    e.preventDefault();
  };

  private readonly onTouchEnd = (e: TouchEvent): void => {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === this.moveTouchId) {
        this.moveTouchId = null;
        this.touchMoveX = 0;
        this.touchMoveY = 0;
      } else if (touch.identifier === this.lookTouchId) {
        this.lookTouchId = null;
      }
    }
  };
}

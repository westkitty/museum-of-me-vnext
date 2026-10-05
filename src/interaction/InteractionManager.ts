import * as THREE from 'three';
import { resolveExhibitLabel, type ExhibitControl } from '../exhibits/contract';

interface RegisteredControl extends ExhibitControl {
  readonly exhibitId: string;
}

/** Shared visitor reach used by interaction and Workshop conservation. */
export const INTERACTION_REACH = 4.2;
/** Camera stays on layer 0; interaction-only proxy geometry lives here. */
export const INTERACTION_ONLY_LAYER = 1;

export interface InteractionFocus {
  readonly exhibitId: string;
  readonly label: string;
  readonly description: string;
}

/**
 * The museum's one interaction surface. Exhibits register world-space controls;
 * this manager decides what the visitor is looking at, shows the cue, and routes
 * the interact action. No exhibit ever reads the keyboard or the mouse.
 */
export class InteractionManager {
  private readonly controls = new Map<THREE.Object3D, RegisteredControl>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly raycastObjects: THREE.Object3D[] = [];
  private readonly raycastHits: THREE.Intersection[] = [];
  private raycastElapsed = INTERACTION_SAMPLE_INTERVAL;
  private controlsDirty = true;
  private focused: RegisteredControl | null = null;
  /** Maximum reach, metres. Beyond this the visitor must walk closer. */
  reach = INTERACTION_REACH;

  private readonly listeners = new Set<(focus: InteractionFocus | null) => void>();

  constructor() {
    // Layer 0 remains the ordinary visible scene. Layer 1 is reserved for
    // invisible interaction proxies that must raycast but never render.
    this.raycaster.layers.enable(INTERACTION_ONLY_LAYER);
  }

  register(exhibitId: string, control: ExhibitControl): () => void {
    const entry: RegisteredControl = { ...control, exhibitId };
    this.controls.set(control.object, entry);
    this.controlsDirty = true;
    control.object.userData.interactive = true;
    return () => {
      if (this.focused?.object === control.object) this.setFocus(null);
      this.controls.delete(control.object);
      this.controlsDirty = true;
    };
  }

  /** Remove every control belonging to an exhibit. Used on unmount. */
  clearExhibit(exhibitId: string): void {
    for (const [object, entry] of this.controls) {
      if (entry.exhibitId === exhibitId) {
        if (this.focused?.object === object) this.setFocus(null);
        this.controls.delete(object);
        this.controlsDirty = true;
      }
    }
  }

  onFocusChange(fn: (focus: InteractionFocus | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get currentFocus(): InteractionFocus | null {
    return this.focused
      ? {
          exhibitId: this.focused.exhibitId,
          label: resolveExhibitLabel(this.focused.label),
          description: this.focused.description ?? resolveExhibitLabel(this.focused.label),
        }
      : null;
  }

  /** Sample focus at 30 Hz; controls and hits reuse stable scratch buffers. */
  update(camera: THREE.Camera, dt = INTERACTION_SAMPLE_INTERVAL): void {
    this.raycastElapsed += Math.max(0, dt);
    if (!this.controlsDirty && this.raycastElapsed < INTERACTION_SAMPLE_INTERVAL) return;
    this.raycastElapsed = 0;
    this.controlsDirty = false;

    if (this.controls.size === 0) {
      this.setFocus(null);
      return;
    }
    this.raycaster.setFromCamera(CENTRE, camera);
    this.raycaster.far = this.reach;

    this.raycastObjects.length = 0;
    for (const object of this.controls.keys()) {
      if (isVisible(object)) this.raycastObjects.push(object);
    }
    if (this.raycastObjects.length === 0) {
      this.setFocus(null);
      return;
    }

    this.raycastHits.length = 0;
    this.raycaster.intersectObjects(this.raycastObjects, true, this.raycastHits);
    if (this.raycastHits.length === 0) {
      this.setFocus(null);
      return;
    }
    // A hit may be a descendant of the registered object.
    let node: THREE.Object3D | null = this.raycastHits[0].object;
    while (node && !this.controls.has(node)) node = node.parent;
    this.setFocus(node ? this.controls.get(node)! : null);
  }

  /** The visitor pressed interact. Returns true if something handled it. */
  activate(): boolean {
    if (!this.focused) return false;
    try {
      this.focused.activate();
    } catch (err) {
      console.error('[Interaction] control threw', err);
    }
    return true;
  }

  /** Pointer motion while interact is held, for drag-style controls. */
  drag(dx: number, dy: number): void {
    this.focused?.drag?.(dx, dy);
  }

  get controlCount(): number {
    return this.controls.size;
  }

  private setFocus(next: RegisteredControl | null): void {
    if (this.focused === next) return;
    this.focused = next;
    const payload = this.currentFocus;
    for (const fn of this.listeners) fn(payload);
  }

  dispose(): void {
    this.controls.clear();
    this.raycastObjects.length = 0;
    this.raycastHits.length = 0;
    this.listeners.clear();
    this.focused = null;
  }
}

const INTERACTION_SAMPLE_INTERVAL = 1 / 30;
const CENTRE = new THREE.Vector2(0, 0);

function isVisible(o: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = o;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

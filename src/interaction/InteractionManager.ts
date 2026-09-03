import * as THREE from 'three';
import { resolveExhibitLabel, type ExhibitControl } from '../exhibits/contract';

interface RegisteredControl extends ExhibitControl {
  readonly exhibitId: string;
}

/** Shared visitor reach used by interaction and Workshop conservation. */
export const INTERACTION_REACH = 4.2;

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
  private focused: RegisteredControl | null = null;
  /** Maximum reach, metres. Beyond this the visitor must walk closer. */
  reach = INTERACTION_REACH;

  private readonly listeners = new Set<(focus: InteractionFocus | null) => void>();

  register(exhibitId: string, control: ExhibitControl): () => void {
    const entry: RegisteredControl = { ...control, exhibitId };
    this.controls.set(control.object, entry);
    control.object.userData.interactive = true;
    return () => {
      if (this.focused?.object === control.object) this.setFocus(null);
      this.controls.delete(control.object);
    };
  }

  /** Remove every control belonging to an exhibit. Used on unmount. */
  clearExhibit(exhibitId: string): void {
    for (const [object, entry] of [...this.controls]) {
      if (entry.exhibitId === exhibitId) {
        if (this.focused?.object === object) this.setFocus(null);
        this.controls.delete(object);
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

  /** Once per frame from the variable-step phase. */
  update(camera: THREE.Camera): void {
    if (this.controls.size === 0) {
      this.setFocus(null);
      return;
    }
    this.raycaster.setFromCamera(CENTRE, camera);
    this.raycaster.far = this.reach;

    const objects = [...this.controls.keys()].filter((o) => isVisible(o));
    if (objects.length === 0) {
      this.setFocus(null);
      return;
    }
    const hits = this.raycaster.intersectObjects(objects, true);
    if (hits.length === 0) {
      this.setFocus(null);
      return;
    }
    // A hit may be a descendant of the registered object.
    let node: THREE.Object3D | null = hits[0].object;
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
    this.listeners.clear();
    this.focused = null;
  }
}

const CENTRE = new THREE.Vector2(0, 0);

function isVisible(o: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = o;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

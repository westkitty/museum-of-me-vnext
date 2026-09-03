import * as THREE from 'three';

export type WorkshopTransformOperation = 'translate' | 'rotate' | 'scale';
export type AuthorableCollisionPolicy = 'visual-only' | 'shared-transform';

export interface AuthorableSceneDefinition {
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly operations: readonly WorkshopTransformOperation[];
  readonly collisionPolicy: AuthorableCollisionPolicy;
  /** Conservative local bounds used by the shared conservation validator. */
  readonly bounds: {
    readonly halfX: number;
    readonly halfY: number;
    readonly halfZ: number;
    readonly minY: number;
    readonly maxY: number;
  };
}

export interface AuthorableSceneEntry extends AuthorableSceneDefinition {
  readonly root: THREE.Object3D;
  readonly baseline: AuthorableSceneTransform;
  readonly persistenceKey: string;
}

export interface AuthorableSceneTransform {
  readonly position: [number, number, number];
  readonly rotation: [number, number, number];
  readonly scale: [number, number, number];
}

const visualOnly = ['translate', 'rotate', 'scale'] as const;

/**
 * The only existing-scene objects the development Workshop may mutate.
 * Runtime roots are registered separately after their builders have created
 * them; this table keeps IDs, labels, safety policy, and bounds deterministic
 * for both the browser and the localhost save bridge.
 */
export const AUTHORABLE_SCENE_DEFINITIONS: readonly AuthorableSceneDefinition[] = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `arrival-garden-shrub-${String(index + 1).padStart(2, '0')}`,
    label: `Arrival garden shrub ${index + 1}`,
    source: 'ArrivalGarden',
    operations: visualOnly,
    collisionPolicy: 'visual-only' as const,
    bounds: { halfX: 1.6, halfY: 1.5, halfZ: 1.6, minY: 0, maxY: 3 },
  })),
  {
    id: 'vestibule-plant-left', label: 'Vestibule plant left', source: 'EnvironmentDressing',
    operations: visualOnly, collisionPolicy: 'visual-only',
    bounds: { halfX: 1.1, halfY: 1.8, halfZ: 1.1, minY: 0, maxY: 3.2 },
  },
  {
    id: 'vestibule-plant-right', label: 'Vestibule plant right', source: 'EnvironmentDressing',
    operations: visualOnly, collisionPolicy: 'visual-only',
    bounds: { halfX: 1.1, halfY: 1.8, halfZ: 1.1, minY: 0, maxY: 3.2 },
  },
  {
    id: 'rotunda-information-counter', label: 'Information counter', source: 'EnvironmentDressing',
    operations: visualOnly, collisionPolicy: 'visual-only',
    bounds: { halfX: 2.6, halfY: 1.6, halfZ: 1.0, minY: 0, maxY: 1.6 },
  },
  {
    id: 'rotunda-information-sign', label: 'Information sign', source: 'EnvironmentDressing',
    operations: visualOnly, collisionPolicy: 'visual-only',
    bounds: { halfX: 1.0, halfY: 0.4, halfZ: 0.12, minY: 0, maxY: 0.8 },
  },
] as const;

const DEFINITIONS_BY_ID = new Map(AUTHORABLE_SCENE_DEFINITIONS.map((definition) => [definition.id, definition]));

export function authorableSceneDefinition(id: string): AuthorableSceneDefinition | null {
  return DEFINITIONS_BY_ID.get(id) ?? null;
}

function transformOf(root: THREE.Object3D): AuthorableSceneTransform {
  return {
    position: [root.position.x, root.position.y, root.position.z],
    rotation: [root.rotation.x, root.rotation.y, root.rotation.z],
    scale: [root.scale.x, root.scale.y, root.scale.z],
  };
}

function applyTransform(root: THREE.Object3D, transform: AuthorableSceneTransform): void {
  root.position.set(...transform.position);
  root.rotation.set(...transform.rotation);
  root.scale.set(...transform.scale);
}

export class AuthorableSceneRegistry {
  private readonly entriesById = new Map<string, AuthorableSceneEntry>();
  private readonly entriesByRoot = new Map<THREE.Object3D, AuthorableSceneEntry>();

  constructor(entries: readonly { readonly id: string; readonly root: THREE.Object3D }[]) {
    for (const { id, root } of entries) this.register(id, root);
  }

  register(id: string, root: THREE.Object3D): AuthorableSceneEntry {
    const definition = authorableSceneDefinition(id);
    if (!definition) throw new Error(`Unknown authorable scene object: ${id}`);
    if (this.entriesById.has(id)) throw new Error(`Duplicate authorable scene object: ${id}`);
    if (this.entriesByRoot.has(root)) throw new Error(`Scene root is registered twice: ${id}`);
    const entry: AuthorableSceneEntry = {
      ...definition,
      root,
      baseline: transformOf(root),
      persistenceKey: `scene:${id}`,
    };
    this.entriesById.set(id, entry);
    this.entriesByRoot.set(root, entry);
    root.name = `authorable:${id}`;
    root.userData.authorableSceneId = id;
    root.userData.authorableSceneLabel = definition.label;
    return entry;
  }

  get(id: string): AuthorableSceneEntry | null {
    return this.entriesById.get(id) ?? null;
  }

  entryForObject(object: THREE.Object3D | null): AuthorableSceneEntry | null {
    let node = object;
    while (node) {
      const entry = this.entriesByRoot.get(node);
      if (entry) return entry;
      node = node.parent;
    }
    return null;
  }

  entries(): readonly AuthorableSceneEntry[] {
    return [...this.entriesById.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  selectableObjects(): readonly THREE.Object3D[] {
    return this.entries().map((entry) => entry.root);
  }

  apply(id: string, transform: AuthorableSceneTransform): void {
    const entry = this.get(id);
    if (!entry) throw new Error(`Unknown authorable scene object: ${id}`);
    applyTransform(entry.root, transform);
  }

  capture(id: string): AuthorableSceneTransform | null {
    const entry = this.get(id);
    return entry ? transformOf(entry.root) : null;
  }
}

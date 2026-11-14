import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { ExhibitControl } from '../exhibits/contract';
import type { SecretDefinition, SecretModel } from '../content/secrets';
import type { SecretsLog } from '../state/Secrets';
import type { ZoneId } from './layout';
import { INTERACTION_ONLY_LAYER } from '../interaction/InteractionManager';

/** Interaction ids for secret objects; never recorded as exhibit visits. */
export const SECRET_CONTROL_PREFIX = 'secret:';
export function isSecretControlId(id: string): boolean {
  return id.startsWith(SECRET_CONTROL_PREFIX);
}

export interface SecretFind {
  readonly secret: SecretDefinition;
  /** Found so far, including this one. */
  readonly found: number;
  readonly total: number;
}

/**
 * How a find is shown. The museum's default is a pop-up and a chime; a single
 * secret can be given its own presentation (its own sound, its own pop-up)
 * with `SecretSpots.setPresentation`.
 */
export type SecretPresentation = (find: SecretFind) => void;

const VERTICAL_REACH = 4;
/** Secret objects are small; aim at a generous invisible sphere around them. */
const TARGET_RADIUS = 0.6;

/**
 * Notices when the visitor finds a secret: reaching a zone or an area, or
 * interacting with a small object. Checks are a handful of distance tests per
 * frame; objects are built once per world and stay put.
 */
export class SecretSpots {
  private readonly presentations = new Map<string, SecretPresentation>();
  private readonly unbind: (() => void)[] = [];
  private readonly ids: readonly string[];
  readonly objects = new Map<string, THREE.Object3D>();

  constructor(
    private readonly secrets: readonly SecretDefinition[],
    private readonly log: SecretsLog,
    private readonly defaultPresentation: SecretPresentation,
  ) {
    this.ids = secrets.map((secret) => secret.id);
  }

  get total(): number {
    return this.secrets.length;
  }

  get foundCount(): number {
    return this.log.countOf(this.ids);
  }

  /** Give one secret its own presentation instead of the default pop-up and chime. */
  setPresentation(id: string, presentation: SecretPresentation | null): void {
    if (presentation) this.presentations.set(id, presentation);
    else this.presentations.delete(id);
  }

  /** Builds the object secrets that belong to a world into its root. */
  attachObjects(
    world: SecretDefinition['world'],
    root: THREE.Object3D,
    scope: ResourceScope,
    register: (id: string, control: ExhibitControl) => () => void,
  ): void {
    for (const secret of this.secrets) {
      if (secret.world !== world || secret.trigger.kind !== 'object' || this.objects.has(secret.id)) continue;
      const object = buildSecretModel(secret.trigger.model, scope);
      object.name = `secret-${secret.id}`;
      object.position.set(...secret.trigger.position);
      // Raycast-only proxy: on the interaction layer, never drawn by the camera.
      const target = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(TARGET_RADIUS, 8, 6)),
        scope.track(new THREE.MeshBasicMaterial()),
      );
      target.name = `secret-target-${secret.id}`;
      target.position.y = 0.2;
      target.layers.set(INTERACTION_ONLY_LAYER);
      object.add(target);
      root.add(object);
      this.objects.set(secret.id, object);
      this.unbind.push(register(`${SECRET_CONTROL_PREFIX}${secret.id}`, {
        object,
        label: secret.trigger.prompt,
        description: `${secret.trigger.prompt}: something small has been left here.`,
        activate: () => { this.find(secret); },
      }));
    }
  }

  /** Per-frame check for zone and area secrets in the visitor's current world. */
  update(world: SecretDefinition['world'], position: THREE.Vector3, zone: ZoneId): void {
    for (const secret of this.secrets) {
      if (secret.world !== world) continue;
      const trigger = secret.trigger;
      if (trigger.kind === 'zone') {
        if (zone === trigger.zone && !this.log.has(secret.id)) this.find(secret);
      } else if (trigger.kind === 'area') {
        const dx = position.x - trigger.center[0];
        const dz = position.z - trigger.center[2];
        if (dx * dx + dz * dz <= trigger.radius * trigger.radius
          && Math.abs(position.y - trigger.center[1]) <= VERTICAL_REACH
          && !this.log.has(secret.id)) this.find(secret);
      }
    }
  }

  /** Records and presents a find. Already-found secrets are silent. */
  find(secret: SecretDefinition): boolean {
    if (!this.log.markFound(secret.id)) return false;
    const find: SecretFind = { secret, found: this.foundCount, total: this.total };
    const present = this.presentations.get(secret.id) ?? this.defaultPresentation;
    try {
      present(find);
    } catch (error) {
      console.error('[Secrets] presentation failed', error);
    }
    return true;
  }

  dispose(): void {
    for (const release of this.unbind.splice(0)) release();
    for (const object of this.objects.values()) object.removeFromParent();
    this.objects.clear();
    this.presentations.clear();
  }
}

/** Small, original, procedural props. Kept low-poly; each is a few draw calls. */
function buildSecretModel(model: SecretModel, scope: ResourceScope): THREE.Object3D {
  const group = new THREE.Group();
  const standard = (color: number, emissive = 0x000000, emissiveIntensity = 0) =>
    scope.track(new THREE.MeshStandardMaterial({ color, roughness: 0.75, emissive, emissiveIntensity }));
  if (model === 'carved-stone') {
    const stone = new THREE.Mesh(scope.track(new THREE.DodecahedronGeometry(0.32, 0)), standard(0x8a8f86));
    stone.scale.set(1, 0.72, 0.9);
    stone.position.y = 0.22;
    const mark = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.12, 0.022, 6, 18)), standard(0xd9c27a, 0xd9c27a, 0.9));
    mark.position.set(0, 0.26, 0.27);
    group.add(stone, mark);
  } else if (model === 'small-lantern') {
    const frame = standard(0x2c2a27);
    const base = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.26, 0.04, 0.26)), frame);
    base.position.y = 0.02;
    const glow = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.18, 0.24, 0.18)), standard(0xffd38a, 0xffb347, 1.6));
    glow.position.y = 0.16;
    const cap = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.2, 0.14, 4)), frame);
    cap.position.y = 0.35;
    cap.rotation.y = Math.PI / 4;
    group.add(base, glow, cap);
  } else {
    const star = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.2, 0)), standard(0xdfe6ff, 0x9fb4ff, 1.1));
    star.scale.set(1, 0.45, 1);
    star.position.y = 0.12;
    const second = star.clone();
    second.rotation.y = Math.PI / 4;
    group.add(star, second);
  }
  return group;
}

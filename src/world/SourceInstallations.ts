import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import type { InteractionManager } from '../interaction/InteractionManager';
import type { Journal } from '../state/Journal';
import { InstallationStore } from '../state/InstallationStore';
import { createTextTexture, canRenderText, createFallbackTexture } from '../assets/TextTexture';
import { SOURCE_INSTALLATIONS, type SourceInstallation } from '../content/sourceParity';
import {
  applyInstallationKey, describeInstallationState, tickInstallationState,
  INSTALLATION_THESES, SPATIAL_CONTRACT, type InstallationState,
} from '../content/installationState';
import { buildInstallationVisual, type InstallationVisual } from './installationBuilders';
import { INSTALLATION_PLACEMENT_BY_ID, type InstallationPlacement } from './installationPlacement';

/**
 * THE FOURTEEN SOURCE PRIMARY INSTALLATIONS, LIVE.
 *
 * The historical Reliquary's installations were not wall labels: each was a
 * physical object with a keyed state machine, an interpretive lectern showing
 * its live state, a collision footprint, and persistence. That contract is
 * restored here inside the vNext architecture. The 64/35 collection, the bay
 * hero objects and the building are untouched — each installation stands clear
 * inside the bay its project was frozen onto.
 */

export interface InstallationRuntime {
  readonly spec: SourceInstallation;
  readonly placement: InstallationPlacement;
  readonly group: THREE.Group;
  readonly visual: InstallationVisual;
  readonly lectern: THREE.Mesh;
  readonly hit: THREE.Mesh;
  state: InstallationState;
  engaged: boolean;
}

export interface InstallationSnapshot {
  readonly id: string;
  readonly title: string;
  readonly host: string;
  readonly status: string;
  readonly engaged: boolean;
  readonly examined: boolean;
  readonly state: InstallationState;
  readonly position: readonly number[];
  readonly interactionPoint: readonly number[];
  readonly interactionRadius: number;
  readonly readingZoneRadius: number;
  readonly cameraSafeDistance: number;
  readonly controls: readonly (readonly (string | boolean)[])[];
  readonly requiredParts: readonly string[];
  readonly presentParts: readonly string[];
}

export class SourceInstallations {
  readonly group = new THREE.Group();
  readonly store: InstallationStore;
  private readonly runtimes = new Map<string, InstallationRuntime>();
  private readonly unbind: (() => void)[] = [];
  private readonly held = new Set<string>();
  private time = 0;
  /** The installation the visitor is currently operating, if any. */
  activeId: string | null = null;

  constructor(
    private readonly scope: ResourceScope,
    collisions: CollisionWorld,
    private readonly interaction: InteractionManager,
    private readonly journal: Journal,
    private readonly onAnnounce: (id: string, message: string) => void,
    store: InstallationStore = new InstallationStore(),
  ) {
    this.group.name = 'source-installations';
    this.store = store;

    for (const spec of SOURCE_INSTALLATIONS) {
      const placement = INSTALLATION_PLACEMENT_BY_ID.get(spec.id);
      if (!placement) continue;
      const runtime = this.build(spec, placement, collisions);
      this.runtimes.set(spec.id, runtime);
      this.group.add(runtime.group);
      this.unbind.push(this.interaction.register(`installation:${spec.id}`, {
        object: runtime.hit,
        label: `Engage ${spec.title}`,
        description: `${spec.stage}. ${SPATIAL_CONTRACT.standard.lecternPrompt} ${this.status(spec.id)}`,
        activate: () => this.engage(spec.id),
      }));
    }
  }

  get count(): number {
    return this.runtimes.size;
  }

  ids(): readonly string[] {
    return [...this.runtimes.keys()];
  }

  get(id: string): InstallationRuntime | undefined {
    return this.runtimes.get(id);
  }

  status(id: string): string {
    const runtime = this.runtimes.get(id);
    return runtime ? describeInstallationState(id, runtime.state) : 'Unknown installation.';
  }

  /**
   * Take focus of an installation. Source parity: engaging in place, marking it
   * examined, and putting its live state on the interpretive surface.
   */
  engage(id: string): boolean {
    const runtime = this.runtimes.get(id);
    if (!runtime) return false;
    runtime.engaged = true;
    this.activeId = id;
    this.store.markExamined(id);
    this.journal.recordHistory({ kind: 'installation', id }, runtime.spec.title);
    this.refresh(runtime);
    this.onAnnounce(
      `installation:${id}`,
      `${runtime.spec.title} engaged. ${this.status(id)} ${this.controlHint(runtime.spec)}`,
    );
    return true;
  }

  disengage(): void {
    if (!this.activeId) return;
    const runtime = this.runtimes.get(this.activeId);
    if (runtime) runtime.engaged = false;
    this.activeId = null;
  }

  /**
   * Route one source control code to an installation. Returns true when the
   * installation's state actually changed, exactly as Version B's
   * `Installation.key` did.
   */
  key(id: string, code: string): boolean {
    const runtime = this.runtimes.get(id);
    if (!runtime) return false;
    const result = applyInstallationKey(id, runtime.state, code);
    if (!result.changed) return false;
    runtime.state = result.state;
    this.store.set(id, result.state);
    this.refresh(runtime);
    this.onAnnounce(
      `installation:${id}`,
      result.message
        ? `${runtime.spec.title}: ${result.message} ${this.status(id)}`
        : `${runtime.spec.title}: ${this.status(id)}`,
    );
    return true;
  }

  /** Route a code to whichever installation is engaged. */
  keyActive(code: string): boolean {
    return this.activeId ? this.key(this.activeId, code) : false;
  }

  hold(code: string, down: boolean): void {
    if (down) this.held.add(code);
    else this.held.delete(code);
  }

  reset(id: string): void {
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    runtime.state = this.store.reset(id);
    this.refresh(runtime);
    this.onAnnounce(`installation:${id}`, `${runtime.spec.title}: Installation reset. ${this.status(id)}`);
  }

  /** Reload every installation from persistence. Proves restore-after-reload. */
  restoreFromStore(): void {
    for (const [id, runtime] of this.runtimes) {
      runtime.state = this.store.get(id);
      this.refresh(runtime);
    }
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    for (const [id, runtime] of this.runtimes) {
      const ticked = tickInstallationState(id, runtime.state, dt, this.held);
      if (ticked.changed) {
        runtime.state = ticked.state;
        this.refresh(runtime, false);
      }
      runtime.visual.tick(this.time, reducedMotion);
    }
  }

  snapshot(): InstallationSnapshot[] {
    return [...this.runtimes.values()].map((runtime) => {
      const thesis = INSTALLATION_THESES[runtime.spec.id];
      const present = new Set<string>();
      runtime.group.traverse((node) => {
        for (const part of thesis?.required ?? []) {
          if (node.name === part || node.name.startsWith(`${part}:`)) present.add(part);
        }
      });
      return {
        id: runtime.spec.id,
        title: runtime.spec.title,
        host: runtime.placement.host,
        status: this.status(runtime.spec.id),
        engaged: runtime.engaged,
        examined: this.store.hasExamined(runtime.spec.id),
        state: runtime.state,
        position: [...runtime.placement.position],
        interactionPoint: [...runtime.placement.interactionPoint],
        interactionRadius: runtime.placement.interactionRadius,
        readingZoneRadius: runtime.placement.readingZoneRadius,
        cameraSafeDistance: runtime.placement.cameraSafeDistance,
        controls: runtime.spec.controls ?? [],
        requiredParts: thesis?.required ?? [],
        presentParts: [...present],
      };
    });
  }

  // ── construction ────────────────────────────────────────────────────────

  private build(
    spec: SourceInstallation,
    placement: InstallationPlacement,
    collisions: CollisionWorld,
  ): InstallationRuntime {
    const group = new THREE.Group();
    group.name = `primary-installation:${spec.id}`;
    group.position.set(placement.position[0], placement.position[1], placement.position[2]);
    group.rotation.y = Math.atan2(placement.facing[0], placement.facing[2]) + Math.PI;

    const visual = buildInstallationVisual(spec.build, this.scope, spec.accent);
    group.add(visual.group);

    const state = this.store.get(spec.id);
    visual.update(state);

    // Source collision footprint: the installation is solid, so a visitor walks
    // around it rather than through it.
    collisions.addBox(
      [placement.position[0], placement.position[1] + 1.2, placement.position[2]],
      [placement.footprint[0], 1.2, placement.footprint[1]],
    );

    const lectern = this.buildLectern(spec, placement, state);
    group.add(lectern);
    collisions.addBox(
      [placement.lectern[0], placement.lectern[1] + 0.55, placement.lectern[2]],
      [placement.lecternCollisionRadius, 0.55, placement.lecternCollisionRadius],
    );

    // The interaction volume sits at the source reading point, sized by the
    // source `interactionRadius`, so focus is acquired exactly where the source
    // said the visitor stands.
    const hit = new THREE.Mesh(
      this.scope.track(new THREE.SphereGeometry(Math.max(0.7, placement.interactionRadius), 12, 8)),
      this.scope.track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001, depthWrite: false })),
    );
    hit.name = `installation-hit:${spec.id}`;
    hit.position.set(
      placement.lectern[0] - placement.position[0],
      placement.lectern[1] - placement.position[1] + 1.05,
      placement.lectern[2] - placement.position[2],
    );
    hit.position.applyAxisAngle(UP, -group.rotation.y);
    hit.userData = { kind: 'installation', id: spec.id };
    group.add(hit);

    return { spec, placement, group, visual, lectern, hit, state, engaged: false };
  }

  private buildLectern(
    spec: SourceInstallation,
    placement: InstallationPlacement,
    state: InstallationState,
  ): THREE.Mesh {
    const map = this.lecternTexture(spec, state);
    const lectern = new THREE.Mesh(
      this.scope.track(new THREE.PlaneGeometry(1.5, 0.72)),
      this.scope.track(new THREE.MeshStandardMaterial({ map, roughness: 0.9 })),
    );
    lectern.name = `interpretive-lectern:${spec.id}`;
    // Local space: the group is already rotated to face the visitor.
    const dx = placement.lectern[0] - placement.position[0];
    const dz = placement.lectern[2] - placement.position[2];
    const local = new THREE.Vector3(dx, 1.05, dz).applyAxisAngle(UP, -this.groupYaw(placement));
    lectern.position.copy(local);
    lectern.rotation.x = -0.5;
    return lectern;
  }

  private groupYaw(placement: InstallationPlacement): number {
    return Math.atan2(placement.facing[0], placement.facing[2]) + Math.PI;
  }

  private lecternTexture(spec: SourceInstallation, state: InstallationState): THREE.Texture {
    if (!canRenderText()) return createFallbackTexture(this.scope, 0x1c1914);
    const controls = (spec.controls ?? []).map((c) => `${String(c[0])} — ${formatCode(String(c[1]))}`);
    return createTextTexture(this.scope, [
      describeInstallationState(spec.id, state),
      SPATIAL_CONTRACT.standard.lecternPrompt,
      ...controls,
    ], {
      width: 1024, height: 500, background: '#1c1914', color: '#e8e1d2',
      title: spec.title, titleColor: '#d4bd7a', titleSize: 44, bodySize: 24, padding: 40,
    });
  }

  private refresh(runtime: InstallationRuntime, retexture = true): void {
    runtime.visual.update(runtime.state);
    if (!retexture) return;
    const material = runtime.lectern.material as THREE.MeshStandardMaterial;
    const next = this.lecternTexture(runtime.spec, runtime.state);
    material.map = next;
    material.needsUpdate = true;
  }

  private controlHint(spec: SourceInstallation): string {
    const controls = spec.controls ?? [];
    if (!controls.length) return '';
    return `Controls: ${controls.map((c) => `${String(c[0])} (${formatCode(String(c[1]))})`).join(', ')}.`;
  }

  dispose(): void {
    for (const fn of this.unbind) fn();
    this.runtimes.clear();
    this.group.removeFromParent();
  }
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Codes an engaged installation holds rather than edge-triggers. Source parity:
 * `tickInstallationState` reads the held set for the katamari's rolling
 * physics, so these must not fall through to museum movement while engaged.
 */
export const INSTALLATION_HELD_CODES: ReadonlySet<string> = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
]);

/** Source parity: CURATED `formatControlCode`. */
export function formatCode(code: string): string {
  const names: Record<string, string> = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    Space: 'Space', Escape: 'Esc',
  };
  return names[code] || code.replace(/^Key/, '').replace(/^Digit/, '');
}

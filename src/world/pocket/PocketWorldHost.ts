import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import type { AssetManager } from '../../assets/AssetManager';
import type { AudioManager } from '../../audio/AudioManager';
import type { ExhibitControl } from '../../exhibits/contract';
import type { InteractionManager } from '../../interaction/InteractionManager';
import type { InputManager } from '../../player/Input';
import type { PlayerController } from '../../player/PlayerController';
import type { QualitySettings } from '../../render/QualityTiers';
import type { Passport } from '../../state/Passport';
import type { WorldDirector } from '../../app/WorldDirector';
import { CollisionWorld } from '../CollisionWorld';
import type { ZoneId } from '../layout';
import type { PocketWorldRegistry } from './PocketWorldRegistry';
import type {
  CameraRigMode,
  HostWorldId,
  PocketExitOptions,
  PocketWorldContext,
  PocketWorldDefinition,
  PocketWorldId,
  PocketWorldInstance,
  SafeAnchor,
} from './types';

export interface PocketTransitionController {
  openEntryPrompt(
    def: PocketWorldDefinition,
    alreadyStamped: boolean,
    onEnter: () => Promise<boolean>,
    onCancel: () => void,
  ): void;
  playExitRewind?(worldTitle: string): void;
  closePrompt?(): void;
}

export interface PocketHostAdapter {
  readonly registry: PocketWorldRegistry;
  readonly passport: Passport;
  readonly worldDirector: Pick<
    WorldDirector,
    | 'activeWorld'
    | 'beginPocketPrompt'
    | 'cancelPocketPrompt'
    | 'beginPreparingPocket'
    | 'abortPreparingPocket'
    | 'commitPocket'
    | 'beginExitingPocket'
    | 'finishExitingPocket'
  >;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly sky: { readonly mesh: THREE.Object3D; follow(camera: THREE.Camera): void };
  readonly lighting: { readonly group: THREE.Object3D };
  readonly exteriorWorld: { readonly root: THREE.Object3D; readonly collision: CollisionWorld };
  readonly interiorWorld: {
    readonly root: THREE.Object3D;
    readonly collision: CollisionWorld;
    setActive(active: boolean): void;
  } | null;
  readonly player: PlayerController;
  readonly input: InputManager;
  readonly interaction: InteractionManager;
  readonly audio: AudioManager;
  readonly assets: AssetManager;
  readonly quality: QualitySettings;
  isContextLost(): boolean;
  getCurrentZone(): ZoneId;
  setCurrentZone(zone: ZoneId): void;
  reducedMotion(): boolean;
  announce(message: string, seconds?: number): void;
  getTransitionController?(): PocketTransitionController | null;
  onPocketStateChange?(): void;
}

export interface DormantAnchorOptions {
  readonly dormantLabel: string | (() => string);
  readonly dormantDescription?: string;
  readonly dormantActivate?: () => void;
  readonly activeLabel?: string | (() => string);
  readonly activeDescription?: string;
  readonly liveReturnAnchor?: () => SafeAnchor;
}

interface HostSnapshot {
  readonly returnAnchor: SafeAnchor;
  readonly fog: THREE.FogBase | null;
  readonly background: THREE.Color | THREE.Texture | null;
  readonly fov: number;
  readonly skyVisible: boolean;
  readonly lightingVisible: boolean;
  readonly currentZone: ZoneId;
  readonly pointerLocked: boolean;
  readonly hostCollisions: CollisionWorld;
  readonly hostRoot: THREE.Object3D;
}

interface ActivePocketSession {
  readonly id: PocketWorldId;
  readonly def: PocketWorldDefinition;
  readonly instance: PocketWorldInstance;
  readonly scope: ResourceScope;
  readonly root: THREE.Group;
  readonly collision: CollisionWorld;
  readonly snapshot: HostSnapshot;
  readonly interactionUnbinds: Set<() => void>;
  pendingCompletion: boolean;
  exiting: boolean;
}

interface PendingPocketLoad {
  readonly id: PocketWorldId;
  readonly hostWorld: HostWorldId;
  readonly abortController: AbortController;
  readonly scope: ResourceScope;
  readonly root: THREE.Group;
  readonly collision: CollisionWorld;
  readonly interactionUnbinds: Set<() => void>;
}

/**
 * Shared Pocket-World Host.
 *
 * Hosts at most one active pocket world inside the single existing Scene,
 * Renderer, and Loop. Snapshots and hides the active museum root on commit,
 * binds an isolated ResourceScope and CollisionWorld, and restores exact
 * museum pose, lighting, fog, FOV, and controls on exit.
 */
export class PocketWorldHost {
  private activeSession: ActivePocketSession | null = null;
  private pendingLoad: PendingPocketLoad | null = null;
  private promptState: { readonly id: PocketWorldId; readonly hostWorld: HostWorldId } | null = null;
  private disposed = false;

  constructor(private readonly host: PocketHostAdapter) {}

  get isActive(): boolean {
    return this.activeSession !== null;
  }

  get activeWorldId(): PocketWorldId | null {
    return this.activeSession?.id ?? null;
  }

  get activeDefinition(): PocketWorldDefinition | null {
    return this.activeSession?.def ?? null;
  }

  get activeScope(): ResourceScope | null {
    return this.activeSession?.scope ?? this.pendingLoad?.scope ?? null;
  }

  get activeCameraMode(): CameraRigMode {
    return this.activeSession?.instance.cameraMode
      ?? this.activeSession?.def.cameraMode
      ?? 'first-person';
  }

  get usesMuseumSky(): boolean {
    return Boolean(this.activeSession?.instance.keepMuseumSky);
  }

  get usesMuseumLighting(): boolean {
    return Boolean(this.activeSession?.instance.keepMuseumLighting);
  }

  get isTransitionBusy(): boolean {
    return this.pendingLoad !== null || this.promptState !== null || Boolean(this.activeSession?.exiting);
  }

  /** Capture the visitor's current pose in the active host world. */
  captureHostAnchor(): SafeAnchor {
    const hostWorld: HostWorldId = this.host.worldDirector.activeWorld === 'interior' ? 'interior' : 'exterior';
    const p = this.host.player.position;
    return {
      hostWorld,
      position: [p.x, p.y, p.z],
      yaw: this.host.player.yaw,
      pitch: this.host.player.pitch,
    };
  }

  /**
   * Wrap an existing museum interactable (`lighthouse-lens-l01`, `observatory-orrery-w09`,
   * etc.) so it preserves exact dormant behavior while `dormant`, and promotes
   * automatically to an entry portal once `'verified'` with a loader.
   */
  createAnchorControl(
    worldId: PocketWorldId,
    object: THREE.Object3D,
    dormantOpts: DormantAnchorOptions,
  ): ExhibitControl {
    return {
      object,
      label: () => {
        const def = this.host.registry.get(worldId);
        if (def && this.host.registry.isPlayable(worldId, this.host.passport)) {
          return resolveControlLabel(dormantOpts.activeLabel ?? `Enter ${def.title}`);
        }
        return resolveControlLabel(dormantOpts.dormantLabel);
      },
      description: dormantOpts.dormantDescription ?? dormantOpts.activeDescription,
      activate: () => {
        const check = this.host.registry.canEnter(worldId, this.host.passport);
        if (check.ok) {
          void this.requestEntry(worldId, dormantOpts.liveReturnAnchor?.());
          return;
        }
        if (check.reason === 'locked-stamps') {
          this.host.announce(check.message, 8);
          return;
        }
        if (dormantOpts.dormantActivate) {
          dormantOpts.dormantActivate();
        } else {
          this.host.announce(check.message, 8);
        }
      },
    };
  }

  /**
   * Interactive entry flow: verifies gate -> enters `POCKET_PROMPT` -> shows
   * the non-flashing entry blur/FOV-zoom prompt (`Enter` / `Back` / `Esc`).
   */
  async requestEntry(id: PocketWorldId, liveReturnAnchor?: SafeAnchor): Promise<boolean> {
    if (this.disposed || this.host.isContextLost()) return false;
    if (this.activeSession || this.pendingLoad || this.promptState) return false;

    const check = this.host.registry.canEnter(id, this.host.passport);
    if (!check.ok) {
      this.host.announce(check.message, 8);
      return false;
    }

    const def = this.host.registry.get(id)!;
    const anchor = liveReturnAnchor ?? this.captureHostAnchor();
    const transition = this.host.getTransitionController?.() ?? null;
    if (!transition) {
      return this.enter(id, anchor);
    }

    if (!this.host.worldDirector.beginPocketPrompt()) return false;
    this.promptState = { id, hostWorld: anchor.hostWorld };
    this.host.onPocketStateChange?.();

    const alreadyStamped = id === 'L01'
      ? this.host.passport.hasBonusCompleted('L01')
      : this.host.passport.hasStamp(id);

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      transition.openEntryPrompt(
        def,
        alreadyStamped,
        async () => {
          if (!this.promptState) {
            settle(false);
            return false;
          }
          const entered = await this.enter(id, anchor);
          if (entered) {
            this.promptState = null;
            settle(true);
          }
          return entered;
        },
        () => {
          const pending = this.promptState;
          this.promptState = null;
          if (this.pendingLoad) {
            this.pendingLoad.abortController.abort();
          } else if (pending) {
            this.host.worldDirector.cancelPocketPrompt(pending.hostWorld);
          }
          this.host.onPocketStateChange?.();
          settle(false);
        },
      );
    });
  }

  /**
   * Load and commit a verified pocket world atomically.
   * Refuses dormant/unverified worlds or locked `W10` (< 1 earned stamp).
   */
  async enter(id: PocketWorldId, liveReturnAnchor?: SafeAnchor): Promise<boolean> {
    if (this.disposed || this.host.isContextLost()) return false;
    if (this.activeSession || this.pendingLoad) return false;

    const check = this.host.registry.canEnter(id, this.host.passport);
    if (!check.ok) {
      if (this.promptState) {
        this.host.worldDirector.cancelPocketPrompt(this.promptState.hostWorld);
        this.promptState = null;
      }
      this.host.announce(check.message, 8);
      return false;
    }

    const def = this.host.registry.get(id)!;
    const anchor = liveReturnAnchor ?? this.captureHostAnchor();
    const snapshot = this.captureHostSnapshot(anchor);

    if (!this.host.worldDirector.beginPreparingPocket()) {
      return false;
    }

    const scope = new ResourceScope(`pocket:${id}`);
    const root = new THREE.Group();
    root.name = `pocket-world:${id}`;
    const collision = new CollisionWorld();
    const abortController = new AbortController();
    const interactionUnbinds = new Set<() => void>();

    const pending: PendingPocketLoad = {
      id,
      hostWorld: anchor.hostWorld,
      abortController,
      scope,
      root,
      collision,
      interactionUnbinds,
    };
    this.pendingLoad = pending;
    this.host.onPocketStateChange?.();

    const ctx: PocketWorldContext = {
      worldId: id,
      scope,
      root,
      scene: this.host.scene,
      camera: this.host.camera,
      collision,
      player: this.host.player,
      input: this.host.input,
      interaction: this.createScopedInteraction(interactionUnbinds, abortController.signal, scope),
      audio: this.host.audio,
      assets: this.host.assets,
      quality: this.host.quality,
      signal: abortController.signal,
      reducedMotion: () => this.host.reducedMotion(),
      announce: (message, seconds) => this.host.announce(message, seconds),
      markCompletionEligible: () => {
        if (this.activeSession?.id === id) {
          this.activeSession.pendingCompletion = true;
        }
      },
      requestComplete: () => {
        if (this.activeSession?.id === id) {
          this.activeSession.pendingCompletion = true;
          void this.exit({ completed: true, viaVhsRewind: false, reason: 'completed' });
        }
      },
      requestExit: (opts) => {
        if (this.activeSession?.id === id) {
          void this.exit({ viaVhsRewind: true, reason: 'back', ...opts });
        }
      },
    };

    let instance: PocketWorldInstance;
    try {
      instance = await this.host.registry.load(id, abortController.signal, ctx);
    } catch (error) {
      if (this.pendingLoad === pending) this.pendingLoad = null;
      this.cleanupPendingLoad(pending);
      this.host.worldDirector.abortPreparingPocket(anchor.hostWorld);
      this.host.onPocketStateChange?.();
      if (!isAbortError(error)) {
        console.error(`[PocketWorldHost] failed to load ${id}`, error);
        this.host.announce(`Could not open ${def.title}. Returning to the museum.`, 8);
      }
      return false;
    }

    if (this.pendingLoad === pending) this.pendingLoad = null;

    if (abortController.signal.aborted || this.disposed || this.host.isContextLost()) {
      safeDisposeInstance(instance);
      this.cleanupPendingLoad(pending);
      this.host.worldDirector.abortPreparingPocket(anchor.hostWorld);
      this.host.onPocketStateChange?.();
      return false;
    }

    const releaseFreeze = this.host.player.acquireFreeze();
    try {
      if (snapshot.hostRoot) snapshot.hostRoot.visible = false;
      if (anchor.hostWorld === 'interior') {
        this.host.interiorWorld?.setActive(false);
      }
      this.host.scene.add(root);

      if (instance.fog !== undefined) {
        this.host.scene.fog = instance.fog;
      }
      if (instance.background !== undefined) {
        this.host.scene.background = instance.background;
      }
      if (instance.fieldOfView !== undefined && Number.isFinite(instance.fieldOfView)) {
        this.host.camera.fov = instance.fieldOfView;
        this.host.camera.updateProjectionMatrix();
      }
      this.host.sky.mesh.visible = Boolean(instance.keepMuseumSky);
      this.host.lighting.group.visible = Boolean(instance.keepMuseumLighting);

      this.host.player.setCollisionWorld(collision);
      this.host.player.restorePose(instance.spawnPosition, instance.spawnYaw, instance.spawnPitch ?? 0);
      this.host.input.resetTransient();

      this.activeSession = {
        id,
        def,
        instance,
        scope,
        root,
        collision,
        snapshot,
        interactionUnbinds,
        pendingCompletion: false,
        exiting: false,
      };
      this.host.worldDirector.commitPocket(id);
      this.host.onPocketStateChange?.();
      return true;
    } finally {
      releaseFreeze();
    }
  }

  /** Abort an in-flight entry load or entry prompt without disturbing the host world. */
  abortPendingEntry(): boolean {
    let aborted = false;
    if (this.promptState) {
      const transition = this.host.getTransitionController?.() ?? null;
      const hostWorld = this.promptState.hostWorld;
      this.promptState = null;
      transition?.closePrompt?.();
      this.host.worldDirector.cancelPocketPrompt(hostWorld);
      this.host.onPocketStateChange?.();
      aborted = true;
    }
    if (this.pendingLoad) {
      this.pendingLoad.abortController.abort();
      aborted = true;
    }
    return aborted;
  }

  /**
   * Exit the active pocket world, dispose its scope/root/controls, and restore
   * the exact host world pose, collision, lighting, fog, and FOV.
   *
   * Stamps are earned ONLY when `opts.completed === true` AND `pendingCompletion`
   * was explicitly triggered by the pocket world (`markCompletionEligible` /
   * `requestComplete`). Back/Esc exits never award stamps.
   */
  exit(opts: PocketExitOptions = {}): boolean {
    if (this.pendingLoad && !this.activeSession) {
      this.pendingLoad.abortController.abort();
      return true;
    }
    const session = this.activeSession;
    if (!session || session.exiting) return false;
    session.exiting = true;

    const releaseFreeze = this.host.player.acquireFreeze();
    try {
      this.host.worldDirector.beginExitingPocket();

      safeDisposeInstance(session.instance);
      this.releaseInteractionUnbinds(session.interactionUnbinds);
      session.root.removeFromParent();
      session.root.clear();
      session.scope.dispose();
      session.collision.clear();

      const snap = session.snapshot;
      this.host.scene.fog = snap.fog;
      this.host.scene.background = snap.background;
      this.host.camera.fov = snap.fov;
      this.host.camera.updateProjectionMatrix();
      this.host.sky.mesh.visible = snap.skyVisible;
      this.host.lighting.group.visible = snap.lightingVisible;
      this.host.setCurrentZone(snap.currentZone);
      this.host.audio.setZone(snap.currentZone);

      snap.hostRoot.visible = true;
      if (snap.returnAnchor.hostWorld === 'interior') {
        this.host.interiorWorld?.setActive(true);
      }

      this.host.player.setCollisionWorld(snap.hostCollisions);
      this.host.player.restorePose(
        snap.returnAnchor.position,
        snap.returnAnchor.yaw,
        snap.returnAnchor.pitch,
      );
      this.host.input.resetTransient();
      this.host.sky.follow(this.host.camera);

      this.activeSession = null;
      this.host.worldDirector.finishExitingPocket(snap.returnAnchor.hostWorld);

      const didComplete = Boolean(opts.completed && session.pendingCompletion);
      const outcome = this.host.passport.recordExit(session.id, didComplete);

      if (outcome.stampEarned) {
        this.host.announce(
          `Passport stamp earned: ${session.def.title} (${this.host.passport.earnedCount}/${this.host.passport.totalStamps}).`,
          6,
        );
      } else if (outcome.bonusCompleted) {
        this.host.announce(`${session.def.title} complete. Returned safely to the museum.`, 6);
      } else if (opts.reason !== 'abort') {
        this.host.announce(`Returned from ${session.def.title}.`, 4);
      }

      const shouldPlayRewind = opts.viaVhsRewind ?? (!didComplete && opts.reason !== 'abort');
      if (shouldPlayRewind) {
        this.host.getTransitionController?.()?.playExitRewind?.(session.def.title);
      }

      this.host.onPocketStateChange?.();
      return true;
    } finally {
      releaseFreeze();
    }
  }

  fixedUpdate(dt: number, eye: readonly [number, number, number]): void {
    this.activeSession?.instance.fixedUpdate?.(dt, eye);
  }

  variableUpdate(dt: number, eye: readonly [number, number, number]): void {
    this.activeSession?.instance.variableUpdate?.(dt, eye);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abortPendingEntry();
    if (this.activeSession) {
      this.exit({ completed: false, viaVhsRewind: false, reason: 'abort' });
    }
  }

  private captureHostSnapshot(anchor: SafeAnchor): HostSnapshot {
    const interior = anchor.hostWorld === 'interior' ? this.host.interiorWorld : null;
    const hostRoot = interior ? interior.root : this.host.exteriorWorld.root;
    const hostCollisions = interior ? interior.collision : this.host.exteriorWorld.collision;
    return {
      returnAnchor: anchor,
      fog: this.host.scene.fog,
      background: this.host.scene.background,
      fov: this.host.camera.fov,
      skyVisible: this.host.sky.mesh.visible,
      lightingVisible: this.host.lighting.group.visible,
      currentZone: this.host.getCurrentZone(),
      pointerLocked: this.host.input.pointerLocked
        || (typeof document !== 'undefined' && document.pointerLockElement !== null),
      hostCollisions,
      hostRoot,
    };
  }

  private createScopedInteraction(
    unbinds: Set<() => void>,
    signal: AbortSignal,
    scope: ResourceScope,
  ): InteractionManager {
    const real = this.host.interaction;
    return new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === 'register') {
          return (exhibitId: string, control: ExhibitControl): (() => void) => {
            if (signal.aborted || scope.isDisposed) {
              return () => undefined;
            }
            const rawUnbind = target.register(exhibitId, control);
            let released = false;
            const wrapped = () => {
              if (released) return;
              released = true;
              unbinds.delete(wrapped);
              rawUnbind();
            };
            unbinds.add(wrapped);
            return wrapped;
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  private releaseInteractionUnbinds(unbinds: Set<() => void>): void {
    for (const unbind of [...unbinds]) {
      try {
        unbind();
      } catch (error) {
        console.error('[PocketWorldHost] interaction unbind failed', error);
      }
    }
    unbinds.clear();
  }

  private cleanupPendingLoad(pending: PendingPocketLoad): void {
    this.releaseInteractionUnbinds(pending.interactionUnbinds);
    pending.root.removeFromParent();
    pending.root.clear();
    pending.scope.dispose();
    pending.collision.clear();
  }
}

function resolveControlLabel(label: string | (() => string)): string {
  return typeof label === 'function' ? label() : label;
}

function safeDisposeInstance(instance: PocketWorldInstance | undefined): void {
  try {
    instance?.dispose?.();
  } catch (error) {
    console.error('[PocketWorldHost] instance dispose failed', error);
  }
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && ((error as { name?: string }).name === 'AbortError'
      || /abort|cancel/i.test(String((error as { message?: string }).message ?? ''))),
  );
}

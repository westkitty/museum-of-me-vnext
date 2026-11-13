import type * as THREE from 'three';
import type { App } from './App';
import {
  ENTRANCE_PORTAL_Z,
  THRESHOLD_PREPARE_Z,
  GROUND_Y,
  PORTAL_WIDTH,
  PORTAL_HEIGHT,
  PORTAL_VESTIBULE_DEPTH,
} from '../world/layout';
import { PLAYER_RADIUS, PLAYER_HEIGHT } from '../player/PlayerController';

/** Portal geometry is authored in layout.ts; the entire island is NOT a door. */
type PortalPosition = Pick<THREE.Vector3, 'x' | 'y' | 'z'>;
const PORTAL_SEAM_TOLERANCE = 0.1;
const APPROACH_HALF_WIDTH = PORTAL_WIDTH / 2 + 6;
const APPROACH_START_Z = 154;

function insideDoorwayOpening(pos: PortalPosition): boolean {
  return Math.abs(pos.x) <= PORTAL_WIDTH / 2 - PLAYER_RADIUS
    && pos.y >= GROUND_Y - 0.5
    && pos.y + PLAYER_HEIGHT <= GROUND_Y + PORTAL_HEIGHT + 0.1;
}

/** A visitor may enter only inside the physical foyer, not anywhere at z=128. */
export function isAtEntrancePortal(pos: PortalPosition): boolean {
  return insideDoorwayOpening(pos)
    && pos.z >= ENTRANCE_PORTAL_Z - PORTAL_VESTIBULE_DEPTH
    && pos.z <= ENTRANCE_PORTAL_Z + PORTAL_SEAM_TOLERANCE;
}

/** Invisible prewarm is allowed only in the south entrance's approach corridor. */
export function isApproachingEntrance(pos: PortalPosition): boolean {
  return Math.abs(pos.x) <= APPROACH_HALF_WIDTH
    && pos.y >= GROUND_Y - 0.5
    && pos.y + PLAYER_HEIGHT <= GROUND_Y + PORTAL_HEIGHT + 0.1
    && pos.z >= ENTRANCE_PORTAL_Z - 1
    && pos.z <= APPROACH_START_Z;
}

/** Return must also cross the doorway; a side path is not an exit portal. */
export function isExitingEntrance(pos: PortalPosition): boolean {
  return insideDoorwayOpening(pos)
    && pos.z > ENTRANCE_PORTAL_Z
    && pos.z <= THRESHOLD_PREPARE_Z;
}

export type WorldId = 'exterior' | 'interior';

export type WorldPhase =
  | 'EXTERIOR_ACTIVE'
  | 'PREPARING_INTERIOR'
  | 'PREPARING_RENDER_RESOURCES'
  | 'AT_THRESHOLD'
  | 'COMMITTING_INTERIOR'
  | 'INTERIOR_ACTIVE'
  | 'PREPARING_EXTERIOR'
  | 'COMMITTING_EXTERIOR'
  | 'PREPARATION_FAILED';

/**
 * WorldDirector manages the non-Euclidean boundary lifecycle between
 * the exterior island world and the interior museum world.
 *
 * It enforces atomic, single-active-root rendering and collision handoffs,
 * predictive loading on approach, seam hold during preparation, and failure recovery.
 */
export class WorldDirector {
  activeWorld: WorldId = 'exterior';
  phase: WorldPhase = 'EXTERIOR_ACTIVE';

  interiorConstructed = false;
  interiorImportStarted = false;
  exteriorReady = true;
  firstExteriorInteractiveMs = 0;

  private preparePromise: Promise<void> | null = null;
  private isCommitting = false;
  private thresholdPromptDismissed = false;

  private entranceIsReady(): boolean {
    return Boolean(this.app.interiorLoadTelemetry.entranceReadyAtMs !== null
      || this.app.interiorWorld?.streaming.telemetry.prewarmReady);
  }

  constructor(private readonly app: App) {
    this.firstExteriorInteractiveMs = 0;
  }

  async prepareInterior(): Promise<void> {
    if (this.interiorConstructed) return;
    if (this.preparePromise) return this.preparePromise;
    this.interiorImportStarted = true;
    this.phase = 'PREPARING_INTERIOR';
    this.app.ui?.hud.setThresholdStatus(true, 'Loading the museum module and building its architecture.', false, true);

    this.preparePromise = (async () => {
      try {
        await this.app.ensureInteriorLoaded();
        this.interiorConstructed = true;
        this.phase = this.activeWorld === 'interior' ? 'INTERIOR_ACTIVE'
          : this.entranceIsReady() ? 'AT_THRESHOLD' : 'PREPARING_RENDER_RESOURCES';

        // Preparation can finish while the visitor walks around the island.
        // Only the physical doorway is allowed to trigger a world switch.
        if (this.activeWorld === 'exterior' && isAtEntrancePortal(this.app.player.position)) {
          this.commitToInterior();
        }
      } catch (err) {
        console.error('[WorldDirector] failed to prepare interior', err);
        this.phase = 'PREPARATION_FAILED';
        this.preparePromise = null;
        this.app.ui?.hud.setThresholdStatus(true, 'Museum preparation failed. The island remains available. Retry preparation or continue outside.', true);
        throw err;
      }
    })();
    return this.preparePromise;
  }

  dismissThresholdPrompt(): void {
    this.thresholdPromptDismissed = true;
    this.app.ui?.hud.setThresholdStatus(false, '');
  }

  /**
   * Synchronous atomic handoff to the interior world.
   * Can be called during a frame tick once interior is constructed.
   */
  commitToInterior(): boolean {
    if (this.activeWorld === 'interior' || this.isCommitting) return true;
    if (this.app.renderer.isContextLost || !this.interiorConstructed || !this.app.interiorWorld
      || !this.entranceIsReady()) return false;

    this.isCommitting = true;
    this.phase = 'COMMITTING_INTERIOR';

    // Scoped freeze during atomic handoff: ensures no half-step movement or physics desync
    const releaseFreeze = this.app.player.acquireFreeze();

    try {
      // 1. Inactive world is hidden, active world is shown
      this.app.exteriorWorld.root.visible = false;
      this.app.interiorWorld.root.visible = true;
      this.app.interiorWorld.setActive(true);

      // 2. Physics collision switches to destination world
      this.app.player.setCollisionWorld(this.app.interiorWorld.collision);

      // 3. Ensure player support height is level with vestibule floor (y >= GROUND_Y)
      if (this.app.player.position.y < GROUND_Y) {
        this.app.player.position.y = GROUND_Y;
      }

      // 4. Update world mode and state
      this.activeWorld = 'interior';
      this.phase = 'INTERIOR_ACTIVE';
      this.app.interiorLoadTelemetry.transitionCommittedAtMs = performance.now();

      return true;
    } finally {
      this.isCommitting = false;
      releaseFreeze();
    }
  }

  async switchToInterior(): Promise<boolean> {
    if (this.activeWorld === 'interior') return true;
    await this.prepareInterior();
    return this.commitToInterior();
  }

  switchToExterior(): boolean {
    if (this.activeWorld === 'exterior' || this.isCommitting) return true;
    if (this.app.renderer.isContextLost) return false;

    this.isCommitting = true;
    this.phase = 'COMMITTING_EXTERIOR';

    // Scoped freeze during atomic handoff
    const releaseFreeze = this.app.player.acquireFreeze();

    try {
      if (this.app.interiorWorld) {
        this.app.interiorWorld.root.visible = false;
        this.app.interiorWorld.setActive(false);
      }
      this.app.exteriorWorld.root.visible = true;

      this.app.player.setCollisionWorld(this.app.exteriorWorld.collision);

      if (this.app.player.position.y < GROUND_Y) {
        this.app.player.position.y = GROUND_Y;
      }

      this.activeWorld = 'exterior';
      this.phase = 'EXTERIOR_ACTIVE';

      return true;
    } finally {
      this.isCommitting = false;
      releaseFreeze();
    }
  }

  update(playerPosition: THREE.Vector3): void {
    if (this.isCommitting || this.app.renderer.isContextLost) return;

    const inApproach = isApproachingEntrance(playerPosition);
    if (!inApproach) this.thresholdPromptDismissed = false;
    const rawEntranceReady = Boolean(this.app.interiorWorld?.streaming.telemetry.prewarmReady);
    if (rawEntranceReady && this.app.interiorLoadTelemetry.entranceReadyAtMs === null) {
      this.app.interiorLoadTelemetry.entranceReadyAtMs = performance.now();
    }
    const entranceReady = this.entranceIsReady();
    if (entranceReady && this.activeWorld === 'exterior' && this.interiorConstructed
      && this.phase === 'PREPARING_RENDER_RESOURCES') this.phase = 'AT_THRESHOLD';
    if (inApproach && !this.thresholdPromptDismissed && this.activeWorld === 'exterior') {
      const failed = this.phase === 'PREPARATION_FAILED';
      const preparing = this.interiorImportStarted && !entranceReady && !failed;
      const message = failed
        ? 'Museum preparation failed. The island remains available.'
        : entranceReady
          ? 'The entrance hall is ready.'
          : this.interiorConstructed
            ? 'Building the entrance exhibits.'
            : this.interiorImportStarted
              ? 'Loading the museum module and building its architecture.'
              : 'The entrance is nearby. Enter museum begins preparation; its galleries are not loaded yet.';
      this.app.ui?.hud.setThresholdStatus(true, message, failed, preparing);
    } else if (!inApproach || this.activeWorld !== 'exterior') {
      this.app.ui?.hud.setThresholdStatus(false, '');
    }

    // 1. Prepare invisibly only when approaching the actual south doorway.
    // The previous Z-only condition loaded the museum from anywhere on the island.
    if (this.activeWorld === 'exterior' && !this.interiorImportStarted
      && inApproach && playerPosition.z <= THRESHOLD_PREPARE_Z) {
      // prepareInterior records and displays the failure, and remains rejecting
      // for explicit callers. This predictive request has no awaiting caller.
      void this.prepareInterior().catch(() => undefined);
    }

    // 2. This is a doorway aperture, not an infinite plane across the island.
    if (this.activeWorld === 'exterior') {
      if (playerPosition.z <= ENTRANCE_PORTAL_Z && isAtEntrancePortal(playerPosition)) {
        // Hold only inside the doorway until the destination is ready. A
        // constructed interior can still be waiting for its entrance prewarm;
        // without the hold the visitor walks past the portal window in the
        // exterior world and can never be admitted.
        const committed = this.interiorConstructed && Boolean(this.app.interiorWorld)
          && this.commitToInterior();
        if (!committed) {
          playerPosition.z = Math.max(ENTRANCE_PORTAL_Z + 0.05, playerPosition.z);
        }
      }
    } else if (this.activeWorld === 'interior') {
      if (isExitingEntrance(playerPosition)) this.switchToExterior();
    }
  }
}

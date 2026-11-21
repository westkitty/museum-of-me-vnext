import type * as THREE from 'three';
import type { App } from './App';
import {
  ENTRANCE_PORTAL_Z,
  THRESHOLD_PREPARE_Z,
  GROUND_Y,
  PORTAL_WIDTH,
  PORTAL_HEIGHT,
  PORTAL_VESTIBULE_DEPTH,
  ATRIUM_FRONT_Z,
  SEAM_OFFSET_Z,
  ENTRANCE_PREWARM_START_Z,
} from '../world/layout';
import { PLAYER_RADIUS, PLAYER_HEIGHT } from '../player/PlayerController';

/** Portal geometry is authored in layout.ts; the entire island is NOT a door. */
type PortalPosition = Pick<THREE.Vector3, 'x' | 'y' | 'z'>;
const PORTAL_SEAM_TOLERANCE = 0.1;
const APPROACH_HALF_WIDTH = PORTAL_WIDTH / 2 + 6;
const APPROACH_START_Z = ENTRANCE_PREWARM_START_Z + 8;

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

/**
 * Return must also cross the doorway; a side path is not an exit portal.
 * Interior coordinates: the way out is the atrium's front door at
 * ATRIUM_FRONT_Z, which opens onto the exterior door at ENTRANCE_PORTAL_Z.
 */
export function isExitingEntrance(pos: PortalPosition): boolean {
  return insideDoorwayOpening(pos)
    && pos.z > ATRIUM_FRONT_Z
    && pos.z <= ATRIUM_FRONT_Z + (THRESHOLD_PREPARE_Z - ENTRANCE_PORTAL_Z);
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
/**
 * Every phase change the director may make. Anything else is a logic error:
 * it is recorded in `illegalTransitions` and reported, never silently taken
 * as normal. (The doorway stranding bug was an unmodelled state: a
 * constructed interior whose entrance was not yet ready.)
 */
export const WORLD_TRANSITIONS: Readonly<Record<WorldPhase, readonly WorldPhase[]>> = {
  EXTERIOR_ACTIVE: ['PREPARING_INTERIOR', 'COMMITTING_INTERIOR'],
  PREPARING_INTERIOR: ['PREPARING_RENDER_RESOURCES', 'AT_THRESHOLD', 'INTERIOR_ACTIVE', 'PREPARATION_FAILED'],
  PREPARING_RENDER_RESOURCES: ['AT_THRESHOLD', 'COMMITTING_INTERIOR'],
  AT_THRESHOLD: ['COMMITTING_INTERIOR'],
  COMMITTING_INTERIOR: ['INTERIOR_ACTIVE'],
  INTERIOR_ACTIVE: ['COMMITTING_EXTERIOR'],
  PREPARING_EXTERIOR: [],
  COMMITTING_EXTERIOR: ['EXTERIOR_ACTIVE'],
  PREPARATION_FAILED: ['PREPARING_INTERIOR'],
};

export function isLegalWorldTransition(from: WorldPhase, to: WorldPhase): boolean {
  return from === to || WORLD_TRANSITIONS[from].includes(to);
}

export class WorldDirector {
  activeWorld: WorldId = 'exterior';
  private currentPhase: WorldPhase = 'EXTERIOR_ACTIVE';
  /** Transitions outside WORLD_TRANSITIONS, for tests and diagnostics. Expected to stay empty. */
  readonly illegalTransitions: { from: WorldPhase; to: WorldPhase }[] = [];

  get phase(): WorldPhase { return this.currentPhase; }

  private transition(to: WorldPhase): void {
    const from = this.currentPhase;
    if (!isLegalWorldTransition(from, to)) {
      this.illegalTransitions.push({ from, to });
      console.error(`[WorldDirector] illegal phase transition ${from} -> ${to}`);
    }
    this.currentPhase = to;
  }

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
    this.transition('PREPARING_INTERIOR');
    // No entrance/loading screen: preparation is invisible while walking.

    this.preparePromise = (async () => {
      try {
        await this.app.ensureInteriorLoaded();
        this.interiorConstructed = true;
        this.transition(this.activeWorld === 'interior' ? 'INTERIOR_ACTIVE'
          : this.entranceIsReady() ? 'AT_THRESHOLD' : 'PREPARING_RENDER_RESOURCES');

        // Preparation can finish while the visitor walks around the island.
        // Only the physical doorway is allowed to trigger a world switch.
        if (this.activeWorld === 'exterior' && this.app.ticket
          && isAtEntrancePortal(this.app.player.position)) {
          this.commitToInterior(true);
        }
      } catch (err) {
        console.error('[WorldDirector] failed to prepare interior', err);
        this.transition('PREPARATION_FAILED');
        this.preparePromise = null;
        this.app.ui?.hud.setThresholdStatus(true, 'The galleries could not be opened this time. The island remains available: retry, or keep exploring outside.', true);
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
   *
   * `viaDoor`: the visitor walked through the exterior door. The exterior
   * door (z = ENTRANCE_PORTAL_Z) opens into the interior atrium's front door
   * (z = ATRIUM_FRONT_Z): the atrium is longer than the building outside
   * holds, so the visitor is carried SEAM_OFFSET_Z metres on. Programmatic
   * callers (Workshop, tests) keep their coordinates.
   */
  commitToInterior(viaDoor = false): boolean {
    if (this.activeWorld === 'interior' || this.isCommitting) return true;
    if (this.app.renderer.isContextLost || !this.interiorConstructed || !this.app.interiorWorld
      || !this.entranceIsReady()) return false;

    this.isCommitting = true;
    this.transition('COMMITTING_INTERIOR');

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
      if (viaDoor) this.app.player.shift(0, 0, SEAM_OFFSET_Z);

      // 4. Update world mode and state
      this.activeWorld = 'interior';
      this.transition('INTERIOR_ACTIVE');
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

  /** `viaDoor`: leaving through the atrium's front door (see commitToInterior). */
  switchToExterior(viaDoor = false): boolean {
    if (this.activeWorld === 'exterior' || this.isCommitting) return true;
    if (this.app.renderer.isContextLost) return false;

    this.isCommitting = true;
    this.transition('COMMITTING_EXTERIOR');

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
      if (viaDoor) this.app.player.shift(0, 0, -SEAM_OFFSET_Z);

      this.activeWorld = 'exterior';
      this.transition('EXTERIOR_ACTIVE');

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
    // The doorway opens on the entrance exhibits alone. The rest of the
    // building warms in the background (App.interiorWorldWarmed) and is normally
    // done long before the visitor reaches the door; it never holds them there.
    const rawEntranceReady = Boolean(this.app.interiorWorld?.streaming.telemetry.prewarmReady);
    if (rawEntranceReady && this.app.interiorLoadTelemetry.entranceReadyAtMs === null) {
      this.app.interiorLoadTelemetry.entranceReadyAtMs = performance.now();
    }
    const entranceReady = this.entranceIsReady();
    if (entranceReady && this.activeWorld === 'exterior' && this.interiorConstructed
      && this.phase === 'PREPARING_RENDER_RESOURCES') this.transition('AT_THRESHOLD');
    // Normal entry is spatial, never a HUD click-through or a loading panel.
    // Preserve an actionable non-modal recovery only for a real load failure.
    if (inApproach && this.activeWorld === 'exterior' && this.phase === 'PREPARATION_FAILED'
      && !this.thresholdPromptDismissed) {
      this.app.ui?.hud.setThresholdStatus(true,
        'The galleries could not be opened this time. Retry, or continue exploring outside.', true);
    } else {
      this.app.ui?.hud.setThresholdStatus(false, '');
    }

    // 1. Prepare invisibly only when approaching the actual south doorway.
    // The previous Z-only condition loaded the museum from anywhere on the island.
    if (this.activeWorld === 'exterior' && !this.interiorImportStarted
      && inApproach && playerPosition.z <= ENTRANCE_PREWARM_START_Z) {
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
        // Admission is by ticket: without one the doorway holds the visitor
        // however ready the galleries are.
        const committed = Boolean(this.app.ticket) && this.interiorConstructed
          && Boolean(this.app.interiorWorld) && this.commitToInterior(true);
        if (!committed) {
          playerPosition.z = Math.max(ENTRANCE_PORTAL_Z + 0.05, playerPosition.z);
        }
      }
    } else if (this.activeWorld === 'interior') {
      if (isExitingEntrance(playerPosition)) this.switchToExterior(true);
    }
  }
}

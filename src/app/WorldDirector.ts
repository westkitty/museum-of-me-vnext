import type * as THREE from 'three';
import type { App } from './App';
import { ENTRANCE_PORTAL_Z, THRESHOLD_PREPARE_Z, GROUND_Y } from '../world/layout';

export type WorldId = 'exterior' | 'interior';

export type WorldPhase =
  | 'EXTERIOR_ACTIVE'
  | 'PREPARING_INTERIOR'
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

  constructor(private readonly app: App) {
    this.firstExteriorInteractiveMs = performance.now();
  }

  async prepareInterior(): Promise<void> {
    if (this.interiorConstructed) return;
    if (this.preparePromise) return this.preparePromise;
    this.interiorImportStarted = true;
    this.phase = 'PREPARING_INTERIOR';
    this.app.ui?.hud.announce('Preparing the galleries…');

    this.preparePromise = (async () => {
      try {
        await this.app.ensureInteriorLoaded();
        this.interiorConstructed = true;
        this.phase = this.activeWorld === 'interior' ? 'INTERIOR_ACTIVE' : 'AT_THRESHOLD';

        // If player is waiting at the threshold seam when load completes, commit transition immediately
        if (this.activeWorld === 'exterior' && this.app.player.position.z <= ENTRANCE_PORTAL_Z + 0.1) {
          this.commitToInterior();
        }
      } catch (err) {
        console.error('[WorldDirector] failed to prepare interior', err);
        this.phase = 'PREPARATION_FAILED';
        this.preparePromise = null;
        this.app.ui?.hud.announce('Gallery preparation failed. Press R to retry.');
        throw err;
      }
    })();
    return this.preparePromise;
  }

  async retryInteriorLoad(): Promise<void> {
    this.interiorImportStarted = false;
    this.preparePromise = null;
    return this.prepareInterior();
  }

  /**
   * Synchronous atomic handoff to the interior world.
   * Can be called during a frame tick once interior is constructed.
   */
  commitToInterior(): boolean {
    if (this.activeWorld === 'interior' || this.isCommitting) return true;
    if (this.app.renderer.isContextLost || !this.interiorConstructed || !this.app.interiorWorld) return false;

    this.isCommitting = true;
    this.phase = 'COMMITTING_INTERIOR';

    // Scoped freeze during atomic handoff: ensures no half-step movement or physics desync
    const releaseFreeze = this.app.player.acquireFreeze();

    try {
      // 1. Inactive world is hidden, active world is shown
      this.app.exteriorWorld.root.visible = false;
      this.app.interiorWorld.root.visible = true;

      // 2. Physics collision switches to destination world
      this.app.player.setCollisionWorld(this.app.interiorWorld.collision);

      // 3. Ensure player support height is level with vestibule floor (y >= GROUND_Y)
      if (this.app.player.position.y < GROUND_Y) {
        this.app.player.position.y = GROUND_Y;
      }

      // 4. Update world mode and state
      this.activeWorld = 'interior';
      this.phase = 'INTERIOR_ACTIVE';

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

    // 1. Predictive interior load on approach toward south entrance doorway (z <= 134)
    if (this.activeWorld === 'exterior' && !this.interiorImportStarted && playerPosition.z <= THRESHOLD_PREPARE_Z) {
      void this.prepareInterior();
    }

    // 2. World boundary handoff across doorway portal plane (z = 128):
    if (this.activeWorld === 'exterior') {
      if (playerPosition.z <= ENTRANCE_PORTAL_Z) {
        if (this.interiorConstructed && this.app.interiorWorld) {
          this.commitToInterior();
        } else {
          // If arrival at threshold happens before load finishes, hold player at doorway seam
          // so player does not walk into void while waiting.
          playerPosition.z = Math.max(ENTRANCE_PORTAL_Z + 0.05, playerPosition.z);
        }
      }
    } else if (this.activeWorld === 'interior') {
      // Stepping back out through south vestibule doorway into exterior
      if (playerPosition.z > ENTRANCE_PORTAL_Z) {
        this.switchToExterior();
      }
    }
  }
}

import type * as THREE from 'three';
import type { App } from './App';

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
 * predictive loading on approach, and failure recovery.
 */
export class WorldDirector {
  activeWorld: WorldId = 'exterior';
  phase: WorldPhase = 'EXTERIOR_ACTIVE';

  interiorConstructed = false;
  interiorImportStarted = false;
  exteriorReady = true;
  firstExteriorInteractiveMs = 0;

  private preparePromise: Promise<void> | null = null;

  constructor(private readonly app: App) {
    this.firstExteriorInteractiveMs = performance.now();
  }

  async prepareInterior(): Promise<void> {
    if (this.interiorConstructed) return;
    if (this.preparePromise) return this.preparePromise;
    this.interiorImportStarted = true;
    this.phase = 'PREPARING_INTERIOR';
    this.preparePromise = (async () => {
      try {
        await this.app.ensureInteriorLoaded();
        this.interiorConstructed = true;
        this.phase = this.activeWorld === 'interior' ? 'INTERIOR_ACTIVE' : 'AT_THRESHOLD';
      } catch (err) {
        console.error('[WorldDirector] failed to prepare interior', err);
        this.phase = 'PREPARATION_FAILED';
        throw err;
      }
    })();
    return this.preparePromise;
  }

  async switchToInterior(): Promise<boolean> {
    await this.prepareInterior();
    if (!this.interiorConstructed || !this.app.interiorWorld) return false;

    this.phase = 'COMMITTING_INTERIOR';

    // Atomic world switch:
    // 1. Inactive world is hidden, active world is shown
    this.app.exteriorWorld.root.visible = false;
    this.app.interiorWorld.root.visible = true;

    // 2. Physics collision switches to destination world
    this.app.player.setCollisionWorld(this.app.interiorWorld.collision);

    // 3. Update world mode and state
    this.activeWorld = 'interior';
    this.phase = 'INTERIOR_ACTIVE';

    return true;
  }

  switchToExterior(): boolean {
    if (this.activeWorld === 'exterior') return true;

    this.phase = 'COMMITTING_EXTERIOR';

    if (this.app.interiorWorld) {
      this.app.interiorWorld.root.visible = false;
    }
    this.app.exteriorWorld.root.visible = true;

    this.app.player.setCollisionWorld(this.app.exteriorWorld.collision);

    this.activeWorld = 'exterior';
    this.phase = 'EXTERIOR_ACTIVE';

    return true;
  }

  update(playerPosition: THREE.Vector3): void {
    // Predictive interior load on approach toward south entrance doorway (z <= 128)
    if (this.activeWorld === 'exterior' && !this.interiorImportStarted && playerPosition.z <= 128) {
      void this.prepareInterior();
    }

    // World boundary handoff:
    if (this.activeWorld === 'exterior' && this.interiorConstructed && playerPosition.z <= 128) {
      void this.switchToInterior();
    } else if (this.activeWorld === 'interior' && playerPosition.z > 128) {
      this.switchToExterior();
    }
  }
}

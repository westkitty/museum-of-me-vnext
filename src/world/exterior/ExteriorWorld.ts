import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import { CollisionWorld } from '../CollisionWorld';
import { ArrivalGarden } from '../ArrivalGarden';
import { ArrivalBeacons } from '../ArrivalBeacons';
import { ExteriorIdentity } from '../ExteriorIdentity';
import { GROUND_Y, ZONE_BY_ID, type Vec3, type ZoneId } from '../layout';
import type { QualityTier } from '../../render/QualityTiers';

/**
 * Autonomous Exterior World context.
 * Owns the exterior island terrain, shoreline, waters, outdoor entrance facade,
 * arrival lanterns, and exterior collision plane.
 *
 * It does NOT import, construct, or evaluate interior museum wings, exhibits,
 * or indoor visitor actors.
 */
export class ExteriorWorld {
  readonly id = 'exterior' as const;
  readonly scope = new ResourceScope('exterior-world');
  readonly root = new THREE.Group();
  readonly collision = new CollisionWorld();
  readonly arrivalGarden: ArrivalGarden;
  readonly arrivalBeacons: ArrivalBeacons;
  readonly exteriorIdentity: ExteriorIdentity;

  readonly spawnPosition: Vec3 = ZONE_BY_ID.get('plaza')!.center;
  readonly spawnYaw = 0;

  constructor(qualityTier: QualityTier) {
    this.root.name = 'exterior-world';

    // The outdoor ground floor covers the island and arrival plaza footprint.
    // Sits at GROUND_Y - 0.5 to match the authoritative exterior ground plane.
    this.collision.addFloor(-300, 300, -300, 300, GROUND_Y - 0.5);

    // ArrivalGarden registers its own collision boxes (pillars, hedges, pool edges).
    this.arrivalGarden = new ArrivalGarden(this.scope, this.collision);
    this.root.add(this.arrivalGarden.build());
    this.arrivalGarden.setWaterQuality(qualityTier);

    this.arrivalBeacons = new ArrivalBeacons(this.scope);
    this.root.add(this.arrivalBeacons.group);

    this.exteriorIdentity = new ExteriorIdentity(this.scope);
    this.root.add(this.exteriorIdentity.build());
  }

  setWaterQuality(tier: QualityTier): void {
    this.arrivalGarden.setWaterQuality(tier);
  }

  authorableSceneRoots(): readonly { readonly id: string; readonly root: THREE.Object3D }[] {
    return this.arrivalGarden.authorableSceneRoots();
  }

  fixedUpdate(_dt: number): void {
    // Exterior fixed simulation ticks (foliage, particles, etc. in future phases)
  }

  variableUpdate(_dt: number, _eye: readonly [number, number, number], _zone: ZoneId): void {
    // Exterior per-frame visual updates
  }

  dispose(): void {
    this.scope.dispose();
  }
}

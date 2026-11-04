import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import { CollisionWorld } from '../CollisionWorld';
import { ArrivalGarden } from '../ArrivalGarden';
import { ArrivalBeacons } from '../ArrivalBeacons';
import { ExteriorIdentity } from '../ExteriorIdentity';
import { ExteriorMuseumShell } from './ExteriorMuseumShell';
import { IslandLandscape } from './IslandLandscape';
import { ExteriorWildlife } from './ExteriorWildlife';
import { addIslandSupport } from './IslandSiteLayout';
import { START_POSITION, START_YAW } from '../start';
import {
  GROUND_Y,
  SOUTH,
  VESTIBULE_TO,
  PLAZA_DEPTH,
  PLAZA_HALF_WIDTH,
  PORTAL_WIDTH,
  type Vec3,
  type ZoneId,
} from '../layout';
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
  readonly museumShell: ExteriorMuseumShell;
  readonly islandLandscape: IslandLandscape;
  readonly wildlife: ExteriorWildlife;

  readonly spawnPosition: Vec3 = START_POSITION;
  readonly spawnYaw = START_YAW;

  constructor(qualityTier: QualityTier) {
    this.root.name = 'exterior-world';

    // Bounded support is derived from the closed site outline and leaves the
    // lagoon, ocean and offshore space unsupported.
    addIslandSupport(this.collision);

    // Raised arrival plaza terrace: floor at GROUND_Y (0) from z = 128 to 158
    this.collision.addFloor(
      -PLAZA_HALF_WIDTH,
      PLAZA_HALF_WIDTH,
      VESTIBULE_TO,
      VESTIBULE_TO + PLAZA_DEPTH,
      GROUND_Y,
    );

    // Steps down from plaza to ground: z = 158 to 164, sloping from 0 to -0.5
    this.collision.addFloor(
      -PLAZA_HALF_WIDTH,
      PLAZA_HALF_WIDTH,
      VESTIBULE_TO + PLAZA_DEPTH,
      VESTIBULE_TO + PLAZA_DEPTH + 6,
      GROUND_Y - 0.5,
    );

    // ArrivalGarden registers its own collision boxes (pillars, hedges, pool edges).
    this.arrivalGarden = new ArrivalGarden(this.scope, this.collision);
    this.root.add(this.arrivalGarden.build());
    this.arrivalGarden.setWaterQuality(qualityTier);

    this.islandLandscape = new IslandLandscape(this.scope, this.collision, qualityTier);
    this.root.add(this.islandLandscape.build());

    this.wildlife = new ExteriorWildlife(this.scope, qualityTier);
    this.root.add(this.wildlife.root);

    this.arrivalBeacons = new ArrivalBeacons(this.scope);
    this.root.add(this.arrivalBeacons.group);

    this.exteriorIdentity = new ExteriorIdentity(this.scope);
    this.root.add(this.exteriorIdentity.build());

    this.museumShell = new ExteriorMuseumShell(this.scope, this.collision);
    this.root.add(this.museumShell.build());

    // Stable inspector semantics remain separate from the Workshop's
    // intentionally narrow authorable-object IDs and mutation contract.
    this.root.userData.spatialSource = 'ExteriorWorld';
    this.museumShell.group.userData.spatialFeatureId = 'exterior-museum-shell';
    this.museumShell.group.getObjectByName('central-turquoise-dome-glazing')!.userData.spatialFeatureId = 'exterior-dome';
    this.arrivalGarden.group.getObjectByName('east-sheltered-lagoon')!.userData.spatialFeatureId = 'lagoon-east';
    this.arrivalGarden.group.getObjectByName('night-island-terrain')!.userData.spatialFeatureId = 'island-land';
    this.islandLandscape.root.userData.spatialFeatureId = 'island-landscape';
    this.islandLandscape.root.getObjectByName('perimeter-woodland-trunks')!.userData.spatialFeatureId = 'grove-perimeter-trunks';
    this.islandLandscape.root.getObjectByName('single-golden-spire')!.userData.spatialFeatureId = 'spire-northwest';
    this.islandLandscape.root.getObjectByName('south-arrival-pier-deck')!.userData.spatialFeatureId = 'pier-south';

    // Build outer threshold buffer and doorway occluder
    this.buildThresholdVestibule();
  }

  /**
   * Builds an outer vestibule visual buffer and doorway aperture matching the south
   * entrance, providing sightline occlusion for the impossible architecture.
   */
  private buildThresholdVestibule(): void {
    const hw = SOUTH.hallHalfWidth; // 9
    const fromZ = VESTIBULE_TO - 6; // 122
    const toZ = VESTIBULE_TO; // 128
    const depth = toZ - fromZ;
    const midZ = (fromZ + toZ) / 2;

    const wallMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x141a22, roughness: 0.85, metalness: 0.15,
    }));
    const floorMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x11161d, roughness: 0.7, metalness: 0.2,
    }));
    const portalBackdropMat = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0x05070a,
    }));

    // Vestibule floor inside doorway buffer
    const floorGeo = this.scope.track(new THREE.PlaneGeometry(hw * 2, depth));
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, GROUND_Y, midZ);
    floor.receiveShadow = true;
    this.root.add(floor);
    this.collision.addFloor(-hw, hw, fromZ, toZ, GROUND_Y);

    // Vestibule ceiling
    const ceil = new THREE.Mesh(floorGeo, wallMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, GROUND_Y + 9, midZ);
    this.root.add(ceil);

    // Side walls
    const wallGeo = this.scope.track(new THREE.PlaneGeometry(depth, 9));
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.rotation.y = s * Math.PI / 2;
      wall.position.set(s * hw, GROUND_Y + 4.5, midZ);
      this.root.add(wall);
      this.collision.addBox([s * hw, GROUND_Y + 4.5, midZ], [0.25, 4.5, depth / 2]);
    }

    // Portal occluder backdrop at the back of the outer vestibule buffer (z = 122)
    const backGeo = this.scope.track(new THREE.PlaneGeometry(hw * 2, 9));
    const back = new THREE.Mesh(backGeo, portalBackdropMat);
    back.position.set(0, GROUND_Y + 4.5, fromZ);
    this.root.add(back);

    // Front facade wall with portal opening at toZ (z = 128)
    const halfOpening = PORTAL_WIDTH / 2; // 3.5
    const leftWidth = PLAZA_HALF_WIDTH - halfOpening;
    // Left facade wall box: x from -PLAZA_HALF_WIDTH to -halfOpening
    this.collision.addBox(
      [(-PLAZA_HALF_WIDTH - halfOpening) / 2, GROUND_Y + 6, toZ],
      [leftWidth / 2, 6, 0.25],
    );
    // Right facade wall box: x from halfOpening to PLAZA_HALF_WIDTH
    this.collision.addBox(
      [(halfOpening + PLAZA_HALF_WIDTH) / 2, GROUND_Y + 6, toZ],
      [leftWidth / 2, 6, 0.25],
    );
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

  variableUpdate(dt: number, eye: readonly [number, number, number], _zone: ZoneId, reducedMotion = false): void {
    this.wildlife.update(dt, eye, reducedMotion);
  }

  dispose(): void {
    this.scope.dispose();
  }
}

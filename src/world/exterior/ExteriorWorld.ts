import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import { CollisionWorld } from '../CollisionWorld';
import { ArrivalGarden } from '../ArrivalGarden';
import { ArrivalBeacons } from '../ArrivalBeacons';
import { ExteriorIdentity } from '../ExteriorIdentity';
import { ExteriorMuseumShell } from './ExteriorMuseumShell';
import { IslandLandscape } from './IslandLandscape';
import { ExteriorWildlife } from './ExteriorWildlife';
import { ExteriorSignatureFeatures } from './ExteriorSignatureFeatures';
import { ExteriorWaymarkers } from './ExteriorWaymarkers';
import { TicketKiosk } from './TicketKiosk';
import { ObsidianSphereEntrance } from './ObsidianSphereEntrance';
import { ExteriorLighthouse } from './ExteriorLighthouse';
import { ExteriorObservatory } from './ExteriorObservatory';
import { ExteriorRootboundHollow } from './ExteriorRootboundHollow';
import { addIslandSupport, addLagoonEdge } from './IslandSiteLayout';
import { START_POSITION, START_YAW } from '../start';
import {
  GROUND_Y,
  SOUTH,
  VESTIBULE_TO,
  PLAZA_DEPTH,
  PLAZA_HALF_WIDTH,
  PORTAL_WIDTH,
  PORTAL_VESTIBULE_DEPTH,
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
  readonly signatureFeatures: ExteriorSignatureFeatures;
  readonly waymarkers: ExteriorWaymarkers;
  /** Admissions kiosk; App builds it and registers its interaction. */
  readonly ticketKiosk: TicketKiosk;
  /** Physical obsidian walk-around entrance before the existing world seam. */
  readonly sphereEntrance: ObsidianSphereEntrance;
  /** Climbable southeast coastal peninsula and lighthouse (ISLAND-02A). */
  readonly lighthouse: ExteriorLighthouse;
  /** Southern wooded hill ruined observatory (ISLAND-02B). */
  readonly observatory: ExteriorObservatory;
  /** Discoverable vaulted root grotto beneath the Ancient Tree roots (ISLAND-02C). */
  readonly rootboundHollow: ExteriorRootboundHollow;

  readonly spawnPosition: Vec3 = START_POSITION;
  readonly spawnYaw = START_YAW;

  constructor(qualityTier: QualityTier) {
    this.root.name = 'exterior-world';

    // Bounded support is derived from the closed site outline and leaves the
    // lagoon, ocean and offshore space unsupported.
    addIslandSupport(this.collision);
    addLagoonEdge(this.collision);

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

    this.signatureFeatures = new ExteriorSignatureFeatures(this.scope, this.collision, qualityTier);
    this.root.add(this.signatureFeatures.root);

    this.waymarkers = new ExteriorWaymarkers(this.scope, this.collision);
    this.root.add(this.waymarkers.build());

    this.ticketKiosk = new TicketKiosk(this.scope, this.collision);

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

    this.sphereEntrance = new ObsidianSphereEntrance(this.scope, this.collision);
    this.root.add(this.sphereEntrance.build());

    this.lighthouse = new ExteriorLighthouse(this.scope, this.collision);
    this.root.add(this.lighthouse.group);

    this.observatory = new ExteriorObservatory(this.scope, this.collision);
    this.root.add(this.observatory.group);

    this.rootboundHollow = new ExteriorRootboundHollow(this.scope, this.collision);
    this.root.add(this.rootboundHollow.group);
  }

  /**
   * Builds an outer vestibule visual buffer and doorway aperture matching the south
   * entrance, providing sightline occlusion for the impossible architecture.
   */
  private buildThresholdVestibule(): void {
    const hw = SOUTH.hallHalfWidth; // 9
    const fromZ = VESTIBULE_TO - PORTAL_VESTIBULE_DEPTH; // 122
    const toZ = VESTIBULE_TO; // 128
    const depth = toZ - fromZ;
    const midZ = (fromZ + toZ) / 2;

    // Beyond the doorway is the atrium, which waits in the dark until the
    // visitor steps in (Museum.updateAtrium). The buffer therefore reads as
    // that darkness: one unlit deep-navy tone on every surface, so no corner,
    // edge or arch reads as a wall. It used to be a lit slate foyer with a
    // warm emissive backdrop, a bronze "rotunda portal" arch and amber
    // sconces, which from inside the obsidian sphere looked like a closed
    // wall at the end of the passage (2026-11-21 walkthrough). Unlit
    // materials only: no light may join the exterior root (shader variants).
    // Deep navy rather than black (2026-11-21 walkthrough: the opening read as
    // solid black and the walking surface could not be seen). Still darker
    // than the lit exterior, so the threshold stays dramatic.
    const wallMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0x0b1729 }));
    const floorMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0x10213a }));
    const portalBackdropMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0x07101f }));

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

    // The one thing a visitor would make out in the dark atrium from here: a
    // faint azure glow high up where the "Museum of Me" hologram hangs, which
    // lights first as they step in. Unlit, additive, no light source.
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const glow = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
        glow.addColorStop(0, 'rgba(70,170,255,0.55)');
        glow.addColorStop(0.45, 'rgba(30,110,230,0.16)');
        glow.addColorStop(1, 'rgba(0,40,160,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 128, 128);
        const hint = new THREE.Mesh(
          this.scope.track(new THREE.PlaneGeometry(hw * 1.6, 4.2)),
          this.scope.track(new THREE.MeshBasicMaterial({
            map: this.scope.track(new THREE.CanvasTexture(canvas)), transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
          })),
        );
        hint.name = 'threshold-atrium-hologram-hint';
        hint.position.set(0, GROUND_Y + 5.6, fromZ + 0.05);
        this.root.add(hint);
      }
    }

    this.buildThresholdContinuity(hw, fromZ, toZ);

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

  /**
   * The arrival axis used to stop dead at the doors: pale plaza walk and its
   * two bronze inlays outside, a dark floor and an unlit black ceiling inside.
   * Carry the walk and inlays through the opening to the foyer backdrop and
   * give the vestibule soffit a warm coffer glow. Visual only: no collider,
   * no light, no change to the doorway aperture or the handoff volumes.
   */
  private buildThresholdContinuity(hw: number, fromZ: number, toZ: number): void {
    const depth = toZ - fromZ;
    const midZ = (fromZ + toZ) / 2;
    // Toned to the atrium as it waits in the dark: its sky-blue runner and
    // coffers barely lit, continuing the arrival axis into the deep navy.
    const runnerMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0x24507a }));
    const inlayMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0x4f9ad0 }));
    const glowMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0x2f7fbf, toneMapped: false }));

    const runner = new THREE.Mesh(this.scope.track(new THREE.PlaneGeometry(10.8, depth - 0.1)), runnerMat);
    runner.name = 'vestibule-arrival-runner';
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, GROUND_Y + 0.012, midZ + 0.05);
    runner.receiveShadow = true;
    this.root.add(runner);

    const inlayGeo = this.scope.track(new THREE.BoxGeometry(0.055, 0.016, depth - 0.1));
    for (const side of [-1, 1]) {
      const inlay = new THREE.Mesh(inlayGeo, inlayMat);
      inlay.name = 'vestibule-axis-inlay';
      inlay.position.set(side * 4.6, GROUND_Y + 0.02, midZ + 0.05);
      this.root.add(inlay);
    }

    const cofferGeo = this.scope.track(new THREE.BoxGeometry(hw * 2 - 1.2, 0.05, 0.22));
    for (let i = 0; i < 3; i++) {
      const coffer = new THREE.Mesh(cofferGeo, glowMat);
      coffer.name = 'vestibule-soffit-coffer';
      coffer.position.set(0, GROUND_Y + 8.95, fromZ + depth * (i + 0.5) / 3);
      this.root.add(coffer);
    }
  }

  setQuality(tier: QualityTier): void {
    this.islandLandscape.setQuality(tier);
    this.signatureFeatures.setQuality(tier);
    this.setWaterQuality(tier);
  }

  setWaterQuality(tier: QualityTier): void {
    this.arrivalGarden.setWaterQuality(tier);
    this.wildlife.setQuality(tier);
  }

  authorableSceneRoots(): readonly { readonly id: string; readonly root: THREE.Object3D }[] {
    return this.arrivalGarden.authorableSceneRoots();
  }

  fixedUpdate(_dt: number): void {
    // Exterior fixed simulation ticks (foliage, particles, etc. in future phases)
  }

  variableUpdate(dt: number, eye: readonly [number, number, number], _zone: ZoneId, reducedMotion = false): void {
    this.wildlife.update(dt, eye, reducedMotion);
    this.signatureFeatures.update(dt, reducedMotion);
    this.ticketKiosk.update(dt);
    this.sphereEntrance.update(dt, eye, reducedMotion);
    this.lighthouse.update(dt, reducedMotion);
    this.observatory.update(dt, reducedMotion);
    this.rootboundHollow.update(dt, reducedMotion);
  }

  dispose(): void {
    this.scope.dispose();
  }
}

import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { CollisionWorld } from '../CollisionWorld';
import type { QualityTier } from '../../render/QualityTiers';
import { GROUND_Y, type Vec3 } from '../layout';

/**
 * ExteriorSignatureFeatures implements the 12 Mandatory Signature Additions (AWE layer)
 * alongside required furnishings (benches, tables, entrance fountain rill connection,
 * animal statuary, and Neolithic-inspired sculpture artworks).
 *
 * All features are deterministic, strictly bounded in resource lifecycle,
 * fully integrated into the exterior collision plane, and quality-tier responsive.
 */
export class ExteriorSignatureFeatures {
  readonly root = new THREE.Group();

  private readonly bronzeMat: THREE.MeshStandardMaterial;
  private readonly stoneMat: THREE.MeshStandardMaterial;
  private readonly darkBasaltMat: THREE.MeshStandardMaterial;
  private readonly timberMat: THREE.MeshStandardMaterial;
  private readonly mossStoneMat: THREE.MeshStandardMaterial;
  private readonly fernLeafMat: THREE.MeshStandardMaterial;
  private readonly flowerMagentaMat: THREE.MeshStandardMaterial;
  private readonly flowerBlueMat: THREE.MeshStandardMaterial;
  private readonly flowerYellowMat: THREE.MeshStandardMaterial;
  private readonly grassMat: THREE.MeshStandardMaterial;
  private readonly rillWaterMat: THREE.MeshStandardMaterial;
  private readonly tidepoolWaterMat: THREE.MeshStandardMaterial;
  private readonly amberGlowMat: THREE.MeshBasicMaterial;
  private readonly verdigrisMat: THREE.MeshStandardMaterial;

  // Kinetic & dynamic references
  private windGroveVanes: THREE.Object3D[] = [];
  private rillWaterMesh: THREE.Mesh | null = null;
  private meadowButterflies: THREE.InstancedMesh | null = null;
  private butterflyTransforms: { x: number; y: number; z: number; phase: number; radius: number; speed: number }[] = [];
  private animTime = 0;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
    private quality: QualityTier,
  ) {
    this.root.name = 'exterior-signature-features';

    // Shared high-efficiency materials tracked in the parent scope
    this.bronzeMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x9e7d56, metalness: 0.65, roughness: 0.35,
    }));
    this.verdigrisMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x367b6b, metalness: 0.45, roughness: 0.42,
    }));
    this.stoneMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x5a6369, roughness: 0.92, metalness: 0.05,
    }));
    this.darkBasaltMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x222a30, roughness: 0.75, metalness: 0.15,
    }));
    this.timberMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x38271e, roughness: 0.96, metalness: 0,
    }));
    this.mossStoneMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x274232, roughness: 0.95, flatShading: true,
    }));
    this.fernLeafMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x1f5e42, roughness: 0.85, side: THREE.DoubleSide,
    }));
    this.flowerMagentaMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x9b3b64, roughness: 0.7, metalness: 0.1,
    }));
    this.flowerBlueMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x5272a8, roughness: 0.75, metalness: 0.08,
    }));
    this.flowerYellowMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0xd4a028, roughness: 0.65, metalness: 0.12,
    }));
    this.grassMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x325841, roughness: 0.92, side: THREE.DoubleSide,
    }));
    this.rillWaterMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x2c6f87, roughness: 0.18, metalness: 0.25, transparent: true, opacity: 0.72, depthWrite: false,
    }));
    this.tidepoolWaterMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x186b7c, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.68, depthWrite: false,
    }));
    this.amberGlowMat = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xffba70, toneMapped: false,
    }));

    this.buildAll();
  }

  private buildAll(): void {
    // 1. The Arrival Axis — luminous stone inlay
    this.buildArrivalAxisInlay();

    // 2. Sculpted reflecting rill & stone step-over bridge
    this.buildSculptedReflectingRill();

    // 3. Living fern ravine
    this.buildLivingFernRavine();

    // 4. Wildflower pollinator meadow with bounded butterflies
    this.buildWildflowerPollinatorMeadow();

    // 5. Neolithic-inspired stone circle & interpretive plinth
    this.buildNeolithicStoneCircle();

    // 6. Wildlife observation hide on lagoon bank
    this.buildWildlifeObservationHide();

    // 7. Sculptural wind grove (procedural kinetic forms)
    this.buildSculpturalWindGrove();

    // 8. Ancient-tree landmark
    this.buildAncientTreeLandmark();

    // 9. Moonlit lantern path
    this.buildMoonlitLanternPath();

    // 10. Coastal tidepool garden
    this.buildCoastalTidepoolGarden();

    // 11. Terrace of astronomical/seasonal markers
    this.buildAstronomicalSeasonalTerrace();

    // 12. Monumental rear-garden reveal
    this.buildMonumentalRearGardenReveal();

    // Required complementary furnishings & artworks
    this.buildAnimalStatuary();
    this.buildNeolithicSculptures();
    this.buildOutdoorFurnishings();
  }

  /* -------------------------------------------------------------------------- */
  /* 1. THE ARRIVAL AXIS — LUMINOUS STONE INLAY                                  */
  /* -------------------------------------------------------------------------- */
  private buildArrivalAxisInlay(): void {
    const group = new THREE.Group();
    group.name = 'arrival-axis-luminous-inlay';

    // Inlay flagstone panels along the pier-to-entrance promenade (z = 148 to 165)
    const numPanels = 9;
    const panelLength = (165 - 148) / numPanels;
    for (let i = 0; i < numPanels; i++) {
      const zCenter = 148 + (i + 0.5) * panelLength;
      // Terrace is at GROUND_Y (0) for z <= 158; steps slope to -0.5 for z > 158
      const y = zCenter <= 158 ? GROUND_Y + 0.012 : GROUND_Y - 0.5 + 0.012;

      // Central engraved medallion panel
      const medallionGeo = this.scope.track(new THREE.CylinderGeometry(0.75, 0.75, 0.015, 16));
      const medallion = new THREE.Mesh(medallionGeo, this.bronzeMat);
      medallion.position.set(0, y, zCenter);
      medallion.receiveShadow = true;
      group.add(medallion);

      // Embedded fossil ammonite / celestial spiral relief
      const spiralRing = new THREE.Mesh(
        this.scope.track(new THREE.TorusGeometry(0.48, 0.035, 6, 18, Math.PI * 1.75)),
        this.amberGlowMat,
      );
      spiralRing.rotation.x = -Math.PI / 2;
      spiralRing.position.set(0, y + 0.009, zCenter);
      group.add(spiralRing);

      // Flanking stone paving borders with roughness variation
      for (const side of [-1, 1]) {
        const borderGeo = this.scope.track(new THREE.BoxGeometry(0.65, 0.012, panelLength * 0.92));
        const border = new THREE.Mesh(borderGeo, this.stoneMat);
        border.position.set(side * 1.55, y, zCenter);
        border.receiveShadow = true;
        group.add(border);
      }
    }

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 2. SCULPTED REFLECTING RILL                                                */
  /* -------------------------------------------------------------------------- */
  private buildSculptedReflectingRill(): void {
    const group = new THREE.Group();
    group.name = 'sculpted-reflecting-rill';

    // Rill curves from entrance fountain at [0, GROUND_Y, 142] toward west pool at [-14, GROUND_Y, 145]
    const curvePoints = [
      new THREE.Vector3(0, GROUND_Y, 142.5),
      new THREE.Vector3(-4, GROUND_Y, 143.2),
      new THREE.Vector3(-8, GROUND_Y, 144.1),
      new THREE.Vector3(-12, GROUND_Y, 144.8),
      new THREE.Vector3(-15, GROUND_Y, 145.2),
    ];
    const rillCurve = new THREE.CatmullRomCurve3(curvePoints);
    const rillGeo = this.scope.track(new THREE.TubeGeometry(rillCurve, 32, 0.38, 8, false));

    // Carved stone coping channel
    const rillStone = new THREE.Mesh(rillGeo, this.stoneMat);
    rillStone.position.y = -0.12;
    rillStone.receiveShadow = true;
    group.add(rillStone);

    // Reflecting water surface
    const waterSurfaceGeo = this.scope.track(new THREE.PlaneGeometry(15.5, 0.55));
    const waterMesh = new THREE.Mesh(waterSurfaceGeo, this.rillWaterMat);
    waterMesh.name = 'reflecting-rill-water';
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.rotation.z = Math.PI * 0.06;
    waterMesh.position.set(-7.5, GROUND_Y + 0.015, 143.8);
    group.add(waterMesh);
    this.rillWaterMesh = waterMesh;

    // Terminal quiet reflecting basin
    const basinGeo = this.scope.track(new THREE.CylinderGeometry(1.65, 1.85, 0.32, 20));
    const basin = new THREE.Mesh(basinGeo, this.stoneMat);
    basin.position.set(-15, GROUND_Y + 0.16, 145.2);
    basin.castShadow = true;
    basin.receiveShadow = true;
    group.add(basin);
    this.collision.addBox([-15, GROUND_Y + 0.16, 145.2], [1.85, 0.2, 1.85]);

    const basinWater = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(1.45, 1.45, 0.02, 20)),
      this.rillWaterMat,
    );
    basinWater.position.set(-15, GROUND_Y + 0.31, 145.2);
    group.add(basinWater);

    // Accessible stone step-over bridge across the rill at pedestrian crossing (x = -5, z = 143.4)
    const bridgeGeo = this.scope.track(new THREE.BoxGeometry(2.4, 0.08, 1.8));
    const bridge = new THREE.Mesh(bridgeGeo, this.stoneMat);
    bridge.name = 'reflecting-rill-bridge';
    bridge.position.set(-5, GROUND_Y + 0.04, 143.4);
    bridge.receiveShadow = true;
    group.add(bridge);
    // Smooth step-over floor collision ensures 100% accessible traversal across the rill
    this.collision.addFloor(-6.2, -3.8, 142.5, 144.3, GROUND_Y);

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 3. LIVING FERN RAVINE                                                      */
  /* -------------------------------------------------------------------------- */
  private buildLivingFernRavine(): void {
    const group = new THREE.Group();
    group.name = 'living-fern-ravine';
    const center: Vec3 = [-126, -0.48, -2];

    // Sunken mossy clearing floor
    const dellFloorGeo = this.scope.track(new THREE.CircleGeometry(11.5, 24));
    const dellFloor = new THREE.Mesh(dellFloorGeo, this.mossStoneMat);
    dellFloor.rotation.x = -Math.PI / 2;
    dellFloor.position.set(center[0], center[1], center[2]);
    dellFloor.receiveShadow = true;
    group.add(dellFloor);

    // Group of 5 weathered mossy boulders with colliders
    const boulderPositions: [number, number, number, number][] = [
      [-129, -0.2, 3, 1.5],
      [-123, -0.1, 4, 1.8],
      [-128, -0.3, -6, 1.4],
      [-122, -0.15, -4, 2.1],
      [-132, 0.0, -1, 1.6],
    ];
    for (const [bx, by, bz, radius] of boulderPositions) {
      const boulderGeo = this.scope.track(new THREE.DodecahedronGeometry(radius, 1));
      const boulder = new THREE.Mesh(boulderGeo, this.mossStoneMat);
      boulder.position.set(bx, by + radius * 0.5, bz);
      boulder.scale.set(1.15, 0.85, 1.05);
      boulder.rotation.set(bx * 0.1, bz * 0.1, 0);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      group.add(boulder);
      this.collision.addBox([bx, by + radius * 0.5, bz], [radius * 1.05, radius * 0.85, radius * 1.05]);
    }

    // Sculpted tiered fern fronds
    const frondGeo = this.scope.track(new THREE.PlaneGeometry(0.42, 1.35, 1, 3));
    const fernPositions: [number, number][] = [
      [-125, 1], [-127, 2], [-130, 0], [-124, -2], [-126, -5],
      [-122, 1], [-129, -4], [-127, 5], [-121, -6], [-131, 3],
      [-125, -1], [-123, 3],
    ];
    for (const [fx, fz] of fernPositions) {
      for (let fr = 0; fr < 6; fr++) {
        const angle = (fr / 6) * Math.PI * 2;
        const frond = new THREE.Mesh(frondGeo, this.fernLeafMat);
        frond.position.set(fx + Math.cos(angle) * 0.35, center[1] + 0.45, fz + Math.sin(angle) * 0.35);
        frond.rotation.set(0.45, angle, 0);
        frond.castShadow = true;
        group.add(frond);
      }
    }

    // Gnarled surface roots creeping over boulders
    const rootGeo = this.scope.track(new THREE.CylinderGeometry(0.12, 0.18, 4.2, 7));
    const root1 = new THREE.Mesh(rootGeo, this.timberMat);
    root1.position.set(-126, center[1] + 0.12, 1);
    root1.rotation.set(Math.PI / 2, 0, 0.45);
    group.add(root1);

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 4. WILDFLOWER POLLINATOR MEADOW                                             */
  /* -------------------------------------------------------------------------- */
  private buildWildflowerPollinatorMeadow(): void {
    const group = new THREE.Group();
    group.name = 'wildflower-pollinator-meadow';
    const center: Vec3 = [-68, -0.48, 118];

    // Meadow turf glade
    const meadowGeo = this.scope.track(new THREE.CircleGeometry(13.5, 24));
    const meadow = new THREE.Mesh(meadowGeo, this.mossStoneMat);
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.set(center[0], center[1], center[2]);
    meadow.receiveShadow = true;
    group.add(meadow);

    // Clumped ornamental grasses
    const grassBladeGeo = this.scope.track(new THREE.PlaneGeometry(0.2, 0.95));
    for (let g = 0; g < 18; g++) {
      const gAngle = (g / 18) * Math.PI * 2 + Math.sin(g * 7);
      const gDist = 2.5 + (g % 5) * 1.8;
      const gx = center[0] + Math.cos(gAngle) * gDist;
      const gz = center[2] + Math.sin(gAngle) * gDist;
      for (let b = 0; b < 5; b++) {
        const blade = new THREE.Mesh(grassBladeGeo, this.grassMat);
        blade.position.set(gx, center[1] + 0.45, gz);
        blade.rotation.set(0.25, (b / 5) * Math.PI * 2, 0);
        group.add(blade);
      }
    }

    // Distinct flower silhouettes (coneflowers, bluebells, buttercups)
    const stemGeo = this.scope.track(new THREE.CylinderGeometry(0.025, 0.035, 0.75, 4));
    const coneGeo = this.scope.track(new THREE.ConeGeometry(0.16, 0.22, 6));
    const bellGeo = this.scope.track(new THREE.SphereGeometry(0.14, 6, 5));
    const bloomPositions: [number, number, number][] = [
      [-66, 116, 0], [-70, 117, 1], [-67, 121, 2], [-72, 119, 0],
      [-64, 119, 1], [-69, 123, 2], [-71, 115, 0], [-65, 122, 1],
      [-68, 114, 2], [-73, 121, 0], [-63, 117, 1], [-70, 120, 2],
    ];

    for (const [fx, fz, type] of bloomPositions) {
      const stem = new THREE.Mesh(stemGeo, this.grassMat);
      stem.position.set(fx, center[1] + 0.38, fz);
      group.add(stem);

      if (type === 0) {
        // Coneflower (magenta petals + raised orange cone)
        const cone = new THREE.Mesh(coneGeo, this.flowerMagentaMat);
        cone.position.set(fx, center[1] + 0.82, fz);
        group.add(cone);
      } else if (type === 1) {
        // Nodding Bluebell
        const bell = new THREE.Mesh(bellGeo, this.flowerBlueMat);
        bell.position.set(fx, center[1] + 0.76, fz);
        group.add(bell);
      } else {
        // Golden Buttercup
        const buttercup = new THREE.Mesh(bellGeo, this.flowerYellowMat);
        buttercup.position.set(fx, center[1] + 0.72, fz);
        group.add(buttercup);
      }
    }

    // Dedicated meadow pollinator butterflies (instanced mesh, bounded within meadow)
    const butterflyCount = this.quality === 'low' ? 6 : this.quality === 'medium' ? 12 : 18;
    const wingGeo = this.scope.track(new THREE.PlaneGeometry(0.24, 0.2, 1, 1));
    const butterflyMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0xe6a832, roughness: 0.5, side: THREE.DoubleSide, emissive: 0x553311, emissiveIntensity: 0.18,
    }));
    const butterflies = new THREE.InstancedMesh(wingGeo, butterflyMat, butterflyCount);
    butterflies.name = 'pollinator-meadow-butterflies';
    this.meadowButterflies = butterflies;

    this.butterflyTransforms = [];
    for (let i = 0; i < butterflyCount; i++) {
      this.butterflyTransforms.push({
        x: center[0] + (Math.sin(i * 1.7) * 4.5),
        y: center[1] + 0.85 + (i % 3) * 0.35,
        z: center[2] + (Math.cos(i * 2.3) * 4.5),
        phase: i * 0.9,
        radius: 1.2 + (i % 4) * 0.7,
        speed: 0.85 + (i % 3) * 0.4,
      });
    }
    this.updateMeadowButterflies(0, false);
    group.add(butterflies);

    this.root.add(group);
  }

  private updateMeadowButterflies(_dt: number, reducedMotion: boolean): void {
    if (!this.meadowButterflies) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.butterflyTransforms.length; i++) {
      const b = this.butterflyTransforms[i];
      if (reducedMotion) {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0.2, b.phase, 0);
      } else {
        const t = this.animTime * b.speed + b.phase;
        const x = b.x + Math.sin(t) * b.radius;
        const z = b.z + Math.cos(t * 1.3) * b.radius;
        const y = b.y + Math.sin(t * 3.5) * 0.22;
        dummy.position.set(x, y, z);
        dummy.rotation.set(Math.sin(t * 8) * 0.35, -t, 0);
      }
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.meadowButterflies.setMatrixAt(i, dummy.matrix);
    }
    this.meadowButterflies.instanceMatrix.needsUpdate = true;
  }

  /* -------------------------------------------------------------------------- */
  /* 5. THE NEOLITHIC-INSPIRED STONE CIRCLE                                      */
  /* -------------------------------------------------------------------------- */
  private buildNeolithicStoneCircle(): void {
    const group = new THREE.Group();
    group.name = 'neolithic-stone-circle';
    const center: Vec3 = [-72, -0.48, -118];
    const radius = 9.2; // 18.4 m diameter

    // Center dolmen / recumbent altar stone
    const altarGeo = this.scope.track(new THREE.BoxGeometry(2.6, 0.75, 1.75));
    const altar = new THREE.Mesh(altarGeo, this.stoneMat);
    altar.position.set(center[0], center[1] + 0.38, center[2]);
    altar.rotation.set(0.04, 0.45, -0.02);
    altar.castShadow = true;
    altar.receiveShadow = true;
    group.add(altar);
    this.collision.addBox([center[0], center[1] + 0.38, center[2]], [1.35, 0.4, 0.9]);

    // 8 standing megaliths (menhirs) with carved reliefs and uplighting
    const stoneCount = 8;
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2;
      const sx = center[0] + Math.cos(angle) * radius;
      const sz = center[2] + Math.sin(angle) * radius;
      const height = 3.2 + (i % 3) * 0.55;
      const width = 1.35 + (i % 2) * 0.25;
      const depth = 0.85 + (i % 2) * 0.15;

      // Weathered orthostat megalith
      const menhirGeo = this.scope.track(new THREE.BoxGeometry(width, height, depth));
      const menhir = new THREE.Mesh(menhirGeo, this.stoneMat);
      menhir.position.set(sx, center[1] + height / 2, sz);
      menhir.rotation.set(0.03, -angle + Math.PI / 2, (i % 2 ? 0.04 : -0.04));
      menhir.castShadow = true;
      menhir.receiveShadow = true;
      group.add(menhir);
      this.collision.addBox([sx, center[1] + height / 2, sz], [width / 2 + 0.15, height / 2, depth / 2 + 0.15]);

      // Embedded spiral petroglyph on inward face
      const glyph = new THREE.Mesh(
        this.scope.track(new THREE.TorusGeometry(0.32, 0.025, 4, 16)),
        this.darkBasaltMat,
      );
      glyph.position.set(sx - Math.cos(angle) * 0.45, center[1] + height * 0.55, sz - Math.sin(angle) * 0.45);
      glyph.rotation.set(0, -angle + Math.PI / 2, 0);
      group.add(glyph);

      // Recessed ground uplight socket casting soft amber warmth upward
      const lightSocketGeo = this.scope.track(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 8));
      const lightSocket = new THREE.Mesh(lightSocketGeo, this.amberGlowMat);
      lightSocket.position.set(sx - Math.cos(angle) * 0.85, center[1] + 0.02, sz - Math.sin(angle) * 0.85);
      group.add(lightSocket);
    }

    // Interpretive bronze plinth marker near the southern approach
    const plinthStoneGeo = this.scope.track(new THREE.BoxGeometry(0.7, 0.85, 0.5));
    const plinthStone = new THREE.Mesh(plinthStoneGeo, this.stoneMat);
    plinthStone.position.set(center[0], center[1] + 0.42, center[2] + radius + 2.2);
    plinthStone.castShadow = true;
    group.add(plinthStone);
    this.collision.addBox([center[0], center[1] + 0.42, center[2] + radius + 2.2], [0.4, 0.45, 0.3]);

    const bronzePlateGeo = this.scope.track(new THREE.BoxGeometry(0.55, 0.03, 0.38));
    const bronzePlate = new THREE.Mesh(bronzePlateGeo, this.bronzeMat);
    bronzePlate.position.set(center[0], center[1] + 0.86, center[2] + radius + 2.2);
    bronzePlate.rotation.x = -Math.PI * 0.18;
    group.add(bronzePlate);

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 6. WILDLIFE OBSERVATION HIDE                                               */
  /* -------------------------------------------------------------------------- */
  private buildWildlifeObservationHide(): void {
    const group = new THREE.Group();
    group.name = 'wildlife-observation-hide';
    const center: Vec3 = [55, -0.48, -14];

    // Drystone foundation and low perimeter wall
    const wallThickness = 0.42;
    const hideWidth = 4.8;
    const hideDepth = 3.6;

    // Back wall (west side, facing away from lagoon)
    const backWallGeo = this.scope.track(new THREE.BoxGeometry(wallThickness, 2.3, hideDepth));
    const backWall = new THREE.Mesh(backWallGeo, this.stoneMat);
    backWall.position.set(center[0] - hideWidth / 2, center[1] + 1.15, center[2]);
    backWall.castShadow = true;
    group.add(backWall);
    this.collision.addBox([center[0] - hideWidth / 2, center[1] + 1.15, center[2]], [wallThickness / 2, 1.2, hideDepth / 2]);

    // Side walls (north and south) with low viewing sills
    for (const side of [-1, 1]) {
      const sideWallGeo = this.scope.track(new THREE.BoxGeometry(hideWidth, 1.1, wallThickness));
      const sideWall = new THREE.Mesh(sideWallGeo, this.stoneMat);
      sideWall.position.set(center[0], center[1] + 0.55, center[2] + side * hideDepth / 2);
      sideWall.castShadow = true;
      group.add(sideWall);
      this.collision.addBox([center[0], center[1] + 0.55, center[2] + side * hideDepth / 2], [hideWidth / 2, 0.6, wallThickness / 2]);
    }

    // Front wall (east side facing lagoon): Low 0.8m breastwork with wide 1.2m viewing letterbox
    const frontWallGeo = this.scope.track(new THREE.BoxGeometry(wallThickness, 0.85, hideDepth));
    const frontWall = new THREE.Mesh(frontWallGeo, this.stoneMat);
    frontWall.position.set(center[0] + hideWidth / 2, center[1] + 0.42, center[2]);
    frontWall.castShadow = true;
    group.add(frontWall);
    this.collision.addBox([center[0] + hideWidth / 2, center[1] + 0.42, center[2]], [wallThickness / 2, 0.45, hideDepth / 2]);

    // Slatted timber shake roof
    const roofGeo = this.scope.track(new THREE.BoxGeometry(hideWidth + 0.8, 0.16, hideDepth + 0.8));
    const roof = new THREE.Mesh(roofGeo, this.timberMat);
    roof.position.set(center[0], center[1] + 2.45, center[2]);
    roof.rotation.z = -0.06;
    roof.castShadow = true;
    group.add(roof);

    // Interior timber viewing bench
    const benchGeo = this.scope.track(new THREE.BoxGeometry(0.55, 0.1, hideDepth * 0.8));
    const bench = new THREE.Mesh(benchGeo, this.timberMat);
    bench.position.set(center[0] - hideWidth / 2 + 0.65, center[1] + 0.45, center[2]);
    group.add(bench);

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 7. SCULPTURAL WIND GROVE                                                   */
  /* -------------------------------------------------------------------------- */
  private buildSculpturalWindGrove(): void {
    const group = new THREE.Group();
    group.name = 'sculptural-wind-grove';
    const center: Vec3 = [48, -0.48, 108];

    // 4 slender kinetic wind sculptures on granite plinths
    const positions: [number, number, number, number][] = [
      [46, 106, 3.8, 0.0],
      [51, 107, 4.6, 1.4],
      [47, 111, 4.2, 2.7],
      [52, 110, 5.2, 4.1],
    ];

    for (let i = 0; i < positions.length; i++) {
      const [wx, wz, height, phase] = positions[i];

      // Base plinth
      const plinthGeo = this.scope.track(new THREE.CylinderGeometry(0.55, 0.65, 0.35, 12));
      const plinth = new THREE.Mesh(plinthGeo, this.stoneMat);
      plinth.position.set(wx, center[1] + 0.18, wz);
      plinth.castShadow = true;
      group.add(plinth);
      this.collision.addBox([wx, center[1] + 0.18, wz], [0.65, 0.2, 0.65]);

      // Slender dark bronze mast
      const mastGeo = this.scope.track(new THREE.CylinderGeometry(0.065, 0.095, height, 8));
      const mast = new THREE.Mesh(mastGeo, this.bronzeMat);
      mast.position.set(wx, center[1] + height / 2, wz);
      mast.castShadow = true;
      group.add(mast);

      // Kinetic head vane group (animated in update)
      const vaneGroup = new THREE.Group();
      vaneGroup.position.set(wx, center[1] + height, wz);
      vaneGroup.userData.phase = phase;
      vaneGroup.userData.speed = 0.75 + (i % 2) * 0.3;

      // Concentric aerodynamic loops
      const ring1 = new THREE.Mesh(
        this.scope.track(new THREE.TorusGeometry(0.65, 0.035, 6, 20)),
        this.verdigrisMat,
      );
      vaneGroup.add(ring1);

      const ring2 = new THREE.Mesh(
        this.scope.track(new THREE.TorusGeometry(0.42, 0.028, 6, 16)),
        this.bronzeMat,
      );
      ring2.rotation.x = Math.PI / 2;
      vaneGroup.add(ring2);

      // Aerodynamic teardrop fin
      const finGeo = this.scope.track(new THREE.ConeGeometry(0.22, 0.95, 4));
      const fin = new THREE.Mesh(finGeo, this.bronzeMat);
      fin.position.y = 0.55;
      vaneGroup.add(fin);

      group.add(vaneGroup);
      this.windGroveVanes.push(vaneGroup);
    }

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 8. ANCIENT-TREE LANDMARK                                                   */
  /* -------------------------------------------------------------------------- */
  private buildAncientTreeLandmark(): void {
    const group = new THREE.Group();
    group.name = 'ancient-tree-landmark';
    const center: Vec3 = [38, -0.48, -88];

    // Massive gnarled asymmetrical trunk
    const trunkHeight = 6.8;
    const trunkGeo = this.scope.track(new THREE.CylinderGeometry(1.4, 2.2, trunkHeight, 10));
    const trunk = new THREE.Mesh(trunkGeo, this.timberMat);
    trunk.position.set(center[0], center[1] + trunkHeight / 2, center[2]);
    trunk.rotation.set(0.06, 0.35, -0.08);
    trunk.castShadow = true;
    group.add(trunk);
    this.collision.addBox([center[0], center[1] + trunkHeight / 2, center[2]], [2.3, trunkHeight / 2, 2.3]);

    // 5 sprawling buttressed roots gripping the ground
    for (let r = 0; r < 5; r++) {
      const rAngle = (r / 5) * Math.PI * 2;
      const rootLength = 3.6 + (r % 2) * 0.8;
      const rootGeo = this.scope.track(new THREE.ConeGeometry(0.45, rootLength, 6));
      const root = new THREE.Mesh(rootGeo, this.timberMat);
      root.position.set(
        center[0] + Math.cos(rAngle) * (rootLength * 0.45),
        center[1] + 0.25,
        center[2] + Math.sin(rAngle) * (rootLength * 0.45),
      );
      root.rotation.set(Math.PI / 2 - 0.25, 0, -rAngle + Math.PI / 2);
      root.castShadow = true;
      group.add(root);
      this.collision.addBox(
        [center[0] + Math.cos(rAngle) * 2.2, center[1] + 0.25, center[2] + Math.sin(rAngle) * 2.2],
        [0.85, 0.35, 0.85],
      );
    }

    // 4 major twisted boughs reaching outward
    const boughAngles = [-0.6, 0.7, 2.1, 3.4];
    for (let b = 0; b < boughAngles.length; b++) {
      const angle = boughAngles[b];
      const boughGeo = this.scope.track(new THREE.CylinderGeometry(0.38, 0.75, 4.5, 7));
      const bough = new THREE.Mesh(boughGeo, this.timberMat);
      bough.position.set(
        center[0] + Math.cos(angle) * 2.4,
        center[1] + trunkHeight + 1.2,
        center[2] + Math.sin(angle) * 2.4,
      );
      bough.rotation.set(0.45, -angle, 0.65);
      bough.castShadow = true;
      group.add(bough);

      // Lush tiered canopy clumps on each bough
      const crownGeo = this.scope.track(new THREE.IcosahedronGeometry(2.8 + (b % 2) * 0.6, 1));
      const crown = new THREE.Mesh(crownGeo, this.mossStoneMat);
      crown.position.set(
        center[0] + Math.cos(angle) * 4.2,
        center[1] + trunkHeight + 3.1,
        center[2] + Math.sin(angle) * 4.2,
      );
      crown.scale.set(1.4, 0.85, 1.25);
      crown.castShadow = true;
      group.add(crown);
    }

    // Surrounding woodland wild flowers and moss ring
    const mossRingGeo = this.scope.track(new THREE.RingGeometry(3.5, 8.5, 18));
    const mossRing = new THREE.Mesh(mossRingGeo, this.mossStoneMat);
    mossRing.rotation.x = -Math.PI / 2;
    mossRing.position.set(center[0], center[1] + 0.015, center[2]);
    mossRing.receiveShadow = true;
    group.add(mossRing);

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 9. MOONLIT LANTERN PATH                                                    */
  /* -------------------------------------------------------------------------- */
  private buildMoonlitLanternPath(): void {
    const group = new THREE.Group();
    group.name = 'moonlit-lantern-path';

    // 6 shielded dark-bronze bollard lanterns along quiet north perimeter path
    const bollardPoints: [number, number][] = [
      [16, -68], [22, -61], [27, -54], [32, -47], [35, -40], [38, -34],
    ];

    const bollardGeo = this.scope.track(new THREE.BoxGeometry(0.18, 0.88, 0.18));
    const capGeo = this.scope.track(new THREE.BoxGeometry(0.26, 0.08, 0.26));
    const glowGeo = this.scope.track(new THREE.BoxGeometry(0.14, 0.12, 0.14));
    const lightPoolGeo = this.scope.track(new THREE.CircleGeometry(2.4, 16));

    for (let i = 0; i < bollardPoints.length; i++) {
      const [px, pz] = bollardPoints[i];
      // Offset bollard slightly onto path shoulder
      const bx = px + 2.4;
      const bz = pz - 1.1;

      // Dark bronze bollard body
      const bollard = new THREE.Mesh(bollardGeo, this.bronzeMat);
      bollard.position.set(bx, -0.48 + 0.44, bz);
      bollard.castShadow = true;
      group.add(bollard);
      this.collision.addBox([bx, -0.48 + 0.44, bz], [0.15, 0.45, 0.15]);

      // Downward shielding louver cap
      const cap = new THREE.Mesh(capGeo, this.bronzeMat);
      cap.position.set(bx, -0.48 + 0.89, bz);
      group.add(cap);

      // Low-glare amber glowing window
      const glow = new THREE.Mesh(glowGeo, this.amberGlowMat);
      glow.position.set(bx, -0.48 + 0.74, bz);
      group.add(glow);

      // Warm pool of light on the path surface
      const lightPool = new THREE.Mesh(lightPoolGeo, this.amberGlowMat);
      lightPool.rotation.x = -Math.PI / 2;
      lightPool.position.set(px, -0.46, pz);
      lightPool.material = this.scope.track(new THREE.MeshBasicMaterial({
        color: 0xffba70, transparent: true, opacity: 0.28, depthWrite: false,
      }));
      group.add(lightPool);
    }

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 10. COASTAL TIDEPOOL GARDEN                                                */
  /* -------------------------------------------------------------------------- */
  private buildCoastalTidepoolGarden(): void {
    const group = new THREE.Group();
    group.name = 'coastal-tidepool-garden';

    // Stepped natural basalt ledge basins
    const basins: [number, number, number, number][] = [
      [135, 34, 2.8, -0.65],
      [138, 37, 2.2, -0.76],
      [134, 39, 1.9, -0.88],
    ];

    for (let i = 0; i < basins.length; i++) {
      const [tx, tz, radius, waterY] = basins[i];

      // Basalt rock rim basin
      const basinGeo = this.scope.track(new THREE.CylinderGeometry(radius * 1.15, radius * 1.35, 0.45, 14));
      const rock = new THREE.Mesh(basinGeo, this.darkBasaltMat);
      rock.position.set(tx, waterY - 0.15, tz);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
      this.collision.addBox([tx, waterY, tz], [radius * 1.25, 0.35, radius * 1.25]);

      // Transparent calm tidal pool water
      const poolGeo = this.scope.track(new THREE.CircleGeometry(radius, 16));
      const pool = new THREE.Mesh(poolGeo, this.tidepoolWaterMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(tx, waterY + 0.05, tz);
      group.add(pool);

      // Embedded shell & sea anemone accents in the basin
      const shellGeo = this.scope.track(new THREE.TorusGeometry(0.16, 0.045, 5, 12));
      const shell = new THREE.Mesh(shellGeo, this.amberGlowMat);
      shell.position.set(tx + radius * 0.45, waterY + 0.06, tz - radius * 0.3);
      shell.rotation.x = -Math.PI / 2;
      group.add(shell);
    }

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 11. TERRACE OF ASTRONOMICAL / SEASONAL MARKERS                              */
  /* -------------------------------------------------------------------------- */
  private buildAstronomicalSeasonalTerrace(): void {
    const group = new THREE.Group();
    group.name = 'astronomical-seasonal-terrace';
    const center: Vec3 = [-34, -0.48, 134];
    const radius = 5.6;

    // Raised circular stone terrace paving
    const terraceGeo = this.scope.track(new THREE.CylinderGeometry(radius * 1.08, radius * 1.12, 0.18, 24));
    const terrace = new THREE.Mesh(terraceGeo, this.stoneMat);
    terrace.position.set(center[0], center[1] + 0.09, center[2]);
    terrace.receiveShadow = true;
    group.add(terrace);
    this.collision.addFloor(center[0] - radius, center[0] + radius, center[2] - radius, center[2] + radius, center[1] + 0.18);

    // Central brass celestial gnomon plinth
    const gnomonPlinthGeo = this.scope.track(new THREE.CylinderGeometry(0.85, 0.95, 0.65, 16));
    const gnomonPlinth = new THREE.Mesh(gnomonPlinthGeo, this.bronzeMat);
    gnomonPlinth.position.set(center[0], center[1] + 0.5, center[2]);
    gnomonPlinth.castShadow = true;
    group.add(gnomonPlinth);
    this.collision.addBox([center[0], center[1] + 0.5, center[2]], [1.0, 0.4, 1.0]);

    // Angled gnomon pointer
    const stylusGeo = this.scope.track(new THREE.ConeGeometry(0.08, 0.75, 4));
    const stylus = new THREE.Mesh(stylusGeo, this.bronzeMat);
    stylus.position.set(center[0], center[1] + 1.15, center[2]);
    stylus.rotation.set(-0.65, 0, 0);
    group.add(stylus);

    // 8 engraved brass/granite seasonal & astronomical markers along circumference
    const markerCount = 8;
    for (let i = 0; i < markerCount; i++) {
      const angle = (i / markerCount) * Math.PI * 2;
      const mx = center[0] + Math.cos(angle) * (radius * 0.78);
      const mz = center[2] + Math.sin(angle) * (radius * 0.78);

      const discGeo = this.scope.track(new THREE.CylinderGeometry(0.42, 0.42, 0.025, 14));
      const disc = new THREE.Mesh(discGeo, this.bronzeMat);
      disc.position.set(mx, center[1] + 0.19, mz);
      group.add(disc);

      // Engraved celestial compass radial lines
      const lineGeo = this.scope.track(new THREE.BoxGeometry(0.04, 0.015, radius * 0.45));
      const line = new THREE.Mesh(lineGeo, this.amberGlowMat);
      line.position.set(
        center[0] + Math.cos(angle) * (radius * 0.4),
        center[1] + 0.185,
        center[2] + Math.sin(angle) * (radius * 0.4),
      );
      line.rotation.y = -angle + Math.PI / 2;
      group.add(line);
    }

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* 12. MONUMENTAL REAR-GARDEN REVEAL                                          */
  /* -------------------------------------------------------------------------- */
  private buildMonumentalRearGardenReveal(): void {
    const group = new THREE.Group();
    group.name = 'rear-garden-monumental-reveal';
    const center: Vec3 = [0, -0.48, -120];

    // Formal terraced belvedere retaining walls
    const wallGeo = this.scope.track(new THREE.BoxGeometry(18.5, 0.95, 1.2));
    const wall = new THREE.Mesh(wallGeo, this.stoneMat);
    wall.position.set(center[0], center[1] + 0.48, center[2]);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    this.collision.addBox([center[0], center[1] + 0.48, center[2]], [9.5, 0.5, 0.7]);

    // Elevated belvedere viewing terrace
    const terraceFloorGeo = this.scope.track(new THREE.BoxGeometry(16.5, 0.15, 8.5));
    const terraceFloor = new THREE.Mesh(terraceFloorGeo, this.stoneMat);
    terraceFloor.position.set(center[0], center[1] + 0.95, center[2] - 4.5);
    terraceFloor.receiveShadow = true;
    group.add(terraceFloor);
    this.collision.addFloor(center[0] - 8.2, center[0] + 8.2, center[2] - 8.7, center[2] - 0.3, center[1] + 1.02);

    // Central grand staircase
    for (let step = 0; step < 5; step++) {
      const stepGeo = this.scope.track(new THREE.BoxGeometry(6.2, 0.19, 0.55));
      const stepMesh = new THREE.Mesh(stepGeo, this.stoneMat);
      stepMesh.position.set(center[0], center[1] + (step + 0.5) * 0.19, center[2] + 1.2 - step * 0.5);
      stepMesh.receiveShadow = true;
      group.add(stepMesh);
    }

    // Accessible flanking ramps on left and right
    for (const side of [-1, 1]) {
      const rampGeo = this.scope.track(new THREE.BoxGeometry(2.4, 0.12, 4.2));
      const ramp = new THREE.Mesh(rampGeo, this.stoneMat);
      ramp.position.set(side * 8.2, center[1] + 0.48, center[2] - 0.5);
      ramp.rotation.x = -0.18;
      group.add(ramp);
      this.collision.addFloor(side * 8.2 - 1.2, side * 8.2 + 1.2, center[2] - 2.6, center[2] + 1.6, center[1] + 0.48);
    }

    // Monumental Raptor Sculpture ("Wings of Dawn") on basalt plinth
    const plinthGeo = this.scope.track(new THREE.CylinderGeometry(1.65, 1.95, 1.25, 8));
    const plinth = new THREE.Mesh(plinthGeo, this.darkBasaltMat);
    plinth.position.set(center[0], center[1] + 1.65, center[2] - 4.5);
    plinth.castShadow = true;
    group.add(plinth);
    this.collision.addBox([center[0], center[1] + 1.65, center[2] - 4.5], [1.8, 0.7, 1.8]);

    // Heraldic soaring bronze osprey/raptor sculpture
    const sculptureGroup = new THREE.Group();
    sculptureGroup.position.set(center[0], center[1] + 2.3, center[2] - 4.5);

    // Stylized raptor torso & head
    const bodyGeo = this.scope.track(new THREE.ConeGeometry(0.65, 2.2, 6));
    const body = new THREE.Mesh(bodyGeo, this.verdigrisMat);
    body.rotation.x = 0.35;
    body.castShadow = true;
    sculptureGroup.add(body);

    const headGeo = this.scope.track(new THREE.ConeGeometry(0.35, 0.75, 5));
    const head = new THREE.Mesh(headGeo, this.bronzeMat);
    head.position.set(0, 1.15, 0.45);
    head.rotation.x = -0.85;
    head.castShadow = true;
    sculptureGroup.add(head);

    // Swept-back expansive wings
    for (const wingSide of [-1, 1]) {
      const wingGeo = this.scope.track(new THREE.BoxGeometry(2.4, 0.12, 1.1));
      const wing = new THREE.Mesh(wingGeo, this.verdigrisMat);
      wing.position.set(wingSide * 1.55, 0.65, -0.35);
      wing.rotation.set(0.2, wingSide * 0.45, wingSide * 0.55);
      wing.castShadow = true;
      sculptureGroup.add(wing);
    }
    group.add(sculptureGroup);

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* COMPLEMENTARY REQUIRED ARTWORKS & FURNISHINGS                              */
  /* -------------------------------------------------------------------------- */
  private buildAnimalStatuary(): void {
    const group = new THREE.Group();
    group.name = 'animal-statuary-group';

    // 1. Bronze Hare at pollinator meadow (X=-62, Z=115)
    const harePlinthGeo = this.scope.track(new THREE.BoxGeometry(0.75, 0.55, 0.75));
    const harePlinth = new THREE.Mesh(harePlinthGeo, this.stoneMat);
    harePlinth.position.set(-62, -0.48 + 0.28, 115);
    group.add(harePlinth);
    this.collision.addBox([-62, -0.48 + 0.28, 115], [0.45, 0.3, 0.45]);

    const hareGeo = this.scope.track(new THREE.ConeGeometry(0.25, 0.75, 5));
    const hare = new THREE.Mesh(hareGeo, this.bronzeMat);
    hare.name = 'animal-statuary-hare';
    hare.position.set(-62, -0.48 + 0.55 + 0.38, 115);
    hare.castShadow = true;
    group.add(hare);

    // 2. Bronze River Otter on rock at lagoon bank (X=56, Z=-8)
    const otterPlinthGeo = this.scope.track(new THREE.DodecahedronGeometry(0.65, 1));
    const otterPlinth = new THREE.Mesh(otterPlinthGeo, this.stoneMat);
    otterPlinth.position.set(56, -0.48 + 0.35, -8);
    group.add(otterPlinth);
    this.collision.addBox([56, -0.48 + 0.35, -8], [0.55, 0.4, 0.55]);

    const otterGeo = this.scope.track(new THREE.CylinderGeometry(0.18, 0.24, 0.95, 6));
    const otter = new THREE.Mesh(otterGeo, this.bronzeMat);
    otter.name = 'animal-statuary-otter';
    otter.position.set(56, -0.48 + 0.85, -8);
    otter.rotation.set(0.45, 0.3, -0.45);
    otter.castShadow = true;
    group.add(otter);

    // 3. Bronze Great Horned Owl in west woodland (X=-132, Z=-8)
    const owlPlinthGeo = this.scope.track(new THREE.CylinderGeometry(0.35, 0.45, 1.4, 8));
    const owlPlinth = new THREE.Mesh(owlPlinthGeo, this.stoneMat);
    owlPlinth.position.set(-132, -0.48 + 0.7, -8);
    group.add(owlPlinth);
    this.collision.addBox([-132, -0.48 + 0.7, -8], [0.45, 0.75, 0.45]);

    const owlGeo = this.scope.track(new THREE.ConeGeometry(0.3, 0.8, 6));
    const owl = new THREE.Mesh(owlGeo, this.bronzeMat);
    owl.name = 'animal-statuary-owl';
    owl.position.set(-132, -0.48 + 1.4 + 0.4, -8);
    owl.castShadow = true;
    group.add(owl);

    this.root.add(group);
  }

  private buildNeolithicSculptures(): void {
    const group = new THREE.Group();
    group.name = 'neolithic-sculpture-group';

    // 1. Carved standing stele with spiral cupules near Path 1 (X=32, Z=132)
    const steleGeo = this.scope.track(new THREE.BoxGeometry(0.85, 2.7, 0.55));
    const stele = new THREE.Mesh(steleGeo, this.stoneMat);
    stele.name = 'neolithic-sculpture-stele';
    stele.position.set(32, -0.48 + 1.35, 132);
    stele.rotation.y = 0.35;
    stele.castShadow = true;
    group.add(stele);
    this.collision.addBox([32, -0.48 + 1.35, 132], [0.55, 1.4, 0.4]);

    // 2. Sculpted dolmen portal marker near Path 3 (X=-35, Z=-82)
    const dolmenGroup = new THREE.Group();
    dolmenGroup.name = 'neolithic-sculpture-dolmen';
    dolmenGroup.position.set(-35, -0.48, -82);

    for (const postSide of [-1, 1]) {
      const postGeo = this.scope.track(new THREE.BoxGeometry(0.65, 2.2, 0.65));
      const post = new THREE.Mesh(postGeo, this.stoneMat);
      post.position.set(postSide * 1.15, 1.1, 0);
      post.castShadow = true;
      dolmenGroup.add(post);
      this.collision.addBox([-35 + postSide * 1.15, -0.48 + 1.1, -82], [0.45, 1.15, 0.45]);
    }
    const lintelGeo = this.scope.track(new THREE.BoxGeometry(3.3, 0.55, 1.1));
    const lintel = new THREE.Mesh(lintelGeo, this.stoneMat);
    lintel.position.set(0, 2.45, 0);
    lintel.castShadow = true;
    dolmenGroup.add(lintel);

    group.add(dolmenGroup);
    this.root.add(group);
  }

  private buildOutdoorFurnishings(): void {
    const group = new THREE.Group();
    group.name = 'outdoor-furnishings-group';

    // Crafted outdoor teak/bronze benches and small bistro tables at scenic nodes
    const nodes: [number, number, number][] = [
      [16, 138, -Math.PI * 0.45], // Forecourt east
      [52, -18, Math.PI * 0.35],  // Lagoon hide overlook
      [-124, 15, -Math.PI * 0.25], // West woodland glade
      [-8, -114, Math.PI],        // Rear garden west
      [8, -114, Math.PI],         // Rear garden east
    ];

    const benchSeatGeo = this.scope.track(new THREE.BoxGeometry(1.8, 0.08, 0.5));
    const benchLegGeo = this.scope.track(new THREE.BoxGeometry(0.1, 0.45, 0.45));
    const tableTopGeo = this.scope.track(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 12));
    const tablePostGeo = this.scope.track(new THREE.CylinderGeometry(0.05, 0.07, 0.68, 8));

    for (const [nx, nz, rot] of nodes) {
      const benchGroup = new THREE.Group();
      benchGroup.position.set(nx, -0.48, nz);
      benchGroup.rotation.y = rot;

      const seat = new THREE.Mesh(benchSeatGeo, this.timberMat);
      seat.position.set(0, 0.46, 0);
      seat.castShadow = true;
      benchGroup.add(seat);

      for (const lx of [-0.75, 0.75]) {
        const leg = new THREE.Mesh(benchLegGeo, this.bronzeMat);
        leg.position.set(lx, 0.23, 0);
        benchGroup.add(leg);
      }
      group.add(benchGroup);
      this.collision.addBox([nx, -0.48 + 0.45, nz], [0.95, 0.5, 0.45]);

      // Small round café bistro table paired with bench
      const tableGroup = new THREE.Group();
      const tx = nx + Math.cos(rot + Math.PI / 2) * 1.35;
      const tz = nz + Math.sin(rot + Math.PI / 2) * 1.35;
      tableGroup.position.set(tx, -0.48, tz);

      const tableTop = new THREE.Mesh(tableTopGeo, this.bronzeMat);
      tableTop.position.set(0, 0.7, 0);
      tableGroup.add(tableTop);

      const tablePost = new THREE.Mesh(tablePostGeo, this.stoneMat);
      tablePost.position.set(0, 0.35, 0);
      tableGroup.add(tablePost);

      group.add(tableGroup);
      this.collision.addBox([tx, -0.48 + 0.35, tz], [0.5, 0.4, 0.5]);
    }

    this.root.add(group);
  }

  /* -------------------------------------------------------------------------- */
  /* LIFECYCLE & UPDATE                                                         */
  /* -------------------------------------------------------------------------- */
  update(dt: number, reducedMotion: boolean): void {
    if (!reducedMotion) {
      this.animTime += Math.min(dt, 0.1);
    }

    // 1. Procedural kinetic breeze on sculptural wind grove
    for (const vane of this.windGroveVanes) {
      if (reducedMotion) {
        vane.rotation.y = vane.userData.phase;
        vane.rotation.z = 0;
      } else {
        const p = vane.userData.phase as number;
        const s = vane.userData.speed as number;
        vane.rotation.y = this.animTime * s + p;
        vane.rotation.z = Math.sin(this.animTime * 0.85 + p) * 0.14;
      }
    }

    // 2. Reflecting rill subtle normal ripple simulation
    if (this.rillWaterMesh && !reducedMotion) {
      this.rillWaterMesh.position.y = GROUND_Y + 0.015 + Math.sin(this.animTime * 2.2) * 0.003;
    }

    // 3. Meadow pollinator butterflies
    this.updateMeadowButterflies(dt, reducedMotion);
  }

  setQuality(tier: QualityTier): void {
    if (tier === this.quality) return;
    this.quality = tier;

    // Adjust water transparency and depth writes based on tier
    const transparent = tier !== 'low';
    this.rillWaterMat.transparent = transparent;
    this.rillWaterMat.depthWrite = !transparent;
    this.rillWaterMat.needsUpdate = true;

    this.tidepoolWaterMat.transparent = transparent;
    this.tidepoolWaterMat.depthWrite = !transparent;
    this.tidepoolWaterMat.needsUpdate = true;
  }
}

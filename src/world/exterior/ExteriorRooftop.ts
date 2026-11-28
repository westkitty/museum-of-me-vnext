import * as THREE from 'three';
import { applyLandscape } from '../../render/LandscapeShading';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { CollisionWorld } from '../CollisionWorld';
import type { ExhibitControl } from '../../exhibits/contract';
import { INTERACTION_ONLY_LAYER } from '../../interaction/InteractionManager';
import { canRenderText, createFallbackTexture, createTextTexture } from '../../assets/TextTexture';
import type { Vec3 } from '../layout';
import { HotDogMan } from './HotDogMan';
import {
  CENTRAL_SPINE_TOP_Y,
  GREENHOUSE_COLLAR_HEIGHT,
  GREENHOUSE_COLLAR_RADIUS,
  GREENHOUSE_FLOWER_CENTER,
  GREENHOUSE_FLOWER_ID,
  HOT_DOG_STAND_CENTER,
  HOT_DOG_STAND_ID,
  HOT_DOG_STAND_OPERATOR_SPOT,
  HOT_DOG_STAND_VISITOR_SPOT,
  HOT_DOG_STAND_SIZE,
  ROOF_ACCESSIBLE_BAYS,
  ROOF_CAFE_DECK,
  ROOF_CAFE_TABLES,
  ROOF_CAFE_TABLE_COLLIDER_HALF,
  ROOF_DECK_UNDERSIDE_Y,
  ROOF_DECK_Y,
  ROOF_FLIGHT_PAD_II_CENTER,
  ROOF_FLIGHT_PAD_II_DECK,
  ROOF_FLIGHT_PAD_II_RADIUS,
  ROOF_FLIGHT_PAD_II_TELEPORT_CENTER,
  ROOF_FLIGHT_PAD_II_TELEPORT_ID,
  ROOF_GREENHOUSE_DECK,
  ROOF_GREENHOUSE_DOOR,
  ROOF_GREENHOUSE_SHELL,
  ROOF_GROUND_Y,
  ROOF_MID_LANDING_Y,
  ROOF_PROMENADE_DECK,
  ROOF_RAIL_COLLIDER_HEIGHT,
  ROOF_RAIL_HEIGHT,
  ROOF_RAIL_THICKNESS,
  ROOF_SLAB_THICKNESS,
  WEST_LOWER_RAMP,
  WEST_MID_LANDING,
  WEST_UPPER_BRIDGE_LANDING,
  WEST_UPPER_RAMP,
  WEST_UPPER_WALKWAY_LINK,
  westBarrelPeakAtX,
  westFlankSurfaceYAtZ,
  type DeckRect,
  type RampRect,
} from './rooftopLayout';

interface RooftopMaterials {
  readonly deckStone: THREE.MeshStandardMaterial;
  readonly pavingTrim: THREE.MeshStandardMaterial;
  readonly bronze: THREE.MeshStandardMaterial;
  readonly brass: THREE.MeshStandardMaterial;
  readonly wood: THREE.MeshStandardMaterial;
  readonly conservatoryGlass: THREE.MeshStandardMaterial;
  readonly railGlass: THREE.MeshStandardMaterial;
  readonly terracotta: THREE.MeshStandardMaterial;
  readonly soil: THREE.MeshStandardMaterial;
  readonly fern: THREE.MeshStandardMaterial;
  readonly awningRed: THREE.MeshStandardMaterial;
  readonly awningCream: THREE.MeshStandardMaterial;
  readonly flowerStem: THREE.MeshStandardMaterial;
  readonly flowerOuterPetal: THREE.MeshStandardMaterial;
  readonly flowerInnerPetal: THREE.MeshStandardMaterial;
  readonly amberGlow: THREE.MeshBasicMaterial;
  readonly cyanGlow: THREE.MeshBasicMaterial;
  readonly goldGlow: THREE.MeshBasicMaterial;
  readonly proxyInvisible: THREE.MeshBasicMaterial;
}

interface FloatingMoteSpec {
  readonly phase: number;
  readonly radius: number;
  readonly heightOffset: number;
  readonly speed: number;
}

const POLLEN_MOTE_COUNT = 22;
const PAD_MOTE_COUNT = 20;
const VISIBILITY_SQ = 120 * 120;

/**
 * Museum Rooftop Complex and Safe Exterior West Flank Ascent (ISLAND-03).
 *
 * Built strictly from core modules (`three`, `ResourceScope`, `CollisionWorld`,
 * `TextTexture`, `InteractionManager`) so cold exterior boot never pulls in
 * interior or exhibit chunks. Zero `THREE.Light` objects are created.
 */
export class ExteriorRooftop {
  readonly group = new THREE.Group();
  private readonly mats: RooftopMaterials;
  private readonly postTransforms: THREE.Matrix4[] = [];
  private readonly pierTransforms: THREE.Matrix4[] = [];
  private readonly beaconTransforms: THREE.Matrix4[] = [];

  private readonly flowerInteractionTarget = new THREE.Group();
  private readonly hotDogInteractionTarget = new THREE.Group();
  private readonly padControlInteractionTarget = new THREE.Group();
  private readonly flowerBlossomGroup = new THREE.Group();
  private readonly padGlyphRing = new THREE.Group();

  private pollenMotes!: THREE.InstancedMesh;
  private readonly pollenSpecs: FloatingMoteSpec[] = [];
  private padMotes!: THREE.InstancedMesh;
  private readonly padSpecs: FloatingMoteSpec[] = [];

  private readonly scratchObj = new THREE.Object3D();
  private elapsed = 0;
  private lastUpdatedElapsed = -1;

  /** ISLAND-04: the owner-approved operator of the hot dog stand (lazy-loaded). */
  readonly hotDogMan: HotDogMan;
  private flowerInspected = false;
  private padControlInspected = false;

  constructor(private readonly scope: ResourceScope, private readonly collision: CollisionWorld) {
    this.hotDogMan = new HotDogMan(scope, HOT_DOG_STAND_OPERATOR_SPOT, HOT_DOG_STAND_VISITOR_SPOT);
    this.group.name = 'exterior-rooftop';
    this.group.userData.visualRole = 'rooftop-architecture-expansion';
    this.mats = this.createMaterials();
    this.build();
    this.group.add(this.hotDogMan.group);
    this.update(0, [ROOF_CAFE_DECK.minX, ROOF_DECK_Y, ROOF_PROMENADE_DECK.minZ], true);
  }

  private createMaterials(): RooftopMaterials {
    const s = this.scope;
    return {
      deckStone: applyLandscape(s.track(new THREE.MeshStandardMaterial({ color: 0x262e39, roughness: 0.86, metalness: 0.08 })), 'paving'),
      pavingTrim: applyLandscape(s.track(new THREE.MeshStandardMaterial({ color: 0x736c5e, roughness: 0.82, metalness: 0.06 })), 'paving'),
      bronze: s.track(new THREE.MeshStandardMaterial({ color: 0x3a2d22, roughness: 0.44, metalness: 0.72 })),
      brass: s.track(new THREE.MeshStandardMaterial({ color: 0xc9a24f, roughness: 0.32, metalness: 0.85 })),
      wood: applyLandscape(s.track(new THREE.MeshStandardMaterial({ color: 0x6b472f, roughness: 0.72, metalness: 0.04 })), 'bark'),
      conservatoryGlass: s.track(new THREE.MeshStandardMaterial({
        color: 0xaadce6,
        emissive: 0x0c242b,
        emissiveIntensity: 0.18,
        roughness: 0.14,
        metalness: 0.1,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        side: THREE.DoubleSide,
      })),
      railGlass: s.track(new THREE.MeshStandardMaterial({
        color: 0x90c4d4,
        roughness: 0.18,
        metalness: 0.1,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      })),
      terracotta: applyLandscape(s.track(new THREE.MeshStandardMaterial({ color: 0x7a422d, roughness: 0.88, metalness: 0.02 })), 'paving'),
      soil: applyLandscape(s.track(new THREE.MeshStandardMaterial({ color: 0x251c16, roughness: 0.96, metalness: 0 })), 'gravel'),
      fern: applyLandscape(s.track(new THREE.MeshStandardMaterial({ color: 0x2e6b44, roughness: 0.85, metalness: 0.02 })), 'foliage'),
      awningRed: s.track(new THREE.MeshStandardMaterial({ color: 0x9e2b25, roughness: 0.74, metalness: 0.04 })),
      awningCream: s.track(new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.76, metalness: 0.02 })),
      flowerStem: s.track(new THREE.MeshStandardMaterial({
        color: 0x1e6b54, emissive: 0x09291e, emissiveIntensity: 0.35, roughness: 0.55,
      })),
      flowerOuterPetal: s.track(new THREE.MeshStandardMaterial({
        color: 0x5fe2f5,
        emissive: 0x1e8fb0,
        emissiveIntensity: 0.9,
        roughness: 0.28,
        metalness: 0.08,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
      })),
      flowerInnerPetal: s.track(new THREE.MeshStandardMaterial({
        color: 0xd996ff,
        emissive: 0x8a3ed6,
        emissiveIntensity: 0.85,
        roughness: 0.26,
        metalness: 0.1,
        side: THREE.DoubleSide,
      })),
      amberGlow: s.track(new THREE.MeshBasicMaterial({ color: 0xffc67d, toneMapped: false })),
      cyanGlow: s.track(new THREE.MeshBasicMaterial({ color: 0x4ee2f5, toneMapped: false })),
      goldGlow: s.track(new THREE.MeshBasicMaterial({ color: 0xf4c76b, toneMapped: false })),
      proxyInvisible: s.track(new THREE.MeshBasicMaterial()),
    };
  }

  private build(): void {
    this.buildDecksAndRamps();
    this.buildSupportPiers();
    this.buildGuardrails();
    this.buildGreenhouse();
    this.buildCafe();
    this.buildFlightPadII();
    this.flushInstancedBatches();
  }

  private box(
    parent: THREE.Object3D,
    name: string,
    size: Vec3,
    pos: Vec3,
    mat: THREE.Material,
    castShadow = true,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(...size)), mat);
    mesh.name = name;
    mesh.position.set(...pos);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private addDeck(name: string, rect: DeckRect): void {
    const w = rect.maxX - rect.minX;
    const d = rect.maxZ - rect.minZ;
    const cx = (rect.minX + rect.maxX) / 2;
    const cz = (rect.minZ + rect.maxZ) / 2;
    this.box(
      this.group,
      name,
      [w, ROOF_SLAB_THICKNESS, d],
      [cx, rect.y - ROOF_SLAB_THICKNESS / 2, cz],
      this.mats.deckStone,
    );
    this.collision.addFloor(rect.minX, rect.maxX, rect.minZ, rect.maxZ, rect.y);
  }

  private addSlopedRamp(name: string, ramp: RampRect): void {
    const { minX, maxX, minZ, maxZ, yAtMin, yAtMax } = ramp;
    const t = ROOF_SLAB_THICKNESS;
    // Vertical-sheared prism matches exact top plane y(z) and bottom y(z) - t with zero seam gaps.
    const positions = new Float32Array([
      // 0..3 top face
      minX, yAtMin, minZ,
      maxX, yAtMin, minZ,
      maxX, yAtMax, maxZ,
      minX, yAtMax, maxZ,
      // 4..7 bottom face
      minX, yAtMin - t, minZ,
      maxX, yAtMin - t, minZ,
      maxX, yAtMax - t, maxZ,
      minX, yAtMax - t, maxZ,
    ]);
    const indices = [
      // top
      0, 3, 2, 0, 2, 1,
      // bottom
      4, 5, 6, 4, 6, 7,
      // west (-X)
      0, 4, 7, 0, 7, 3,
      // east (+X)
      1, 2, 6, 1, 6, 5,
      // north (minZ)
      0, 1, 5, 0, 5, 4,
      // south (maxZ)
      3, 7, 6, 3, 6, 2,
    ];
    const geo = this.scope.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mats.deckStone);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    this.collision.add({
      kind: 'ramp',
      minX,
      maxX,
      minZ,
      maxZ,
      axis: 'z',
      yAtMin,
      yAtMax,
    });

    // Instanced subtle transverse stone cleats along the ramp for tactile visual rhythm.
    const len = maxZ - minZ;
    const count = Math.max(2, Math.floor(len / 2.0));
    const cleatGeo = this.scope.track(new THREE.BoxGeometry(maxX - minX - 0.35, 0.018, 0.14));
    const cleats = this.scope.track(new THREE.InstancedMesh(cleatGeo, this.mats.pavingTrim, count));
    cleats.name = `${name}-cleats`;
    const slope = Math.atan2(yAtMin - yAtMax, len);
    const dummy = this.scratchObj;
    const cx = (minX + maxX) / 2;
    for (let i = 0; i < count; i++) {
      const f = (i + 0.5) / count;
      const z = minZ + len * f;
      const y = yAtMin + (yAtMax - yAtMin) * f;
      dummy.position.set(cx, y + 0.008, z);
      dummy.rotation.set(slope, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cleats.setMatrixAt(i, dummy.matrix);
    }
    cleats.instanceMatrix.needsUpdate = true;
    cleats.computeBoundingSphere();
    this.group.add(cleats);
  }

  private buildDecksAndRamps(): void {
    this.addDeck('rooftop-cafe-deck', ROOF_CAFE_DECK);
    this.addDeck('rooftop-west-promenade', ROOF_PROMENADE_DECK);
    this.addDeck('rooftop-greenhouse-deck', ROOF_GREENHOUSE_DECK);
    this.addDeck('rooftop-flight-pad-ii-deck', ROOF_FLIGHT_PAD_II_DECK);
    this.addDeck('rooftop-west-mid-landing', WEST_MID_LANDING);
    this.addDeck('rooftop-west-upper-bridge', WEST_UPPER_BRIDGE_LANDING);
    this.addDeck('rooftop-west-upper-walkway-link', WEST_UPPER_WALKWAY_LINK);

    this.addSlopedRamp('rooftop-west-lower-ramp', WEST_LOWER_RAMP);
    this.addSlopedRamp('rooftop-west-upper-ramp', WEST_UPPER_RAMP);

    // Ground-level Path 5 connecting threshold apron at [-42.0, -0.5, 114.0]
    this.box(
      this.group,
      'rooftop-west-ramp-entry-apron',
      [4.2, 0.08, 3.6],
      [-41.5, ROOF_GROUND_Y + 0.02, 113.6],
      this.mats.pavingTrim,
      false,
    );
    // Low stone base wedge anchoring the bottom of the Lower West Ramp cleanly into the island soil.
    const wedgeGeo = this.scope.track(new THREE.BufferGeometry());
    const wMinX = WEST_LOWER_RAMP.minX;
    const wMaxX = WEST_LOWER_RAMP.maxX;
    const wMinZ = 96.0;
    const wMaxZ = WEST_LOWER_RAMP.maxZ;
    const yHigh = westFlankSurfaceYAtZ(wMinZ)! - ROOF_SLAB_THICKNESS;
    const yBase = ROOF_GROUND_Y - 0.1;
    const wPos = new Float32Array([
      wMinX, yHigh, wMinZ,
      wMaxX, yHigh, wMinZ,
      wMaxX, ROOF_GROUND_Y, wMaxZ,
      wMinX, ROOF_GROUND_Y, wMaxZ,
      wMinX, yBase, wMinZ,
      wMaxX, yBase, wMinZ,
      wMaxX, yBase, wMaxZ,
      wMinX, yBase, wMaxZ,
    ]);
    const wIdx = [
      0, 3, 2, 0, 2, 1,
      4, 5, 6, 4, 6, 7,
      0, 4, 7, 0, 7, 3,
      1, 2, 6, 1, 6, 5,
      0, 1, 5, 0, 5, 4,
      3, 7, 6, 3, 6, 2,
    ];
    wedgeGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    wedgeGeo.setIndex(wIdx);
    wedgeGeo.computeVertexNormals();
    const wedge = new THREE.Mesh(wedgeGeo, this.mats.pavingTrim);
    wedge.name = 'rooftop-west-ramp-abutment';
    wedge.receiveShadow = true;
    this.group.add(wedge);

    // Solid recessed abutment collider under Z in [96, 106] keeps >= 1.9 m clear of Path 5 ribbon
    // and sits strictly beneath the ramp underside (+0.22 m at Z=106) so it never protrudes onto the deck.
    const abutmentMaxY = westFlankSurfaceYAtZ(106)! - ROOF_SLAB_THICKNESS - 0.02;
    this.collision.addBox(
      [-40.75, (ROOF_GROUND_Y - 0.05 + abutmentMaxY) / 2, 101.0],
      [1.25, (abutmentMaxY - (ROOF_GROUND_Y - 0.05)) / 2, 5.0],
    );

    // Decorative deck paving inlays on the Cafe Terrace and Promenade
    this.box(
      this.group,
      'rooftop-cafe-timber-inlay',
      [20.0, 0.02, 20.0],
      [-0.5, ROOF_DECK_Y + 0.005, 30.5],
      this.mats.wood,
      false,
    );
    this.box(
      this.group,
      'rooftop-promenade-runner',
      [23.5, 0.018, 3.6],
      [-25.75, ROOF_DECK_Y + 0.005, 28.0],
      this.mats.pavingTrim,
      false,
    );
  }

  private pushPier(x: number, yBottom: number, yTop: number, z: number, addGroundCollider: boolean): void {
    const h = yTop - yBottom;
    if (h <= 0.15) return;
    const dummy = this.scratchObj;
    dummy.position.set(x, (yBottom + yTop) / 2, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.56, h, 0.56);
    dummy.updateMatrix();
    this.pierTransforms.push(dummy.matrix.clone());

    if (addGroundCollider) {
      this.collision.addBox([x, (yBottom + yTop) / 2, z], [0.3, h / 2, 0.3]);
    }
  }

  private buildSupportPiers(): void {
    // 1. Cafe Terrace columns seated cleanly on Central Spine top (Y = 11.5)
    for (const x of [-11.5, -4.0, 4.0, 11.5]) {
      for (const z of [18.5, 27.0, 35.5, 43.5]) {
        this.pushPier(x, CENTRAL_SPINE_TOP_Y, ROOF_DECK_UNDERSIDE_Y, z, false);
      }
    }

    // 2. Flight Pad II columns seated on Central Spine top (Y = 11.5)
    for (const x of [-6.8, 6.8]) {
      for (const z of [50.0, 56.0, 62.0]) {
        this.pushPier(x, CENTRAL_SPINE_TOP_Y, ROOF_DECK_UNDERSIDE_Y, z, false);
      }
    }

    // 3. West Connecting Promenade columns seated on West Barrel roof shoulders
    for (const x of [-36.8, -31.0, -25.5, -20.0, -14.6]) {
      const baseY = (westBarrelPeakAtX(x) ?? CENTRAL_SPINE_TOP_Y) - 0.45;
      for (const z of [24.8, 31.2]) {
        this.pushPier(x, baseY, ROOF_DECK_UNDERSIDE_Y, z, false);
      }
    }

    // 4. Glass Greenhouse columns seated on West Barrel roof shoulders
    for (const x of [-36.8, -31.0, -25.5, -20.0, -17.1]) {
      const baseY = (westBarrelPeakAtX(x) ?? CENTRAL_SPINE_TOP_Y) - 0.45;
      for (const z of [-3.2, 4.0, 11.5, 19.0]) {
        this.pushPier(x, baseY, ROOF_DECK_UNDERSIDE_Y, z, false);
      }
    }

    // 5. Upper Bridge Landing inner barrel pier + outer ground piers
    const innerBridgeBase = (westBarrelPeakAtX(-35.8) ?? CENTRAL_SPINE_TOP_Y) - 0.45;
    for (const z of [-9.2, -4.8]) {
      this.pushPier(-35.8, innerBridgeBase, ROOF_DECK_UNDERSIDE_Y, z, false);
      this.pushPier(-42.55, ROOF_GROUND_Y, ROOF_DECK_UNDERSIDE_Y, z, true);
      this.pushPier(-39.95, ROOF_GROUND_Y, ROOF_DECK_UNDERSIDE_Y, z, true);
    }

    // 6. West Flank Ramp & Mid Overlook ground columns (collision-backed)
    for (const z of [8.0, 21.0, 34.0, 47.0, 55.0, 68.0, 80.0, 92.0]) {
      const yTop = (westFlankSurfaceYAtZ(z) ?? ROOF_MID_LANDING_Y) - ROOF_SLAB_THICKNESS;
      this.pushPier(-42.55, ROOF_GROUND_Y, yTop, z, true);
      this.pushPier(-39.95, ROOF_GROUND_Y, yTop, z, true);
    }
  }

  private pushGuardPost(x: number, yBase: number, z: number, beacon = false): void {
    const dummy = this.scratchObj;
    dummy.position.set(x, yBase + ROOF_RAIL_HEIGHT / 2, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    this.postTransforms.push(dummy.matrix.clone());

    if (beacon) {
      dummy.position.set(x, yBase + ROOF_RAIL_HEIGHT + 0.06, z);
      dummy.updateMatrix();
      this.beaconTransforms.push(dummy.matrix.clone());
    }
  }

  private addHorizontalRail(x0: number, z0: number, x1: number, z1: number, y: number): void {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) return;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const sx = alongX ? length : ROOF_RAIL_THICKNESS;
    const sz = alongX ? ROOF_RAIL_THICKNESS : length;

    // Top bronze handrail, mid bar, and clear balustrade glass panel
    this.box(this.group, 'rooftop-rail-top', [sx, 0.08, sz], [cx, y + ROOF_RAIL_HEIGHT - 0.04, cz], this.mats.bronze);
    this.box(this.group, 'rooftop-rail-mid', [sx * (alongX ? 1 : 0.45), 0.04, sz * (alongX ? 0.45 : 1)], [cx, y + 0.54, cz], this.mats.bronze, false);
    this.box(
      this.group,
      'rooftop-rail-glass',
      [alongX ? Math.max(0.05, length - 0.08) : 0.03, ROOF_RAIL_HEIGHT - 0.22, alongX ? 0.03 : Math.max(0.05, length - 0.08)],
      [cx, y + 0.56, cz],
      this.mats.railGlass,
      false,
    );

    const posts = Math.max(2, Math.ceil(length / 4.0) + 1);
    for (let i = 0; i < posts; i++) {
      const f = i / (posts - 1);
      this.pushGuardPost(x0 + dx * f, y, z0 + dz * f, i % 2 === 0);
    }

    // Solid collider extending down to deck underside (minY = y - 0.35) so ceilingHeight never traps walkers.
    this.collision.addBox(
      [cx, y + (ROOF_RAIL_COLLIDER_HEIGHT - ROOF_SLAB_THICKNESS) / 2, cz],
      [sx / 2, (ROOF_RAIL_COLLIDER_HEIGHT + ROOF_SLAB_THICKNESS) / 2, sz / 2],
    );
  }

  private addSlopedRailAlongZ(x: number, ramp: RampRect, zFrom: number, zTo: number): void {
    const zMin = Math.min(zFrom, zTo);
    const zMax = Math.max(zFrom, zTo);
    const yAt = (z: number) => {
      const t = (z - ramp.minZ) / (ramp.maxZ - ramp.minZ);
      return ramp.yAtMin + (ramp.yAtMax - ramp.yAtMin) * t;
    };
    const yLowEnd = yAt(zMax);
    const yHighEnd = yAt(zMin);
    const len = zMax - zMin;

    // Continuous sloped visual rail beam & glass infill
    const beamPrism = (yOffset: number, halfH: number, halfW: number, mat: THREE.Material, name: string) => {
      const geo = this.scope.track(new THREE.BufferGeometry());
      const x0 = x - halfW;
      const x1 = x + halfW;
      const pos = new Float32Array([
        x0, yHighEnd + yOffset + halfH, zMin,
        x1, yHighEnd + yOffset + halfH, zMin,
        x1, yLowEnd + yOffset + halfH, zMax,
        x0, yLowEnd + yOffset + halfH, zMax,
        x0, yHighEnd + yOffset - halfH, zMin,
        x1, yHighEnd + yOffset - halfH, zMin,
        x1, yLowEnd + yOffset - halfH, zMax,
        x0, yLowEnd + yOffset - halfH, zMax,
      ]);
      const idx = [
        0, 3, 2, 0, 2, 1,
        4, 5, 6, 4, 6, 7,
        0, 4, 7, 0, 7, 3,
        1, 2, 6, 1, 6, 5,
        0, 1, 5, 0, 5, 4,
        3, 7, 6, 3, 6, 2,
      ];
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.name = name;
      this.group.add(m);
    };
    beamPrism(ROOF_RAIL_HEIGHT - 0.04, 0.04, ROOF_RAIL_THICKNESS / 2, this.mats.bronze, 'rooftop-ramp-rail-top');
    beamPrism(0.56, 0.42, 0.015, this.mats.railGlass, 'rooftop-ramp-rail-glass');

    const posts = Math.max(2, Math.ceil(len / 4.0) + 1);
    for (let i = 0; i < posts; i++) {
      const z = zMin + (len * i) / (posts - 1);
      this.pushGuardPost(x, yAt(z), z, i % 2 === 0);
    }

    // Segment collider in <= 16 m slices: minY stays below the ramp floor, and each
    // slice above the bottom one hangs >= 2.5 m over the ground, so walkers under
    // the ramp are never blocked. 16 m (not 8 m) keeps the island inside the
    // non-tree collider budget asserted by island-landscape.e2e.ts.
    const segments = Math.max(1, Math.ceil(len / 16.0));
    for (let s = 0; s < segments; s++) {
      const sz0 = zMin + (len * s) / segments;
      const sz1 = zMin + (len * (s + 1)) / segments;
      const segMinY = Math.min(yAt(sz0), yAt(sz1)) - ROOF_SLAB_THICKNESS;
      const segMaxY = Math.max(yAt(sz0), yAt(sz1)) + ROOF_RAIL_COLLIDER_HEIGHT;
      this.collision.addBox(
        [x, (segMinY + segMaxY) / 2, (sz0 + sz1) / 2],
        [ROOF_RAIL_THICKNESS / 2, (segMaxY - segMinY) / 2, (sz1 - sz0) / 2],
      );
    }
  }

  private buildGuardrails(): void {
    const h = ROOF_RAIL_THICKNESS / 2;
    const Y = ROOF_DECK_Y;

    // Cafe Terrace perimeter (open at West Z in [24, 32] and South X in [-8, +8])
    this.addHorizontalRail(ROOF_CAFE_DECK.minX, ROOF_CAFE_DECK.minZ - h, ROOF_CAFE_DECK.maxX, ROOF_CAFE_DECK.minZ - h, Y);
    this.addHorizontalRail(ROOF_CAFE_DECK.maxX + h, ROOF_CAFE_DECK.minZ, ROOF_CAFE_DECK.maxX + h, ROOF_CAFE_DECK.maxZ, Y);
    this.addHorizontalRail(ROOF_CAFE_DECK.minX - h, ROOF_CAFE_DECK.minZ, ROOF_CAFE_DECK.minX - h, ROOF_PROMENADE_DECK.minZ, Y);
    this.addHorizontalRail(ROOF_CAFE_DECK.minX - h, ROOF_PROMENADE_DECK.maxZ, ROOF_CAFE_DECK.minX - h, ROOF_CAFE_DECK.maxZ, Y);
    this.addHorizontalRail(ROOF_CAFE_DECK.minX, ROOF_CAFE_DECK.maxZ + h, ROOF_FLIGHT_PAD_II_DECK.minX, ROOF_CAFE_DECK.maxZ + h, Y);
    this.addHorizontalRail(ROOF_FLIGHT_PAD_II_DECK.maxX, ROOF_CAFE_DECK.maxZ + h, ROOF_CAFE_DECK.maxX, ROOF_CAFE_DECK.maxZ + h, Y);

    // Flight Pad II Deck perimeter (open at North Z = 45)
    this.addHorizontalRail(ROOF_FLIGHT_PAD_II_DECK.minX - h, ROOF_FLIGHT_PAD_II_DECK.minZ, ROOF_FLIGHT_PAD_II_DECK.minX - h, ROOF_FLIGHT_PAD_II_DECK.maxZ, Y);
    this.addHorizontalRail(ROOF_FLIGHT_PAD_II_DECK.maxX + h, ROOF_FLIGHT_PAD_II_DECK.minZ, ROOF_FLIGHT_PAD_II_DECK.maxX + h, ROOF_FLIGHT_PAD_II_DECK.maxZ, Y);
    this.addHorizontalRail(ROOF_FLIGHT_PAD_II_DECK.minX, ROOF_FLIGHT_PAD_II_DECK.maxZ + h, ROOF_FLIGHT_PAD_II_DECK.maxX, ROOF_FLIGHT_PAD_II_DECK.maxZ + h, Y);

    // West Connecting Promenade perimeter (open North X in [-37.5, -16.5], open East X = -14.0)
    this.addHorizontalRail(ROOF_PROMENADE_DECK.minX - h, ROOF_PROMENADE_DECK.minZ, ROOF_PROMENADE_DECK.minX - h, ROOF_PROMENADE_DECK.maxZ, Y);
    this.addHorizontalRail(ROOF_PROMENADE_DECK.minX, ROOF_PROMENADE_DECK.maxZ + h, ROOF_PROMENADE_DECK.maxX, ROOF_PROMENADE_DECK.maxZ + h, Y);
    this.addHorizontalRail(ROOF_GREENHOUSE_DECK.maxX, ROOF_PROMENADE_DECK.minZ - h, ROOF_PROMENADE_DECK.maxX, ROOF_PROMENADE_DECK.minZ - h, Y);

    // Greenhouse Deck outer perimeter (open at South Z = 24, and North-West X in [-37.5, -35.0] into Upper Bridge)
    this.addHorizontalRail(ROOF_GREENHOUSE_DECK.minX - h, ROOF_GREENHOUSE_DECK.minZ, ROOF_GREENHOUSE_DECK.minX - h, ROOF_GREENHOUSE_DECK.maxZ, Y);
    this.addHorizontalRail(ROOF_GREENHOUSE_DECK.maxX + h, ROOF_GREENHOUSE_DECK.minZ, ROOF_GREENHOUSE_DECK.maxX + h, ROOF_GREENHOUSE_DECK.maxZ, Y);
    this.addHorizontalRail(WEST_UPPER_WALKWAY_LINK.maxX, ROOF_GREENHOUSE_DECK.minZ - h, ROOF_GREENHOUSE_DECK.maxX, ROOF_GREENHOUSE_DECK.minZ - h, Y);

    // Upper Bridge Landing perimeter (open South X in [-43, -39.5] to ramp & X in [-37.5, -35] to west walkway)
    this.addHorizontalRail(WEST_UPPER_BRIDGE_LANDING.minX - h, WEST_UPPER_BRIDGE_LANDING.minZ, WEST_UPPER_BRIDGE_LANDING.minX - h, WEST_UPPER_BRIDGE_LANDING.maxZ, Y);
    this.addHorizontalRail(WEST_UPPER_BRIDGE_LANDING.minX, WEST_UPPER_BRIDGE_LANDING.minZ - h, WEST_UPPER_WALKWAY_LINK.maxX, WEST_UPPER_BRIDGE_LANDING.minZ - h, Y);
    this.addHorizontalRail(WEST_UPPER_WALKWAY_LINK.maxX + h, WEST_UPPER_WALKWAY_LINK.minZ, WEST_UPPER_WALKWAY_LINK.maxX + h, WEST_UPPER_WALKWAY_LINK.maxZ, Y);
    this.addHorizontalRail(WEST_UPPER_RAMP.maxX, WEST_UPPER_BRIDGE_LANDING.maxZ - h, WEST_UPPER_BRIDGE_LANDING.maxX, WEST_UPPER_BRIDGE_LANDING.maxZ - h, Y);

    // Upper West Ramp & Mid Overlook Landing
    this.addSlopedRailAlongZ(WEST_UPPER_RAMP.minX - h, WEST_UPPER_RAMP, WEST_UPPER_RAMP.minZ, WEST_UPPER_RAMP.maxZ);
    this.addSlopedRailAlongZ(WEST_UPPER_RAMP.maxX + h, WEST_UPPER_RAMP, WEST_UPPER_RAMP.minZ, WEST_UPPER_RAMP.maxZ);
    this.addHorizontalRail(WEST_MID_LANDING.minX - h, WEST_MID_LANDING.minZ, WEST_MID_LANDING.minX - h, WEST_MID_LANDING.maxZ, ROOF_MID_LANDING_Y);
    this.addHorizontalRail(WEST_MID_LANDING.maxX + h, WEST_MID_LANDING.minZ, WEST_MID_LANDING.maxX + h, WEST_MID_LANDING.maxZ, ROOF_MID_LANDING_Y);

    // Lower West Ramp: East rail full length; West rail stops at Z = 104 to leave Path 5 mouth + clearance open.
    this.addSlopedRailAlongZ(WEST_LOWER_RAMP.minX - h, WEST_LOWER_RAMP, WEST_LOWER_RAMP.minZ, 104.0);
    this.addSlopedRailAlongZ(WEST_LOWER_RAMP.maxX + h, WEST_LOWER_RAMP, WEST_LOWER_RAMP.minZ, WEST_LOWER_RAMP.maxZ);
  }

  private buildGreenhouse(): void {
    const gh = new THREE.Group();
    gh.name = 'rooftop-greenhouse-shell';
    this.group.add(gh);

    const { minX, maxX, minZ, maxZ, eaveY, ridgeY } = ROOF_GREENHOUSE_SHELL;
    const baseY = ROOF_DECK_Y;
    const wallH = eaveY - baseY; // 4.2 m
    const midX = (minX + maxX) / 2;
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;
    const midZ = (minZ + maxZ) / 2;
    const kneeH = 0.55;
    const glassH = wallH - kneeH;
    const glassMidY = baseY + kneeH + glassH / 2;

    const addGlassWall = (x0: number, z0: number, x1: number, z1: number) => {
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      const alongX = Math.abs(dx) >= Math.abs(dz);
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      // Stone knee wall + transparent glass curtain + bronze top eaves plate
      this.box(gh, 'greenhouse-knee-wall', [alongX ? len : 0.24, kneeH, alongX ? 0.24 : len], [cx, baseY + kneeH / 2, cz], this.mats.pavingTrim);
      this.box(gh, 'greenhouse-glass-wall', [alongX ? len : 0.06, glassH, alongX ? 0.06 : len], [cx, glassMidY, cz], this.mats.conservatoryGlass, false);
      this.box(gh, 'greenhouse-eave-beam', [alongX ? len : 0.26, 0.22, alongX ? 0.26 : len], [cx, eaveY - 0.11, cz], this.mats.bronze);

      const mullions = Math.max(2, Math.round(len / 2.5) + 1);
      for (let i = 0; i < mullions; i++) {
        const f = i / (mullions - 1);
        this.box(
          gh,
          'greenhouse-mullion',
          [0.14, wallH, 0.14],
          [x0 + dx * f, baseY + wallH / 2, z0 + dz * f],
          this.mats.bronze,
          false,
        );
      }

      // Wall collider (extends down to deck underside so ceilingHeight stays clean)
      this.collision.addBox(
        [cx, (ROOF_DECK_UNDERSIDE_Y + eaveY) / 2, cz],
        [(alongX ? len : 0.26) / 2, (eaveY - ROOF_DECK_UNDERSIDE_Y) / 2, (alongX ? 0.26 : len) / 2],
      );
    };

    // West, East, North walls, plus South wall flanking the 4 m arched doorway
    addGlassWall(minX, minZ, minX, maxZ);
    addGlassWall(maxX, minZ, maxX, maxZ);
    addGlassWall(minX, minZ, maxX, minZ);
    addGlassWall(minX, maxZ, ROOF_GREENHOUSE_DOOR.minX, maxZ);
    addGlassWall(ROOF_GREENHOUSE_DOOR.maxX, maxZ, maxX, maxZ);

    // 4 m wide South arched doorway surround + header transom
    const doorMidX = (ROOF_GREENHOUSE_DOOR.minX + ROOF_GREENHOUSE_DOOR.maxX) / 2;
    const doorW = ROOF_GREENHOUSE_DOOR.maxX - ROOF_GREENHOUSE_DOOR.minX;
    const headerBottom = baseY + ROOF_GREENHOUSE_DOOR.height;
    const headerH = eaveY - headerBottom;
    this.box(gh, 'greenhouse-door-transom', [doorW, headerH, 0.18], [doorMidX, headerBottom + headerH / 2, maxZ], this.mats.bronze);
    for (const side of [-1, 1]) {
      const px = doorMidX + side * (doorW / 2 + 0.12);
      this.box(gh, 'greenhouse-door-pilaster', [0.24, wallH, 0.3], [px, baseY + wallH / 2, maxZ], this.mats.bronze);
      const lantern = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.11, 10, 8)), this.mats.amberGlow);
      lantern.name = `greenhouse-door-lantern-${side}`;
      lantern.position.set(px, baseY + 2.65, maxZ + 0.22);
      gh.add(lantern);
    }
    const doorArch = new THREE.Mesh(
      this.scope.track(new THREE.TorusGeometry(doorW / 2, 0.11, 8, 24, Math.PI)),
      this.mats.brass,
    );
    doorArch.name = 'greenhouse-door-arch';
    doorArch.position.set(doorMidX, baseY + 2.8, maxZ + 0.08);
    gh.add(doorArch);

    const doorSign = new THREE.Mesh(
      this.scope.track(new THREE.PlaneGeometry(3.4, 0.62)),
      this.scope.track(new THREE.MeshBasicMaterial({
        map: this.createSignTexture('CONSERVATORY', ['Glasshouse · Exotic W05 Specimen'], 760, 140),
        toneMapped: false,
      })),
    );
    doorSign.name = 'greenhouse-door-sign';
    doorSign.position.set(doorMidX, headerBottom + 0.42, maxZ + 0.16);
    gh.add(doorSign);

    // Barrel-vaulted transparent glass conservatory roof (Y = 22.8 .. 25.4) + bronze ribs
    const roofRise = ridgeY - eaveY;
    const nx = 24;
    const nz = 12;
    const roofPositions: number[] = [];
    const roofIndices: number[] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const z = minZ + (spanZ * iz) / nz;
      for (let ix = 0; ix <= nx; ix++) {
        const u = -1 + (2 * ix) / nx;
        const x = midX + (u * spanX) / 2;
        const y = eaveY + roofRise * Math.sqrt(Math.max(0, 1 - u * u));
        roofPositions.push(x, y, z);
      }
    }
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const a = iz * (nx + 1) + ix;
        roofIndices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
    const vaultGeo = this.scope.track(new THREE.BufferGeometry());
    vaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
    vaultGeo.setIndex(roofIndices);
    vaultGeo.computeVertexNormals();
    const vaultMesh = new THREE.Mesh(vaultGeo, this.mats.conservatoryGlass);
    vaultMesh.name = 'greenhouse-glass-vault';
    gh.add(vaultMesh);

    // Arched bronze structural ribs along the conservatory roof
    const ribPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = -1 + (2 * i) / 24;
      ribPts.push(new THREE.Vector3((u * spanX) / 2, eaveY + roofRise * Math.sqrt(Math.max(0, 1 - u * u)), 0));
    }
    const ribGeo = this.scope.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPts), 24, 0.085, 6, false));
    const ribCount = 7;
    const ribs = this.scope.track(new THREE.InstancedMesh(ribGeo, this.mats.bronze, ribCount));
    ribs.name = 'greenhouse-vault-ribs';
    const dummy = this.scratchObj;
    for (let i = 0; i < ribCount; i++) {
      dummy.position.set(midX, 0, minZ + (spanZ * i) / (ribCount - 1));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ribs.setMatrixAt(i, dummy.matrix);
    }
    ribs.instanceMatrix.needsUpdate = true;
    ribs.computeBoundingSphere();
    gh.add(ribs);

    // Gable glass fanlights closing the north and south barrel arches above eaveY
    const fanShape = new THREE.Shape();
    fanShape.moveTo(-spanX / 2, 0);
    for (let i = 0; i <= 24; i++) {
      const u = -1 + (2 * i) / 24;
      fanShape.lineTo((u * spanX) / 2, roofRise * Math.sqrt(Math.max(0, 1 - u * u)));
    }
    fanShape.closePath();
    const fanGeo = this.scope.track(new THREE.ShapeGeometry(fanShape, 24));
    for (const z of [minZ, maxZ]) {
      const fan = new THREE.Mesh(fanGeo, this.mats.conservatoryGlass);
      fan.name = `greenhouse-gable-glass-${z}`;
      fan.position.set(midX, eaveY, z);
      gh.add(fan);
    }

    this.box(gh, 'greenhouse-ridge-crest', [0.16, 0.16, spanZ + 0.2], [midX, ridgeY + 0.06, midZ], this.mats.brass, false);

    // Ordinary small potted ferns & herbs in perimeter planters ONLY (zero giant roof plants)
    const planters = new THREE.Group();
    planters.name = 'rooftop-greenhouse-planters';
    this.group.add(planters);

    const planterBeds: readonly { x: number; z: number; sx: number; sz: number }[] = [
      { x: minX + 0.72, z: midZ, sx: 0.9, sz: 18.0 },
      { x: maxX - 0.72, z: midZ, sx: 0.9, sz: 18.0 },
      { x: midX, z: minZ + 0.72, sx: 14.0, sz: 0.9 },
    ];
    const fernPositions: Vec3[] = [];
    for (const bed of planterBeds) {
      this.box(planters, 'greenhouse-planter-trough', [bed.sx, 0.44, bed.sz], [bed.x, baseY + 0.22, bed.z], this.mats.terracotta);
      this.box(planters, 'greenhouse-planter-soil', [bed.sx - 0.14, 0.06, bed.sz - 0.14], [bed.x, baseY + 0.43, bed.z], this.mats.soil, false);
      this.collision.addBox([bed.x, baseY + 0.25, bed.z], [bed.sx / 2, 0.55, bed.sz / 2]);
      const count = bed.sx > bed.sz ? 9 : 11;
      for (let i = 0; i < count; i++) {
        const f = -0.45 + (0.9 * i) / (count - 1);
        fernPositions.push([
          bed.x + (bed.sx > bed.sz ? bed.sx * f : 0),
          baseY + 0.45,
          bed.z + (bed.sz > bed.sx ? bed.sz * f : 0),
        ]);
      }
    }
    const fernGeo = this.scope.track(new THREE.IcosahedronGeometry(0.26, 0));
    const ferns = this.scope.track(new THREE.InstancedMesh(fernGeo, this.mats.fern, fernPositions.length));
    ferns.name = 'greenhouse-perimeter-potted-ferns';
    fernPositions.forEach(([fx, fy, fz], i) => {
      const s = 0.8 + (i % 3) * 0.18;
      dummy.position.set(fx, fy + 0.2 * s, fz);
      dummy.rotation.set(0, i * 0.9, 0);
      dummy.scale.set(s, s * 0.85, s);
      dummy.updateMatrix();
      ferns.setMatrixAt(i, dummy.matrix);
    });
    ferns.instanceMatrix.needsUpdate = true;
    ferns.computeBoundingSphere();
    planters.add(ferns);

    // Central W05 Portal Anchor: raised stone collar + ~3.4 m bioluminescent exotic flower
    const [fx, fy, fz] = GREENHOUSE_FLOWER_CENTER;
    const collar = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(GREENHOUSE_COLLAR_RADIUS, GREENHOUSE_COLLAR_RADIUS + 0.15, GREENHOUSE_COLLAR_HEIGHT, 32)),
      this.mats.pavingTrim,
    );
    collar.name = 'greenhouse-flower-w05-collar';
    collar.position.set(fx, fy + GREENHOUSE_COLLAR_HEIGHT / 2, fz);
    collar.receiveShadow = true;
    this.group.add(collar);
    const collarSoil = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(GREENHOUSE_COLLAR_RADIUS - 0.28, GREENHOUSE_COLLAR_RADIUS - 0.28, 0.1, 24)),
      this.mats.soil,
    );
    collarSoil.position.set(fx, fy + GREENHOUSE_COLLAR_HEIGHT - 0.02, fz);
    this.group.add(collarSoil);
    // Inscribed collision box inside collar so visitors can circle freely
    this.collision.addBox([fx, fy + 0.75, fz], [2.05, 1.05, 2.05]);

    const flowerAnchor = new THREE.Group();
    flowerAnchor.name = 'greenhouse-flower-w05-anchor';
    flowerAnchor.position.set(fx, fy + GREENHOUSE_COLLAR_HEIGHT, fz);
    this.group.add(flowerAnchor);

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.18, 0.85, 0.1),
      new THREE.Vector3(-0.14, 1.85, -0.08),
      new THREE.Vector3(0.0, 2.75, 0.04),
    ]);
    const stemMesh = new THREE.Mesh(
      this.scope.track(new THREE.TubeGeometry(stemCurve, 18, 0.13, 8, false)),
      this.mats.flowerStem,
    );
    stemMesh.name = 'greenhouse-flower-stem';
    flowerAnchor.add(stemMesh);

    const leafGeo = this.scope.track(new THREE.ConeGeometry(0.38, 1.25, 5));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(leafGeo, this.mats.fern);
      leaf.position.set(Math.cos(a) * 0.75, 0.28, Math.sin(a) * 0.75);
      leaf.rotation.set(0, -a, -Math.PI / 3);
      flowerAnchor.add(leaf);
    }

    this.flowerBlossomGroup.name = 'greenhouse-flower-blossom';
    this.flowerBlossomGroup.position.set(0, 2.78, 0.04);
    flowerAnchor.add(this.flowerBlossomGroup);

    const outerPetalGeo = this.scope.track(new THREE.ConeGeometry(0.42, 1.18, 6));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const petal = new THREE.Mesh(outerPetalGeo, this.mats.flowerOuterPetal);
      petal.position.set(Math.cos(a) * 0.48, 0.14, Math.sin(a) * 0.48);
      petal.rotation.order = 'YXZ';
      petal.rotation.y = -a;
      petal.rotation.z = -1.02;
      this.flowerBlossomGroup.add(petal);
    }
    const innerPetalGeo = this.scope.track(new THREE.ConeGeometry(0.26, 0.88, 6));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.32;
      const petal = new THREE.Mesh(innerPetalGeo, this.mats.flowerInnerPetal);
      petal.position.set(Math.cos(a) * 0.26, 0.28, Math.sin(a) * 0.26);
      petal.rotation.order = 'YXZ';
      petal.rotation.y = -a;
      petal.rotation.z = -0.62;
      this.flowerBlossomGroup.add(petal);
    }
    const core = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.24, 14, 10)), this.mats.goldGlow);
    core.name = 'greenhouse-flower-core';
    core.position.y = 0.28;
    this.flowerBlossomGroup.add(core);

    // Floating bioluminescent pollen motes (InstancedMesh)
    this.pollenMotes = this.scope.track(new THREE.InstancedMesh(
      this.scope.track(new THREE.SphereGeometry(0.055, 6, 5)),
      this.mats.cyanGlow,
      POLLEN_MOTE_COUNT,
    ));
    this.pollenMotes.name = 'greenhouse-flower-pollen-motes';
    this.pollenMotes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    flowerAnchor.add(this.pollenMotes);
    for (let i = 0; i < POLLEN_MOTE_COUNT; i++) {
      this.pollenSpecs.push({
        phase: (i / POLLEN_MOTE_COUNT) * Math.PI * 2,
        radius: 0.75 + ((i * 7) % 11) / 11 * 1.15,
        heightOffset: 0.65 + ((i * 5) % 9) / 9 * 2.15,
        speed: 0.35 + ((i * 3) % 7) * 0.06,
      });
    }

    // Interaction target & hit proxy on layer 1
    this.flowerInteractionTarget.name = 'greenhouse-flower-w05-interaction';
    this.flowerInteractionTarget.position.set(0, 1.4, 0);
    const flowerHit = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(1.65, 1.65, 3.2, 10)),
      this.mats.proxyInvisible,
    );
    flowerHit.name = 'greenhouse-flower-hit-proxy';
    flowerHit.layers.set(INTERACTION_ONLY_LAYER);
    this.flowerInteractionTarget.add(flowerHit);
    flowerAnchor.add(this.flowerInteractionTarget);
  }

  private buildCafe(): void {
    const cafe = new THREE.Group();
    cafe.name = 'rooftop-cafe';
    this.group.add(cafe);

    // 1. Overhead "ROOFTOP CAFÉ" architectural gantry sign spanning Promenade -> Cafe threshold
    const gantryX = -13.7;
    for (const z of [24.2, 31.8]) {
      this.box(cafe, 'rooftop-cafe-sign-post', [0.22, 4.0, 0.22], [gantryX, ROOF_DECK_Y + 2.0, z], this.mats.bronze);
      this.collision.addBox([gantryX, ROOF_DECK_Y + 1.2, z], [0.16, 1.45, 0.16]);
    }
    this.box(cafe, 'rooftop-cafe-sign-beam', [0.26, 0.2, 7.9], [gantryX, ROOF_DECK_Y + 3.9, 28.0], this.mats.bronze);
    const signBoardMat = this.scope.track(new THREE.MeshBasicMaterial({
      map: this.createSignTexture('ROOFTOP CAFÉ', ['Hot Dogs · Greenhouse ← · Flight Pad II →'], 960, 240),
      toneMapped: false,
    }));
    for (const face of [-1, 1]) {
      const sign = new THREE.Mesh(this.scope.track(new THREE.PlaneGeometry(5.2, 1.25)), signBoardMat);
      sign.name = face < 0 ? 'rooftop-cafe-sign' : 'rooftop-cafe-sign-east';
      sign.position.set(gantryX + face * 0.15, ROOF_DECK_Y + 3.28, 28.0);
      sign.rotation.y = face < 0 ? -Math.PI / 2 : Math.PI / 2;
      cafe.add(sign);
    }

    // 2. Hot Dog Man Stand at [7.5, 18.6, 29.0], 4.2 m x 2.8 m, facing -X
    const [hx, hy, hz] = HOT_DOG_STAND_CENTER;
    const stand = new THREE.Group();
    stand.name = 'rooftop-hot-dog-stand';
    stand.position.set(hx, hy, hz);
    cafe.add(stand);

    const { depthX, widthZ } = HOT_DOG_STAND_SIZE; // 2.8 x 4.2
    // Lower counter body, rear kitchen wall, side walls, brass service sill
    this.box(stand, 'hot-dog-counter-base', [0.55, 1.05, widthZ], [-depthX / 2 + 0.275, 0.525, 0], this.mats.wood);
    this.box(stand, 'hot-dog-service-sill', [0.8, 0.08, widthZ + 0.16], [-depthX / 2 + 0.22, 1.07, 0], this.mats.brass);
    this.box(stand, 'hot-dog-rear-wall', [0.28, 2.35, widthZ], [depthX / 2 - 0.14, 1.175, 0], this.mats.bronze);
    for (const zSide of [-1, 1]) {
      this.box(stand, 'hot-dog-side-post', [0.22, 2.4, 0.24], [-depthX / 2 + 0.11, 1.2, zSide * (widthZ / 2 - 0.12)], this.mats.bronze);
      this.box(stand, 'hot-dog-side-wing', [depthX, 1.3, 0.18], [0, 1.75, zSide * (widthZ / 2 - 0.09)], this.mats.bronze);
    }
    this.box(stand, 'hot-dog-header-fascia', [depthX + 0.16, 0.55, widthZ + 0.12], [0, 2.65, 0], this.mats.bronze);

    // Striped red & cream awning projecting toward -X
    const stripeCount = 7;
    const stripeW = (widthZ + 0.2) / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const sz = -(widthZ + 0.2) / 2 + stripeW * (i + 0.5);
      const stripe = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(1.45, 0.08, stripeW - 0.01)),
        i % 2 === 0 ? this.mats.awningRed : this.mats.awningCream,
      );
      stripe.position.set(-depthX / 2 - 0.42, 2.26, sz);
      stripe.rotation.z = 0.28;
      stand.add(stripe);
    }

    // Crisp menu sign facing -X
    const menuSign = new THREE.Mesh(
      this.scope.track(new THREE.PlaneGeometry(3.6, 0.86)),
      this.scope.track(new THREE.MeshBasicMaterial({
        map: this.createSignTexture('HOT DOGS', ['Mustard & Kraut · Lemonade'], 920, 220),
        toneMapped: false,
      })),
    );
    menuSign.name = 'hot-dog-menu-sign';
    menuSign.position.set(-depthX / 2 - 0.1, 2.75, 0);
    menuSign.rotation.y = -Math.PI / 2;
    stand.add(menuSign);

    // Condiment pots and warm serving light bar (MeshBasicMaterial, no THREE.Light)
    this.box(stand, 'hot-dog-service-glow', [0.06, 0.06, widthZ - 0.6], [-depthX / 2 + 0.24, 2.34, 0], this.mats.amberGlow, false);
    const condimentGeo = this.scope.track(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 8));
    const mustard = new THREE.Mesh(condimentGeo, this.mats.goldGlow);
    mustard.position.set(-depthX / 2 + 0.18, 1.22, -0.7);
    const ketchup = new THREE.Mesh(condimentGeo, this.mats.awningRed);
    ketchup.position.set(-depthX / 2 + 0.18, 1.22, -0.45);
    stand.add(mustard, ketchup);

    // Counter box collider (minY extends below deck so ceilingHeight never triggers)
    this.collision.addBox([hx, hy + 1.1, hz], [depthX / 2, 1.35, widthZ / 2]);

    // Hit proxy on -X counter face
    this.hotDogInteractionTarget.name = 'hot-dog-stand-interaction';
    this.hotDogInteractionTarget.position.set(-0.4, 1.35, 0);
    const hotDogHit = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(2.2, 2.4, 3.8)),
      this.mats.proxyInvisible,
    );
    hotDogHit.layers.set(INTERACTION_ONLY_LAYER);
    this.hotDogInteractionTarget.add(hotDogHit);
    stand.add(this.hotDogInteractionTarget);

    // 3. 4 Table Clusters with >= 1.8 m aisles
    const tableTopGeo = this.scope.track(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 16));
    const tablePostGeo = this.scope.track(new THREE.CylinderGeometry(0.06, 0.12, 0.74, 10));
    const chairSeatGeo = this.scope.track(new THREE.BoxGeometry(0.42, 0.05, 0.42));
    const chairBackGeo = this.scope.track(new THREE.BoxGeometry(0.42, 0.42, 0.05));
    const lanternGeo = this.scope.track(new THREE.CylinderGeometry(0.055, 0.065, 0.14, 8));

    ROOF_CAFE_TABLES.forEach(([tx, ty, tz], index) => {
      const cluster = new THREE.Group();
      cluster.name = `rooftop-cafe-table-${index + 1}`;
      cluster.position.set(tx, ty, tz);
      cafe.add(cluster);

      const top = new THREE.Mesh(tableTopGeo, this.mats.wood);
      top.position.y = 0.76;
      const post = new THREE.Mesh(tablePostGeo, this.mats.bronze);
      post.position.y = 0.37;
      const lamp = new THREE.Mesh(lanternGeo, this.mats.amberGlow);
      lamp.position.y = 0.85;
      cluster.add(top, post, lamp);

      for (const side of [-1, 1]) {
        const chair = new THREE.Group();
        chair.position.set(side * 0.78, 0, 0);
        chair.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        const seat = new THREE.Mesh(chairSeatGeo, this.mats.wood);
        seat.position.y = 0.45;
        const back = new THREE.Mesh(chairBackGeo, this.mats.bronze);
        back.position.set(0, 0.68, -0.18);
        const leg = new THREE.Mesh(tablePostGeo, this.mats.bronze);
        leg.scale.set(0.6, 0.6, 0.6);
        leg.position.y = 0.225;
        chair.add(seat, back, leg);
        cluster.add(chair);
      }

      this.collision.addBox(
        [tx, ty + 0.55, tz],
        [ROOF_CAFE_TABLE_COLLIDER_HALF, 0.8, ROOF_CAFE_TABLE_COLLIDER_HALF],
      );
    });

    // 4. 2 Step-free Accessible Seating / Standing Overlook Bays (>= 2.4 m clear)
    ROOF_ACCESSIBLE_BAYS.forEach((bay) => {
      const bayGroup = new THREE.Group();
      bayGroup.name = bay.id;
      bayGroup.position.set(bay.center[0], bay.center[1], bay.center[2]);
      cafe.add(bayGroup);

      const size = bay.clearHalf * 2;
      const border = new THREE.Mesh(
        this.scope.track(new THREE.RingGeometry(bay.clearHalf * Math.SQRT2 - 0.14, bay.clearHalf * Math.SQRT2, 4)),
        this.mats.brass,
      );
      border.rotation.x = -Math.PI / 2;
      border.rotation.z = Math.PI / 4;
      border.position.y = 0.015;
      bayGroup.add(border);

      const plaque = new THREE.Mesh(
        this.scope.track(new THREE.PlaneGeometry(Math.min(1.8, size * 0.6), 0.36)),
        this.scope.track(new THREE.MeshBasicMaterial({
          map: this.createSignTexture('STEP-FREE BAY', [bay.label], 560, 120),
          toneMapped: false,
        })),
      );
      plaque.rotation.x = -Math.PI / 2;
      plaque.position.y = 0.018;
      bayGroup.add(plaque);
    });
  }

  private buildFlightPadII(): void {
    const [px, py, pz] = ROOF_FLIGHT_PAD_II_CENTER;
    const pad = new THREE.Group();
    pad.name = 'rooftop-flight-pad-ii-pad';
    pad.position.set(px, py, pz);
    this.group.add(pad);

    // Flush stepped launch plinth (0.06 m rise << STEP_UP 0.55 m)
    const plinth = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(ROOF_FLIGHT_PAD_II_RADIUS, ROOF_FLIGHT_PAD_II_RADIUS + 0.18, 0.06, 48)),
      this.mats.bronze,
    );
    plinth.position.y = 0.03;
    plinth.receiveShadow = true;
    pad.add(plinth);

    const outerGlowRing = new THREE.Mesh(
      this.scope.track(new THREE.RingGeometry(ROOF_FLIGHT_PAD_II_RADIUS - 0.24, ROOF_FLIGHT_PAD_II_RADIUS - 0.08, 48)),
      this.mats.cyanGlow,
    );
    outerGlowRing.rotation.x = -Math.PI / 2;
    outerGlowRing.position.y = 0.066;
    pad.add(outerGlowRing);

    const innerGlowRing = new THREE.Mesh(
      this.scope.track(new THREE.RingGeometry(1.45, 1.62, 40)),
      this.mats.goldGlow,
    );
    innerGlowRing.rotation.x = -Math.PI / 2;
    innerGlowRing.position.y = 0.066;
    pad.add(innerGlowRing);

    this.padGlyphRing.name = 'rooftop-flight-pad-ii-glyphs';
    this.padGlyphRing.position.y = 0.068;
    const glyphGeo = this.scope.track(new THREE.RingGeometry(2.15, 2.3, 6, 1, 0, Math.PI / 9));
    glyphGeo.rotateX(-Math.PI / 2);
    const glyphs = this.scope.track(new THREE.InstancedMesh(glyphGeo, this.mats.cyanGlow, 12));
    const dummy = this.scratchObj;
    for (let i = 0; i < 12; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, (i * Math.PI) / 6, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      glyphs.setMatrixAt(i, dummy.matrix);
    }
    glyphs.instanceMatrix.needsUpdate = true;
    glyphs.computeBoundingSphere();
    this.padGlyphRing.add(glyphs);
    pad.add(this.padGlyphRing);

    // Rising launch motes
    this.padMotes = this.scope.track(new THREE.InstancedMesh(
      this.scope.track(new THREE.SphereGeometry(0.065, 6, 5)),
      this.mats.cyanGlow,
      PAD_MOTE_COUNT,
    ));
    this.padMotes.name = 'rooftop-flight-pad-ii-motes';
    this.padMotes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pad.add(this.padMotes);
    for (let i = 0; i < PAD_MOTE_COUNT; i++) {
      this.padSpecs.push({
        phase: (i / PAD_MOTE_COUNT),
        radius: 0.4 + ((i * 5) % 11) / 11 * 2.4,
        heightOffset: 0.25,
        speed: 0.34,
      });
    }

    // Two player-readable upward aim arcs (NE -> future W06, South -> future W10)
    const buildAimArc = (
      name: string,
      pts: THREE.Vector3[],
      mat: THREE.Material,
      title: string,
      subtitle: string,
      signPos: Vec3,
      signYaw: number,
    ) => {
      const arcGroup = new THREE.Group();
      arcGroup.name = name;
      pad.add(arcGroup);

      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(this.scope.track(new THREE.TubeGeometry(curve, 24, 0.06, 6, false)), mat);
      arcGroup.add(tube);

      const end = curve.getPoint(1);
      const tangent = curve.getTangent(1).normalize();
      const arrow = new THREE.Mesh(this.scope.track(new THREE.ConeGeometry(0.22, 0.62, 10)), mat);
      arrow.position.copy(end);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      arcGroup.add(arrow);

      const plaque = new THREE.Mesh(
        this.scope.track(new THREE.PlaneGeometry(3.4, 0.96)),
        this.scope.track(new THREE.MeshBasicMaterial({
          map: this.createSignTexture(title, [subtitle], 860, 240),
          toneMapped: false,
        })),
      );
      plaque.position.set(...signPos);
      plaque.rotation.y = signYaw;
      arcGroup.add(plaque);
    };

    // NE upward aim arc toward future W06 Skyborne Gardens
    buildAimArc(
      'rooftop-flight-pad-ii-arc-w06',
      [
        new THREE.Vector3(2.2, 0.2, -2.2),
        new THREE.Vector3(4.0, 2.8, -4.0),
        new THREE.Vector3(5.8, 5.2, -5.8),
      ],
      this.mats.cyanGlow,
      'W06 · SKYBORNE',
      'NE ↑ Floating Islands · Dormant',
      [1.8, 2.35, -5.2],
      -0.3,
    );

    // South upward aim arc toward future W10 Breath of the Weasel
    buildAimArc(
      'rooftop-flight-pad-ii-arc-w10',
      [
        new THREE.Vector3(0, 0.2, 3.2),
        new THREE.Vector3(0, 2.7, 5.6),
        new THREE.Vector3(0, 5.0, 8.0),
      ],
      this.mats.goldGlow,
      'W10 · WEASEL',
      'S ↑ Wilderness · 1st Stamp Unlocks',
      [2.8, 1.65, 6.4],
      Math.PI - 0.25,
    );

    // Reduced-motion accessible Launch Control Pedestal at [-4.2, 18.6, 51.5]
    const [cx, cy, cz] = ROOF_FLIGHT_PAD_II_TELEPORT_CENTER;
    const pedestal = new THREE.Group();
    pedestal.name = 'rooftop-flight-pad-ii-teleport-pedestal';
    pedestal.position.set(cx, cy, cz);
    this.group.add(pedestal);

    this.box(pedestal, 'flight-pad-pedestal-base', [0.85, 0.14, 0.85], [0, 0.07, 0], this.mats.pavingTrim);
    this.box(pedestal, 'flight-pad-pedestal-column', [0.56, 1.05, 0.56], [0, 0.665, 0], this.mats.bronze);
    const consoleHead = this.box(pedestal, 'flight-pad-pedestal-head', [0.42, 0.46, 0.76], [0, 1.32, 0], this.mats.bronze);

    const consoleScreen = new THREE.Mesh(
      this.scope.track(new THREE.PlaneGeometry(0.68, 0.36)),
      this.scope.track(new THREE.MeshBasicMaterial({
        map: this.createSignTexture('PAD II ACCESS', ['W06 & W10 Dormant'], 520, 260),
        toneMapped: false,
      })),
    );
    consoleScreen.name = 'flight-pad-pedestal-screen';
    consoleScreen.position.set(0.22, 1.34, 0);
    consoleScreen.rotation.order = 'YXZ';
    consoleScreen.rotation.y = Math.PI / 2;
    consoleScreen.rotation.x = -0.35;
    pedestal.add(consoleScreen);
    void consoleHead;

    this.collision.addBox([cx, cy + 0.65, cz], [0.45, 0.9, 0.45]);

    this.padControlInteractionTarget.name = 'flight-pad-ii-teleport-interaction';
    this.padControlInteractionTarget.position.set(0, 1.0, 0);
    const padControlHit = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(0.75, 0.75, 2.0, 10)),
      this.mats.proxyInvisible,
    );
    padControlHit.layers.set(INTERACTION_ONLY_LAYER);
    this.padControlInteractionTarget.add(padControlHit);
    pedestal.add(this.padControlInteractionTarget);
  }

  private flushInstancedBatches(): void {
    const s = this.scope;

    if (this.pierTransforms.length > 0) {
      const pierGeo = s.track(new THREE.BoxGeometry(1, 1, 1));
      const piers = s.track(new THREE.InstancedMesh(pierGeo, this.mats.pavingTrim, this.pierTransforms.length));
      piers.name = 'rooftop-support-piers';
      piers.castShadow = true;
      piers.receiveShadow = true;
      this.pierTransforms.forEach((m, i) => piers.setMatrixAt(i, m));
      piers.instanceMatrix.needsUpdate = true;
      piers.computeBoundingSphere();
      this.group.add(piers);
    }

    if (this.postTransforms.length > 0) {
      const postGeo = s.track(new THREE.BoxGeometry(0.11, ROOF_RAIL_HEIGHT, 0.11));
      const posts = s.track(new THREE.InstancedMesh(postGeo, this.mats.bronze, this.postTransforms.length));
      posts.name = 'rooftop-guardrail-posts';
      this.postTransforms.forEach((m, i) => posts.setMatrixAt(i, m));
      posts.instanceMatrix.needsUpdate = true;
      posts.computeBoundingSphere();
      this.group.add(posts);
    }

    if (this.beaconTransforms.length > 0) {
      const beaconGeo = s.track(new THREE.SphereGeometry(0.065, 8, 6));
      const beacons = s.track(new THREE.InstancedMesh(beaconGeo, this.mats.amberGlow, this.beaconTransforms.length));
      beacons.name = 'rooftop-guardrail-beacons';
      this.beaconTransforms.forEach((m, i) => beacons.setMatrixAt(i, m));
      beacons.instanceMatrix.needsUpdate = true;
      beacons.computeBoundingSphere();
      this.group.add(beacons);
    }
  }

  private createSignTexture(title: string, lines: string[], width: number, height: number): THREE.Texture {
    if (!canRenderText()) return createFallbackTexture(this.scope, 0x161820);
    return createTextTexture(this.scope, lines, {
      width,
      height,
      title,
      titleSize: Math.round(height * 0.30),
      bodySize: Math.round(height * 0.14),
      align: 'center',
      rule: false,
      padding: 20,
      background: '#13161f',
      titleColor: '#f2cb77',
      color: '#cbd7e2',
    });
  }

  getControls(announce: (message: string) => void): ReadonlyArray<readonly [string, ExhibitControl]> {
    return [
      [
        HOT_DOG_STAND_ID,
        {
          object: this.hotDogInteractionTarget,
          label: () => (this.hotDogMan.state === 'ready'
            ? 'Buy a hot dog from Hot Dog Man'
            : 'Rooftop Hot Dog Stand'),
          description: 'The Rooftop Café hot dog stand overlooking the dome, run by Hot Dog Man.',
          activate: () => {
            if (this.hotDogMan.state === 'ready') {
              this.hotDogMan.serve();
              announce('Hot Dog Man hands a hot dog across the counter.');
            } else {
              announce('The rooftop hot dog stand is here. Service is unavailable at the moment.');
            }
          },
        },
      ],
      [
        GREENHOUSE_FLOWER_ID,
        {
          object: this.flowerInteractionTarget,
          label: () => (this.flowerInspected
            ? 'Exotic Conservatory Flower (W05 dormant)'
            : 'Inspect Exotic Conservatory Flower'),
          description: 'A bioluminescent specimen anchored at the conservatory centre for The Impossible Greenhouse (W05).',
          activate: () => {
            this.flowerInspected = true;
            announce('The exotic conservatory bloom hums quietly. Its passage into The Impossible Greenhouse (W05) is dormant.');
          },
        },
      ],
      [
        ROOF_FLIGHT_PAD_II_TELEPORT_ID,
        {
          object: this.padControlInteractionTarget,
          label: () => (this.padControlInspected
            ? 'Flight Pad II Console (W06 & W10 dormant)'
            : 'Inspect Flight Pad II Console'),
          description: 'Step-free reduced-motion console for Skyborne Gardens (W06, NE) and Breath of the Weasel (W10, South).',
          activate: () => {
            this.padControlInspected = true;
            announce('Flight Pad II console: Skyborne Gardens (W06, northeast) is dormant, and Breath of the Weasel (W10, south) is dormant. It opens once the world is ready and you have earned a stamp in another world.');
          },
        },
      ],
    ];
  }

  update(dt: number, eye: readonly [number, number, number], reducedMotion: boolean): void {
    this.hotDogMan.update(dt, eye, reducedMotion);
    const dx = eye[0] + 12;
    const dz = eye[2] - 26;
    const nearRoof = dx * dx + dz * dz <= VISIBILITY_SQ;
    if (!nearRoof && this.lastUpdatedElapsed >= 0) return;

    if (!reducedMotion && Number.isFinite(dt) && dt > 0) {
      const clamped = Math.min(dt, 0.05);
      this.elapsed += clamped;
      this.flowerBlossomGroup.rotation.y = Math.sin(this.elapsed * 0.45) * 0.14;
      this.padGlyphRing.rotation.y = (this.padGlyphRing.rotation.y + clamped * 0.14) % (Math.PI * 2);
    }

    if (this.lastUpdatedElapsed === this.elapsed) return;
    this.lastUpdatedElapsed = this.elapsed;

    const dummy = this.scratchObj;
    for (let i = 0; i < POLLEN_MOTE_COUNT; i++) {
      const spec = this.pollenSpecs[i];
      const angle = spec.phase + this.elapsed * spec.speed;
      const bob = Math.sin(spec.phase * 2 + this.elapsed * 0.9) * 0.16;
      dummy.position.set(
        Math.cos(angle) * spec.radius,
        spec.heightOffset + bob,
        Math.sin(angle) * spec.radius,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.8 + Math.sin(spec.phase + this.elapsed) * 0.25);
      dummy.updateMatrix();
      this.pollenMotes.setMatrixAt(i, dummy.matrix);
    }
    this.pollenMotes.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < PAD_MOTE_COUNT; i++) {
      const spec = this.padSpecs[i];
      const rise = (spec.phase + this.elapsed * spec.speed) % 1;
      const angle = spec.phase * Math.PI * 6 + this.elapsed * 0.55;
      dummy.position.set(
        Math.cos(angle) * spec.radius,
        0.16 + rise * 2.8,
        Math.sin(angle) * spec.radius,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.55 + (1 - rise) * 0.85);
      dummy.updateMatrix();
      this.padMotes.setMatrixAt(i, dummy.matrix);
    }
    this.padMotes.instanceMatrix.needsUpdate = true;
  }
}

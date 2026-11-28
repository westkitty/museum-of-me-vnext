import * as THREE from 'three';
import { applyLandscape } from '../../render/LandscapeShading';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { CollisionWorld } from '../CollisionWorld';
import type { ExhibitControl } from '../../exhibits/contract';
import { INTERACTION_ONLY_LAYER } from '../../interaction/InteractionManager';
import type { Vec3 } from '../layout';
import {
  ANCIENT_TREE_CENTER,
  LAND_SUPPORT_Y,
  ROOTBOUND_HOLLOW_CENTER,
  ROOTBOUND_HOLLOW_PORTAL,
} from './IslandSiteLayout';

export const ROOTBOUND_RELIC_ID = 'rootbound-hollow-relic';
export const ROOTBOUND_THRESHOLD_Y = -0.24;
export const ROOTBOUND_CHAMBER_FLOOR_Y = ROOTBOUND_HOLLOW_CENTER[1]; // -0.38
export const ROOTBOUND_RELIC_POSITION: Vec3 = [64.0, ROOTBOUND_CHAMBER_FLOOR_Y, -88.6];

const PORTAL_Z = ROOTBOUND_HOLLOW_PORTAL[1]; // -88.8
const TUNNEL_START_X = 54.4;
const TUNNEL_CREST_X = 56.6;
const CHAMBER_WEST_X = 58.4;
const CHAMBER_EAST_X = 65.15;
const TUNNEL_HALF_W = 1.25; // interior Z: [-90.05, -87.55]
const CHAMBER_MIN_Z = -91.45;
const CHAMBER_MAX_Z = -85.75;
const CHAMBER_MID_Z = (CHAMBER_MIN_Z + CHAMBER_MAX_Z) / 2; // -88.6
const RELIC_FLOAT_Y = ROOTBOUND_CHAMBER_FLOOR_Y + 1.52; // 1.14

/**
 * ISLAND-02C: Rootbound Hollow — a discoverable, physically traversable vaulted
 * root-mound grotto woven into the northern/eastern roots of the Ancient Tree.
 *
 * Built above the Y = -0.5 island terrain plane (via a two-sided mossy threshold
 * saddle and raised peat-slate chamber floor at Y = -0.38) so the continuous
 * terrain grass mesh never clips across the interior.
 *
 * Strictly maintains zero THREE.Light instances inside ExteriorWorld.root, tracks
 * every Three.js resource in ResourceScope, and honors reducedMotion.
 */
export class ExteriorRootboundHollow {
  readonly group = new THREE.Group();
  private readonly portalGroup = new THREE.Group();
  private readonly chamberGroup = new THREE.Group();
  private readonly relicGroup = new THREE.Group();
  private readonly interactionTarget = new THREE.Group();

  private seedCore!: THREE.Mesh;
  private outerRing!: THREE.Mesh;
  private innerRing!: THREE.Mesh;
  private myceliumGlowMat!: THREE.MeshStandardMaterial;
  private relicAuraMat!: THREE.MeshBasicMaterial;
  private discovered = false;
  private animTime = 0;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
  ) {
    this.group.name = 'rootbound-hollow';
    this.group.userData.visualRole = 'secret-root-grotto';

    this.portalGroup.name = 'rootbound-hollow-portal';
    this.chamberGroup.name = 'rootbound-hollow-chamber';
    this.relicGroup.name = 'rootbound-hollow-relic-shrine';
    this.interactionTarget.name = 'rootbound-hollow-relic-core';

    this.group.add(this.portalGroup, this.chamberGroup, this.relicGroup);
    this.build();
  }

  private build(): void {
    const s = this.scope;

    const loamMat = applyLandscape(s.track(new THREE.MeshStandardMaterial({
      color: 0x1a2220, roughness: 0.96, metalness: 0.02, flatShading: true,
      emissive: 0x071210, emissiveIntensity: 0.28,
    })), 'rock');
    const mossMoundMat = applyLandscape(s.track(new THREE.MeshStandardMaterial({
      color: 0x2a4c39, roughness: 0.94, metalness: 0.01, flatShading: true,
      emissive: 0x05110b, emissiveIntensity: 0.14,
    })), 'grass');
    const darkMossMat = applyLandscape(s.track(new THREE.MeshStandardMaterial({
      color: 0x1f3a2c, roughness: 0.95, flatShading: true,
      emissive: 0x040d09, emissiveIntensity: 0.12,
    })), 'grass');
    const rootBarkMat = applyLandscape(s.track(new THREE.MeshStandardMaterial({
      color: 0x3b281e, roughness: 0.94, metalness: 0.02,
      emissive: 0x0e0a07, emissiveIntensity: 0.16,
    })), 'bark');
    const slateMat = applyLandscape(s.track(new THREE.MeshStandardMaterial({
      color: 0x323d42, roughness: 0.88, metalness: 0.06,
      emissive: 0x0b161a, emissiveIntensity: 0.22,
    })), 'paving');
    const bronzeMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x9b7a52, roughness: 0.38, metalness: 0.72,
      emissive: 0x1c1409, emissiveIntensity: 0.2,
    }));
    const fernMat = applyLandscape(s.track(new THREE.MeshStandardMaterial({
      color: 0x1f5c41, roughness: 0.86, side: THREE.DoubleSide,
    })), 'foliage');
    const amberGlowMat = s.track(new THREE.MeshBasicMaterial({
      color: 0xffc074, toneMapped: false,
    }));
    const jadeGlowMat = s.track(new THREE.MeshBasicMaterial({
      color: 0x6ef7d6, toneMapped: false,
    }));
    this.myceliumGlowMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x52d8c2,
      emissive: 0x3ee6c8,
      emissiveIntensity: 1.05,
      roughness: 0.35,
      metalness: 0.05,
    }));

    const tealPoolTex = this.createRadialGlowTexture([76, 240, 206], [24, 130, 118]);
    const amberPoolTex = this.createRadialGlowTexture([255, 200, 120], [180, 108, 42]);

    this.buildWalkwayAndApproach(slateMat, loamMat, amberGlowMat, amberPoolTex);
    this.buildPortalAndRootArch(rootBarkMat, mossMoundMat, slateMat, fernMat, amberGlowMat);
    this.buildChamberShell(loamMat, mossMoundMat, darkMossMat, rootBarkMat, slateMat, bronzeMat, fernMat);
    this.buildBioluminescence(jadeGlowMat, tealPoolTex);
    this.buildRelicShrine(slateMat, rootBarkMat, bronzeMat, jadeGlowMat, tealPoolTex);
  }

  private createRadialGlowTexture(
    innerRgb: readonly [number, number, number],
    midRgb: readonly [number, number, number],
  ): THREE.DataTexture {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    const half = (size - 1) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - half) / half;
        const dy = (y - half) / half;
        const r = Math.min(1, Math.hypot(dx, dy));
        const falloff = Math.pow(1 - r, 2.1);
        const mix = Math.min(1, r * 1.4);
        const o = (y * size + x) * 4;
        data[o] = Math.round(innerRgb[0] * (1 - mix) + midRgb[0] * mix);
        data[o + 1] = Math.round(innerRgb[1] * (1 - mix) + midRgb[1] * mix);
        data[o + 2] = Math.round(innerRgb[2] * (1 - mix) + midRgb[2] * mix);
        data[o + 3] = Math.round(falloff * 255);
      }
    }
    const tex = this.scope.track(new THREE.DataTexture(data, size, size, THREE.RGBAFormat));
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  private buildWalkwayAndApproach(
    slateMat: THREE.Material,
    loamMat: THREE.Material,
    amberGlowMat: THREE.Material,
    amberPoolTex: THREE.DataTexture,
  ): void {
    const s = this.scope;

    // 4 low mossy stepping stones leading gently from the western clearing [50.5, -84]
    // around the WNW buttress root to the arched portal threshold [54.4, -88.8].
    const stoneCoords: readonly [number, number, number, number][] = [
      [51.9, -85.7, 0.58, 0.25],
      [52.8, -87.0, 0.64, -0.35],
      [53.6, -88.1, 0.68, 0.15],
      [54.1, -88.7, 0.78, 0.0],
    ];
    const stepStoneGeo = s.track(new THREE.CylinderGeometry(0.95, 1.05, 0.06, 7));
    const stones = s.track(new THREE.InstancedMesh(stepStoneGeo, slateMat, stoneCoords.length));
    stones.name = 'rootbound-approach-stepping-stones';
    const dummy = new THREE.Object3D();
    for (const [i, [sx, sz, scale, yaw]] of stoneCoords.entries()) {
      // Top rests at -0.455: cleanly above Y = -0.50 ground and Y = -0.465 moss ring.
      dummy.position.set(sx, -0.485, sz);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(scale, 1, scale * 0.84);
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
    }
    stones.instanceMatrix.needsUpdate = true;
    stones.computeBoundingSphere();
    this.portalGroup.add(stones);

    // Two-sided threshold saddle ramps: zero grass clipping (all >= -0.46).
    this.collision.add({
      kind: 'ramp',
      minX: TUNNEL_START_X,
      maxX: TUNNEL_CREST_X,
      minZ: PORTAL_Z - TUNNEL_HALF_W,
      maxZ: PORTAL_Z + TUNNEL_HALF_W,
      axis: 'x',
      yAtMin: -0.46,
      yAtMax: ROOTBOUND_THRESHOLD_Y,
    });
    this.collision.add({
      kind: 'ramp',
      minX: TUNNEL_CREST_X,
      maxX: CHAMBER_WEST_X,
      minZ: PORTAL_Z - TUNNEL_HALF_W,
      maxZ: PORTAL_Z + TUNNEL_HALF_W,
      axis: 'x',
      yAtMin: ROOTBOUND_THRESHOLD_Y,
      yAtMax: ROOTBOUND_CHAMBER_FLOOR_Y,
    });

    this.buildSlopeSlab(
      TUNNEL_START_X, -0.46, TUNNEL_CREST_X, ROOTBOUND_THRESHOLD_Y,
      PORTAL_Z, TUNNEL_HALF_W * 2 + 0.12, 0.32, slateMat, 'rootbound-entry-ramp',
    );
    this.buildSlopeSlab(
      TUNNEL_CREST_X, ROOTBOUND_THRESHOLD_Y, CHAMBER_WEST_X, ROOTBOUND_CHAMBER_FLOOR_Y,
      PORTAL_Z, TUNNEL_HALF_W * 2 + 0.12, 0.32, loamMat, 'rootbound-inner-ramp',
    );

    // Subtle stone threshold ridge ribs along the entrance saddle.
    const ribGeo = s.track(new THREE.BoxGeometry(0.16, 0.03, TUNNEL_HALF_W * 1.8));
    const ribs = s.track(new THREE.InstancedMesh(ribGeo, slateMat, 4));
    ribs.name = 'rootbound-threshold-ribs';
    for (let i = 0; i < 4; i++) {
      const f = (i + 0.5) / 4;
      const rx = TUNNEL_START_X + (TUNNEL_CREST_X - TUNNEL_START_X) * f;
      const ry = -0.46 + (ROOTBOUND_THRESHOLD_Y - (-0.46)) * f + 0.004;
      dummy.position.set(rx, ry, PORTAL_Z);
      dummy.rotation.set(0, 0, Math.atan2(ROOTBOUND_THRESHOLD_Y - (-0.46), TUNNEL_CREST_X - TUNNEL_START_X));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ribs.setMatrixAt(i, dummy.matrix);
    }
    ribs.instanceMatrix.needsUpdate = true;
    ribs.computeBoundingSphere();
    this.portalGroup.add(ribs);

    // Solid opaque chamber floor at Y = -0.38 (+0.12 m above island grass plane).
    this.collision.addFloor(
      CHAMBER_WEST_X, CHAMBER_EAST_X, CHAMBER_MIN_Z, CHAMBER_MAX_Z, ROOTBOUND_CHAMBER_FLOOR_Y,
    );
    const floorW = CHAMBER_EAST_X - CHAMBER_WEST_X + 0.2;
    const floorD = CHAMBER_MAX_Z - CHAMBER_MIN_Z + 0.2;
    const chamberFloor = new THREE.Mesh(
      s.track(new THREE.BoxGeometry(floorW, 0.24, floorD)),
      loamMat,
    );
    chamberFloor.name = 'rootbound-chamber-floor';
    chamberFloor.position.set(
      (CHAMBER_WEST_X + CHAMBER_EAST_X) / 2,
      ROOTBOUND_CHAMBER_FLOOR_Y - 0.12,
      CHAMBER_MID_Z,
    );
    chamberFloor.receiveShadow = true;
    this.chamberGroup.add(chamberFloor);

    // Warm unlit glow pool welcoming the visitor at the portal threshold.
    const poolMat = s.track(new THREE.MeshBasicMaterial({
      map: amberPoolTex, transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const entryGlow = new THREE.Mesh(s.track(new THREE.PlaneGeometry(3.2, 2.8)), poolMat);
    entryGlow.name = 'rootbound-portal-glow-pool';
    entryGlow.rotation.x = -Math.PI / 2;
    entryGlow.position.set(TUNNEL_START_X - 0.35, -0.452, PORTAL_Z);
    entryGlow.renderOrder = 2;
    this.portalGroup.add(entryGlow);

    // Twin warm amber root-lanterns cradling the portal mouth.
    const lanternPostGeo = s.track(new THREE.CylinderGeometry(0.10, 0.16, 0.56, 7));
    const lanternOrbGeo = s.track(new THREE.SphereGeometry(0.11, 10, 8));
    for (const side of [-1, 1]) {
      const lz = PORTAL_Z + side * 1.48;
      const post = new THREE.Mesh(lanternPostGeo, slateMat);
      post.position.set(54.75, LAND_SUPPORT_Y + 0.28, lz);
      const orb = new THREE.Mesh(lanternOrbGeo, amberGlowMat);
      orb.position.set(54.75, LAND_SUPPORT_Y + 0.62, lz);
      this.portalGroup.add(post, orb);
    }
  }

  private buildSlopeSlab(
    x0: number, y0: number, x1: number, y1: number,
    z: number, width: number, thickness: number,
    material: THREE.Material, name: string,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const slopeLen = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    const halfT = thickness / 2;
    const mesh = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(slopeLen, thickness, width)),
      material,
    );
    mesh.name = name;
    mesh.position.set(midX + Math.sin(angle) * halfT, midY - Math.cos(angle) * halfT, z);
    mesh.rotation.z = angle;
    mesh.receiveShadow = true;
    this.portalGroup.add(mesh);
  }

  private buildPortalAndRootArch(
    rootBarkMat: THREE.Material,
    mossMoundMat: THREE.Material,
    slateMat: THREE.Material,
    fernMat: THREE.Material,
    amberGlowMat: THREE.Material,
  ): void {
    const s = this.scope;
    const [tx, , tz] = ANCIENT_TREE_CENTER;

    // Sweeping gnarled roots growing directly from the Ancient Tree trunk over
    // the portal mouth and across the vaulted earthen mound into the clearing floor.
    const rootCurves: readonly { readonly pts: readonly Vec3[]; readonly radius: number }[] = [
      // Twin portal arch roots framing the western entrance (clear height >= 2.35 m)
      {
        radius: 0.25,
        pts: [
          [tx - 0.5, 3.0, tz - 1.3],
          [55.6, 2.95, -87.0],
          [55.3, 2.75, PORTAL_Z],
          [55.2, 1.45, PORTAL_Z - 1.75],
          [55.2, -0.54, PORTAL_Z - 2.05],
        ],
      },
      {
        radius: 0.21,
        pts: [
          [tx - 1.1, 2.35, tz - 1.1],
          [54.9, 2.45, -86.9],
          [54.7, 2.55, PORTAL_Z],
          [54.6, 1.15, PORTAL_Z - 1.85],
          [54.5, -0.54, PORTAL_Z - 2.15],
        ],
      },
      // Vault structural roots draping cleanly OVER the outer mossy dome cap (apex ~4.01 m)
      {
        radius: 0.26,
        pts: [
          [tx + 0.6, 3.85, tz - 1.4],
          [59.0, 4.10, -86.9],
          [61.5, 4.28, -88.8],
          [64.2, 3.45, -91.4],
          [64.6, -0.54, -92.2],
        ],
      },
      {
        radius: 0.24,
        pts: [
          [tx + 1.2, 3.45, tz - 1.0],
          [60.5, 3.95, -86.0],
          [63.8, 3.82, -88.5],
          [66.0, 2.55, -89.8],
          [66.2, -0.54, -90.4],
        ],
      },
      {
        radius: 0.22,
        pts: [
          [tx + 1.4, 2.75, tz - 0.5],
          [60.4, 3.10, -84.8],
          [63.2, 2.75, -84.9],
          [65.7, 1.55, -86.2],
          [66.0, -0.54, -87.0],
        ],
      },
      {
        radius: 0.20,
        pts: [
          [tx + 0.1, 4.05, tz - 1.5],
          [58.4, 3.92, -88.8],
          [59.6, 3.35, -91.6],
          [60.1, 1.55, -92.3],
          [60.2, -0.54, -92.6],
        ],
      },
    ];

    for (const [i, spec] of rootCurves.entries()) {
      const curve = new THREE.CatmullRomCurve3(spec.pts.map((p) => new THREE.Vector3(...p)));
      const geo = s.track(new THREE.TubeGeometry(curve, 22, spec.radius, 7, false));
      const rootMesh = new THREE.Mesh(geo, rootBarkMat);
      rootMesh.name = `rootbound-arch-root-${i + 1}`;
      rootMesh.castShadow = true;
      rootMesh.receiveShadow = true;
      (i < 2 ? this.portalGroup : this.chamberGroup).add(rootMesh);
    }

    // Flanking mossy stone & earthen portal jambs (staying strictly outside [-90.05, -87.55]).
    const jambGeo = s.track(new THREE.DodecahedronGeometry(0.92, 0));
    const jambPlacements: readonly [number, number, number, number, number, number][] = [
      [54.9, 0.22, PORTAL_Z - 2.18, 1.05, 1.25, 0.82],
      [55.0, 0.22, PORTAL_Z + 2.14, 1.00, 1.25, 0.80],
      [55.8, 0.95, PORTAL_Z - 2.14, 0.95, 1.15, 0.78],
      [55.8, 0.95, PORTAL_Z + 2.12, 0.92, 1.15, 0.78],
    ];
    for (const [x, y, z, sx, sy, sz] of jambPlacements) {
      const jamb = new THREE.Mesh(jambGeo, mossMoundMat);
      jamb.position.set(x, y, z);
      jamb.scale.set(sx, sy, sz);
      jamb.castShadow = true;
      jamb.receiveShadow = true;
      this.portalGroup.add(jamb);
    }

    // Engraved slate keystone plaque nestled neatly under the portal arch root.
    const lintel = new THREE.Mesh(s.track(new THREE.BoxGeometry(0.32, 0.24, 1.85)), slateMat);
    lintel.position.set(55.15, 2.40, PORTAL_Z);
    const sigil = new THREE.Mesh(s.track(new THREE.TorusGeometry(0.18, 0.028, 6, 16)), amberGlowMat);
    sigil.position.set(54.98, 2.40, PORTAL_Z);
    sigil.rotation.y = Math.PI / 2;
    this.portalGroup.add(lintel, sigil);

    // Wild woodland fern tufts framing the portal shoulders (outside walkable Z lane).
    const frondGeo = s.track(new THREE.ConeGeometry(0.22, 0.72, 4));
    const fernPositions: readonly [number, number][] = [
      [54.1, PORTAL_Z - 2.05],
      [54.2, PORTAL_Z + 1.95],
      [53.4, PORTAL_Z - 1.9],
      [55.0, PORTAL_Z - 2.5],
      [56.2, PORTAL_Z - 2.3],
    ];
    const ferns = s.track(new THREE.InstancedMesh(frondGeo, fernMat, fernPositions.length * 4));
    ferns.name = 'rootbound-portal-ferns';
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (const [fx, fz] of fernPositions) {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + fx;
        dummy.position.set(fx + Math.cos(a) * 0.16, LAND_SUPPORT_Y + 0.24, fz + Math.sin(a) * 0.16);
        dummy.rotation.set(0.45, a, 0.32);
        dummy.scale.set(0.85, 0.85, 0.32);
        dummy.updateMatrix();
        ferns.setMatrixAt(idx++, dummy.matrix);
      }
    }
    ferns.instanceMatrix.needsUpdate = true;
    ferns.computeBoundingSphere();
    this.portalGroup.add(ferns);
  }

  private buildChamberShell(
    loamMat: THREE.Material,
    mossMoundMat: THREE.Material,
    darkMossMat: THREE.Material,
    rootBarkMat: THREE.Material,
    slateMat: THREE.Material,
    bronzeMat: THREE.Material,
    fernMat: THREE.Material,
  ): void {
    const s = this.scope;

    // 1. Tunnel collision shell (invisible physics bounds) + curved extruded arch shell
    const tunnelMidX = (54.95 + 58.55) / 2; // 56.75
    const tunnelHalfLen = (58.55 - 54.95) / 2; // 1.80
    this.collision.addBox([tunnelMidX, 1.0, PORTAL_Z - TUNNEL_HALF_W - 0.35], [tunnelHalfLen, 1.5, 0.35]);
    this.collision.addBox([tunnelMidX, 1.0, PORTAL_Z + TUNNEL_HALF_W + 0.35], [tunnelHalfLen, 1.5, 0.35]);
    this.collision.addBox([tunnelMidX, 2.75, PORTAL_Z], [tunnelHalfLen, 0.50, TUNNEL_HALF_W + 0.35]);

    // Extruded organic vaulted arch tunnel shell (smooth mossy exterior + dark vaulted interior)
    const archOuterR = 1.92;
    const archInnerR = TUNNEL_HALF_W; // 1.25
    const archSpringY = 1.32;
    const archShape = new THREE.Shape();
    archShape.moveTo(-archOuterR, -0.52);
    archShape.lineTo(-archOuterR, archSpringY);
    archShape.absarc(0, archSpringY, archOuterR, Math.PI, 0, true);
    archShape.lineTo(archOuterR, -0.52);
    archShape.lineTo(archInnerR, -0.52);
    archShape.lineTo(archInnerR, archSpringY);
    archShape.absarc(0, archSpringY, archInnerR, 0, Math.PI, false);
    archShape.lineTo(-archInnerR, -0.52);
    archShape.closePath();

    const archGeo = s.track(new THREE.ExtrudeGeometry(archShape, {
      depth: 3.7,
      bevelEnabled: false,
      curveSegments: 10,
    }));
    // ExtrudeGeometry extrudes along +Z from 0..depth; rotate Y = +PI/2 so depth runs along +X,
    // and cross-section X maps to -Z (centered on PORTAL_Z).
    archGeo.rotateY(Math.PI / 2);
    const archMesh = new THREE.Mesh(archGeo, mossMoundMat);
    archMesh.name = 'rootbound-tunnel-arch-vault';
    archMesh.position.set(54.85, 0, PORTAL_Z);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    this.chamberGroup.add(archMesh);

    // Dark inner tunnel liner walls & ceiling strips (zero external box corners)
    const linerSideGeo = s.track(new THREE.BoxGeometry(3.6, 1.9, 0.08));
    for (const side of [-1, 1]) {
      const liner = new THREE.Mesh(linerSideGeo, loamMat);
      liner.position.set(56.75, 0.43, PORTAL_Z + side * (TUNNEL_HALF_W + 0.04));
      this.chamberGroup.add(liner);
    }

    // Tunnel vaulted root ribs overhead (strictly hugging inner arch crown Y = 2.55)
    const tunnelRibGeo = s.track(new THREE.TorusGeometry(1.30, 0.12, 6, 12, Math.PI));
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(tunnelRibGeo, rootBarkMat);
      rib.position.set(55.45 + i * 1.32, archSpringY, PORTAL_Z);
      rib.rotation.y = Math.PI / 2;
      this.chamberGroup.add(rib);
    }

    // 2. Chamber perimeter collision shell (physics bounds)
    const chamberMidX = (CHAMBER_WEST_X + CHAMBER_EAST_X) / 2; // 61.775
    const chamberHalfX = (CHAMBER_EAST_X - CHAMBER_WEST_X) / 2 + 0.35; // 3.725
    const chamberHalfZ = (CHAMBER_MAX_Z - CHAMBER_MIN_Z) / 2 + 0.35; // 3.20

    this.collision.addBox([58.50, 1.05, -90.95], [0.35, 1.55, 0.90]);
    this.collision.addBox([58.50, 1.05, -86.45], [0.35, 1.55, 1.10]);
    this.collision.addBox([chamberMidX, 1.05, CHAMBER_MIN_Z - 0.35], [chamberHalfX, 1.55, 0.35]);
    this.collision.addBox([chamberMidX, 1.05, CHAMBER_MAX_Z + 0.35], [chamberHalfX, 1.55, 0.35]);
    this.collision.addBox([CHAMBER_EAST_X + 0.35, 1.05, CHAMBER_MID_Z], [0.35, 1.55, chamberHalfZ]);
    this.collision.addBox([chamberMidX, 3.0, CHAMBER_MID_Z], [chamberHalfX, 0.55, chamberHalfZ]);

    // Thin dark earthen chamber interior walls (tucked cleanly inside the rounded mossy mound)
    const addInnerWall = (
      cx: number, cy: number, cz: number,
      sx: number, sy: number, sz: number,
      name: string,
    ) => {
      const mesh = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx, sy, sz)), loamMat);
      mesh.name = name;
      mesh.position.set(cx, cy, cz);
      mesh.receiveShadow = true;
      this.chamberGroup.add(mesh);
    };
    const wallH = 2.90;
    const wallY = 0.95; // -0.50 .. +2.40
    addInnerWall(58.42, wallY, -90.75, 0.14, wallH, 1.45, 'rootbound-chamber-west-north-wall');
    addInnerWall(58.42, wallY, -86.65, 0.14, wallH, 1.85, 'rootbound-chamber-west-south-wall');
    addInnerWall(chamberMidX, wallY, CHAMBER_MIN_Z - 0.08, 6.85, wallH, 0.16, 'rootbound-chamber-north-wall');
    addInnerWall(chamberMidX, wallY, CHAMBER_MAX_Z + 0.08, 6.85, wallH, 0.16, 'rootbound-chamber-south-wall');
    addInnerWall(CHAMBER_EAST_X + 0.08, wallY, CHAMBER_MID_Z, 0.16, wallH, 5.86, 'rootbound-chamber-east-wall');

    // Visible domed earthen ceiling vault strictly above Y = 2.34 (open inside!)
    const vaultGeo = s.track(new THREE.SphereGeometry(3.85, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.48));
    const vaultMat = applyLandscape(s.track(new THREE.MeshStandardMaterial({
      color: 0x161f1d, roughness: 0.95, flatShading: true, side: THREE.DoubleSide,
      emissive: 0x05100e, emissiveIntensity: 0.28,
    })), 'rock');
    const vaultDome = new THREE.Mesh(vaultGeo, vaultMat);
    vaultDome.name = 'rootbound-chamber-vault-dome';
    vaultDome.position.set(chamberMidX, 2.34, CHAMBER_MID_Z);
    vaultDome.scale.set(1.04, 0.36, 0.90);
    this.chamberGroup.add(vaultDome);

    // Exterior mossy earthen barrow mound dome enveloping the entire chamber from ground Y = -0.52 up to apex Y = 4.02!
    // An outer mossy shell (FrontSide / BackSide? Wait: only outside! Inner faces are hidden cleanly or dome starts outside!).
    // Wait: a full hemisphere of radius 4.4 m at y = -0.52 WOULD intersect the chamber interior!
    // Instead, stack a continuous tapered mossy dome ring + upper moss cap strictly OUTSIDE the chamber walls & ceiling:
    // 1) Upper moss dome cap (kept east of tunnel arch and above vaultDome)
    const outerCap = new THREE.Mesh(
      s.track(new THREE.SphereGeometry(4.25, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.48)),
      mossMoundMat,
    );
    outerCap.name = 'rootbound-outer-moss-cap';
    outerCap.position.set(chamberMidX + 0.42, 2.48, CHAMBER_MID_Z);
    outerCap.scale.set(0.95, 0.36, 0.94);
    outerCap.castShadow = true;
    outerCap.receiveShadow = true;
    this.chamberGroup.add(outerCap);

    // Interior corner root columns (tucked cleanly into wall corners outside walkable center)
    const colGeo = s.track(new THREE.CylinderGeometry(0.16, 0.26, 2.95, 7));
    const corners: readonly [number, number][] = [
      [CHAMBER_WEST_X + 0.16, CHAMBER_MIN_Z + 0.20],
      [CHAMBER_WEST_X + 0.16, CHAMBER_MAX_Z - 0.20],
      [CHAMBER_EAST_X - 0.16, CHAMBER_MIN_Z + 0.20],
      [CHAMBER_EAST_X - 0.16, CHAMBER_MAX_Z - 0.20],
      [61.8, CHAMBER_MIN_Z + 0.14],
      [61.8, CHAMBER_MAX_Z - 0.14],
    ];
    const colBatch = s.track(new THREE.InstancedMesh(colGeo, rootBarkMat, corners.length));
    colBatch.name = 'rootbound-interior-root-columns';
    const dummy = new THREE.Object3D();
    for (const [i, [cx, cz]] of corners.entries()) {
      dummy.position.set(cx, ROOTBOUND_CHAMBER_FLOOR_Y + 1.47, cz);
      dummy.rotation.set(0, i * 0.8, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      colBatch.setMatrixAt(i, dummy.matrix);
    }
    colBatch.instanceMatrix.needsUpdate = true;
    colBatch.computeBoundingSphere();
    this.chamberGroup.add(colBatch);

    // Concentric bronze & slate floor mosaic rings inside the chamber
    const outerMosaic = new THREE.Mesh(
      s.track(new THREE.RingGeometry(1.75, 1.92, 24)),
      bronzeMat,
    );
    outerMosaic.rotation.x = -Math.PI / 2;
    outerMosaic.position.set(61.6, ROOTBOUND_CHAMBER_FLOOR_Y + 0.005, CHAMBER_MID_Z);
    const innerMosaic = new THREE.Mesh(
      s.track(new THREE.RingGeometry(0.95, 1.08, 24)),
      slateMat,
    );
    innerMosaic.rotation.x = -Math.PI / 2;
    innerMosaic.position.set(61.6, ROOTBOUND_CHAMBER_FLOOR_Y + 0.006, CHAMBER_MID_Z);
    this.chamberGroup.add(outerMosaic, innerMosaic);

    // Exterior mossy earthen mound slopes sculpted seamlessly around the chamber outer skin.
    // Every boulder is unrotated in XZ (or isotropic in XZ) with explicit inner clearance >= 0.12 m
    // from CHAMBER_MIN_Z (-91.45), CHAMBER_MAX_Z (-85.75), CHAMBER_EAST_X (65.15), and CHAMBER_WEST_X (58.4),
    // guaranteeing ZERO protrusion into the walkable chamber interior while hiding all flat inner wall seams!
    const boulderSpecs: readonly [number, number, number, number, number, number][] = [
      // Tunnel outer flanks (outside z = -90.05 .. -87.55)
      [56.2, 0.55, -91.35, 1.15, 2.15, 1.05],
      [57.5, 0.65, -91.50, 1.25, 2.30, 1.15],
      [56.6, 0.42, -86.45, 0.95, 1.65, 0.85],
      // West-north & west-south shoulders (x_max = 58.35 <= CHAMBER_WEST_X, outside tunnel z)
      [57.7, 0.85, -91.75, 0.65, 2.45, 1.05],
      [57.7, 0.68, -86.05, 0.65, 2.05, 0.95],
      // North flank continuous mossy hillside (z_max = bz + sz <= -91.55, reaching y ~ 3.2 m into cap)
      [59.6, 0.88, -92.55, 1.25, 2.55, 0.98],
      [61.5, 0.96, -92.65, 1.40, 2.65, 1.05],
      [63.4, 0.90, -92.55, 1.30, 2.55, 0.98],
      [64.9, 0.82, -92.35, 1.15, 2.40, 0.88],
      // East apse rounded mossy hillside (x_min = bx - sx >= 65.25)
      [66.20, 0.88, -90.75, 0.95, 2.45, 1.20],
      [66.35, 0.95, -88.60, 1.08, 2.65, 1.55],
      [66.15, 0.84, -86.45, 0.92, 2.40, 1.15],
      // South flank mossy hillside (z_min = bz - sz >= -85.65, clear of E root at [59.2, -84])
      [61.5, 0.80, -84.85, 1.35, 2.35, 0.78],
      [63.6, 0.82, -84.85, 1.30, 2.40, 0.80],
      [65.1, 0.76, -85.05, 1.05, 2.25, 0.70],
    ];
    const boulderGeo = s.track(new THREE.IcosahedronGeometry(1, 0));
    const boulders = s.track(new THREE.InstancedMesh(boulderGeo, darkMossMat, boulderSpecs.length));
    boulders.name = 'rootbound-exterior-mound-slopes';
    boulders.castShadow = true;
    boulders.receiveShadow = true;
    for (const [i, [bx, by, bz, sx, sy, sz]] of boulderSpecs.entries()) {
      dummy.position.set(bx, by, bz);
      // Zero Y rotation prevents anisotropic XZ radii from swinging inward across wall planes.
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      boulders.setMatrixAt(i, dummy.matrix);
    }
    boulders.instanceMatrix.needsUpdate = true;
    boulders.computeBoundingSphere();
    this.chamberGroup.add(boulders);

    // Exterior mossy ferns perched strictly ON TOP of outerCap (y_cap + 0.35 -> never pokes into vaultDome!)
    const ridgeFernGeo = s.track(new THREE.ConeGeometry(0.22, 0.72, 4));
    const ridgeFerns = s.track(new THREE.InstancedMesh(ridgeFernGeo, fernMat, 8));
    ridgeFerns.name = 'rootbound-mound-ferns';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const fx = chamberMidX + 0.42 + Math.cos(a) * 2.15;
      const fz = CHAMBER_MID_Z + Math.sin(a) * 2.0;
      const normR = Math.hypot((fx - (chamberMidX + 0.42)) / (4.25 * 0.95), (fz - CHAMBER_MID_Z) / (4.25 * 0.94));
      const capY = 2.48 + 4.25 * 0.36 * Math.sqrt(Math.max(0.05, 1 - normR * normR));
      dummy.position.set(fx, capY + 0.32, fz);
      dummy.rotation.set(0.22, a, 0.18);
      dummy.scale.set(1, 1, 0.35);
      dummy.updateMatrix();
      ridgeFerns.setMatrixAt(i, dummy.matrix);
    }
    ridgeFerns.instanceMatrix.needsUpdate = true;
    ridgeFerns.computeBoundingSphere();
    this.chamberGroup.add(ridgeFerns);
  }

  private buildBioluminescence(
    jadeGlowMat: THREE.Material,
    tealPoolTex: THREE.DataTexture,
  ): void {
    const s = this.scope;

    // 1. Clusters of glowing cyan-jade mushrooms tucked along walls, corners & roots
    const capSpots: readonly [number, number, number, number][] = [
      // Tunnel inner jambs
      [55.6, -0.20, PORTAL_Z - 1.16, 1.0],
      [56.8, -0.22, PORTAL_Z + 1.15, 0.85],
      [57.7, -0.28, PORTAL_Z - 1.16, 1.15],
      // Chamber base ledges (strictly outside central walking lane)
      [59.0, ROOTBOUND_CHAMBER_FLOOR_Y + 0.08, CHAMBER_MIN_Z + 0.22, 1.25],
      [60.8, ROOTBOUND_CHAMBER_FLOOR_Y + 0.06, CHAMBER_MIN_Z + 0.18, 1.05],
      [63.2, ROOTBOUND_CHAMBER_FLOOR_Y + 0.08, CHAMBER_MIN_Z + 0.20, 1.3],
      [64.8, ROOTBOUND_CHAMBER_FLOOR_Y + 0.10, CHAMBER_MID_Z - 1.85, 1.2],
      [64.8, ROOTBOUND_CHAMBER_FLOOR_Y + 0.10, CHAMBER_MID_Z + 1.85, 1.15],
      [62.6, ROOTBOUND_CHAMBER_FLOOR_Y + 0.07, CHAMBER_MAX_Z - 0.20, 1.25],
      [59.4, ROOTBOUND_CHAMBER_FLOOR_Y + 0.08, CHAMBER_MAX_Z - 0.22, 1.0],
      // Shelf fungi high up on corner root columns (above head height)
      [58.7, 1.95, CHAMBER_MIN_Z + 0.28, 1.1],
      [64.9, 2.05, CHAMBER_MIN_Z + 0.30, 1.15],
      [64.9, 2.00, CHAMBER_MAX_Z - 0.30, 1.1],
    ];

    const capGeo = s.track(new THREE.ConeGeometry(0.14, 0.09, 7));
    const stemGeo = s.track(new THREE.CylinderGeometry(0.024, 0.036, 0.18, 5));
    const stemMat = s.track(new THREE.MeshStandardMaterial({
      color: 0xa7efe2, emissive: 0x1d685c, emissiveIntensity: 0.45, roughness: 0.55,
    }));

    const totalCaps = capSpots.length * 3;
    const caps = s.track(new THREE.InstancedMesh(capGeo, this.myceliumGlowMat, totalCaps));
    const stems = s.track(new THREE.InstancedMesh(stemGeo, stemMat, totalCaps));
    caps.name = 'rootbound-bioluminescent-fungi';
    stems.name = 'rootbound-bioluminescent-stems';

    const dummy = new THREE.Object3D();
    let count = 0;
    for (const [i, [fx, fy, fz, scale]] of capSpots.entries()) {
      for (let k = 0; k < 3; k++) {
        const angle = i * 1.9 + k * 2.1;
        const spread = k === 0 ? 0 : 0.13 * scale;
        const subScale = scale * (k === 0 ? 1.05 : 0.65 + k * 0.12);
        const mx = fx + Math.cos(angle) * spread;
        const mz = fz + Math.sin(angle) * spread;
        const stemH = 0.16 * subScale;

        dummy.position.set(mx, fy + stemH * 0.5, mz);
        dummy.rotation.set(0.06 * (k - 1), angle, 0.05 * (1 - k));
        dummy.scale.set(subScale, subScale, subScale);
        dummy.updateMatrix();
        stems.setMatrixAt(count, dummy.matrix);

        dummy.position.set(mx, fy + stemH + 0.03 * subScale, mz);
        dummy.scale.set(subScale * 1.15, subScale, subScale * 1.15);
        dummy.updateMatrix();
        caps.setMatrixAt(count, dummy.matrix);
        count++;
      }
    }
    stems.instanceMatrix.needsUpdate = true;
    stems.computeBoundingSphere();
    caps.instanceMatrix.needsUpdate = true;
    caps.computeBoundingSphere();
    this.chamberGroup.add(stems, caps);

    // 2. Floor glowing mycelium veins and hanging luminous root filaments
    const veinGeo = s.track(new THREE.BoxGeometry(0.06, 0.012, 1.4));
    const veinSpecs: readonly [number, number, number, number][] = [
      [59.8, CHAMBER_MID_Z - 1.3, 0.35, 1.0],
      [61.6, CHAMBER_MID_Z + 1.5, -0.45, 1.1],
      [63.0, CHAMBER_MID_Z - 1.2, 0.72, 0.95],
      [60.2, CHAMBER_MID_Z + 0.4, 1.25, 0.85],
    ];
    const veins = s.track(new THREE.InstancedMesh(veinGeo, jadeGlowMat, veinSpecs.length));
    veins.name = 'rootbound-mycelium-veins';
    for (const [i, [vx, vz, yaw, len]] of veinSpecs.entries()) {
      dummy.position.set(vx, ROOTBOUND_CHAMBER_FLOOR_Y + 0.006, vz);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, len);
      dummy.updateMatrix();
      veins.setMatrixAt(i, dummy.matrix);
    }
    veins.instanceMatrix.needsUpdate = true;
    veins.computeBoundingSphere();
    this.chamberGroup.add(veins);

    // Delicate hanging glowing filaments along chamber outer upper rim (strictly above Y = 2.05)
    const tendrilGeo = s.track(new THREE.CylinderGeometry(0.015, 0.008, 0.48, 5));
    const tendrils = s.track(new THREE.InstancedMesh(tendrilGeo, jadeGlowMat, 8));
    tendrils.name = 'rootbound-hanging-mycelium';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rx = 61.8 + Math.cos(a) * 2.55;
      const rz = CHAMBER_MID_Z + Math.sin(a) * 2.15;
      dummy.position.set(rx, 2.32, rz);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(1, 0.8 + (i % 3) * 0.22, 1);
      dummy.updateMatrix();
      tendrils.setMatrixAt(i, dummy.matrix);
    }
    tendrils.instanceMatrix.needsUpdate = true;
    tendrils.computeBoundingSphere();
    this.chamberGroup.add(tendrils);

    // 3. Soft additive teal light pools on chamber floor (zero THREE.Light)
    const glowPoolMat = s.track(new THREE.MeshBasicMaterial({
      map: tealPoolTex, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const poolSpots: readonly [number, number, number][] = [
      [59.5, CHAMBER_MIN_Z + 0.65, 2.2],
      [63.0, CHAMBER_MIN_Z + 0.65, 2.4],
      [62.6, CHAMBER_MAX_Z - 0.65, 2.2],
      [61.6, CHAMBER_MID_Z, 3.0],
    ];
    const poolGeo = s.track(new THREE.PlaneGeometry(1, 1));
    for (const [px, pz, scale] of poolSpots) {
      const pool = new THREE.Mesh(poolGeo, glowPoolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.scale.set(scale, scale, 1);
      pool.position.set(px, ROOTBOUND_CHAMBER_FLOOR_Y + 0.01, pz);
      pool.renderOrder = 2;
      this.chamberGroup.add(pool);
    }
  }

  private buildRelicShrine(
    slateMat: THREE.Material,
    rootBarkMat: THREE.Material,
    bronzeMat: THREE.Material,
    jadeGlowMat: THREE.Material,
    tealPoolTex: THREE.DataTexture,
  ): void {
    const s = this.scope;
    const [rx, ry, rz] = ROOTBOUND_RELIC_POSITION;

    // Solid shrine pedestal collider
    this.collision.addBox([rx, ry + 0.68, rz], [0.65, 0.68, 0.65]);

    const plinthBase = new THREE.Mesh(
      s.track(new THREE.CylinderGeometry(0.62, 0.72, 0.24, 8)),
      slateMat,
    );
    plinthBase.name = 'rootbound-relic-plinth-base';
    plinthBase.position.set(rx, ry + 0.12, rz);
    plinthBase.receiveShadow = true;

    const plinthColumn = new THREE.Mesh(
      s.track(new THREE.CylinderGeometry(0.40, 0.52, 0.66, 8)),
      slateMat,
    );
    plinthColumn.name = 'rootbound-relic-plinth-column';
    plinthColumn.position.set(rx, ry + 0.57, rz);
    plinthColumn.castShadow = true;

    const collar = new THREE.Mesh(
      s.track(new THREE.CylinderGeometry(0.46, 0.44, 0.08, 12)),
      bronzeMat,
    );
    collar.position.set(rx, ry + 0.92, rz);
    this.relicGroup.add(plinthBase, plinthColumn, collar);

    // Four carved cradle roots gripping the pedestal and lifting toward the Seed-Stone
    const prongGeo = s.track(new THREE.ConeGeometry(0.08, 0.68, 5));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const prong = new THREE.Mesh(prongGeo, rootBarkMat);
      prong.position.set(rx + Math.cos(a) * 0.36, ry + 1.08, rz + Math.sin(a) * 0.36);
      prong.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28);
      this.relicGroup.add(prong);
    }

    // Soft teal shrine aura on the floor beneath the Relic
    this.relicAuraMat = s.track(new THREE.MeshBasicMaterial({
      map: tealPoolTex, transparent: true, opacity: 0.46,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const relicPool = new THREE.Mesh(s.track(new THREE.PlaneGeometry(3.2, 3.2)), this.relicAuraMat);
    relicPool.rotation.x = -Math.PI / 2;
    relicPool.position.set(rx, ry + 0.012, rz);
    relicPool.renderOrder = 2;
    this.relicGroup.add(relicPool);

    // Floating Heartwood Seed-Stone + counter-rotating astrolabe rings + raycast hit proxy
    this.interactionTarget.position.set(rx, RELIC_FLOAT_Y, rz);
    this.relicGroup.add(this.interactionTarget);

    const seedMat = s.track(new THREE.MeshStandardMaterial({
      color: 0xaefae6,
      emissive: 0x45e8c6,
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.25,
    }));
    this.seedCore = new THREE.Mesh(s.track(new THREE.OctahedronGeometry(0.28, 0)), seedMat);
    this.seedCore.name = 'rootbound-heartwood-seed';
    this.seedCore.scale.set(0.88, 1.32, 0.88);

    const innerSpark = new THREE.Mesh(s.track(new THREE.OctahedronGeometry(0.14, 0)), jadeGlowMat);
    this.seedCore.add(innerSpark);

    this.outerRing = new THREE.Mesh(
      s.track(new THREE.TorusGeometry(0.46, 0.025, 8, 24)),
      bronzeMat,
    );
    this.outerRing.name = 'rootbound-relic-outer-ring';
    this.outerRing.rotation.set(0.42, 0.35, 0);

    this.innerRing = new THREE.Mesh(
      s.track(new THREE.TorusGeometry(0.36, 0.018, 6, 20)),
      jadeGlowMat,
    );
    this.innerRing.name = 'rootbound-relic-inner-ring';
    this.innerRing.rotation.set(-0.55, 0.8, 0.25);

    const hitProxy = new THREE.Mesh(
      s.track(new THREE.CylinderGeometry(0.85, 0.85, 1.75, 10)),
      s.track(new THREE.MeshBasicMaterial()),
    );
    hitProxy.name = 'rootbound-relic-hit-proxy';
    hitProxy.position.y = -0.1;
    hitProxy.layers.set(INTERACTION_ONLY_LAYER);

    this.interactionTarget.add(this.seedCore, this.outerRing, this.innerRing, hitProxy);
  }

  getRelicControl(announce: (message: string) => void): ExhibitControl {
    return {
      object: this.interactionTarget,
      label: () => (this.discovered
        ? 'Rootbound Relic (discovered)'
        : 'Examine Rootbound Relic'),
      description: 'An ancient heartwood seed-stone humming beneath the Great Tree roots.',
      activate: () => {
        this.discovered = true;
        this.relicAuraMat.opacity = 0.72;
        announce(
          'Rootbound Hollow: an ancient heartwood seed-stone cradles the island’s oldest roots beneath the Great Tree vault.',
        );
      },
    };
  }

  update(dt: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      this.seedCore.position.y = 0;
      this.seedCore.rotation.y = 0;
      this.outerRing.rotation.set(0.42, 0.35, 0);
      this.innerRing.rotation.set(-0.55, 0.8, 0.25);
      this.myceliumGlowMat.emissiveIntensity = 1.05;
      return;
    }

    this.animTime += Math.min(dt, 0.1);
    this.seedCore.position.y = Math.sin(this.animTime * 1.45) * 0.045;
    this.seedCore.rotation.y = (this.animTime * 0.42) % (Math.PI * 2);
    this.outerRing.rotation.y = 0.35 + this.animTime * 0.36;
    this.innerRing.rotation.y = 0.8 - this.animTime * 0.54;
    this.myceliumGlowMat.emissiveIntensity = 0.95 + Math.sin(this.animTime * 1.7) * 0.22;
  }
}

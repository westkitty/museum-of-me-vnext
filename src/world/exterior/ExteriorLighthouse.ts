import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { CollisionWorld } from '../CollisionWorld';
import type { ExhibitControl } from '../../exhibits/contract';
import { INTERACTION_ONLY_LAYER } from '../../interaction/InteractionManager';
import {
  LAND_SUPPORT_Y,
  LIGHTHOUSE_APPROACH_PATH,
  LIGHTHOUSE_PENINSULA_CENTER,
} from './IslandSiteLayout';

export const LIGHTHOUSE_LENS_ID = 'lighthouse-lens-l01';
export const LIGHTHOUSE_TERRACE_Y = 1.5;
export const LIGHTHOUSE_GALLERY_Y = 11.5;

const RAMP_MIN_X = LIGHTHOUSE_PENINSULA_CENTER[0] - 28; // 148
const RAMP_MAX_X = LIGHTHOUSE_PENINSULA_CENTER[0] - 14; // 162
const RAMP_HALF_W = 3.5;

const TERRACE_HALF = 14; // 162..190 x 138..166
const CORE_HALF = 2.2;
const SHAFT_HALF = 4.2;
const GALLERY_HALF = 7.2;

/**
 * ISLAND-02A: Southeast coastal headland, approach trail, climbable stone
 * lighthouse, stormy overlook gallery, and Fresnel lens anchor reserved for
 * future bonus world L01 (The Lighthouse at World's End).
 *
 * Uses zero THREE.Light objects (exterior light invariance) and shares the
 * single authoritative Loop via ExteriorWorld.variableUpdate.
 */
export class ExteriorLighthouse {
  readonly group = new THREE.Group();
  private readonly lensTurret = new THREE.Group();
  private readonly lensAnchor = new THREE.Group();
  private readonly interactionTarget: THREE.Group;
  private inspected = false;
  private beamAngle = 0.72;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
  ) {
    this.group.name = 'lighthouse-peninsula';
    this.group.userData.visualRole = 'coastal-lighthouse-headland';

    this.interactionTarget = new THREE.Group();
    this.interactionTarget.name = 'lighthouse-lens-l01-optics';

    this.build();
  }

  private build(): void {
    const [tx, , tz] = LIGHTHOUSE_PENINSULA_CENTER;
    const s = this.scope;

    const basaltMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x263138, roughness: 0.94, metalness: 0.04, flatShading: true,
    }));
    const slateMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x38454f, roughness: 0.86, metalness: 0.08,
      emissive: 0x101820, emissiveIntensity: 0.16,
    }));
    const stoneMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x8f948c, roughness: 0.86, metalness: 0.03,
      emissive: 0x1a222b, emissiveIntensity: 0.24,
    }));
    const creamMat = s.track(new THREE.MeshStandardMaterial({
      color: 0xd9d4c4, roughness: 0.78, metalness: 0.02,
      emissive: 0x1a1e24, emissiveIntensity: 0.18,
    }));
    const treadMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x6f746d, roughness: 0.82, metalness: 0.05,
      emissive: 0x181f27, emissiveIntensity: 0.26,
    }));
    const trailMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x998e77, roughness: 0.92, metalness: 0.02,
    }));
    const brassMat = s.track(new THREE.MeshStandardMaterial({
      color: 0xc9a14e, roughness: 0.34, metalness: 0.82,
      emissive: 0x2b1d08, emissiveIntensity: 0.18,
    }));
    const ironMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x1f262d, roughness: 0.54, metalness: 0.65,
    }));
    const copperMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x357467, roughness: 0.52, metalness: 0.45,
      emissive: 0x0b221e, emissiveIntensity: 0.18,
    }));
    const glassMat = s.track(new THREE.MeshStandardMaterial({
      color: 0xaad6ec, roughness: 0.14, metalness: 0.12,
      transparent: true, opacity: 0.28, depthWrite: false,
    }));
    const lensGlassMat = s.track(new THREE.MeshStandardMaterial({
      color: 0xfff3d0, emissive: 0xffc970, emissiveIntensity: 0.9,
      roughness: 0.14, metalness: 0.18, transparent: true, opacity: 0.9,
    }));
    const amberGlowMat = s.track(new THREE.MeshBasicMaterial({
      color: 0xffca7a, toneMapped: false,
    }));
    const coreGlowMat = s.track(new THREE.MeshBasicMaterial({
      color: 0xfff0be, toneMapped: false,
    }));
    const beamTexData = new Uint8Array(64 * 4);
    for (let i = 0; i < 64; i++) {
      const t = i / 63; // 0 = wide open cone mouth (far), 1 = Fresnel lens tip
      const fade = Math.pow(t, 2.0) * (1 - Math.pow(Math.max(0, t - 0.92) / 0.08, 2));
      const a = Math.max(0, Math.min(255, Math.round(fade * 255)));
      const o = i * 4;
      beamTexData[o] = 255;
      beamTexData[o + 1] = 228;
      beamTexData[o + 2] = 168;
      beamTexData[o + 3] = a;
    }
    const beamMap = s.track(new THREE.DataTexture(beamTexData, 1, 64, THREE.RGBAFormat));
    beamMap.needsUpdate = true;
    const beamMat = s.track(new THREE.MeshBasicMaterial({
      color: 0xffffff, map: beamMap, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false,
    }));

    this.buildApproachTrail(trailMat, slateMat, amberGlowMat);
    this.buildHeadlandAndRamp(tx, tz, basaltMat, slateMat, treadMat, amberGlowMat);
    this.buildTowerAndStairs(tx, tz, slateMat, stoneMat, creamMat, treadMat, ironMat, amberGlowMat);
    this.buildGalleryAndLantern(
      tx, tz, slateMat, stoneMat, ironMat, copperMat, brassMat,
      glassMat, lensGlassMat, coreGlowMat, beamMat,
    );
  }

  private buildApproachTrail(
    trailMat: THREE.Material,
    postMat: THREE.Material,
    amberMat: THREE.Material,
  ): void {
    const s = this.scope;
    const curve = new THREE.CatmullRomCurve3(
      LIGHTHOUSE_APPROACH_PATH.map(([x, z]) => new THREE.Vector3(x, -0.463, z)),
      false,
      'centripetal',
    );
    const samples = curve.getPoints(72);
    const positions: number[] = [];
    const indices: number[] = [];
    const halfWidth = 2.1;
    for (let i = 0; i < samples.length; i++) {
      const tangent = curve.getTangent(i / (samples.length - 1));
      const nx = tangent.z;
      const nz = -tangent.x;
      positions.push(samples[i].x - nx * halfWidth, -0.463, samples[i].z - nz * halfWidth);
      positions.push(samples[i].x + nx * halfWidth, -0.463, samples[i].z + nz * halfWidth);
      if (i < samples.length - 1) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = s.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const trail = new THREE.Mesh(geo, trailMat);
    trail.name = 'lighthouse-approach-trail';
    trail.receiveShadow = true;
    this.group.add(trail);

    // Warm low cairn bollards along the trail margin (outside the walking corridor).
    const count = 8;
    const postGeo = s.track(new THREE.CylinderGeometry(0.16, 0.24, 0.72, 7));
    const capGeo = s.track(new THREE.SphereGeometry(0.14, 8, 6));
    const posts = s.track(new THREE.InstancedMesh(postGeo, postMat, count));
    const caps = s.track(new THREE.InstancedMesh(capGeo, amberMat, count));
    posts.name = 'lighthouse-trail-cairns';
    caps.name = 'lighthouse-trail-lanterns';
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const u = curve.getUtoTmapping((i + 0.4) / (count + 0.2), 0);
      const p = curve.getPoint(u);
      const t = curve.getTangent(u);
      const side = i % 2 === 0 ? 1 : -1;
      const x = p.x + t.z * 2.75 * side;
      const z = p.z - t.x * 2.75 * side;
      dummy.position.set(x, LAND_SUPPORT_Y + 0.36, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
      dummy.position.y = LAND_SUPPORT_Y + 0.78;
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
    }
    posts.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    this.group.add(posts, caps);
  }

  private buildHeadlandAndRamp(
    tx: number,
    tz: number,
    basaltMat: THREE.Material,
    slateMat: THREE.Material,
    treadMat: THREE.Material,
    amberMat: THREE.Material,
  ): void {
    const s = this.scope;
    const rampLen = RAMP_MAX_X - RAMP_MIN_X; // 14
    const rampMidX = (RAMP_MIN_X + RAMP_MAX_X) / 2; // 155
    const rise = LIGHTHOUSE_TERRACE_Y - LAND_SUPPORT_Y; // 2.0
    const slopeLen = Math.hypot(rampLen, rise);
    const slopeAngle = Math.atan2(rise, rampLen);

    // Walkable causeway ramp from island ground (-0.5) to headland terrace (+1.5).
    this.collision.add({
      kind: 'ramp',
      minX: RAMP_MIN_X,
      maxX: RAMP_MAX_X,
      minZ: tz - RAMP_HALF_W,
      maxZ: tz + RAMP_HALF_W,
      axis: 'x',
      yAtMin: LAND_SUPPORT_Y,
      yAtMax: LIGHTHOUSE_TERRACE_Y,
    });

    const rampMesh = new THREE.Mesh(
      s.track(new THREE.BoxGeometry(slopeLen, 0.4, RAMP_HALF_W * 2)),
      treadMat,
    );
    rampMesh.name = 'lighthouse-headland-ramp';
    rampMesh.position.set(rampMidX, (LAND_SUPPORT_Y + LIGHTHOUSE_TERRACE_Y) / 2 - 0.2, tz);
    rampMesh.rotation.z = slopeAngle;
    rampMesh.receiveShadow = true;
    this.group.add(rampMesh);

    // Solid stone apron underneath the ramp so there is no gap beneath the slope.
    const underRamp = new THREE.Mesh(
      s.track(new THREE.BoxGeometry(rampLen, 2.2, RAMP_HALF_W * 2 + 0.8)),
      basaltMat,
    );
    underRamp.position.set(rampMidX, -0.55, tz);
    this.group.add(underRamp);

    // Stepped stone treads along the headland ramp for crisp footing cues.
    const rampSteps = 12;
    const stepGeo = s.track(new THREE.BoxGeometry(0.9, 0.1, RAMP_HALF_W * 2 - 0.4));
    const stepBatch = s.track(new THREE.InstancedMesh(stepGeo, slateMat, rampSteps));
    stepBatch.name = 'lighthouse-ramp-treads';
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rampSteps; i++) {
      const f = (i + 0.5) / rampSteps;
      dummy.position.set(RAMP_MIN_X + rampLen * f, LAND_SUPPORT_Y + rise * f - 0.02, tz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stepBatch.setMatrixAt(i, dummy.matrix);
    }
    stepBatch.instanceMatrix.needsUpdate = true;
    this.group.add(stepBatch);

    // Ramp curb walls + glowing entrance pylons.
    for (const side of [-1, 1]) {
      const curbZ = tz + side * (RAMP_HALF_W + 0.4);
      this.collision.addBox([rampMidX, 1.15, curbZ], [rampLen / 2, 1.65, 0.4]);
      const curb = new THREE.Mesh(
        s.track(new THREE.BoxGeometry(rampLen, 1.35, 0.72)),
        slateMat,
      );
      curb.position.set(rampMidX, 0.65, curbZ);
      curb.rotation.z = slopeAngle * 0.65;
      this.group.add(curb);

      for (const [px, py] of [[RAMP_MIN_X + 0.4, LAND_SUPPORT_Y], [RAMP_MAX_X - 0.4, LIGHTHOUSE_TERRACE_Y]] as const) {
        const pylon = new THREE.Mesh(s.track(new THREE.BoxGeometry(0.65, 1.3, 0.65)), slateMat);
        pylon.position.set(px, py + 0.65, curbZ);
        const cap = new THREE.Mesh(s.track(new THREE.SphereGeometry(0.18, 10, 8)), amberMat);
        cap.position.set(px, py + 1.42, curbZ);
        this.group.add(pylon, cap);
      }
    }

    // Headland crown terrace floor (Y = 1.5).
    const minX = tx - TERRACE_HALF; // 162
    const maxX = tx + TERRACE_HALF; // 190
    const minZ = tz - TERRACE_HALF; // 138
    const maxZ = tz + TERRACE_HALF; // 166
    this.collision.addFloor(minX, maxX, minZ, maxZ, LIGHTHOUSE_TERRACE_Y);

    const terraceDeck = new THREE.Mesh(
      s.track(new THREE.BoxGeometry(TERRACE_HALF * 2, 2.2, TERRACE_HALF * 2)),
      slateMat,
    );
    terraceDeck.name = 'lighthouse-headland-terrace';
    terraceDeck.position.set(tx, LIGHTHOUSE_TERRACE_Y - 1.1, tz);
    terraceDeck.receiveShadow = true;
    this.group.add(terraceDeck);

    // Cliff-edge stone parapets keeping visitors safe above the basalt crags.
    const addParapet = (cx: number, cz: number, sx: number, sz: number) => {
      this.collision.addBox([cx, 1.12, cz], [sx / 2, 1.62, sz / 2]);
      const mesh = new THREE.Mesh(
        s.track(new THREE.BoxGeometry(sx, 1.08, sz)),
        slateMat,
      );
      mesh.position.set(cx, LIGHTHOUSE_TERRACE_Y + 0.54, cz);
      this.group.add(mesh);
    };
    const sideSpan = TERRACE_HALF - RAMP_HALF_W; // 10.5
    addParapet(minX - 0.3, tz - RAMP_HALF_W - sideSpan / 2, 0.75, sideSpan);
    addParapet(minX - 0.3, tz + RAMP_HALF_W + sideSpan / 2, 0.75, sideSpan);
    addParapet(tx, minZ - 0.3, TERRACE_HALF * 2 + 0.8, 0.75);
    addParapet(maxX + 0.3, tz, 0.75, TERRACE_HALF * 2 + 0.8);
    addParapet(tx, maxZ + 0.3, TERRACE_HALF * 2 + 0.8, 0.75);

    // Sculpted coastal basalt crags around the headland cliff and offshore sea-stacks.
    const crags: { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const cos = Math.cos(a), sin = Math.sin(a);
      // Leave the west ramp mouth clear.
      if (cos < -0.55 && Math.abs(sin) < 0.42) continue;
      const edgeR = 14.5 + (i % 3) * 1.4;
      const x = tx + cos * edgeR;
      const z = tz + sin * edgeR;
      const h = 1.6 + (i % 4) * 0.45;
      crags.push({ x, y: LAND_SUPPORT_Y + h * 0.42, z, sx: 2.8 + (i % 3) * 0.8, sy: h, sz: 2.6 + ((i + 1) % 3) * 0.7, yaw: a });
    }
    const seaStacks: readonly [number, number, number, number][] = [
      [tx + 38, tz - 12, 3.6, 3.2],
      [tx + 36, tz + 14, 4.4, 2.8],
      [tx + 18, tz + 36, 3.2, 2.6],
      [tx - 4, tz + 34, 2.7, 2.1],
    ];
    for (const [sx, sz, w, h] of seaStacks) {
      crags.push({ x: sx, y: LAND_SUPPORT_Y + h * 0.32 - 0.4, z: sz, sx: w, sy: h, sz: w * 0.86, yaw: sx * 0.3 });
    }
    const cragGeo = s.track(new THREE.DodecahedronGeometry(1, 0));
    const cragBatch = s.track(new THREE.InstancedMesh(cragGeo, basaltMat, crags.length));
    cragBatch.name = 'lighthouse-coastal-crags';
    for (const [i, c] of crags.entries()) {
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(0.08 * (i % 3), c.yaw, 0);
      dummy.scale.set(c.sx, c.sy, c.sz);
      dummy.updateMatrix();
      cragBatch.setMatrixAt(i, dummy.matrix);
    }
    cragBatch.instanceMatrix.needsUpdate = true;
    this.group.add(cragBatch);
  }

  private buildTowerAndStairs(
    tx: number,
    tz: number,
    slateMat: THREE.Material,
    stoneMat: THREE.Material,
    creamMat: THREE.Material,
    treadMat: THREE.Material,
    ironMat: THREE.Material,
    amberMat: THREE.Material,
  ): void {
    const s = this.scope;
    const towerGroup = new THREE.Group();
    towerGroup.name = 'lighthouse-peninsula-tower';
    this.group.add(towerGroup);

    // Outer tapered coastal lighthouse drum (Y = 1.5 .. 11.5), built as open-ended
    // banded rings (DoubleSide) so no internal cylinder caps occlude the stairwell.
    // The lowest ring opens along theta [4.90 .. 5.44] for the West-SW arched doorway.
    const band = (
      name: string,
      rTop: number,
      rBottom: number,
      height: number,
      yCenter: number,
      mat: THREE.Material,
      thetaStart = 0,
      thetaLength = Math.PI * 2,
    ) => {
      const geo = s.track(new THREE.CylinderGeometry(
        rTop, rBottom, height, 16, 1, true, thetaStart, thetaLength,
      ));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      mesh.position.set(tx, yCenter, tz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      towerGroup.add(mesh);
    };

    const doubleSided = (mat: THREE.Material) => {
      const cloned = s.track((mat as THREE.MeshStandardMaterial).clone());
      cloned.side = THREE.DoubleSide;
      return cloned;
    };

    const doorStart = 4.92;
    const doorEnd = 5.42;
    const baseOuterMat = doubleSided(slateMat);
    const creamDoubleMat = doubleSided(creamMat);
    const slateDoubleMat = doubleSided(slateMat);
    band(
      'lighthouse-tower-base-ring',
      6.98,
      7.25,
      3.15,
      LIGHTHOUSE_TERRACE_Y + 1.575,
      baseOuterMat,
      doorEnd,
      Math.PI * 2 - (doorEnd - doorStart),
    );
    // Solid upper masonry stripes (Y = 4.65 .. 11.12); min apothem 6.43 > 6.14 shaft corner.
    band('lighthouse-tower-band-cream-1', 6.78, 6.98, 2.45, 5.875, creamDoubleMat);
    band('lighthouse-tower-band-slate-2', 6.64, 6.78, 2.0, 8.10, slateDoubleMat);
    band('lighthouse-tower-band-cream-2', 6.56, 6.64, 2.02, 10.11, creamDoubleMat);
    // Flared corbel ring supporting the Y = 11.5 gallery deck.
    band('lighthouse-tower-corbel-ring', 7.55, 6.55, 0.38, 11.31, slateDoubleMat);

    // Exterior oriented cylinder-perimeter wall colliders (r = 6.85) so visitors
    // on the terrace cannot clip through the curved outer drum between walls.
    // Segment k=10 (300 deg) sits over the doorway and is active only above Y=4.65.
    const drumRadius = 6.85;
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * Math.PI * 2;
      const cx = tx + Math.sin(angle) * drumRadius;
      const cz = tz + Math.cos(angle) * drumRadius;
      const minY = k === 10 ? 4.65 : LIGHTHOUSE_TERRACE_Y;
      const maxY = LIGHTHOUSE_GALLERY_Y;
      this.collision.add({
        kind: 'wall',
        minX: cx - 2.2,
        maxX: cx + 2.2,
        minY,
        maxY,
        minZ: cz - 2.2,
        maxZ: cz + 2.2,
        oriented: {
          centerX: cx,
          centerZ: cz,
          halfX: 1.76,
          halfZ: 0.42,
          yaw: angle,
        },
      });
    }

    // Framed stone entrance porch on West-SW doorway (dx = -7.1..-4.2, dz = +2.2..+4.2).
    const porchCenterZ = tz + 3.2;
    const jambGeo = s.track(new THREE.BoxGeometry(2.95, 3.1, 0.42));
    for (const offset of [-1.25, 1.25]) {
      const jamb = new THREE.Mesh(jambGeo, stoneMat);
      jamb.position.set(tx - 5.75, LIGHTHOUSE_TERRACE_Y + 1.55, porchCenterZ + offset);
      towerGroup.add(jamb);
    }
    const lintel = new THREE.Mesh(s.track(new THREE.BoxGeometry(3.05, 0.55, 2.95)), slateMat);
    lintel.position.set(tx - 5.75, LIGHTHOUSE_TERRACE_Y + 3.32, porchCenterZ);
    const porchLantern = new THREE.Mesh(s.track(new THREE.SphereGeometry(0.18, 10, 8)), amberMat);
    porchLantern.position.set(tx - 7.1, LIGHTHOUSE_TERRACE_Y + 3.25, porchCenterZ);
    towerGroup.add(lintel, porchLantern);

    // Central stairwell masonry pillar (dx, dz in [-2.2, +2.2], Y = 1.5 .. 11.5).
    this.collision.addBox([tx, 6.5, tz], [CORE_HALF, 5.0, CORE_HALF]);
    const core = new THREE.Mesh(
      s.track(new THREE.BoxGeometry(CORE_HALF * 2, 10.0, CORE_HALF * 2)),
      stoneMat,
    );
    core.name = 'lighthouse-stairwell-core';
    core.position.set(tx, 6.5, tz);
    towerGroup.add(core);

    // Interior stairwell shaft walls enclosing [-4.2, +4.2]; thin wallT = 0.14
    // keeps square corners (r = 6.14 m) cleanly inside the 6.25 m outer drum.
    const addShaftWall = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number) => {
      this.collision.addBox([cx, cy, cz], [hx, hy, hz]);
      const wall = new THREE.Mesh(s.track(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2)), stoneMat);
      wall.position.set(cx, cy, cz);
      towerGroup.add(wall);
    };
    const wallT = 0.14;
    addShaftWall(tx, 6.5, tz - SHAFT_HALF - wallT, SHAFT_HALF + wallT * 2, 5.0, wallT);
    addShaftWall(tx + SHAFT_HALF + wallT, 6.5, tz, wallT, 5.0, SHAFT_HALF + wallT * 2);
    addShaftWall(tx, 6.5, tz + SHAFT_HALF + wallT, SHAFT_HALF + wallT * 2, 5.0, wallT);
    // West shaft wall: solid north of doorway (dz <= +2.2) and solid above doorway (Y >= 4.65).
    addShaftWall(tx - SHAFT_HALF - wallT, 6.5, tz - 1.0, wallT, 5.0, 3.2);
    addShaftWall(tx - SHAFT_HALF - wallT, 8.075, tz + 3.2, wallT, 3.425, 1.0);

    // Eight clockwise stair flights + corner landings from Y = 1.5 to Y = 11.5.
    // All flights sit inside [±2.2..±4.2] (2.0 m wide corridors, 4.4 m flight run, 1.25 m rise).
    const landings: readonly { x0: number; x1: number; z0: number; z1: number; y: number }[] = [
      { x0: -SHAFT_HALF, x1: -CORE_HALF, z0: CORE_HALF, z1: SHAFT_HALF, y: 1.5 },   // L0 SW
      { x0: -SHAFT_HALF, x1: -CORE_HALF, z0: -SHAFT_HALF, z1: -CORE_HALF, y: 2.75 }, // L1 NW
      { x0: CORE_HALF, x1: SHAFT_HALF, z0: -SHAFT_HALF, z1: -CORE_HALF, y: 4.0 },   // L2 NE
      { x0: CORE_HALF, x1: SHAFT_HALF, z0: CORE_HALF, z1: SHAFT_HALF, y: 5.25 },     // L3 SE
      { x0: -SHAFT_HALF, x1: -CORE_HALF, z0: CORE_HALF, z1: SHAFT_HALF, y: 6.5 },   // L4 SW
      { x0: -SHAFT_HALF, x1: -CORE_HALF, z0: -SHAFT_HALF, z1: -CORE_HALF, y: 7.75 }, // L5 NW
      { x0: CORE_HALF, x1: SHAFT_HALF, z0: -SHAFT_HALF, z1: -CORE_HALF, y: 9.0 },   // L6 NE
      { x0: CORE_HALF, x1: SHAFT_HALF, z0: CORE_HALF, z1: SHAFT_HALF, y: 10.25 },    // L7 SE
    ];
    for (const [i, l] of landings.entries()) {
      this.collision.addFloor(tx + l.x0, tx + l.x1, tz + l.z0, tz + l.z1, l.y);
      if (i > 0) { // L0 sits directly on the solid terrace deck (Y = 1.5).
        const plate = new THREE.Mesh(
          s.track(new THREE.BoxGeometry(l.x1 - l.x0, 0.22, l.z1 - l.z0)),
          treadMat,
        );
        plate.position.set(tx + (l.x0 + l.x1) / 2, l.y - 0.11, tz + (l.z0 + l.z1) / 2);
        towerGroup.add(plate);
      }
    }

    const flights: readonly {
      x0: number; x1: number; z0: number; z1: number;
      axis: 'x' | 'z'; yAtMin: number; yAtMax: number;
    }[] = [
      { x0: -SHAFT_HALF, x1: -CORE_HALF, z0: -CORE_HALF, z1: CORE_HALF, axis: 'z', yAtMin: 2.75, yAtMax: 1.5 },
      { x0: -CORE_HALF, x1: CORE_HALF, z0: -SHAFT_HALF, z1: -CORE_HALF, axis: 'x', yAtMin: 2.75, yAtMax: 4.0 },
      { x0: CORE_HALF, x1: SHAFT_HALF, z0: -CORE_HALF, z1: CORE_HALF, axis: 'z', yAtMin: 4.0, yAtMax: 5.25 },
      { x0: -CORE_HALF, x1: CORE_HALF, z0: CORE_HALF, z1: SHAFT_HALF, axis: 'x', yAtMin: 6.5, yAtMax: 5.25 },
      { x0: -SHAFT_HALF, x1: -CORE_HALF, z0: -CORE_HALF, z1: CORE_HALF, axis: 'z', yAtMin: 7.75, yAtMax: 6.5 },
      { x0: -CORE_HALF, x1: CORE_HALF, z0: -SHAFT_HALF, z1: -CORE_HALF, axis: 'x', yAtMin: 7.75, yAtMax: 9.0 },
      { x0: CORE_HALF, x1: SHAFT_HALF, z0: -CORE_HALF, z1: CORE_HALF, axis: 'z', yAtMin: 9.0, yAtMax: 10.25 },
      { x0: -CORE_HALF, x1: CORE_HALF, z0: CORE_HALF, z1: SHAFT_HALF, axis: 'x', yAtMin: 11.5, yAtMax: 10.25 },
    ];

    const stepsPerFlight = 8;
    const stepGeo = s.track(new THREE.BoxGeometry(1, 1, 1));
    const treads = s.track(new THREE.InstancedMesh(stepGeo, treadMat, flights.length * stepsPerFlight));
    treads.name = 'lighthouse-stair-treads';
    const dummy = new THREE.Object3D();
    let treadIndex = 0;

    for (const f of flights) {
      this.collision.add({
        kind: 'ramp',
        minX: tx + f.x0,
        maxX: tx + f.x1,
        minZ: tz + f.z0,
        maxZ: tz + f.z1,
        axis: f.axis,
        yAtMin: f.yAtMin,
        yAtMax: f.yAtMax,
      });

      // Sloped structural stringer slab beneath the steps.
      const dx = f.x1 - f.x0;
      const dz = f.z1 - f.z0;
      const run = f.axis === 'x' ? dx : dz;
      const width = f.axis === 'x' ? dz : dx;
      const rise = f.yAtMax - f.yAtMin;
      const slopeLen = Math.hypot(run, rise);
      const stringer = new THREE.Mesh(
        s.track(new THREE.BoxGeometry(
          f.axis === 'x' ? slopeLen : width,
          0.22,
          f.axis === 'x' ? width : slopeLen,
        )),
        slateMat,
      );
      stringer.position.set(
        tx + (f.x0 + f.x1) / 2,
        (f.yAtMin + f.yAtMax) / 2 - 0.14,
        tz + (f.z0 + f.z1) / 2,
      );
      if (f.axis === 'x') stringer.rotation.z = Math.atan2(rise, run);
      else stringer.rotation.x = -Math.atan2(rise, run);
      towerGroup.add(stringer);

      // Visual masonry stair treads flush with the collision ramp plane.
      const stepRun = run / stepsPerFlight;
      for (let k = 0; k < stepsPerFlight; k++) {
        const t = (k + 0.5) / stepsPerFlight;
        const stepY = f.yAtMin + rise * t - 0.08;
        const cx = f.axis === 'x' ? tx + f.x0 + run * t : tx + (f.x0 + f.x1) / 2;
        const cz = f.axis === 'z' ? tz + f.z0 + run * t : tz + (f.z0 + f.z1) / 2;
        dummy.position.set(cx, stepY, cz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(
          f.axis === 'x' ? stepRun + 0.04 : width - 0.06,
          0.16,
          f.axis === 'z' ? stepRun + 0.04 : width - 0.06,
        );
        dummy.updateMatrix();
        treads.setMatrixAt(treadIndex++, dummy.matrix);
      }
    }
    treads.instanceMatrix.needsUpdate = true;
    towerGroup.add(treads);

    // Warm glowing stairwell sconces along the central core at each landing level.
    const sconceGeo = s.track(new THREE.BoxGeometry(0.18, 0.28, 0.18));
    const sconcePositions: readonly [number, number, number][] = [
      [-CORE_HALF - 0.1, 3.6, -3.2],
      [3.2, 4.9, -CORE_HALF - 0.1],
      [CORE_HALF + 0.1, 6.2, 3.2],
      [-3.2, 7.4, CORE_HALF + 0.1],
      [-CORE_HALF - 0.1, 8.6, -3.2],
      [3.2, 9.9, -CORE_HALF - 0.1],
      [CORE_HALF + 0.1, 11.1, 3.2],
    ];
    const sconces = s.track(new THREE.InstancedMesh(sconceGeo, amberMat, sconcePositions.length));
    sconces.name = 'lighthouse-stairwell-sconces';
    for (const [i, [sx, sy, sz]] of sconcePositions.entries()) {
      dummy.position.set(tx + sx, sy, tz + sz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sconces.setMatrixAt(i, dummy.matrix);
    }
    sconces.instanceMatrix.needsUpdate = true;
    towerGroup.add(sconces);

    // Decorative exterior slit windows on upper bands for lighthouse character.
    const slitGeo = s.track(new THREE.BoxGeometry(0.28, 1.1, 0.18));
    const slits = s.track(new THREE.InstancedMesh(slitGeo, amberMat, 6));
    slits.name = 'lighthouse-exterior-slit-windows';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 2 + 0.3;
      const y = 5.4 + i * 0.9;
      const r = 6.32;
      dummy.position.set(tx + Math.sin(a) * r, y, tz + Math.cos(a) * r);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      slits.setMatrixAt(i, dummy.matrix);
    }
    slits.instanceMatrix.needsUpdate = true;
    towerGroup.add(slits);

    // Subtle wrought-iron handrail bars on the central core walls.
    const railGeo = s.track(new THREE.BoxGeometry(CORE_HALF * 2 + 0.12, 0.08, CORE_HALF * 2 + 0.12));
    for (const ry of [3.5, 6.0, 8.5]) {
      const bandRail = new THREE.Mesh(railGeo, ironMat);
      bandRail.position.set(tx, ry, tz);
      towerGroup.add(bandRail);
    }
  }

  private buildGalleryAndLantern(
    tx: number,
    tz: number,
    slateMat: THREE.Material,
    stoneMat: THREE.Material,
    ironMat: THREE.Material,
    copperMat: THREE.Material,
    brassMat: THREE.Material,
    glassMat: THREE.Material,
    lensGlassMat: THREE.Material,
    coreGlowMat: THREE.Material,
    beamMat: THREE.Material,
  ): void {
    const s = this.scope;
    const gy = LIGHTHOUSE_GALLERY_Y; // 11.5

    // 5 non-overlapping walkable floor rectangles at Y = 11.5 covering the entire
    // 14.4 m x 14.4 m gallery + Lantern Room, leaving East+SE+South stairhead
    // (dx in [+2.2,+4.2], dz in [-2.2,+4.2] and dx in [-2.2,+4.2], dz in [+2.2,+4.2])
    // open to the sky for unobstructed stair climb headroom!
    const deckPanels: readonly { x0: number; x1: number; z0: number; z1: number; name: string }[] = [
      { x0: -GALLERY_HALF, x1: -CORE_HALF, z0: -GALLERY_HALF, z1: GALLERY_HALF, name: 'gallery-deck-west' },
      { x0: -CORE_HALF, x1: GALLERY_HALF, z0: -GALLERY_HALF, z1: -CORE_HALF, name: 'gallery-deck-north' },
      { x0: -CORE_HALF, x1: CORE_HALF, z0: -CORE_HALF, z1: CORE_HALF, name: 'lantern-room-floor' },
      { x0: SHAFT_HALF, x1: GALLERY_HALF, z0: -CORE_HALF, z1: GALLERY_HALF, name: 'gallery-deck-east' },
      { x0: -CORE_HALF, x1: SHAFT_HALF, z0: SHAFT_HALF, z1: GALLERY_HALF, name: 'gallery-deck-south' },
    ];
    for (const p of deckPanels) {
      this.collision.addFloor(tx + p.x0, tx + p.x1, tz + p.z0, tz + p.z1, gy);
      const slab = new THREE.Mesh(
        s.track(new THREE.BoxGeometry(p.x1 - p.x0, 0.18, p.z1 - p.z0)),
        slateMat,
      );
      slab.name = p.name;
      slab.position.set(tx + (p.x0 + p.x1) / 2, gy - 0.09, tz + (p.z0 + p.z1) / 2);
      slab.receiveShadow = true;
      this.group.add(slab);
    }

    // Outer gallery safety balustrades (solid collision 1.2 m high + wrought-iron rail visuals).
    const addRail = (cx: number, cz: number, sx: number, sz: number, name: string) => {
      this.collision.addBox([cx, gy + 0.65, cz], [sx / 2, 0.75, sz / 2]);
      const curb = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx, 0.24, sz)), stoneMat);
      curb.position.set(cx, gy + 0.12, cz);
      const topRail = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx, 0.08, sz)), ironMat);
      topRail.name = name;
      topRail.position.set(cx, gy + 1.08, cz);
      const midRail = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx, 0.05, sz)), ironMat);
      midRail.position.set(cx, gy + 0.64, cz);
      this.group.add(curb, topRail, midRail);
    };
    const outerSpan = GALLERY_HALF * 2;
    addRail(tx, tz - GALLERY_HALF + 0.12, outerSpan, 0.24, 'gallery-rail-north');
    addRail(tx, tz + GALLERY_HALF - 0.12, outerSpan, 0.24, 'gallery-rail-south');
    addRail(tx - GALLERY_HALF + 0.12, tz, 0.24, outerSpan, 'gallery-rail-west');
    addRail(tx + GALLERY_HALF - 0.12, tz, 0.24, outerSpan, 'gallery-rail-east');

    // Balustrade corners + intermediate iron stanchions.
    const postGeo = s.track(new THREE.BoxGeometry(0.14, 1.12, 0.14));
    for (let i = -3; i <= 3; i++) {
      const k = (i / 3) * (GALLERY_HALF - 0.14);
      for (const [px, pz] of [
        [k, -GALLERY_HALF + 0.14], [k, GALLERY_HALF - 0.14],
        [-GALLERY_HALF + 0.14, k], [GALLERY_HALF - 0.14, k],
      ] as const) {
        const post = new THREE.Mesh(postGeo, ironMat);
        post.position.set(tx + px, gy + 0.56, tz + pz);
        this.group.add(post);
      }
    }

    // Stairwell shaft safety railings on the Gallery Deck so visitors never step
    // sideways into the stairs except via the SW exit at dx = -2.2, dz = [2.2..4.2].
    addRail(tx + SHAFT_HALF + 0.1, tz + 1.0, 0.2, 6.4, 'stairhead-rail-east');
    addRail(tx + 1.0, tz + SHAFT_HALF + 0.1, 6.4, 0.2, 'stairhead-rail-south');
    addRail(tx + 3.2, tz - CORE_HALF - 0.1, 2.0, 0.2, 'stairhead-rail-north');

    // Lantern Room enclosure on [-2.2, +2.2] x [-2.2, +2.2] (Y = 11.5 .. 15.2)
    // Open 1.8 m doorway on West face (dz in [-0.9, +0.9]).
    const addLanternWall = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, glazed: boolean) => {
      this.collision.addBox([cx, cy, cz], [sx / 2, sy / 2, sz / 2]);
      if (glazed) {
        const knee = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx, 0.9, sz)), stoneMat);
        knee.position.set(cx, gy + 0.45, cz);
        const glass = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx * 0.85, sy - 1.1, sz * 0.85)), glassMat);
        glass.position.set(cx, gy + 0.9 + (sy - 1.1) / 2, cz);
        const header = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx, 0.22, sz)), ironMat);
        header.position.set(cx, gy + sy - 0.11, cz);
        this.group.add(knee, glass, header);
      } else {
        const lintel = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx, sy, sz)), ironMat);
        lintel.position.set(cx, cy, cz);
        this.group.add(lintel);
      }
    };
    const lH = 3.7;
    addLanternWall(tx, gy + lH / 2, tz - CORE_HALF, CORE_HALF * 2, lH, 0.24, true);
    addLanternWall(tx + CORE_HALF, gy + lH / 2, tz, 0.24, lH, CORE_HALF * 2, true);
    addLanternWall(tx, gy + lH / 2, tz + CORE_HALF, CORE_HALF * 2, lH, 0.24, true);
    // West wall split around 1.8 m doorway (dz in [-0.9, +0.9]):
    addLanternWall(tx - CORE_HALF, gy + lH / 2, tz - 1.55, 0.24, lH, 1.3, true);
    addLanternWall(tx - CORE_HALF, gy + lH / 2, tz + 1.55, 0.24, lH, 1.3, true);
    addLanternWall(tx - CORE_HALF, gy + 3.15, tz, 0.24, 1.1, 1.8, false);

    // Copper cupola roof & lightning finial (Y = 15.2 .. 19.0).
    const roofBase = new THREE.Mesh(s.track(new THREE.CylinderGeometry(3.2, 3.6, 0.35, 8)), ironMat);
    roofBase.position.set(tx, gy + 3.85, tz);
    roofBase.rotation.y = Math.PI / 8;
    const dome = new THREE.Mesh(
      s.track(new THREE.SphereGeometry(3.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)),
      copperMat,
    );
    dome.position.set(tx, gy + 4.0, tz);
    const finial = new THREE.Mesh(s.track(new THREE.ConeGeometry(0.24, 1.7, 8)), brassMat);
    finial.position.set(tx, gy + 7.75, tz);
    this.group.add(roofBase, dome, finial);

    // Central brass & stone Fresnel Lens pedestal at (tx, 11.5, tz).
    this.collision.addBox([tx, gy + 0.9, tz], [0.68, 0.9, 0.68]);
    const pedestal = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.58, 0.72, 1.15, 8)), stoneMat);
    pedestal.position.set(tx, gy + 0.575, tz);
    const collar = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.64, 0.64, 0.14, 12)), brassMat);
    collar.position.set(tx, gy + 1.22, tz);
    this.group.add(pedestal, collar);

    // Named Fresnel Lens Anchor (reserved for L01: The Lighthouse at World's End).
    this.lensAnchor.name = 'lighthouse-lens-l01-anchor';
    this.lensAnchor.position.set(tx, gy + 1.95, tz);
    this.group.add(this.lensAnchor);

    // Rotating lens turret & translucent volumetric beacon cones.
    this.lensTurret.name = 'lighthouse-fresnel-turret';
    this.lensAnchor.add(this.lensTurret);

    const lampCore = new THREE.Mesh(s.track(new THREE.SphereGeometry(0.32, 14, 10)), coreGlowMat);
    const bullseye = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.56, 0.56, 0.92, 14)), lensGlassMat);
    const topCrown = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.28, 0.58, 0.3, 12)), brassMat);
    topCrown.position.y = 0.61;
    const botCrown = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.58, 0.36, 0.24, 12)), brassMat);
    botCrown.position.y = -0.58;

    // Pair of opposing brass bullseye rings + long volumetric light cones.
    const ringGeo = s.track(new THREE.TorusGeometry(0.36, 0.055, 8, 18));
    const coneLen = 68;
    const coneGeo = s.track(new THREE.ConeGeometry(8.5, coneLen, 18, 1, true));
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, brassMat);
      ring.position.set(0, 0, side * 0.56);
      this.lensTurret.add(ring);

      const beamPivot = new THREE.Group();
      beamPivot.rotation.x = side * -0.055; // gently sweeps seaward horizon
      const beam = new THREE.Mesh(coneGeo, beamMat);
      beam.name = side > 0 ? 'lighthouse-beam-fore' : 'lighthouse-beam-aft';
      beam.rotation.x = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      beam.position.set(0, 0, side * (coneLen / 2 + 0.7));
      beamPivot.add(beam);
      this.lensTurret.add(beamPivot);
    }

    // Attach visible optics + generous interaction proxy to the lens target.
    this.interactionTarget.position.set(0, 0, 0);
    this.interactionTarget.add(lampCore, bullseye, topCrown, botCrown);
    const hitProxy = new THREE.Mesh(
      s.track(new THREE.CylinderGeometry(0.95, 0.95, 2.2, 10)),
      s.track(new THREE.MeshBasicMaterial()),
    );
    hitProxy.name = 'lighthouse-lens-hit-proxy';
    hitProxy.position.y = -0.2;
    hitProxy.layers.set(INTERACTION_ONLY_LAYER);
    this.interactionTarget.add(hitProxy);
    this.lensTurret.add(this.interactionTarget);
    this.lensTurret.rotation.y = this.beamAngle;
  }

  getLensControl(announce: (message: string) => void): ExhibitControl {
    return {
      object: this.interactionTarget,
      label: () => (this.inspected
        ? 'Fresnel lens (L01 passage dormant)'
        : 'Inspect Lighthouse Lens'),
      description: 'Brass Fresnel lens overlooking the southeast coast, anchor for The Lighthouse at World\'s End (L01).',
      activate: () => {
        this.inspected = true;
        announce(
          'The Fresnel lens sweeps the dark horizon. Its sea passage to The Lighthouse at World\'s End (L01) is not open yet.',
        );
      },
    };
  }

  update(dt: number, reducedMotion: boolean): void {
    if (reducedMotion) return;
    this.beamAngle = (this.beamAngle + dt * 0.28) % (Math.PI * 2);
    this.lensTurret.rotation.y = this.beamAngle;
  }
}

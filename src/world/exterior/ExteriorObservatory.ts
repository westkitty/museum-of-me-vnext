import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { CollisionWorld } from '../CollisionWorld';
import type { ExhibitControl } from '../../exhibits/contract';
import { canRenderText, createFallbackTexture, createTextTexture } from '../../assets/TextTexture';
import { INTERACTION_ONLY_LAYER } from '../../interaction/InteractionManager';
import {
  LAND_SUPPORT_Y,
  OBSERVATORY_APPROACH_PATH,
  OBSERVATORY_CENTER,
} from './IslandSiteLayout';

export const OBSERVATORY_ORRERY_ID = 'observatory-orrery-w09';
export const OBSERVATORY_FLOOR_Y = 2.5;

const RAMP_MIN_X = OBSERVATORY_CENTER[0] - 18; // 70
const RAMP_MAX_X = OBSERVATORY_CENTER[0] - 8;  // 80
const RAMP_HALF_W = 2.5; // z in [93.5, 98.5]
const TERRACE_HALF = 8.0; // x in [80, 96], z in [88, 104]

/**
 * ISLAND-02B: Southern wooded ruined observatory on a raised hill south-east of
 * the museum approach, distinct from the southwest astronomical sundial terrace.
 * Houses a weathered dome fragment, broken mechanical orrery (dormant W09 anchor),
 * brass telescope, constellation charts, and zodiac floor mosaic.
 *
 * Uses zero THREE.Light objects and runs solely inside ExteriorWorld.variableUpdate.
 */
export class ExteriorObservatory {
  readonly group = new THREE.Group();
  private readonly orreryAnchor = new THREE.Group();
  private readonly interactionTarget = new THREE.Group();
  private readonly haltedRings: THREE.Object3D[] = [];
  private coreMat: THREE.MeshStandardMaterial | null = null;
  private inspected = false;
  private elapsed = 0;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
  ) {
    this.group.name = 'southern-ruined-observatory';
    this.group.userData.visualRole = 'wooded-ruined-observatory';
    this.interactionTarget.name = 'observatory-orrery-w09-model';
    this.build();
  }

  private build(): void {
    const [ox, , oz] = OBSERVATORY_CENTER;
    const s = this.scope;

    const stoneMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x6f7572, roughness: 0.9, metalness: 0.04,
      emissive: 0x161d24, emissiveIntensity: 0.22,
    }));
    const darkStoneMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x3b4449, roughness: 0.92, metalness: 0.06,
      emissive: 0x0f151b, emissiveIntensity: 0.18,
    }));
    const mossHillMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x264133, roughness: 0.96, metalness: 0, flatShading: true,
    }));
    const trailMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x8f8772, roughness: 0.92, metalness: 0.02,
    }));
    const bronzeMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x9f7e4b, roughness: 0.4, metalness: 0.78,
      emissive: 0x241907, emissiveIntensity: 0.22,
    }));
    const brassMat = s.track(new THREE.MeshStandardMaterial({
      color: 0xd0a857, roughness: 0.32, metalness: 0.85,
      emissive: 0x2d1e07, emissiveIntensity: 0.24,
    }));
    const copperMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x387064, roughness: 0.58, metalness: 0.38,
      emissive: 0x0d211d, emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    }));
    const sunMat = s.track(new THREE.MeshStandardMaterial({
      color: 0xffdf94, emissive: 0xffba52, emissiveIntensity: 0.85,
      roughness: 0.28, metalness: 0.35,
    }));
    this.coreMat = sunMat;
    const amberGlowMat = s.track(new THREE.MeshBasicMaterial({
      color: 0xffc675, toneMapped: false,
    }));

    this.buildWoodlandTrail(trailMat, darkStoneMat, amberGlowMat);
    this.buildHillRampAndTerrace(ox, oz, stoneMat, darkStoneMat, mossHillMat, amberGlowMat);
    this.buildRuinedWallsAndDome(ox, oz, stoneMat, darkStoneMat, bronzeMat, copperMat);
    this.buildZodiacFloorAndCharts(ox, oz, bronzeMat, darkStoneMat);
    this.buildTelescope(ox, oz, stoneMat, brassMat, bronzeMat);
    this.buildBrokenOrrery(ox, oz, stoneMat, brassMat, bronzeMat, sunMat);
  }

  private buildWoodlandTrail(
    trailMat: THREE.Material,
    cairnMat: THREE.Material,
    amberMat: THREE.Material,
  ): void {
    const s = this.scope;
    const curve = new THREE.CatmullRomCurve3(
      OBSERVATORY_APPROACH_PATH.map(([x, z]) => new THREE.Vector3(x, -0.463, z)),
      false,
      'centripetal',
    );
    const samples = curve.getPoints(48);
    const positions: number[] = [];
    const indices: number[] = [];
    const halfWidth = 1.9;
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
    const ribbon = new THREE.Mesh(geo, trailMat);
    ribbon.name = 'observatory-approach-trail';
    ribbon.receiveShadow = true;
    this.group.add(ribbon);

    // Subtle trail marker stones leading into the trees.
    const count = 6;
    const postGeo = s.track(new THREE.CylinderGeometry(0.14, 0.21, 0.62, 6));
    const capGeo = s.track(new THREE.SphereGeometry(0.11, 8, 6));
    const posts = s.track(new THREE.InstancedMesh(postGeo, cairnMat, count));
    const caps = s.track(new THREE.InstancedMesh(capGeo, amberMat, count));
    posts.name = 'observatory-trail-markers';
    caps.name = 'observatory-trail-lanterns';
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const u = curve.getUtoTmapping((i + 0.35) / (count + 0.1), 0);
      const p = curve.getPoint(u);
      const t = curve.getTangent(u);
      const side = i % 2 === 0 ? 1 : -1;
      const x = p.x + t.z * 2.45 * side;
      const z = p.z - t.x * 2.45 * side;
      dummy.position.set(x, LAND_SUPPORT_Y + 0.31, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
      dummy.position.y = LAND_SUPPORT_Y + 0.66;
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
    }
    posts.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    this.group.add(posts, caps);
  }

  private buildHillRampAndTerrace(
    ox: number,
    oz: number,
    stoneMat: THREE.Material,
    darkStoneMat: THREE.Material,
    mossHillMat: THREE.Material,
    amberMat: THREE.Material,
  ): void {
    const s = this.scope;
    const rampLen = RAMP_MAX_X - RAMP_MIN_X; // 10
    const rampMidX = (RAMP_MIN_X + RAMP_MAX_X) / 2; // 75
    const rise = OBSERVATORY_FLOOR_Y - LAND_SUPPORT_Y; // 3.0
    const slopeLen = Math.hypot(rampLen, rise);
    const slopeAngle = Math.atan2(rise, rampLen);

    // Walkable hill ramp from ground (-0.5) up to ruined observatory deck (+2.5).
    this.collision.add({
      kind: 'ramp',
      minX: RAMP_MIN_X,
      maxX: RAMP_MAX_X,
      minZ: oz - RAMP_HALF_W,
      maxZ: oz + RAMP_HALF_W,
      axis: 'x',
      yAtMin: LAND_SUPPORT_Y,
      yAtMax: OBSERVATORY_FLOOR_Y,
    });

    const rampMesh = new THREE.Mesh(
      s.track(new THREE.BoxGeometry(slopeLen, 0.36, RAMP_HALF_W * 2)),
      stoneMat,
    );
    rampMesh.name = 'observatory-hill-ramp';
    rampMesh.position.set(rampMidX, (LAND_SUPPORT_Y + OBSERVATORY_FLOOR_Y) / 2 - 0.18, oz);
    rampMesh.rotation.z = slopeAngle;
    rampMesh.receiveShadow = true;
    this.group.add(rampMesh);

    // Right-triangular stone under-ramp masonry prism (stays beneath slope, never blocks stairs).
    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(RAMP_MIN_X, LAND_SUPPORT_Y - 0.15);
    wedgeShape.lineTo(RAMP_MAX_X, LAND_SUPPORT_Y - 0.15);
    wedgeShape.lineTo(RAMP_MAX_X, OBSERVATORY_FLOOR_Y - 0.25);
    wedgeShape.closePath();
    const wedgeWidth = RAMP_HALF_W * 2 + 0.55;
    const underRamp = new THREE.Mesh(
      s.track(new THREE.ExtrudeGeometry(wedgeShape, { depth: wedgeWidth, bevelEnabled: false })),
      darkStoneMat,
    );
    underRamp.name = 'observatory-hill-under-ramp';
    underRamp.position.set(0, 0, oz - wedgeWidth / 2);
    this.group.add(underRamp);

    // Ten weathered stone stair treads along the hill ascent.
    const rampSteps = 10;
    const stepGeo = s.track(new THREE.BoxGeometry(0.84, 0.1, RAMP_HALF_W * 2 - 0.35));
    const treads = s.track(new THREE.InstancedMesh(stepGeo, darkStoneMat, rampSteps));
    treads.name = 'observatory-ramp-steps';
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rampSteps; i++) {
      const f = (i + 0.5) / rampSteps;
      dummy.position.set(RAMP_MIN_X + rampLen * f, LAND_SUPPORT_Y + rise * f - 0.02, oz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      treads.setMatrixAt(i, dummy.matrix);
    }
    treads.instanceMatrix.needsUpdate = true;
    this.group.add(treads);

    // Ramp curb walls + warm bronze entrance bollards clear of curb ends.
    const curbLen = rampLen - 0.9;
    const curbMidX = RAMP_MIN_X + 0.9 + curbLen / 2;
    const curbMidSurfaceY = LAND_SUPPORT_Y + rise * ((curbMidX - RAMP_MIN_X) / rampLen);
    for (const side of [-1, 1]) {
      const curbZ = oz + side * (RAMP_HALF_W + 0.38);
      this.collision.addBox([rampMidX, 1.8, curbZ], [rampLen / 2, 2.3, 0.38]);
      const curb = new THREE.Mesh(s.track(new THREE.BoxGeometry(curbLen, 1.25, 0.65)), darkStoneMat);
      curb.position.set(curbMidX, curbMidSurfaceY + 0.16, curbZ);
      curb.rotation.z = slopeAngle;
      this.group.add(curb);

      const footPost = new THREE.Mesh(s.track(new THREE.BoxGeometry(0.55, 1.05, 0.55)), darkStoneMat);
      footPost.position.set(RAMP_MIN_X + 0.35, LAND_SUPPORT_Y + 0.525, curbZ);
      const footLamp = new THREE.Mesh(s.track(new THREE.SphereGeometry(0.16, 8, 6)), amberMat);
      footLamp.position.set(RAMP_MIN_X + 0.35, LAND_SUPPORT_Y + 1.18, curbZ);
      this.group.add(footPost, footLamp);
    }

    // Raised rotunda floor support (80..96 x 88..104, Y = 2.5).
    this.collision.addFloor(
      ox - TERRACE_HALF, ox + TERRACE_HALF,
      oz - TERRACE_HALF, oz + TERRACE_HALF,
      OBSERVATORY_FLOOR_Y,
    );

    const foundation = new THREE.Mesh(
      s.track(new THREE.CylinderGeometry(8.4, 10.6, 3.2, 16)),
      darkStoneMat,
    );
    foundation.name = 'observatory-hill-foundation';
    foundation.position.set(ox, OBSERVATORY_FLOOR_Y - 1.6, oz);
    foundation.receiveShadow = true;
    this.group.add(foundation);

    const floorPlate = new THREE.Mesh(
      s.track(new THREE.BoxGeometry(TERRACE_HALF * 2, 0.4, TERRACE_HALF * 2)),
      stoneMat,
    );
    floorPlate.position.set(ox, OBSERVATORY_FLOOR_Y - 0.2, oz);
    floorPlate.receiveShadow = true;
    this.group.add(floorPlate);

    // Mossy wooded knoll mounds banking strictly outside terrace walls & ramp stairs.
    const knolls: { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number }[] = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const cos = Math.cos(a), sin = Math.sin(a);
      if (cos < -0.35 && Math.abs(sin) < 0.72) continue; // keep west ramp mouth wide open
      const sx = 2.1 + (i % 3) * 0.42;
      const sz = 2.1 + ((i + 1) % 3) * 0.4;
      const h = 1.25 + (i % 4) * 0.28;
      const maxCard = Math.max(Math.abs(cos), Math.abs(sin));
      const edgePush = maxCard > 0 ? 1 / maxCard : 1;
      const r = Math.max(10.8, TERRACE_HALF * edgePush + Math.max(sx, sz) * 1.05 + (i % 2) * 0.8);
      const kx = ox + cos * r;
      const kz = oz + sin * r;
      if (kx < ox - 3.0 && Math.abs(kz - oz) < 6.8) continue;
      knolls.push({
        x: kx,
        y: LAND_SUPPORT_Y + h * 0.36,
        z: kz,
        sx,
        sy: h,
        sz,
        yaw: a * 1.3,
      });
    }
    const moundGeo = s.track(new THREE.DodecahedronGeometry(1, 0));
    const mounds = s.track(new THREE.InstancedMesh(moundGeo, mossHillMat, knolls.length));
    mounds.name = 'observatory-wooded-knoll';
    for (const [i, k] of knolls.entries()) {
      dummy.position.set(k.x, k.y, k.z);
      dummy.rotation.set(0.06 * (i % 3), k.yaw, 0);
      dummy.scale.set(k.sx, k.sy, k.sz);
      dummy.updateMatrix();
      mounds.setMatrixAt(i, dummy.matrix);
    }
    mounds.instanceMatrix.needsUpdate = true;
    this.group.add(mounds);
  }

  private buildRuinedWallsAndDome(
    ox: number,
    oz: number,
    stoneMat: THREE.Material,
    darkStoneMat: THREE.Material,
    bronzeMat: THREE.Material,
    copperMat: THREE.Material,
  ): void {
    const s = this.scope;
    const fy = OBSERVATORY_FLOOR_Y;

    // Ruined perimeter walls & safety cliff parapets enclosing [ox-8..ox+8, oz-8..oz+8]
    // with West entrance gap at x = ox - 8, z in [oz - 2.5, oz + 2.5].
    const addRuinedWall = (cx: number, cz: number, sx: number, sz: number, height: number) => {
      this.collision.addBox([cx, LAND_SUPPORT_Y + (height + 3.0) / 2, cz], [sx / 2, (height + 3.0) / 2, sz / 2]);
      const wall = new THREE.Mesh(s.track(new THREE.BoxGeometry(sx, height, sz)), stoneMat);
      wall.position.set(cx, fy + height / 2, cz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);
    };

    // North & East tall ruined walls supporting the broken dome shell:
    addRuinedWall(ox, oz - TERRACE_HALF + 0.35, TERRACE_HALF * 2, 0.7, 3.8);
    addRuinedWall(ox + TERRACE_HALF - 0.35, oz, 0.7, TERRACE_HALF * 2, 3.6);
    // South wall stepping down into low weathered ruin parapet:
    addRuinedWall(ox + 2.5, oz + TERRACE_HALF - 0.35, 11.0, 0.7, 2.2);
    addRuinedWall(ox - 5.2, oz + TERRACE_HALF - 0.35, 5.6, 0.7, 1.35);
    // West entrance split around ramp doorway (z in [oz - 2.5, oz + 2.5]):
    addRuinedWall(ox - TERRACE_HALF + 0.35, oz - 5.25, 0.7, 5.5, 2.9);
    addRuinedWall(ox - TERRACE_HALF + 0.35, oz + 5.25, 0.7, 5.5, 1.9);

    // Tall ruined masonry portal piers & broken cornice framing the West entrance:
    for (const side of [-1, 1]) {
      const pier = new THREE.Mesh(s.track(new THREE.BoxGeometry(1.1, 4.3, 0.9)), darkStoneMat);
      pier.position.set(ox - TERRACE_HALF + 0.3, fy + 2.15, oz + side * 2.85);
      this.group.add(pier);
    }

    // Octagonal stone columns standing directly under the NE ring beam + one SE ruin stump.
    const domeCenterY = fy + 3.85; // 6.35
    const ringRadius = 7.38;
    const supportHeight = 4.05;
    const columnGeo = s.track(new THREE.CylinderGeometry(0.42, 0.52, supportHeight, 8));
    for (const beta of [-2.35, -1.65, -0.95, -0.25, 0.47]) {
      const col = new THREE.Mesh(columnGeo, darkStoneMat);
      col.position.set(ox + Math.cos(beta) * ringRadius, fy + supportHeight / 2, oz + Math.sin(beta) * ringRadius);
      this.group.add(col);
    }
    const seStump = new THREE.Mesh(columnGeo, darkStoneMat);
    seStump.scale.y = 0.62;
    seStump.position.set(ox + 6.4, fy + (supportHeight * 0.62) / 2, oz + 6.4);
    this.group.add(seStump);

    // Weathered copper dome fragment overarching the NE arc (phi 0.85*PI..1.80*PI),
    // leaving the zenith & West/SW sky genuinely open to the real starry sky!
    const domeGeo = s.track(new THREE.SphereGeometry(
      7.4, 20, 12,
      Math.PI * 0.85, Math.PI * 0.95, // covers +X and -Z (NE), open on W/SW
      0.24, Math.PI * 0.42,           // open zenith crown (thetaStart = 0.24 rad)
    ));
    const domeFragment = new THREE.Mesh(domeGeo, copperMat);
    domeFragment.name = 'ruined-observatory-dome-fragment';
    domeFragment.position.set(ox, domeCenterY, oz);
    this.group.add(domeFragment);

    // Skeletal bronze meridian ribs sweeping cleanly from the ring beam to a broken zenith oculus collar.
    const ribGeo = s.track(new THREE.TorusGeometry(7.36, 0.13, 6, 24, Math.PI * 0.425));
    for (const yaw of [-0.25, 0.50, 1.25, 2.05]) {
      const rib = new THREE.Mesh(ribGeo, bronzeMat);
      rib.position.set(ox, domeCenterY, oz);
      rib.rotation.y = yaw;
      this.group.add(rib);
    }

    const oculusCollar = new THREE.Mesh(
      s.track(new THREE.TorusGeometry(1.72, 0.15, 6, 20, Math.PI * 0.76)),
      bronzeMat,
    );
    oculusCollar.position.set(ox, domeCenterY + 7.16, oz);
    oculusCollar.rotation.x = Math.PI / 2;
    oculusCollar.rotation.z = -2.10;
    this.group.add(oculusCollar);

    // Partial stone ring beam spanning cleanly from the NW column (-2.35) to ESE column (+0.47).
    const ringBeam = new THREE.Mesh(
      s.track(new THREE.TorusGeometry(ringRadius, 0.34, 6, 24, 2.82)),
      darkStoneMat,
    );
    ringBeam.position.set(ox, domeCenterY, oz);
    ringBeam.rotation.x = Math.PI / 2;
    ringBeam.rotation.z = -2.35;
    this.group.add(ringBeam);
  }

  private buildZodiacFloorAndCharts(
    ox: number,
    oz: number,
    bronzeMat: THREE.Material,
    darkStoneMat: THREE.Material,
  ): void {
    const s = this.scope;
    const fy = OBSERVATORY_FLOOR_Y;

    // Historical zodiac & celestial floor mosaic disc.
    const zodiacTex = this.createZodiacTexture();
    const zodiacMat = s.track(new THREE.MeshStandardMaterial({
      map: zodiacTex, roughness: 0.78, metalness: 0.14,
      emissive: 0x1e1912, emissiveIntensity: 0.22,
    }));
    const zodiacDisc = new THREE.Mesh(
      s.track(new THREE.CircleGeometry(5.8, 48)),
      zodiacMat,
    );
    zodiacDisc.name = 'observatory-zodiac-floor';
    zodiacDisc.rotation.x = -Math.PI / 2;
    zodiacDisc.position.set(ox, fy + 0.018, oz);
    zodiacDisc.receiveShadow = true;
    this.group.add(zodiacDisc);

    // Brass meridian floor inlay rings:
    const ringInlay = new THREE.Mesh(s.track(new THREE.RingGeometry(5.65, 5.88, 48)), bronzeMat);
    ringInlay.rotation.x = -Math.PI / 2;
    ringInlay.position.set(ox, fy + 0.022, oz);
    this.group.add(ringInlay);

    // Two weathered constellation chart lecterns (clear of walkways).
    const charts: readonly { x: number; z: number; yaw: number; title: string; lines: string[] }[] = [
      {
        x: ox - 4.4, z: oz - 4.8, yaw: 0.65,
        title: 'Northern Constellations',
        lines: ['Cygnus · Lyra · Cassiopeia', 'Broken horizon arc · Zenith open'],
      },
      {
        x: ox - 4.4, z: oz + 4.8, yaw: 2.45,
        title: 'Halted Ephemeris',
        lines: ['Orrery locked between ticks', 'Time awaits deliberate motion'],
      },
    ];
    for (const [i, chart] of charts.entries()) {
      const stand = new THREE.Group();
      stand.name = `observatory-constellation-chart-${i + 1}`;
      stand.position.set(chart.x, fy, chart.z);
      stand.rotation.y = chart.yaw;

      this.collision.addBox([chart.x, fy + 0.65, chart.z], [0.42, 0.65, 0.42]);

      const post = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.11, 0.16, 1.05, 8)), darkStoneMat);
      post.position.y = 0.525;
      const frame = new THREE.Mesh(s.track(new THREE.BoxGeometry(1.18, 0.08, 0.78)), bronzeMat);
      frame.position.y = 1.08;
      frame.rotation.x = 0.52;

      const map = canRenderText()
        ? createTextTexture(s, chart.lines, {
          width: 640, height: 420, title: chart.title, titleSize: 44, bodySize: 28,
          align: 'center', rule: true, padding: 28,
          background: '#11161f', titleColor: '#e8c670', color: '#c4cdd6',
        })
        : createFallbackTexture(s, 0x151c28);
      const plaque = new THREE.Mesh(
        s.track(new THREE.PlaneGeometry(1.06, 0.68)),
        s.track(new THREE.MeshBasicMaterial({ map, toneMapped: false })),
      );
      plaque.position.set(0, 1.12, 0.03);
      plaque.rotation.x = -Math.PI / 2 + 0.52;

      stand.add(post, frame, plaque);
      this.group.add(stand);
    }
  }

  private buildTelescope(
    ox: number,
    oz: number,
    stoneMat: THREE.Material,
    brassMat: THREE.Material,
    bronzeMat: THREE.Material,
  ): void {
    const s = this.scope;
    const fy = OBSERVATORY_FLOOR_Y;
    const tx = ox + 4.4; // 92.4
    const tz = oz - 4.4; // 91.6

    this.collision.addBox([tx, fy + 0.9, tz], [0.65, 0.9, 0.65]);

    const group = new THREE.Group();
    group.name = 'observatory-weathered-telescope';
    group.position.set(tx, fy, tz);
    group.rotation.y = -2.2; // aimed upward & outward toward NE/sky gap

    const pier = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.46, 0.62, 1.35, 8)), stoneMat);
    pier.position.y = 0.675;
    const yoke = new THREE.Mesh(s.track(new THREE.BoxGeometry(0.48, 0.52, 0.36)), bronzeMat);
    yoke.position.y = 1.55;

    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, 1.75, 0);
    barrelGroup.rotation.x = -0.58; // 33 deg upward elevation

    const mainTube = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.18, 0.23, 2.75, 14)), brassMat);
    mainTube.rotation.x = Math.PI / 2;
    const dewShield = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.24, 0.24, 0.55, 14)), bronzeMat);
    dewShield.rotation.x = Math.PI / 2;
    dewShield.position.z = -1.42;
    const eyepiece = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.08, 0.11, 0.42, 10)), bronzeMat);
    eyepiece.rotation.x = Math.PI / 2;
    eyepiece.position.z = 1.48;
    const lensGlow = new THREE.Mesh(
      s.track(new THREE.CircleGeometry(0.21, 14)),
      s.track(new THREE.MeshBasicMaterial({ color: 0x7cb0d4, toneMapped: false })),
    );
    lensGlow.position.z = -1.7;
    lensGlow.rotation.y = Math.PI;

    barrelGroup.add(mainTube, dewShield, eyepiece, lensGlow);
    group.add(pier, yoke, barrelGroup);
    this.group.add(group);
  }

  private buildBrokenOrrery(
    ox: number,
    oz: number,
    stoneMat: THREE.Material,
    brassMat: THREE.Material,
    bronzeMat: THREE.Material,
    sunMat: THREE.Material,
  ): void {
    const s = this.scope;
    const fy = OBSERVATORY_FLOOR_Y;

    // Central carved stone plinth.
    this.collision.addBox([ox, fy + 0.9, oz], [1.1, 0.9, 1.1]);
    const plinth = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.95, 1.12, 1.12, 8)), stoneMat);
    plinth.position.set(ox, fy + 0.56, oz);
    const rim = new THREE.Mesh(s.track(new THREE.CylinderGeometry(1.02, 1.02, 0.12, 12)), bronzeMat);
    rim.position.set(ox, fy + 1.16, oz);
    this.group.add(plinth, rim);

    // Named anchor reserved for W09 (The Museum Between Seconds).
    this.orreryAnchor.name = 'observatory-orrery-w09-anchor';
    this.orreryAnchor.position.set(ox, fy + 1.98, oz);
    this.group.add(this.orreryAnchor);

    // Central gilded sun + concentric halted/broken planetary rings.
    const sun = new THREE.Mesh(s.track(new THREE.SphereGeometry(0.32, 16, 12)), sunMat);
    const spindle = new THREE.Mesh(s.track(new THREE.CylinderGeometry(0.06, 0.08, 1.25, 10)), bronzeMat);
    spindle.position.y = -0.35;
    this.interactionTarget.add(sun, spindle);

    const ringSpecs: readonly { radius: number; arc: number; tiltX: number; tiltZ: number; rotY: number; planetR: number }[] = [
      { radius: 0.72, arc: Math.PI * 2, tiltX: 0.32, tiltZ: -0.18, rotY: 0.4, planetR: 0.08 },
      { radius: 1.06, arc: Math.PI * 1.62, tiltX: -0.48, tiltZ: 0.35, rotY: 1.2, planetR: 0.11 }, // fractured arc
      { radius: 1.38, arc: Math.PI * 1.82, tiltX: 0.22, tiltZ: 0.52, rotY: 2.3, planetR: 0.13 }, // fractured outer orbit
    ];
    for (const spec of ringSpecs) {
      const ringGroup = new THREE.Group();
      ringGroup.rotation.set(spec.tiltX, spec.rotY, spec.tiltZ);
      const arm = new THREE.Mesh(
        s.track(new THREE.TorusGeometry(spec.radius, 0.036, 8, 32, spec.arc)),
        brassMat,
      );
      arm.rotation.x = Math.PI / 2;
      const planet = new THREE.Mesh(s.track(new THREE.SphereGeometry(spec.planetR, 12, 10)), bronzeMat);
      planet.position.set(Math.cos(spec.arc * 0.45) * spec.radius, 0, Math.sin(spec.arc * 0.45) * spec.radius);
      ringGroup.add(arm, planet);
      this.haltedRings.push(ringGroup);
      this.interactionTarget.add(ringGroup);
    }

    const hitProxy = new THREE.Mesh(
      s.track(new THREE.CylinderGeometry(1.45, 1.45, 2.3, 12)),
      s.track(new THREE.MeshBasicMaterial()),
    );
    hitProxy.name = 'observatory-orrery-hit-proxy';
    hitProxy.layers.set(INTERACTION_ONLY_LAYER);
    this.interactionTarget.add(hitProxy);
    this.orreryAnchor.add(this.interactionTarget);
  }

  private createZodiacTexture(): THREE.Texture {
    if (typeof document === 'undefined' || !canRenderText()) {
      return createFallbackTexture(this.scope, 0x2a2f36);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return createFallbackTexture(this.scope, 0x2a2f36);

    ctx.fillStyle = '#242a30';
    ctx.fillRect(0, 0, 512, 512);

    const cx = 256, cy = 256;
    ctx.strokeStyle = '#c8a355';
    ctx.lineWidth = 3;
    for (const r of [240, 198, 136, 72]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Twelve zodiac sectors and celestial spokes.
    const glyphs = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e5c678';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 72, cy + Math.sin(a) * 72);
      ctx.lineTo(cx + Math.cos(a) * 240, cy + Math.sin(a) * 240);
      ctx.stroke();

      const mid = a + Math.PI / 12;
      ctx.fillText(glyphs[i], cx + Math.cos(mid) * 218, cy + Math.sin(mid) * 218);
    }

    // Subtle inlaid star constellation dots inside inner dial.
    ctx.fillStyle = '#f2e0ac';
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39996;
      const r = 88 + (i * 19) % 100;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = this.scope.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  getOrreryControl(announce: (message: string) => void): ExhibitControl {
    return {
      object: this.interactionTarget,
      label: () => (this.inspected
        ? 'Broken Orrery (W09 passage dormant)'
        : 'Inspect Broken Orrery'),
      description: 'Fractured brass orrery suspended inside the ruined observatory, anchor for The Museum Between Seconds (W09).',
      activate: () => {
        this.inspected = true;
        announce(
          'The halted brass rings quiver as if waiting for your next step. The Museum Between Seconds (W09) is not open yet.',
        );
      },
    };
  }

  update(dt: number, reducedMotion: boolean): void {
    if (reducedMotion) return;
    this.elapsed += dt;
    if (this.coreMat) {
      this.coreMat.emissiveIntensity = 0.78 + Math.sin(this.elapsed * 1.4) * 0.14;
    }
    // Slight suspended tremor on the fractured brass ring — halted, not spinning freely.
    const middle = this.haltedRings[1];
    if (middle) middle.rotation.y = 1.2 + Math.sin(this.elapsed * 0.7) * 0.025;
  }
}

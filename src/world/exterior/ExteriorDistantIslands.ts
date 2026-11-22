import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import type { QualityTier } from '../../render/QualityTiers';

/**
 * World-space anchor for the distant Skyborne Gardens floating islands (future W06).
 * Located ENE (~315 m from origin, Y ≈ +55..+94 m) along a clear sightline visible
 * from the south pier, coastal overlooks, lighthouse gallery, and museum rooftop.
 */
export const SKY_ISLANDS_ANCHOR: readonly [number, number, number] = [295, 74, -110];

/**
 * World-space anchor for the distant Wild Island silhouette (future W10 Breath of the Weasel).
 * Located SW across open water (~445 m from origin, Y ≈ -2..+50 m), separated by ~149 deg
 * from the Sky Islands and ~87 deg from the SE lighthouse peninsula.
 */
export const WILD_ISLAND_ANCHOR: readonly [number, number, number] = [-275, -1, 350];

export interface DistantIslandLodSpec {
  readonly skyIslandCount: number;
  readonly skyRadialSegments: number;
  readonly skyCanopies: number;
  readonly skyRocklets: number;
  readonly skyWaterfalls: number;
  readonly skyArchways: number;
  readonly wildRadialSegments: number;
  readonly wildRingSegments: number;
  readonly wildPines: number;
  readonly wildMistLayers: number;
}

export const DISTANT_ISLAND_LOD_COUNTS: Record<QualityTier, DistantIslandLodSpec> = {
  low: {
    skyIslandCount: 3,
    skyRadialSegments: 7,
    skyCanopies: 9,
    skyRocklets: 0,
    skyWaterfalls: 2,
    skyArchways: 1,
    wildRadialSegments: 24,
    wildRingSegments: 9,
    wildPines: 24,
    wildMistLayers: 1,
  },
  medium: {
    skyIslandCount: 5,
    skyRadialSegments: 10,
    skyCanopies: 19,
    skyRocklets: 14,
    skyWaterfalls: 4,
    skyArchways: 2,
    wildRadialSegments: 32,
    wildRingSegments: 12,
    wildPines: 56,
    wildMistLayers: 2,
  },
  high: {
    skyIslandCount: 5,
    skyRadialSegments: 14,
    skyCanopies: 32,
    skyRocklets: 28,
    skyWaterfalls: 6,
    skyArchways: 3,
    wildRadialSegments: 42,
    wildRingSegments: 15,
    wildPines: 96,
    wildMistLayers: 2,
  },
};

interface SkyIslandSite {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  readonly depth: number;
  readonly amp: number;
  readonly speed: number;
  readonly phase: number;
  readonly hasArch: boolean;
  readonly waterfalls: number;
}

const SKY_ISLAND_SITES: readonly SkyIslandSite[] = [
  { x: 0, y: 0, z: 0, radius: 20, depth: 19, amp: 0.62, speed: 0.24, phase: 0.2, hasArch: true, waterfalls: 2 },
  { x: 30, y: 7, z: 16, radius: 12, depth: 13, amp: 0.78, speed: 0.29, phase: 1.7, hasArch: true, waterfalls: 1 },
  { x: -32, y: -6, z: -16, radius: 11, depth: 13, amp: 0.72, speed: 0.21, phase: 3.1, hasArch: false, waterfalls: 1 },
  { x: -14, y: 12, z: 28, radius: 9.5, depth: 11, amp: 0.85, speed: 0.33, phase: 4.5, hasArch: true, waterfalls: 1 },
  { x: 20, y: -9, z: -28, radius: 8.5, depth: 10, amp: 0.68, speed: 0.27, phase: 5.4, hasArch: false, waterfalls: 1 },
];

interface FloatingSubGroup {
  readonly group: THREE.Group;
  readonly baseY: number;
  readonly amp: number;
  readonly speed: number;
  readonly phase: number;
}

interface SkyInstancePlacement {
  readonly siteIndex: number;
  readonly x: number;
  readonly baseY: number;
  readonly z: number;
  readonly rotY: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly orbitAmp: number;
  readonly orbitPhase: number;
}

function seeded01(seed: number): number {
  const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Transform local (lx, lz) into broadside horizon-aligned axes (u across view, v depth). */
function toWildHorizonAxes(lx: number, lz: number): readonly [number, number] {
  // Wild anchor (-275, 350) -> perpendicular horizon vector (0.786, 0.618), depth (-0.618, 0.786)
  return [0.786 * lx + 0.618 * lz, -0.618 * lx + 0.786 * lz];
}

/** Deterministic shoreline radius modulation for the Wild Island massif. */
function wildCoastRadius(angle: number): number {
  const lx = Math.cos(angle);
  const lz = Math.sin(angle);
  const [u, v] = toWildHorizonAxes(lx, lz);
  // Elliptical broadside footprint (~94 m half-width across horizon, ~58 m depth) + craggy coves
  const ellipse = 1 / Math.hypot(u / 94, v / 58);
  return ellipse * (
    1
    + 0.10 * Math.cos(2 * angle - 0.45)
    + 0.08 * Math.sin(3 * angle + 1.15)
    + 0.045 * Math.cos(5 * angle + 0.3)
  );
}

/** Deterministic elevation function (local Y relative to WILD_ISLAND_ANCHOR) shared by terrain & pines. */
export function sampleWildIslandElevation(lx: number, lz: number): number {
  const angle = Math.atan2(lz, lx);
  const maxR = wildCoastRadius(angle);
  const r = Math.hypot(lx, lz);
  const uNorm = r / maxR;
  if (uNorm >= 1.0) return -2.2;

  const [u, v] = toWildHorizonAxes(lx, lz);

  // Coastal cliff escarpment rising sharply from sea skirt (-2.2) to highland shelf (+7..+11)
  const coastBlend = 1 - Math.max(0, Math.min(1, (uNorm - 0.76) / 0.24));
  const shelf = -2.2 + 11.4 * Math.pow(coastBlend, 0.52);

  // Western main volcanic peak (u ≈ -26)
  const dMain = Math.hypot(u + 26, v + 3);
  const mainAngle = Math.atan2(v + 3, u + 26);
  const mainGully = 1 + 0.08 * Math.cos(4 * mainAngle + dMain * 0.06) + 0.05 * Math.sin(7 * mainAngle);
  const mainPeak = 36.5 * Math.exp(-(dMain * dMain) / (2 * 20 * 20)) * mainGully;

  // Eastern twin pine-ridge crest (u ≈ +38)
  const dEast = Math.hypot(u - 38, v + 2);
  const eastPeak = 25.5 * Math.exp(-(dEast * dEast) / (2 * 18 * 18));

  // Central highland plateau saddle connecting both peaks (u ≈ +5)
  const dSaddle = Math.hypot((u - 5) * 0.65, v);
  const saddle = 14.5 * Math.exp(-(dSaddle * dSaddle) / (2 * 16 * 16));

  // Western coastal bluff (u ≈ -62)
  const dWest = Math.hypot(u + 62, v - 6);
  const westBluff = 12.0 * Math.exp(-(dWest * dWest) / (2 * 13 * 13));

  const ridgeDetail = 1.2 * Math.sin(u * 0.11 + v * 0.09) * coastBlend;

  return shelf + mainPeak + eastPeak + saddle + westBluff + ridgeDetail;
}

/**
 * ISLAND-02D: Visual-only distant Floating Sky Islands (W06 preview) and
 * distant Wild Island ocean-horizon silhouette (W10 preview).
 *
 * Strictly visual-only: zero CollisionWorld colliders, zero THREE.Light objects,
 * zero external fetches, fog-exempt with moonlit atmospheric perspective so
 * silhouettes remain clear across pier, coastal, lighthouse, and rooftop views.
 */
export class ExteriorDistantIslands {
  readonly root = new THREE.Group();
  private readonly detailScope: ResourceScope;
  private quality: QualityTier;

  private skyRoot: THREE.Group | null = null;
  private wildRoot: THREE.Group | null = null;

  private floatingGroups: FloatingSubGroup[] = [];
  private canopyBatch: THREE.InstancedMesh | null = null;
  private canopyPlacements: SkyInstancePlacement[] = [];
  private trunkBatch: THREE.InstancedMesh | null = null;
  private trunkPlacements: SkyInstancePlacement[] = [];
  private rockletBatch: THREE.InstancedMesh | null = null;
  private rockletPlacements: SkyInstancePlacement[] = [];
  private mistBands: THREE.Mesh[] = [];
  private waterfallMeshes: THREE.Mesh[] = [];

  private readonly dummy = new THREE.Object3D();
  private animTime = 0;
  private resting = false;

  constructor(
    private readonly scope: ResourceScope,
    quality: QualityTier,
  ) {
    this.root.name = 'exterior-distant-islands';
    this.root.userData.visualRole = 'distant-horizon-landmarks';
    this.quality = quality;
    this.detailScope = scope.track(new ResourceScope('exterior-distant-islands-detail'));
    this.build();
  }

  get currentQuality(): QualityTier {
    return this.quality;
  }

  setQuality(tier: QualityTier): void {
    if (tier === this.quality || this.scope.isDisposed) return;
    this.quality = tier;
    this.clearBuilt();
    this.build();
  }

  private clearBuilt(): void {
    if (this.skyRoot) {
      this.skyRoot.removeFromParent();
      this.skyRoot = null;
    }
    if (this.wildRoot) {
      this.wildRoot.removeFromParent();
      this.wildRoot = null;
    }
    this.floatingGroups = [];
    this.canopyBatch = null;
    this.canopyPlacements = [];
    this.trunkBatch = null;
    this.trunkPlacements = [];
    this.rockletBatch = null;
    this.rockletPlacements = [];
    this.mistBands = [];
    this.waterfallMeshes = [];
    this.detailScope.releaseAll();
  }

  private build(): void {
    const lod = DISTANT_ISLAND_LOD_COUNTS[this.quality];
    this.skyRoot = this.buildSkyIslands(lod);
    this.wildRoot = this.buildWildIsland(lod);
    this.root.add(this.skyRoot, this.wildRoot);
    this.resting = false;
    this.applyMotion(this.animTime);
    this.canopyBatch?.computeBoundingSphere();
    this.trunkBatch?.computeBoundingSphere();
    this.rockletBatch?.computeBoundingSphere();
  }

  update(dt: number, reducedMotion = false): void {
    if (reducedMotion) {
      if (!this.resting) {
        this.applyMotion(0);
        this.resting = true;
      }
      return;
    }
    this.resting = false;
    const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1);
    this.animTime += step;
    this.applyMotion(this.animTime);
  }

  private applyMotion(time: number): void {
    for (const item of this.floatingGroups) {
      const offsetY = time === 0 ? 0 : Math.sin(time * item.speed + item.phase) * item.amp;
      item.group.position.y = item.baseY + offsetY;
    }

    const applyBatch = (batch: THREE.InstancedMesh | null, placements: readonly SkyInstancePlacement[], spin = false): void => {
      if (!batch) return;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        const fg = this.floatingGroups[p.siteIndex];
        const dy = fg ? fg.group.position.y - fg.baseY : 0;
        const bob = time === 0 || p.orbitAmp === 0 ? 0 : Math.sin(time * 0.65 + p.orbitPhase) * p.orbitAmp;
        this.dummy.position.set(p.x, p.baseY + dy + bob, p.z);
        this.dummy.rotation.set(
          spin && time !== 0 ? Math.sin(time * 0.25 + p.orbitPhase) * 0.12 : 0,
          p.rotY + (spin && time !== 0 ? time * 0.08 : 0),
          0,
        );
        this.dummy.scale.set(p.sx, p.sy, p.sz);
        this.dummy.updateMatrix();
        batch.setMatrixAt(i, this.dummy.matrix);
      }
      batch.instanceMatrix.needsUpdate = true;
    };

    applyBatch(this.canopyBatch, this.canopyPlacements, false);
    applyBatch(this.trunkBatch, this.trunkPlacements, false);
    applyBatch(this.rockletBatch, this.rockletPlacements, true);

    if (this.waterfallMeshes.length > 0) {
      const wf = this.waterfallMeshes[0];
      const baseOpacity = (wf.userData.baseOpacity as number) ?? 0.46;
      const mat = wf.material as THREE.MeshBasicMaterial;
      mat.opacity = time === 0 ? baseOpacity : baseOpacity * (0.88 + 0.12 * Math.sin(time * 1.3));
    }

    for (let i = 0; i < this.mistBands.length; i++) {
      const band = this.mistBands[i];
      const baseRot = (band.userData.baseRotY as number) ?? 0;
      const dir = i % 2 === 0 ? 1 : -1;
      band.rotation.y = time === 0 ? baseRot : baseRot + Math.sin(time * 0.25) * 0.05 * dir;
    }
  }

  private buildSkyIslands(lod: DistantIslandLodSpec): THREE.Group {
    const s = this.detailScope;
    const group = new THREE.Group();
    group.name = 'distant-sky-islands';
    group.userData.destinationWorld = 'W06';
    group.userData.visualRole = 'distant-floating-sky-islands';
    group.position.set(...SKY_ISLANDS_ANCHOR);

    // Moonlit aerial-perspective materials (fog: false prevents 300 m fog wall from erasing skyline)
    const rockMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x2e4256,
      emissive: 0x0c1b29,
      emissiveIntensity: 0.55,
      roughness: 0.9,
      metalness: 0.06,
      flatShading: true,
      fog: false,
    }));
    const darkRockMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x1d2d3d,
      emissive: 0x07121c,
      emissiveIntensity: 0.5,
      roughness: 0.94,
      metalness: 0.04,
      flatShading: true,
      fog: false,
    }));
    const grassMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x2d695c,
      emissive: 0x10302b,
      emissiveIntensity: 0.52,
      roughness: 0.88,
      metalness: 0.04,
      flatShading: true,
      fog: false,
    }));
    const terraceMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x3b806e,
      emissive: 0x143b33,
      emissiveIntensity: 0.5,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
      fog: false,
    }));
    const archMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x627a8b,
      emissive: 0x1f3142,
      emissiveIntensity: 0.45,
      roughness: 0.72,
      metalness: 0.14,
      fog: false,
    }));
    const crystalMat = s.track(new THREE.MeshBasicMaterial({
      color: 0x8af0e6,
      toneMapped: false,
      fog: false,
    }));
    const lanternMat = s.track(new THREE.MeshBasicMaterial({
      color: 0xffd188,
      toneMapped: false,
      fog: false,
    }));
    const canopyMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x2b6e61,
      emissive: 0x0e2f2a,
      emissiveIntensity: 0.52,
      roughness: 0.86,
      flatShading: true,
      fog: false,
    }));
    const trunkMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x3a2e28,
      emissive: 0x14100d,
      emissiveIntensity: 0.35,
      roughness: 0.94,
      fog: false,
    }));

    const waterfallTex = s.track(this.createWaterfallTexture());
    const waterfallMat = s.track(new THREE.MeshBasicMaterial({
      color: 0x8be2f4,
      map: waterfallTex,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }));
    const mistPuffMat = s.track(new THREE.MeshBasicMaterial({
      color: 0x5ca6c7,
      map: waterfallTex,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }));

    const activeSites = SKY_ISLAND_SITES.slice(0, lod.skyIslandCount);
    let archesBuilt = 0;
    let waterfallsBuilt = 0;

    for (let i = 0; i < activeSites.length; i++) {
      const site = activeSites[i];
      const sub = new THREE.Group();
      sub.name = `sky-island-node-${i}`;
      sub.position.set(site.x, site.y, site.z);
      group.add(sub);
      this.floatingGroups.push({
        group: sub,
        baseY: site.y,
        amp: site.amp,
        speed: site.speed,
        phase: site.phase,
      });

      // 1. Tapered craggy rock underside
      const rockGeo = s.track(this.buildFloatingRockGeometry(site.radius, site.depth, lod.skyRadialSegments, i * 17 + 5));
      const rockMesh = new THREE.Mesh(rockGeo, rockMat);
      rockMesh.name = `sky-island-rock-${i}`;
      sub.add(rockMesh);

      // Secondary lower basalt keel spire for silhouette depth
      const keelGeo = s.track(new THREE.ConeGeometry(site.radius * 0.36, site.depth * 0.52, Math.max(5, lod.skyRadialSegments - 2)));
      const keelMesh = new THREE.Mesh(keelGeo, darkRockMat);
      keelMesh.rotation.x = Math.PI;
      keelMesh.position.set(site.radius * 0.08, -site.depth * 0.72, -site.radius * 0.06);
      sub.add(keelMesh);

      // 2. Grassy terraced crowns
      const crownGeo = s.track(new THREE.CylinderGeometry(site.radius * 0.98, site.radius * 1.03, 1.4, lod.skyRadialSegments));
      const crownMesh = new THREE.Mesh(crownGeo, grassMat);
      crownMesh.name = `sky-island-crown-${i}`;
      crownMesh.position.y = 0.7;
      sub.add(crownMesh);

      const upperRadius = site.radius * 0.58;
      const terraceGeo = s.track(new THREE.CylinderGeometry(upperRadius * 0.92, upperRadius * 1.04, 1.5, lod.skyRadialSegments));
      const terraceMesh = new THREE.Mesh(terraceGeo, terraceMat);
      terraceMesh.position.set(site.radius * 0.08, 2.05, -site.radius * 0.05);
      sub.add(terraceMesh);

      if (this.quality === 'high') {
        const ridgeRingGeo = s.track(new THREE.CylinderGeometry(upperRadius * 0.52, upperRadius * 0.62, 1.1, lod.skyRadialSegments));
        const ridgeRing = new THREE.Mesh(ridgeRingGeo, grassMat);
        ridgeRing.position.set(-site.radius * 0.14, 3.0, site.radius * 0.10);
        sub.add(ridgeRing);
      }

      // 3. Miniature archway + sky crystal / lantern cues
      if (site.hasArch && archesBuilt < lod.skyArchways) {
        archesBuilt++;
        const archGroup = new THREE.Group();
        archGroup.name = `sky-island-archway-${i}`;
        const archY = 2.8;
        const archX = site.radius * 0.08;
        const archZ = -site.radius * 0.05;
        archGroup.position.set(archX, archY, archZ);
        archGroup.rotation.y = i === 0 ? -0.45 : 0.65;

        const pillarSpan = i === 0 ? 3.2 : 2.1;
        const pillarH = i === 0 ? 6.2 : 4.2;
        const pillarGeo = s.track(new THREE.BoxGeometry(i === 0 ? 0.9 : 0.65, pillarH, i === 0 ? 0.9 : 0.65));
        for (const side of [-1, 1]) {
          const pillar = new THREE.Mesh(pillarGeo, archMat);
          pillar.position.set(side * pillarSpan, pillarH / 2, 0);
          archGroup.add(pillar);
        }
        const lintelGeo = s.track(new THREE.TorusGeometry(pillarSpan, i === 0 ? 0.48 : 0.34, 6, 12, Math.PI));
        const lintel = new THREE.Mesh(lintelGeo, archMat);
        lintel.position.set(0, pillarH, 0);
        archGroup.add(lintel);

        const crystalGeo = s.track(new THREE.OctahedronGeometry(i === 0 ? 1.35 : 0.95, 0));
        const crystal = new THREE.Mesh(crystalGeo, i === 0 ? crystalMat : lanternMat);
        crystal.name = `sky-island-beacon-${i}`;
        crystal.position.set(0, pillarH * 0.62, 0);
        crystal.scale.set(0.85, 1.45, 0.85);
        archGroup.add(crystal);

        if (i === 0) {
          const flankGeo = s.track(new THREE.SphereGeometry(0.55, 6, 5));
          for (const side of [-1, 1]) {
            const lantern = new THREE.Mesh(flankGeo, lanternMat);
            lantern.position.set(side * (pillarSpan + 2.2), 1.4, 1.4);
            archGroup.add(lantern);
          }
        }
        sub.add(archGroup);
      }

      // 4. Hanging waterfalls / mist ribbons
      for (let w = 0; w < site.waterfalls && waterfallsBuilt < lod.skyWaterfalls; w++) {
        waterfallsBuilt++;
        const angle = (w === 0 ? 2.25 : 4.05) + i * 0.9;
        const dropLen = site.depth * (0.95 + w * 0.14);
        const ribbonGeo = s.track(new THREE.PlaneGeometry(site.radius * 0.19, dropLen, 1, 5));
        const ribbon = new THREE.Mesh(ribbonGeo, waterfallMat);
        ribbon.name = `sky-island-waterfall-${waterfallsBuilt}`;
        ribbon.userData.baseOpacity = 0.46;
        ribbon.position.set(
          Math.cos(angle) * (site.radius * 0.92),
          0.4 - dropLen * 0.5,
          Math.sin(angle) * (site.radius * 0.92),
        );
        ribbon.lookAt(0, ribbon.position.y, 0);
        sub.add(ribbon);
        this.waterfallMeshes.push(ribbon);

        // Soft cross-ribbon & mist plume beneath drop
        const plumeGeo = s.track(new THREE.PlaneGeometry(site.radius * 0.34, dropLen * 0.38));
        const plume = new THREE.Mesh(plumeGeo, mistPuffMat);
        plume.position.set(ribbon.position.x, -dropLen + 1.2, ribbon.position.z);
        plume.rotation.y = ribbon.rotation.y + Math.PI * 0.35;
        sub.add(plume);
      }
    }

    // 5. Instanced botanical canopies & trunks distributed across active sky islands
    const canopyGeo = s.track(new THREE.IcosahedronGeometry(1, 1));
    const trunkGeo = s.track(new THREE.CylinderGeometry(0.22, 0.34, 1.8, 6));
    const canopyBatch = s.track(new THREE.InstancedMesh(canopyGeo, canopyMat, lod.skyCanopies));
    canopyBatch.name = 'sky-island-botanical-canopies';
    const trunkBatch = s.track(new THREE.InstancedMesh(trunkGeo, trunkMat, lod.skyCanopies));
    trunkBatch.name = 'sky-island-botanical-trunks';

    for (let k = 0; k < lod.skyCanopies; k++) {
      const siteIdx = k % activeSites.length;
      const site = activeSites[siteIdx];
      const ang = seeded01(k * 19 + 3) * Math.PI * 2;
      const radial = site.radius * (0.28 + 0.56 * Math.sqrt(seeded01(k * 31 + 7)));
      const lx = Math.cos(ang) * radial;
      const lz = Math.sin(ang) * radial;
      const onUpper = Math.hypot(lx - site.radius * 0.08, lz + site.radius * 0.05) < site.radius * 0.55;
      const surfaceY = onUpper ? 2.8 : 1.4;
      const scale = (0.95 + seeded01(k * 43 + 11) * 1.15) * (siteIdx === 0 ? 1.2 : 0.9);
      const trunkH = scale * 1.15;

      this.trunkPlacements.push({
        siteIndex: siteIdx,
        x: site.x + lx,
        baseY: site.y + surfaceY + trunkH * 0.5,
        z: site.z + lz,
        rotY: ang,
        sx: scale * 0.65,
        sy: trunkH,
        sz: scale * 0.65,
        orbitAmp: 0,
        orbitPhase: 0,
      });
      this.canopyPlacements.push({
        siteIndex: siteIdx,
        x: site.x + lx,
        baseY: site.y + surfaceY + trunkH + scale * 0.72,
        z: site.z + lz,
        rotY: ang * 1.3,
        sx: scale * 1.35,
        sy: scale * 0.92,
        sz: scale * 1.35,
        orbitAmp: 0,
        orbitPhase: 0,
      });
    }
    group.add(trunkBatch, canopyBatch);
    this.trunkBatch = trunkBatch;
    this.canopyBatch = canopyBatch;

    // 6. Instanced floating rocklets orbiting undersides (medium/high)
    if (lod.skyRocklets > 0) {
      const rockletGeo = s.track(new THREE.DodecahedronGeometry(1, 0));
      const rockletBatch = s.track(new THREE.InstancedMesh(rockletGeo, darkRockMat, lod.skyRocklets));
      rockletBatch.name = 'sky-island-floating-rocklets';
      for (let k = 0; k < lod.skyRocklets; k++) {
        const siteIdx = k % activeSites.length;
        const site = activeSites[siteIdx];
        const ang = (k / lod.skyRocklets) * Math.PI * 2 + seeded01(k * 13) * 0.8;
        const dist = site.radius * (0.65 + seeded01(k * 29 + 4) * 0.72);
        const depthY = -3.0 - seeded01(k * 37 + 9) * (site.depth * 0.9);
        const size = 0.65 + seeded01(k * 41 + 2) * 1.35;
        this.rockletPlacements.push({
          siteIndex: siteIdx,
          x: site.x + Math.cos(ang) * dist,
          baseY: site.y + depthY,
          z: site.z + Math.sin(ang) * dist,
          rotY: ang,
          sx: size,
          sy: size * (1.2 + seeded01(k * 7) * 0.8),
          sz: size * 0.9,
          orbitAmp: 0.35 + seeded01(k * 53) * 0.45,
          orbitPhase: seeded01(k * 61) * Math.PI * 2,
        });
      }
      group.add(rockletBatch);
      this.rockletBatch = rockletBatch;
    }

    return group;
  }

  private buildWildIsland(lod: DistantIslandLodSpec): THREE.Group {
    const s = this.detailScope;
    const group = new THREE.Group();
    group.name = 'distant-wild-island';
    group.userData.destinationWorld = 'W10';
    group.userData.visualRole = 'distant-wild-island-silhouette';
    group.position.set(...WILD_ISLAND_ANCHOR);

    // 1. Sculpted layered volcanic / pine-ridge landmass (muted twilight palette matching night horizon)
    const terrainGeo = s.track(this.buildWildTerrainGeometry(lod.wildRadialSegments, lod.wildRingSegments));
    const terrainMat = s.track(new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: 0x050e17,
      emissiveIntensity: 0.28,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true,
      fog: false,
    }));
    const massif = new THREE.Mesh(terrainGeo, terrainMat);
    massif.name = 'wild-island-massif';
    group.add(massif);

    // 2. Flanking offshore sea stack islet off the eastern horn (separated across open water)
    const stackGeo = s.track(this.buildSeaStackGeometry(13, 21, Math.max(8, Math.floor(lod.wildRadialSegments * 0.4))));
    const stackMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x0d1b28,
      emissive: 0x050e17,
      emissiveIntensity: 0.28,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true,
      fog: false,
    }));
    const seaStack = new THREE.Mesh(stackGeo, stackMat);
    seaStack.name = 'wild-island-sea-stack';
    // At u = +112, v = +4 along broadside horizon axis -> (lx = 85.5, lz = 72.3)
    seaStack.position.set(85.5, 0, 72.3);
    group.add(seaStack);

    // 3. Instanced pine-ridge silhouettes seated on the lower & mid mountain slopes
    const pineGeo = s.track(this.buildPineSilhouetteGeometry());
    const pineMat = s.track(new THREE.MeshStandardMaterial({
      color: 0x0e2426,
      emissive: 0x051416,
      emissiveIntensity: 0.34,
      roughness: 0.94,
      flatShading: true,
      fog: false,
    }));
    const pineBatch = s.track(new THREE.InstancedMesh(pineGeo, pineMat, lod.wildPines));
    pineBatch.name = 'wild-island-pine-ridges';
    let placedPines = 0;
    for (let attempt = 0; attempt < lod.wildPines * 24 && placedPines < lod.wildPines; attempt++) {
      const ang = seeded01(attempt * 17 + 3) * Math.PI * 2;
      const maxR = wildCoastRadius(ang);
      const r = maxR * (0.20 + 0.58 * Math.sqrt(seeded01(attempt * 23 + 7)));
      const lx = Math.cos(ang) * r;
      const lz = Math.sin(ang) * r;
      const y = sampleWildIslandElevation(lx, lz);
      if (y < 4.0 || y > 27) continue;
      const scale = 1.35 + seeded01(attempt * 31 + 13) * 1.6;
      this.dummy.position.set(lx, y - 0.3, lz);
      this.dummy.rotation.set(0, ang, 0);
      this.dummy.scale.set(scale, scale * (1.05 + seeded01(attempt * 41) * 0.4), scale);
      this.dummy.updateMatrix();
      pineBatch.setMatrixAt(placedPines, this.dummy.matrix);
      placedPines++;
    }
    pineBatch.count = placedPines;
    pineBatch.instanceMatrix.needsUpdate = true;
    pineBatch.computeBoundingSphere();
    group.add(pineBatch);

    // 4. Elliptical shoreline mist collar hugging the cliff base without extending past island flanks
    const mistTex = s.track(this.createMistBandTexture());
    for (let m = 0; m < lod.wildMistLayers; m++) {
      const rx = 89 + m * 6;
      const rz = 56 + m * 5;
      const height = 6.5 + m * 2.5;
      const mistGeo = s.track(new THREE.CylinderGeometry(0.95, 1.0, height, 36, 1, true));
      mistGeo.scale(rx, 1, rz);
      const mistMat = s.track(new THREE.MeshBasicMaterial({
        color: m === 0 ? 0x203e5a : 0x1a354e,
        map: mistTex,
        transparent: true,
        opacity: m === 0 ? 0.32 : 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }));
      const band = new THREE.Mesh(mistGeo, mistMat);
      band.name = `wild-island-mist-band-${m}`;
      band.position.set(0, height * 0.35 - 1.5, 0);
      // Align ellipse with broadside horizon axis (theta = atan2(0.618, 0.786) = 0.666 rad)
      const baseRot = -0.666;
      band.userData.baseRotY = baseRot;
      band.rotation.y = baseRot;
      group.add(band);
      this.mistBands.push(band);
    }

    // 5. High-plateau explorer shrine beacon & soft atmospheric mist halo (zero THREE.Light)
    // Saddle at u = +5, v = +1 -> (lx = 3.3, lz = 3.9)
    const beaconX = 3.3;
    const beaconZ = 3.9;
    const beaconBaseY = sampleWildIslandElevation(beaconX, beaconZ);
    const beaconGroup = new THREE.Group();
    beaconGroup.name = 'wild-island-beacon';
    beaconGroup.position.set(beaconX, beaconBaseY, beaconZ);

    const spireGeo = s.track(new THREE.ConeGeometry(0.9, 5.2, 5));
    const spireMesh = new THREE.Mesh(spireGeo, stackMat);
    spireMesh.position.y = 2.4;
    beaconGroup.add(spireMesh);

    const emberMat = s.track(new THREE.MeshBasicMaterial({
      color: 0xffc070,
      toneMapped: false,
      fog: false,
    }));
    const emberGeo = s.track(new THREE.SphereGeometry(1.15, 8, 6));
    const ember = new THREE.Mesh(emberGeo, emberMat);
    ember.position.y = 5.3;
    beaconGroup.add(ember);

    const haloMat = s.track(new THREE.MeshBasicMaterial({
      color: 0x9ce2ea,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }));
    const haloGeo = s.track(new THREE.RingGeometry(2.0, 4.6, 16));
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = 5.3;
    halo.rotation.x = Math.PI / 2;
    beaconGroup.add(halo);

    group.add(beaconGroup);

    return group;
  }

  private buildFloatingRockGeometry(
    radius: number,
    depth: number,
    radialSegs: number,
    seed: number,
  ): THREE.BufferGeometry {
    // Rings from top rim (t = 0) down to tapered underside tip (t = 1)
    const ringTs = [0, 0.26, 0.58, 0.84];
    const positions: number[] = [];
    const indices: number[] = [];

    // Top center vertex (0)
    positions.push(0, 0.2, 0);

    for (let rIdx = 0; rIdx < ringTs.length; rIdx++) {
      const t = ringTs[rIdx];
      const baseR = radius * Math.pow(1 - t, 0.68);
      const y = -t * depth;
      for (let aIdx = 0; aIdx < radialSegs; aIdx++) {
        const angle = (aIdx / radialSegs) * Math.PI * 2;
        const crag = 0.82 + 0.30 * seeded01(seed + rIdx * 37 + aIdx * 13);
        const yJitter = rIdx === 0 ? 0 : (seeded01(seed + rIdx * 53 + aIdx * 7) - 0.5) * depth * 0.08;
        positions.push(Math.cos(angle) * baseR * crag, y + yJitter, Math.sin(angle) * baseR * crag);
      }
    }

    // Bottom spire tip vertex
    const tipIndex = 1 + ringTs.length * radialSegs;
    positions.push(0, -depth, 0);

    // Top cap fan
    for (let a = 0; a < radialSegs; a++) {
      const next = (a + 1) % radialSegs;
      indices.push(0, 1 + next, 1 + a);
    }
    // Side walls between rings
    for (let r = 0; r < ringTs.length - 1; r++) {
      const rowA = 1 + r * radialSegs;
      const rowB = 1 + (r + 1) * radialSegs;
      for (let a = 0; a < radialSegs; a++) {
        const next = (a + 1) % radialSegs;
        indices.push(rowA + a, rowA + next, rowB + a);
        indices.push(rowA + next, rowB + next, rowB + a);
      }
    }
    // Bottom cone tip fan
    const lastRow = 1 + (ringTs.length - 1) * radialSegs;
    for (let a = 0; a < radialSegs; a++) {
      const next = (a + 1) % radialSegs;
      indices.push(lastRow + a, lastRow + next, tipIndex);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  private buildWildTerrainGeometry(radialSegs: number, ringSegs: number): THREE.BufferGeometry {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const colorAt = (y: number, u: number): readonly [number, number, number] => {
      if (u > 0.86 || y < 3.5) return [0.024, 0.048, 0.080]; // dark nocturnal sea cliff
      if (y < 20) return [0.036, 0.082, 0.092]; // deep moonlit pine slope
      if (y < 34) return [0.038, 0.075, 0.115]; // twilight alpine crag
      return [0.062, 0.110, 0.158]; // muted volcanic crest
    };

    // Center apex vertex (0)
    const cy = sampleWildIslandElevation(0, 0);
    positions.push(0, cy, 0);
    colors.push(...colorAt(cy, 0));

    for (let r = 1; r <= ringSegs; r++) {
      const u = r / ringSegs;
      for (let a = 0; a < radialSegs; a++) {
        const angle = (a / radialSegs) * Math.PI * 2;
        const maxR = wildCoastRadius(angle);
        const lx = Math.cos(angle) * maxR * u;
        const lz = Math.sin(angle) * maxR * u;
        const ly = u >= 0.999 ? -2.4 : sampleWildIslandElevation(lx, lz);
        positions.push(lx, ly, lz);
        colors.push(...colorAt(ly, u));
      }
    }

    // Center ring fan
    for (let a = 0; a < radialSegs; a++) {
      const next = (a + 1) % radialSegs;
      indices.push(0, 1 + next, 1 + a);
    }
    // Outer rings
    for (let r = 0; r < ringSegs - 1; r++) {
      const rowA = 1 + r * radialSegs;
      const rowB = 1 + (r + 1) * radialSegs;
      for (let a = 0; a < radialSegs; a++) {
        const next = (a + 1) % radialSegs;
        indices.push(rowA + a, rowA + next, rowB + a);
        indices.push(rowA + next, rowB + next, rowB + a);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  private buildSeaStackGeometry(radius: number, height: number, radialSegs: number): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    positions.push(0, height, 0);
    const rings = [0.22, 0.62, 1.0];
    for (let r = 0; r < rings.length; r++) {
      const u = rings[r];
      const y = r === rings.length - 1 ? -2.2 : height * (1 - u * 0.85);
      for (let a = 0; a < radialSegs; a++) {
        const ang = (a / radialSegs) * Math.PI * 2;
        const crag = 0.72 + 0.42 * seeded01(r * 43 + a * 19 + 11);
        positions.push(Math.cos(ang) * radius * u * crag, y, Math.sin(ang) * radius * u * crag);
      }
    }
    for (let a = 0; a < radialSegs; a++) {
      const next = (a + 1) % radialSegs;
      indices.push(0, 1 + next, 1 + a);
    }
    for (let r = 0; r < rings.length - 1; r++) {
      const rowA = 1 + r * radialSegs;
      const rowB = 1 + (r + 1) * radialSegs;
      for (let a = 0; a < radialSegs; a++) {
        const next = (a + 1) % radialSegs;
        indices.push(rowA + a, rowA + next, rowB + a);
        indices.push(rowA + next, rowB + next, rowB + a);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  private buildPineSilhouetteGeometry(): THREE.BufferGeometry {
    // Two-tier conifer silhouette merged into one lightweight geometry (7 radial sides)
    const sides = 7;
    const positions: number[] = [];
    const indices: number[] = [];

    const addCone = (yBase: number, rBase: number, height: number): void => {
      const baseCenter = positions.length / 3;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        positions.push(Math.cos(a) * rBase, yBase, Math.sin(a) * rBase);
      }
      const tip = positions.length / 3;
      positions.push(0, yBase + height, 0);
      for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        indices.push(baseCenter + i, baseCenter + next, tip);
      }
    };

    addCone(0.4, 1.05, 2.2);
    addCone(1.8, 0.72, 2.0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  private createWaterfallTexture(): THREE.DataTexture {
    const w = 16;
    const h = 32;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1); // 0 = bottom, 1 = top in DataTexture
      const verticalFade = Math.sin(v * Math.PI) * (0.35 + 0.65 * v);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const edgeFade = Math.sin(u * Math.PI);
        const streaks = 0.55 + 0.45 * Math.sin(u * Math.PI * 6 + v * 3.0);
        const alpha = Math.max(0, Math.min(255, Math.round(verticalFade * edgeFade * streaks * 255)));
        const idx = (y * w + x) * 4;
        data[idx] = 225;
        data[idx + 1] = 246;
        data[idx + 2] = 255;
        data[idx + 3] = alpha;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  private createMistBandTexture(): THREE.DataTexture {
    const w = 64;
    const h = 16;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      const verticalEnvelope = Math.pow(Math.sin(v * Math.PI), 1.5);
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const wisps = 0.48
          + 0.30 * Math.sin(u * Math.PI * 2 * 3)
          + 0.22 * Math.cos(u * Math.PI * 2 * 5 + 0.9);
        const alpha = Math.max(0, Math.min(255, Math.round(verticalEnvelope * wisps * 255)));
        const idx = (y * w + x) * 4;
        data[idx] = 215;
        data[idx + 1] = 235;
        data[idx + 2] = 250;
        data[idx + 3] = alpha;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }
}

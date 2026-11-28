import * as THREE from 'three';
import { applyLandscape } from '../../render/LandscapeShading';
import { ResourceScope } from '../../assets/ResourceScope';
import { CollisionWorld } from '../CollisionWorld';
import type { QualityTier } from '../../render/QualityTiers';
import {
  FOREST_BELT_BOUNDS, ISLAND_OUTLINE, PATH_CENTERLINES, PIER_CENTERLINE, SCENIC_GROVE_POINTS,
  SPIRE_GARDEN_CENTER, SPIRE_GARDEN_RADIUS, LANTERN_WALK_Z, distanceToLighthousePath,
  distanceToObservatoryPath, inAncientTreeClearing, isLighthousePeninsula, isRuinedObservatory, isSiteLand,
} from './IslandSiteLayout';
import { WAYMARKER_POSTS } from './ExteriorWaymarkers';
import { CANOPY_UNDERSIDE_MIN, blocksLandmarkSightline, landmarkGroundExcluded } from './IslandLandmarks';

/** Even walking rhythm of path edge lights (metres of path between lights). */
export const PATH_LIGHT_SPACING = 13;
/** Edge lights sit just off the 2.3 m half-width ribbon. */
export const PATH_LIGHT_OFFSET = 2.7;
/** Where the pier edge trim opens for the island-loop crossing (z range). */
export const PIER_TRIM_GAP: readonly [number, number] = [181, 186.8];

/** The lantern walk carries its own light; waymarkers stand at the forks. */
export function pathLightSuppressed(x: number, z: number): boolean {
  const lanternFrom = Math.min(...LANTERN_WALK_Z) - 4;
  const lanternTo = Math.max(...LANTERN_WALK_Z) + 4;
  if (x > 38 && x < 54 && z > lanternFrom && z < lanternTo) return true;
  return WAYMARKER_POSTS.some((post) => Math.hypot(post.x - x, post.z - z) < 3.5);
}

/** Paths, woodland, western spire court and the axial south pier. */
export class IslandLandscape {
  readonly root = new THREE.Group();
  private readonly detailScope: ResourceScope;
  private detailObjects: THREE.Object3D[] = [];
  private built = false;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
    private quality: QualityTier,
  ) {
    this.root.name = 'island-landscape';
    this.detailScope = scope.track(new ResourceScope('island-landscape-detail'));
  }

  build(): THREE.Group {
    if (this.built) return this.root;
    this.built = true;
    this.buildPaths();
    this.buildSpireGarden();
    this.buildPier();
    this.buildDetail(true);
    return this.root;
  }

  /** Replace render-only batches; the construction-time collision world is immutable. */
  setQuality(tier: QualityTier): void {
    if (tier === this.quality || this.scope.isDisposed) return;
    this.quality = tier;
    if (!this.built) return;
    for (const object of this.detailObjects) object.removeFromParent();
    this.detailScope.releaseAll();
    this.buildDetail(false);
  }

  private buildDetail(registerCollision: boolean): void {
    const first = this.root.children.length;
    this.buildCoastalRocks();
    this.buildWoodland(registerCollision);
    this.buildWildflowerGlades();
    this.detailObjects = this.root.children.slice(first);
  }

  private buildPaths(): void {
    const pathMat = applyLandscape(this.scope.track(new THREE.MeshStandardMaterial({ color: 0xb6a27a, roughness: 0.92, metalness: 0.02 })), 'gravel');
    const lightMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0xffbf78, toneMapped: false }));
    const markers: { x: number; z: number; id: string }[] = [];
    PATH_CENTERLINES.forEach((points, pathIndex) => {
      const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, -0.465, z)), false, 'centripetal');
      const samples = curve.getPoints(Math.max(24, points.length * 16));
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i < samples.length; i++) {
        const tangent = curve.getTangent(i / (samples.length - 1));
        const nx = tangent.z;
        const nz = -tangent.x;
        positions.push(samples[i].x - nx * 2.3, -0.465, samples[i].z - nz * 2.3);
        positions.push(samples[i].x + nx * 2.3, -0.465, samples[i].z + nz * 2.3);
        if (i < samples.length - 1) {
          const a = i * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const geo = this.scope.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, pathMat);
      mesh.name = `site-path-${pathIndex + 1}`;
      mesh.receiveShadow = true;
      this.root.add(mesh);

      // Edge lights at an even walking rhythm (arc length, not spline
      // parameter), alternating sides so the ribbon reads as a lit path.
      // The old sampler stepped every 22nd parameter sample: spacing varied
      // with segment length and every light fell on the same side.
      const length = curve.getLength();
      const count = Math.max(1, Math.round(length / PATH_LIGHT_SPACING));
      for (let k = 0; k < count; k++) {
        const u = curve.getUtoTmapping((k + 0.5) / count, 0);
        const p = curve.getPoint(u);
        const tangent = curve.getTangent(u);
        const side = (pathIndex + k) % 2 === 0 ? 1 : -1;
        const x = p.x + tangent.z * PATH_LIGHT_OFFSET * side;
        const z = p.z - tangent.x * PATH_LIGHT_OFFSET * side;
        // The lantern stretch has its own light; waymarkers stand at the forks.
        if (pathLightSuppressed(x, z)) continue;
        // Never float a path light over the lagoon or off the island.
        if (isSiteLand(x, z)) markers.push({ x, z, id: `path-ground-light-${pathIndex + 1}-${k}` });
      }
    });
    // The pier junction is the one fork on the way in: a lit pair marks each
    // path mouth so the turn-off reads from the spawn at night.
    for (const [pathIndex, fromEnd] of [[0, false], [PATH_CENTERLINES.length - 1, true]] as const) {
      const points = PATH_CENTERLINES[pathIndex];
      const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, -0.465, z)), false, 'centripetal');
      const along = 9 / curve.getLength();
      const u = curve.getUtoTmapping(fromEnd ? 1 - along : along, 0);
      const p = curve.getPoint(u);
      const tangent = curve.getTangent(u);
      for (const side of [-1, 1]) {
        const x = p.x + tangent.z * PATH_LIGHT_OFFSET * side;
        const z = p.z - tangent.x * PATH_LIGHT_OFFSET * side;
        if (isSiteLand(x, z)) markers.push({ x, z, id: `path-junction-light-${pathIndex + 1}-${side}` });
      }
    }
    const markerGeo = this.scope.track(new THREE.SphereGeometry(0.18, 8, 6));
    const batch = new THREE.InstancedMesh(markerGeo, lightMat, markers.length);
    batch.name = 'path-ground-light-instances';
    batch.userData.visualRole = 'landscape-path-edge-guidance';
    batch.userData.sourceMarkerIds = markers.map((marker) => marker.id);
    const placement = new THREE.Object3D();
    for (const [i, marker] of markers.entries()) {
      // Bottom of 18 cm sphere meets the path surface at Y = -0.465.
      placement.position.set(marker.x, -0.285, marker.z);
      placement.rotation.set(0, 0, 0);
      placement.scale.set(1, 1, 1);
      placement.updateMatrix();
      batch.setMatrixAt(i, placement.matrix);
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingSphere();
    this.root.add(batch);
    this.scope.trackObject(batch);
  }

  private buildSpireGarden(): void {
    const center = SPIRE_GARDEN_CENTER;
    const earth = applyLandscape(this.scope.track(new THREE.MeshStandardMaterial({ color: 0x8a7650, roughness: 0.96 })), 'gravel');
    const gold = this.scope.track(new THREE.MeshStandardMaterial({ color: 0xc7a34b, roughness: 0.42, metalness: 0.65, emissive: 0x2b1805, emissiveIntensity: 0.18 }));
    const ringMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0xffca73, toneMapped: false }));
    const court = new THREE.Mesh(this.scope.track(new THREE.CircleGeometry(SPIRE_GARDEN_RADIUS, 48)), earth);
    court.name = 'northwest-spire-garden-clearing';
    court.rotation.x = -Math.PI / 2;
    court.position.set(center[0], -0.47, center[2]);
    this.root.add(court);
    for (const radius of [17, 20.5, 23]) {
      const ring = new THREE.Mesh(this.scope.track(new THREE.TorusGeometry(radius, 0.22, 6, 64)), ringMat);
      ring.name = `spire-garden-concentric-ring-${radius}`;
      ring.rotation.x = Math.PI / 2;
      ring.position.set(center[0], -0.25, center[2]);
      this.root.add(ring);
    }
    const base = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(2.4, 3.1, 1.2, 20)), gold);
    base.name = 'gold-spire-base';
    base.position.set(center[0], 0.1, center[2]);
    this.root.add(base);
    const spire = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.16, 1.1, 31, 12)), gold);
    spire.name = 'single-golden-spire';
    spire.position.set(center[0], 16.2, center[2]);
    this.root.add(spire);
    const tip = new THREE.Mesh(this.scope.track(new THREE.ConeGeometry(0.16, 4, 12)), ringMat);
    tip.name = 'gold-spire-tip';
    tip.position.set(center[0], 33.5, center[2]);
    this.root.add(tip);
    const plinth = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(6.5, 0.45, 6.5)), earth);
    plinth.position.set(center[0], -0.12, center[2]);
    this.root.add(plinth);
    this.collision.addBox([center[0], 0.1, center[2]], [3.25, 0.35, 3.25]);
    const topiaryGeo = this.scope.track(new THREE.IcosahedronGeometry(1.55, 1));
    const topiaryMat = applyLandscape(this.scope.track(new THREE.MeshStandardMaterial({ color: 0x1b3a31, roughness: 0.96 })), 'foliage');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = center[0] + Math.cos(a) * 17.5;
      const z = center[2] + Math.sin(a) * 17.5;
      const topiary = new THREE.Mesh(topiaryGeo, topiaryMat);
      topiary.name = `spire-garden-topiary-${i + 1}`;
      topiary.scale.set(1, 0.78, 1);
      topiary.position.set(x, 0.72, z);
      topiary.castShadow = true;
      this.root.add(topiary);
      this.collision.addBox([x, 0.72, z], [1.45, 1.25, 1.45]);
    }
  }

  private buildPier(): void {
    const stone = applyLandscape(this.scope.track(new THREE.MeshStandardMaterial({ color: 0x414b52, roughness: 0.84 })), 'paving');
    const trim = applyLandscape(this.scope.track(new THREE.MeshStandardMaterial({ color: 0x7b6d58, roughness: 0.74 })), 'paving');
    const points = PIER_CENTERLINE;
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, -0.49, z)), false, 'centripetal');
    const samples = curve.getPoints(24);
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      const tangent = curve.getTangent(i / (samples.length - 1));
      positions.push(samples[i].x - tangent.z * 5.5, -0.49, samples[i].z + tangent.x * 5.5);
      positions.push(samples[i].x + tangent.z * 5.5, -0.49, samples[i].z - tangent.x * 5.5);
      if (i < samples.length - 1) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const deckGeo = this.scope.track(new THREE.BufferGeometry());
    deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    deckGeo.setIndex(indices);
    deckGeo.computeVertexNormals();
    const deck = new THREE.Mesh(deckGeo, stone);
    deck.name = 'south-arrival-pier-deck';
    this.root.add(deck);
    const terminal = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(15, 0.5, 12)), trim);
    terminal.name = 'south-pier-terminal-platform';
    terminal.position.set(0, -0.75, 215);
    this.root.add(terminal);
    // Ten weathered support pylons extend through the water. Their tops
    // touch the thin pier deck; all are beneath the walkable surface.
    const pierPileMaterial = applyLandscape(this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x293940, roughness: 0.95, metalness: 0.03,
    })), 'rock');
    const pierPileGeo = this.scope.track(new THREE.CylinderGeometry(0.62, 0.76, 3.6, 8));
    const pierPiles = new THREE.InstancedMesh(pierPileGeo, pierPileMaterial, 10);
    pierPiles.name = 'pier-foundation-pylons';
    pierPiles.userData.visualRole = 'supported-pier-construction';
    const pileTransform = new THREE.Object3D();
    for (let i = 0; i < 5; i++) {
      for (const [sideIndex, side] of [-1, 1].entries()) {
        pileTransform.position.set(side * 4.7, -2.29, 168 + i * 12);
        pileTransform.updateMatrix();
        pierPiles.setMatrixAt(i * 2 + sideIndex, pileTransform.matrix);
      }
    }
    pierPiles.instanceMatrix.needsUpdate = true;
    pierPiles.computeBoundingSphere();
    this.root.add(pierPiles);
    this.scope.trackObject(pierPiles);
    // The edge trim is broken where the island loop crosses the pier, so the
    // fork reads as an opening rather than a kerb the path runs under.
    const [gapFrom, gapTo] = PIER_TRIM_GAP;
    for (const side of [-1, 1]) {
      const south = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.3, 0.35, 217 - gapTo)), trim);
      south.name = `pier-edge-${side}`;
      // The trim must touch the pier deck at -0.49, not float 0.135 m above it.
      south.position.set(side * 5.35, -0.315, (217 + gapTo) / 2);
      this.root.add(south);
      const north = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.3, 0.35, gapFrom - 159)), trim);
      north.name = `pier-edge-north-${side}`;
      north.position.set(side * 5.35, -0.315, (gapFrom + 159) / 2);
      this.root.add(north);
    }
    // A quiet amber rhythm draws the eye north from the new pier spawn.
    // Rails only: these visual-only inlays cannot obstruct the walkway.
    const guideGeometry = this.scope.track(new THREE.BoxGeometry(0.12, 0.06, 1.2));
    const guideMaterial = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xc5a17b, toneMapped: false,
    }));
    const guides = new THREE.InstancedMesh(guideGeometry, guideMaterial, 16);
    guides.name = 'pier-guide-inlays';
    guides.userData.visualRole = 'pier-wayfinding';
    const guideTransform = new THREE.Object3D();
    for (let i = 0; i < 8; i++) {
      for (const [sideIndex, side] of [-1, 1].entries()) {
        // Trim top is slightly visible above the -0.49 m stone walking surface.
        guideTransform.position.set(side * 5.35, -0.455, 168 + i * 6);
        guideTransform.rotation.set(0, 0, 0);
        guideTransform.scale.set(1, 1, 1);
        guideTransform.updateMatrix();
        guides.setMatrixAt(i * 2 + sideIndex, guideTransform.matrix);
      }
    }
    guides.instanceMatrix.needsUpdate = true;
    guides.computeBoundingSphere();
    this.root.add(guides);
    this.scope.trackObject(guides);

    // The first view is an actual pier landing, not a player floating over
    // an unmarked slab. One quiet compass ring identifies the spawn while
    // the north-facing notch points toward the real museum entrance.
    const compassMaterial = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0x9f8864, toneMapped: true,
    }));
    const compass = new THREE.Mesh(
      this.scope.track(new THREE.RingGeometry(2.02, 2.13, 48)),
      compassMaterial,
    );
    compass.name = 'pier-arrival-compass';
    compass.userData.visualRole = 'arrival-orientation';
    compass.rotation.x = -Math.PI / 2;
    compass.position.set(0, -0.465, PIER_CENTERLINE[2][1]);
    this.root.add(compass);
    const northNotch = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(0.22, 0.035, 0.72)),
      guideMaterial,
    );
    northNotch.name = 'pier-arrival-north-marker';
    northNotch.position.set(0, -0.45, PIER_CENTERLINE[2][1] - 2.4);
    this.root.add(northNotch);

    // Paired low stone sentinels frame the approach from the pier. They make
    // the dome/portico sightline ceremonial without a cinematic lock, modal,
    // expensive point light, or a wall across the walking corridor.
    const sentinelPositions = [172, 180, 188, 196, 204, 212] as const;
    const sentinelBodyGeo = this.scope.track(new THREE.CylinderGeometry(0.23, 0.32, 1.6, 10));
    const sentinelCapGeo = this.scope.track(new THREE.CylinderGeometry(0.40, 0.36, 0.14, 12));
    const sentinelBody = new THREE.InstancedMesh(sentinelBodyGeo, trim, sentinelPositions.length * 2);
    sentinelBody.name = 'pier-stone-sentinels';
    sentinelBody.userData.visualRole = 'pier-ceremonial-edges';
    const sentinelCrown = new THREE.InstancedMesh(sentinelCapGeo, guideMaterial, sentinelPositions.length * 2);
    sentinelCrown.name = 'pier-amber-sentinel-caps';
    const sentinelTransform = new THREE.Object3D();
    for (const [i, z] of sentinelPositions.entries()) {
      for (const [sideIndex, side] of [-1, 1].entries()) {
        const index = i * 2 + sideIndex;
        const x = side * 5.22;
        sentinelTransform.position.set(x, 0.31, z);
        sentinelTransform.rotation.set(0, 0, 0);
        sentinelTransform.scale.set(1, 1, 1);
        sentinelTransform.updateMatrix();
        sentinelBody.setMatrixAt(index, sentinelTransform.matrix);
        sentinelTransform.position.y = 1.17;
        sentinelTransform.updateMatrix();
        sentinelCrown.setMatrixAt(index, sentinelTransform.matrix);
        // The central 9 m walkway remains clear; physical bollards protect
        // the pier edge rather than being decorative objects one can phase through.
        this.collision.addBox([x, 0.31, z], [0.32, 0.8, 0.32]);
      }
    }
    for (const mesh of [sentinelBody, sentinelCrown]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.root.add(mesh);
      this.scope.trackObject(mesh);
    }
    this.collision.addFloor(-6, 6, 164, 218, -0.5);
  }

  /** A single instanced draw of rock outcrops, placed on the real coastline. */
  private buildCoastalRocks(): void {
    // Twice the shoreline rock detail, still a single non-colliding draw.
    const target = this.quality === 'low' ? 96 : this.quality === 'medium' ? 192 : 288;
    const geometry = this.detailScope.track(new THREE.IcosahedronGeometry(1, 0));
    const material = applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0x33494c, roughness: 0.98, metalness: 0,
      flatShading: true,
    })), 'rock');
    const rocks = new THREE.InstancedMesh(geometry, material, target);
    rocks.name = 'shoreline-rock-scatter';
    rocks.userData.visualRole = 'coastal-outcrops';
    rocks.castShadow = false;
    rocks.receiveShadow = false;
    const transform = new THREE.Object3D();
    let placed = 0;
    // Outcrops are distributed by coastline length, in irregular clusters of
    // one to four (a large anchor stone with smaller satellites) straddling
    // the waterline. The former layout gave every edge the same number of
    // rocks at the same fractions of its length: short edges were crowded,
    // long ones sparse, and the repetition read as a regular kerb.
    const edges = ISLAND_OUTLINE.map(([ax, az], i) => {
      const [bx, bz] = ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length];
      return { ax, az, bx, bz, length: Math.hypot(bx - ax, bz - az) };
    });
    const perimeter = edges.reduce((sum, edge) => sum + edge.length, 0);
    const pointAt = (s: number): { x: number; z: number; tx: number; tz: number } => {
      let rest = ((s % perimeter) + perimeter) % perimeter;
      for (const edge of edges) {
        if (rest <= edge.length) {
          const t = rest / edge.length;
          return { x: edge.ax + (edge.bx - edge.ax) * t, z: edge.az + (edge.bz - edge.az) * t,
            tx: (edge.bx - edge.ax) / edge.length, tz: (edge.bz - edge.az) / edge.length };
        }
        rest -= edge.length;
      }
      return { x: edges[0].ax, z: edges[0].az, tx: 1, tz: 0 };
    };
    const hash = (n: number): number => {
      const v = Math.sin(n * 91.3458 + 17.17) * 47453.5453;
      return v - Math.floor(v);
    };
    const clusters = Math.ceil(target / 2.5);
    for (let k = 0; k < clusters && placed < target; k++) {
      const s = ((k + 0.5 + (hash(k) - 0.5) * 0.8) / clusters) * perimeter;
      const anchor = pointAt(s);
      const size = 1 + Math.floor(hash(k + 101) * 4);
      for (let j = 0; j < size && placed < target; j++) {
        const along = j === 0 ? 0 : (hash(k * 7 + j) - 0.5) * 4.4;
        // The outline runs clockwise in this top-down view: (tz, -tx) is seaward.
        const across = j === 0 ? (hash(k + 211) - 0.5) * 1.2 : -1.2 + hash(k * 13 + j) * 2.8;
        const x = anchor.x + anchor.tx * along + anchor.tz * across;
        const z = anchor.z + anchor.tz * along - anchor.tx * across;
        if (z > 153 && Math.abs(x) < 27) continue; // clear the entire pier approach
        const scale = j === 0 ? 1.0 + hash(k + 307) * 0.6 : 0.4 + hash(k * 17 + j) * 0.4;
        transform.position.set(x, -0.52 + scale * 0.35, z);
        transform.rotation.set(0, hash(k * 29 + j) * Math.PI * 2, 0);
        transform.scale.set(scale * 1.25, scale * 0.78, scale);
        transform.updateMatrix();
        rocks.setMatrixAt(placed++, transform.matrix);
      }
    }
    rocks.count = placed;
    rocks.instanceMatrix.needsUpdate = true;
    rocks.computeBoundingSphere();
    this.root.add(rocks);
    this.detailScope.trackObject(rocks);
  }

  private buildWoodland(registerCollision: boolean): void {
    // ISLAND-01b: every tier plants the same 176 perimeter trees. Placement is
    // a deterministic prefix sequence, so the old 68/112-tree tiers were the
    // first trees of this list, but collision was registered only for the tier
    // the exterior was built with: switching tier afterwards left visible trees
    // without colliders (or colliders without trees). One quality-independent
    // set keeps visual and collision geometry identical on every tier; low
    // tier pays for it with 20-triangle crowns instead of 80.
    const count = 176;
    const trunkGeo = this.detailScope.track(new THREE.CylinderGeometry(0.22, 0.46, 5.4, 7));
    const crownGeo = this.detailScope.track(new THREE.IcosahedronGeometry(3.2, this.quality === 'low' ? 0 : 1));
    // Warm dark bark; per-instance colour varies each trunk (ISLAND-01b).
    const trunkMat = applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })), 'bark');
    const barkTones = [0x4a3426, 0x553b2a, 0x3f2c20, 0x5c4330, 0x4d3a2c, 0x46301f];
    const barkTint = new THREE.Color();
    const crownMaterials = [
      applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({ color: 0x15302d, roughness: 0.98 })), 'foliage'),
      applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({ color: 0x1d3934, roughness: 0.98 })), 'foliage'),
      applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({ color: 0x23423a, roughness: 0.98 })), 'foliage'),
    ];
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunks.name = 'perimeter-woodland-trunks';
    trunks.userData.spatialFeatureId = 'grove-perimeter-trunks';
    trunks.castShadow = true;
    // A second asymmetric canopy mass creates a layered forest silhouette
    // rather than a field of identical green polyhedra. One extra draw only.
    const lobeMaterial = applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0x294b40, roughness: 0.98,
    })), 'foliage');
    const canopyLobes = new THREE.InstancedMesh(crownGeo, lobeMaterial, count);
    canopyLobes.name = 'woodland-secondary-canopy';
    canopyLobes.userData.visualRole = 'forest-layered-silhouette';
    canopyLobes.castShadow = false;
    const crowns = crownMaterials.map((mat, i) => {
      const mesh = new THREE.InstancedMesh(crownGeo, mat, Math.ceil(count / 3));
      mesh.name = `perimeter-woodland-canopy-${i + 1}`;
      mesh.castShadow = true;
      this.root.add(mesh);
      return mesh;
    });
    const dummy = new THREE.Object3D();
    let placed = 0;
    const byPalette = [0, 0, 0];
    const occupied: [number, number][] = [];
    const halfTrunkHeight = (5.4 * 0.82) / 2;
    const placeTree = (x: number, z: number, scale: number, yaw: number): void => {
      dummy.position.set(x, -0.5 + halfTrunkHeight * scale, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(0.9 * scale, 0.82 * scale, 0.9 * scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      trunks.setColorAt(placed, barkTint.setHex(barkTones[(placed * 7) % barkTones.length]));
      const palette = placed % crownMaterials.length;
      // ISLAND-01: crowns lifted (3.7 -> 4.2 x scale) so every perimeter tree
      // shows a readable trunk; underside >= 3.59 m. Trunk/collider unchanged.
      dummy.position.y += 4.2 * scale;
      dummy.scale.set(0.90 * scale, 1.07 * scale, 0.91 * scale);
      dummy.updateMatrix();
      crowns[palette].setMatrixAt(byPalette[palette]++, dummy.matrix);
      const angle = placed * 2.399963229728653;
      dummy.position.set(x + Math.cos(angle) * 1.85 * scale, -0.5 + 5.6 * scale,
        z + Math.sin(angle) * 1.25 * scale);
      dummy.scale.set(0.62 * scale, 0.69 * scale, 0.67 * scale);
      dummy.updateMatrix();
      canopyLobes.setMatrixAt(placed, dummy.matrix);
      if (registerCollision) this.collision.addBox([x, -0.5 + halfTrunkHeight * scale, z], [
        0.44 * scale, halfTrunkHeight * scale, 0.44 * scale,
      ]);
      occupied.push([x, z]);
      placed++;
    };
    // Taller, deliberately varied west woodland reads at the building's scale.
    // Preserve every tree X/Z, the quality-tier counts, instance batches and
    // existing collision ownership; only trunk/canopy vertical proportions change.
    // Fixed grove and procedural woodland use the same four instanced draws.
    for (const [i, [x, z]] of SCENIC_GROVE_POINTS.entries()) {
      if (!isSiteLand(x, z)) throw new Error(`Scenic grove point ${i} is outside island land`);
      placeTree(x, z, (x < -45 ? 1.65 : 1.20) + (i % 5) * 0.16, (i * 2.4) % (Math.PI * 2));
    }
    let state = 0x21d47011;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    for (let tries = 0; tries < count * 20 && placed < count; tries++) {
      const x = -172 + random() * 344;
      const z = -160 + random() * 320;
      if (!isSiteLand(x, z)) continue;
      if (Math.hypot(x, z - 128) < 54) continue;
      if (x > 44 && x < 142 && z > -62 && z < 63) continue;
      if (Math.hypot(x + 104, z + 82) < 33 || inAncientTreeClearing(x, z)) continue;
      if (isLighthousePeninsula(x, z) || distanceToLighthousePath(x, z) < 5.5) continue;
      if (isRuinedObservatory(x, z) || distanceToObservatoryPath(x, z) < 4.5) continue;
      if (Math.abs(x) < 50 && Math.abs(z) < 112) continue;
      if (occupied.some(([px, pz]) => Math.hypot(x - px, z - pz) < 8)) continue;
      if (PATH_CENTERLINES.some((path) => path.slice(0, -1).some((point, index) => {
        const next = path[index + 1];
        const dx = next[0] - point[0];
        const dz = next[1] - point[1];
        const t = Math.max(0, Math.min(1, ((x - point[0]) * dx + (z - point[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - (point[0] + dx * t), z - (point[1] + dz * t)) < 8;
      }))) continue;
      const scale = (x < -45 ? 1.52 : 1.22) + random() * (x < -45 ? 0.94 : 0.76);
      placeTree(x, z, scale, random() * Math.PI * 2);
    }
    trunks.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
    this.root.add(this.detailScope.track(trunks));
    crowns.forEach((mesh, index) => {
      mesh.count = byPalette[index];
      mesh.instanceMatrix.needsUpdate = true;
      this.detailScope.track(mesh);
    });
    canopyLobes.count = placed;
    canopyLobes.instanceMatrix.needsUpdate = true;
    canopyLobes.computeBoundingSphere();
    this.root.add(this.detailScope.track(canopyLobes));

    // A low, collision-free understory fills the visual gaps without raising
    // the ground or interfering with the museum's authored walking paths.
    // Its density scales with device quality; there is no extra frame loop.
    // Double per-tree groundcover without adding tree colliders or passes.
    const shrubsPerTree = this.quality === 'low' ? 2 : this.quality === 'medium' ? 5 : 12;
    const shrubGeo = this.detailScope.track(new THREE.IcosahedronGeometry(1, 0));
    const shrubMat = applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0x2b5447, roughness: 1,
    })), 'foliage');
    const understory = new THREE.InstancedMesh(shrubGeo, shrubMat, count * shrubsPerTree);
    understory.name = 'woodland-understory';
    understory.userData.visualRole = 'landscape-understory';
    understory.castShadow = false;
    understory.receiveShadow = false;
    let shrubCount = 0;
    const nearPath = (x: number, z: number): boolean => PATH_CENTERLINES.some((path) =>
      path.slice(0, -1).some((point, index) => {
        const next = path[index + 1];
        const dx = next[0] - point[0];
        const dz = next[1] - point[1];
        const t = Math.max(0, Math.min(1,
          ((x - point[0]) * dx + (z - point[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - (point[0] + dx * t), z - (point[1] + dz * t)) < 5.5;
      }));
    for (let i = 0; i < occupied.length; i++) {
      const [tx, tz] = occupied[i];
      for (let j = 0; j < shrubsPerTree; j++) {
        const angle = i * 2.399963229728653 + j * 2.0943951023931953;
        const distance = 2.8 + j * 1.2;
        const x = tx + Math.cos(angle) * distance;
        const z = tz + Math.sin(angle) * distance;
        if (!isSiteLand(x, z) || nearPath(x, z)) continue;
        if (Math.abs(x) < 50 && Math.abs(z) < 112) continue;
        if (Math.hypot(x, z - 128) < 54) continue;
        if (x > 44 && x < 142 && z > -62 && z < 63) continue;
        if (Math.hypot(x + 104, z + 82) < 33 || inAncientTreeClearing(x, z)) continue;
        if (isLighthousePeninsula(x, z) || distanceToLighthousePath(x, z) < 5.0) continue;
        if (isRuinedObservatory(x, z) || distanceToObservatoryPath(x, z) < 4.2) continue;
        // ISLAND-01: no eye-level shrub inside a landmark clearing or walk-in corridor.
        if (landmarkGroundExcluded(x, z, 1.7)) continue;
        const width = 0.9 + ((i + j) % 5) * 0.18;
        // ISLAND-01: tops at 0.9–1.38 m (was up to 1.66 m, at eye height).
        const height = 0.45 + ((i + j * 2) % 3) * 0.12;
        dummy.position.set(x, -0.5 + height, z);
        dummy.rotation.set(0, angle * 0.18, 0);
        dummy.scale.set(width, height, width * 0.89);
        dummy.updateMatrix();
        understory.setMatrixAt(shrubCount++, dummy.matrix);
      }
    }
    understory.count = shrubCount;
    understory.instanceMatrix.needsUpdate = true;
    understory.computeBoundingSphere();
    this.root.add(this.detailScope.track(understory));

    // The original tree spacing makes the island appear park-like from the
    // canonical overhead and west cameras. Add canopy-only infill around the
    // existing trees, without placing another trunk, collider or floor tile.
    // One instanced low-poly mesh keeps the draw count constant across tiers.
    const infillPerTree = this.quality === 'low' ? 1 : this.quality === 'medium' ? 2 : 4;
    const infillGeometry = this.detailScope.track(new THREE.IcosahedronGeometry(2.7, 0));
    const infillMaterial = applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0,
    })), 'foliage');
    const infill = new THREE.InstancedMesh(infillGeometry, infillMaterial, placed * infillPerTree);
    infill.name = 'woodland-canopy-infill';
    infill.userData.visualRole = 'dense-layered-woodland-canopy';
    infill.castShadow = false;
    infill.receiveShadow = false;
    const tones = [0x193a32, 0x23493e, 0x2a5145, 0x17352f];
    const inset = 3.8;
    let infillCount = 0;
    for (let i = 0; i < occupied.length; i++) {
      const [tx, tz] = occupied[i];
      for (let j = 0; j < infillPerTree; j++) {
        const angle = i * 2.399963229728653 + j * (Math.PI * 2 / infillPerTree);
        const distance = inset + j * 1.15;
        const x = tx + Math.cos(angle) * distance;
        const z = tz + Math.sin(angle) * distance;
        // All foliage stays on established land, away from visitor paths,
        // the pier/garden arrival, walls, lagoon and sacred spire clearing.
        if (!isSiteLand(x, z) || nearPath(x, z)) continue;
        if (Math.abs(x) < 50 && Math.abs(z) < 112) continue;
        if (Math.hypot(x, z - 128) < 54) continue;
        if (x > 44 && x < 142 && z > -62 && z < 63) continue;
        if (Math.hypot(x + 104, z + 82) < 33 || inAncientTreeClearing(x, z)) continue;
        if (isLighthousePeninsula(x, z) || isRuinedObservatory(x, z)) continue;
        const width = 0.94 + ((i + j) % 5) * 0.11;
        const height = 0.72 + ((i + j * 2) % 4) * 0.12;
        // ISLAND-01: keep the infill underside above CANOPY_UNDERSIDE_MIN so
        // it reads as overhead canopy, never as an eye-level leaf wall.
        const elevation = Math.max(4.7 + ((i * 3 + j) % 5) * 0.78,
          CANOPY_UNDERSIDE_MIN + 2.7 * height + 0.2);
        dummy.position.set(x, -0.5 + elevation, z);
        dummy.rotation.set(0, angle * 0.17, 0);
        dummy.scale.set(width, height, width * 0.91);
        dummy.updateMatrix();
        infill.setMatrixAt(infillCount, dummy.matrix);
        infill.setColorAt(infillCount, new THREE.Color(tones[(i + j) % tones.length]));
        infillCount++;
      }
    }
    infill.count = infillCount;
    infill.instanceMatrix.needsUpdate = true;
    if (infill.instanceColor) infill.instanceColor.needsUpdate = true;
    infill.computeBoundingSphere();
    this.root.add(this.detailScope.track(infill));

    // S5c filled the island's protected forest areas with a deterministic,
    // site-masked jittered grid of crowns. Those crowns had no trunk and their
    // undersides sat at or below the ground, so from a path they read as
    // opaque eye-level leaf walls that hid landmarks (ISLAND-01 baseline:
    // every belt crown reached below 2.2 m).
    //
    // ISLAND-01 (world expansion 2026-11-21): every belt crown now stands on a
    // visible, leaning, collision-backed trunk, with its underside lifted to
    // CANOPY_UNDERSIDE_MIN–(MIN + 1.8) m. The trunk grid is quality-independent
    // (the former low-tier grid), so collision is identical on every tier and
    // the construction-time collision world stays immutable. Medium/high tiers
    // add extra overhead crowns clustered on those same trunks: density lives
    // above head height, as the master plan asks. Landmark clearings and
    // walk-in corridors (IslandLandmarks) receive no trunk, and no crown that
    // crosses a landmark's eye-height sightline.
    const trunkStep = 7.315;
    const { minX, maxX, minZ, maxZ } = FOREST_BELT_BOUNDS;
    const columns = Math.ceil((maxX - minX) / trunkStep);
    const rows = Math.ceil((maxZ - minZ) / trunkStep);
    // ISLAND-01b: low tier also adds a crown to ~40 % of trunks, so it no longer
    // thins into an orchard (20-triangle crowns keep it cheap).
    const extraCrowns = this.quality === 'high' ? 2 : 1;
    // Low tier uses 20 triangles/crown rather than 80, reducing the forest
    // geometry burden without changing canopy counts, clearing or material.
    const beltGeometry = this.detailScope.track(new THREE.IcosahedronGeometry(4.1, this.quality === 'high' ? 1 : 0));
    const beltMaterial = applyLandscape(this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.98, metalness: 0,
    })), 'foliage');
    const belt = new THREE.InstancedMesh(beltGeometry, beltMaterial, columns * rows * (1 + extraCrowns));
    belt.name = 'woodland-forest-belt'; // keep inspector/CI scene identity
    belt.userData.visualRole = 'island-masked-woodland-distribution';
    belt.castShadow = false;
    belt.receiveShadow = false;
    // Unit-height trunk with its base at the origin, so scale.y is the height.
    // Open-ended: the base is in the ground and the top inside the crown.
    const beltTrunkGeometry = this.detailScope.track(new THREE.CylinderGeometry(0.13, 0.34, 1, 6, 1, true).translate(0, 0.5, 0));
    const beltTrunks = new THREE.InstancedMesh(beltTrunkGeometry, trunkMat, columns * rows);
    beltTrunks.name = 'woodland-forest-belt-trunks';
    beltTrunks.userData.visualRole = 'forest-belt-visible-trunks';
    beltTrunks.userData.spatialFeatureId = 'grove-belt-trunks';
    beltTrunks.castShadow = false;
    beltTrunks.receiveShadow = false;
    const beltColours = [0x326652, 0x427963, 0x295844, 0x356f5b, 0x396d56];
    const beltTint = new THREE.Color();
    const forestPathClear = (x: number, z: number): boolean => !PATH_CENTERLINES.some((path) =>
      path.slice(0, -1).some(([ax, az], index) => {
        const [bx, bz] = path[index + 1];
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1,
          ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        // ISLAND-01b: trunks may stand 7 m from a path centreline (was 10.5 m
        // when belt crowns were ground-level blobs); raised crowns overhang
        // the path edge above head height instead of leaving vacant verges.
        return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) < 7;
      }));
    const clearFootprint = (x: number, z: number): boolean => {
      const margin = 6.4;
      return isSiteLand(x, z)
        && isSiteLand(x + margin, z) && isSiteLand(x - margin, z)
        && isSiteLand(x, z + margin) && isSiteLand(x, z - margin)
        && forestPathClear(x, z)
        && !(Math.abs(x) < 55 && Math.abs(z) < 118)
        && Math.hypot(x, z - 128) >= 60
        && !(x > 39 && x < 147 && z > -67 && z < 68)
        && Math.hypot(x + 104, z + 82) >= 38
        && !inAncientTreeClearing(x, z)
        && !isLighthousePeninsula(x, z)
        && distanceToLighthousePath(x, z) >= 5.5
        && !isRuinedObservatory(x, z)
        && distanceToObservatoryPath(x, z) >= 4.5
        && !(z > 155 && Math.abs(x) < 26);
    };
    const hash01 = (n: number): number => {
      const v = Math.sin(n * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };
    const trunkTop = new THREE.Vector3();
    const trunkMatrix = new THREE.Matrix4();
    let beltCount = 0;
    let trunkCount = 0;
    const placeCrown = (x: number, y: number, z: number, sx: number, sy: number, sz: number,
      yaw: number, colour: number): boolean => {
      const radiusY = 4.1 * sy;
      if (blocksLandmarkSightline(x, y, z, Math.max(4.1 * Math.max(sx, sz), radiusY))) return false;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      belt.setMatrixAt(beltCount, dummy.matrix);
      belt.setColorAt(beltCount, beltTint.setHex(colour));
      beltCount++;
      return true;
    };
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows; row++) {
        const seed = 19_431 + col * 3719 + row * 1097;
        const gx = minX + (col + 0.5) * trunkStep + (hash01(seed) - 0.5) * trunkStep * 0.66;
        const gz = minZ + (row + 0.5) * trunkStep + (hash01(seed + 11) - 0.5) * trunkStep * 0.66;
        // ISLAND-01b clumping: pull each trunk 40 % toward a jittered clump
        // centre on a 22 m grid, so trees gather in stands with glades between
        // instead of an even scatter. Still quality-independent.
        const ccol = Math.floor((gx - minX) / 22), crow = Math.floor((gz - minZ) / 22);
        const cseed = 7_919 + ccol * 613 + crow * 211;
        const cx = minX + (ccol + 0.5) * 22 + (hash01(cseed) - 0.5) * 12;
        const cz = minZ + (crow + 0.5) * 22 + (hash01(cseed + 5) - 0.5) * 12;
        const x = gx + (cx - gx) * 0.4;
        const z = gz + (cz - gz) * 0.4;
        if (!clearFootprint(x, z) || landmarkGroundExcluded(x, z, 0.6)) continue;
        const clumpValue = 0.8 + hash01(cseed + 9) * 0.38;
        const sx = 0.72 + hash01(seed + 31) * 0.72;
        const sz = 0.72 + hash01(seed + 53) * 0.72;
        // Slightly flattened crowns (0.48–1.12) read as broad leafy heads.
        const sy = (0.75 + hash01(seed + 47) * 1.00) * 0.64;
        const radiusY = 4.1 * sy;
        const underside = CANOPY_UNDERSIDE_MIN + hash01(seed + 83) * 1.8;
        const trunkHeight = underside + radiusY * 0.55;
        const girth = 0.75 + hash01(seed + 97) * 0.55;
        const leanX = (hash01(seed + 101) - 0.5) * 0.12;
        const leanZ = (hash01(seed + 103) - 0.5) * 0.12;
        // Clump value plus per-tree jitter: near and far stands separate in value.
        const colour = new THREE.Color(beltColours[(col + row) % beltColours.length])
          .multiplyScalar(clumpValue * (0.94 + hash01(seed + 151) * 0.12)).getHex();
        const yaw = hash01(seed + 71) * Math.PI * 2;
        // The primary crown is checked against landmark sightlines before its
        // trunk is committed, so a trunk never stands without its crown.
        dummy.position.set(x, -0.5, z);
        dummy.rotation.set(leanX, yaw, leanZ);
        dummy.scale.set(girth, trunkHeight, girth);
        dummy.updateMatrix();
        trunkTop.set(0, 1, 0).applyMatrix4(dummy.matrix);
        trunkMatrix.copy(dummy.matrix);
        const crownY = -0.5 + underside + radiusY;
        const crownX = trunkTop.x, crownZ = trunkTop.z;
        if (!clearFootprint(crownX, crownZ)) continue;
        if (!placeCrown(crownX, crownY, crownZ, sx, sy, sz, yaw, colour)) continue;
        beltTrunks.setColorAt(trunkCount, barkTint.setHex(barkTones[Math.floor(hash01(seed + 167) * barkTones.length)]));
        beltTrunks.setMatrixAt(trunkCount++, trunkMatrix);
        if (registerCollision) {
          const half = 0.32 * girth + 0.04;
          this.collision.addBox([x, -0.5 + trunkHeight / 2, z], [half, trunkHeight / 2, half]);
        }
        for (let k = 0; k < extraCrowns; k++) {
          // Low adds one crown to ~40 % of trees, medium to ~74 %; high adds one to all and a
          // second to ~56 %, raising canopy density overhead only.
          const chance = hash01(seed + 211 + k * 17);
          if (this.quality === 'low' ? chance > 0.4 : this.quality === 'medium' ? chance > 0.74 : k === 1 && chance > 0.56) continue;
          const angle = hash01(seed + 223 + k * 19) * Math.PI * 2;
          const reach = 2.2 + hash01(seed + 227 + k * 23) * 1.8;
          const ex = crownX + Math.cos(angle) * reach;
          const ez = crownZ + Math.sin(angle) * reach;
          if (!clearFootprint(ex, ez)) continue;
          const shrink = 0.6 + hash01(seed + 229 + k * 29) * 0.25;
          const eUnder = underside + 0.8 + hash01(seed + 233 + k * 31) * 1.2;
          placeCrown(ex, -0.5 + eUnder + radiusY * shrink, ez, sx * shrink, sy * shrink, sz * shrink,
            yaw + angle, new THREE.Color(beltColours[(col + row + k + 1) % beltColours.length]).multiplyScalar(clumpValue).getHex());
        }
      }
    }
    belt.count = beltCount;
    belt.instanceMatrix.needsUpdate = true;
    if (belt.instanceColor) belt.instanceColor.needsUpdate = true;
    belt.computeBoundingSphere();
    this.root.add(this.detailScope.track(belt));
    beltTrunks.count = trunkCount;
    beltTrunks.instanceMatrix.needsUpdate = true;
    if (beltTrunks.instanceColor) beltTrunks.instanceColor.needsUpdate = true;
    beltTrunks.computeBoundingSphere();
    this.root.add(this.detailScope.track(beltTrunks));
  }


  /** Quiet glade flowers: one tiny instanced draw, no floor/collision mutation. */
  private buildWildflowerGlades(): void {
    const target = this.quality === 'low' ? 64 : this.quality === 'medium' ? 144 : 240;
    const geometry = this.detailScope.track(new THREE.TetrahedronGeometry(0.45, 0));
    const material = this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.92, metalness: 0,
      emissive: 0x101613, emissiveIntensity: 0.12,
      flatShading: true,
    }));
    const blooms = new THREE.InstancedMesh(geometry, material, target);
    blooms.name = 'island-wildflower-glades';
    blooms.userData.visualRole = 'moonlit-woodland-wildflowers';
    blooms.castShadow = false;
    blooms.receiveShadow = false;
    const color = new THREE.Color();
    const palette = [0x91a9b4, 0xaaa077, 0x8e98b3, 0x8cb3a2];
    const dummy = new THREE.Object3D();
    let seed = 0x52f29b7;
    const rnd = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    let count = 0;
    for (let i = 0; i < target * 60 && count < target; i++) {
      const x = -177 + rnd() * 354;
      const z = -165 + rnd() * 330;
      if (!isSiteLand(x, z) || !isSiteLand(x + 1.5, z) || !isSiteLand(x - 1.5, z)) continue;
      if (Math.abs(x) < 56 && Math.abs(z) < 120) continue;
      if (Math.hypot(x, z - 128) < 58) continue;
      if (x > 42 && x < 147 && z > -68 && z < 70) continue;
      if (Math.hypot(x + 104, z + 82) < 40 || inAncientTreeClearing(x, z)) continue;
      if (isLighthousePeninsula(x, z) || distanceToLighthousePath(x, z) < 4.0) continue;
      if (isRuinedObservatory(x, z) || distanceToObservatoryPath(x, z) < 3.8) continue;
      if (PATH_CENTERLINES.some((path) => path.slice(0, -1).some(([ax, az], n) => {
        const [bx, bz] = path[n + 1];
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1,
          ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < 5.2;
      }))) continue;
      const size = 0.6 + rnd() * 0.72;
      dummy.position.set(x, -0.5 + size * 0.25, z);
      dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
      dummy.scale.set(size, size * 0.72, size);
      dummy.updateMatrix();
      blooms.setMatrixAt(count, dummy.matrix);
      blooms.setColorAt(count, color.setHex(palette[count % palette.length]));
      count++;
    }
    blooms.count = count;
    blooms.instanceMatrix.needsUpdate = true;
    if (blooms.instanceColor) blooms.instanceColor.needsUpdate = true;
    blooms.computeBoundingSphere();
    this.root.add(this.detailScope.track(blooms));
  }
}

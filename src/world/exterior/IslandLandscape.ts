import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import { CollisionWorld } from '../CollisionWorld';
import type { QualityTier } from '../../render/QualityTiers';
import {
  ISLAND_OUTLINE, PATH_CENTERLINES, PIER_CENTERLINE, SCENIC_GROVE_POINTS, SPIRE_GARDEN_CENTER,
  SPIRE_GARDEN_RADIUS, isSiteLand,
} from './IslandSiteLayout';

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
    const pathMat = this.scope.track(new THREE.MeshStandardMaterial({ color: 0xb6a27a, roughness: 0.92, metalness: 0.02 }));
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

      for (let i = 3; i < samples.length - 3; i += 22) {
        const p = samples[i];
        const x = p.x + (i % 2 ? 2.7 : -2.7);
        const z = p.z;
        // Never float a path light over the lagoon or off the island.
        if (isSiteLand(x, z)) markers.push({ x, z, id: `path-ground-light-${pathIndex + 1}-${i}` });
      }
    });
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
    const earth = this.scope.track(new THREE.MeshStandardMaterial({ color: 0x8a7650, roughness: 0.96 }));
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
    const topiaryMat = this.scope.track(new THREE.MeshStandardMaterial({ color: 0x1b3a31, roughness: 0.96 }));
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
    const stone = this.scope.track(new THREE.MeshStandardMaterial({ color: 0x414b52, roughness: 0.84 }));
    const trim = this.scope.track(new THREE.MeshStandardMaterial({ color: 0x7b6d58, roughness: 0.74 }));
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
    const pierPileMaterial = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x293940, roughness: 0.95, metalness: 0.03,
    }));
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
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.3, 0.35, 58)), trim);
      edge.name = `pier-edge-${side}`;
      // The trim must touch the pier deck at -0.49, not float 0.135 m above it.
      edge.position.set(side * 5.35, -0.315, 188);
      this.root.add(edge);
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
    const material = this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0x33494c, roughness: 0.98, metalness: 0,
      flatShading: true,
    }));
    const rocks = new THREE.InstancedMesh(geometry, material, target);
    rocks.name = 'shoreline-rock-scatter';
    rocks.userData.visualRole = 'coastal-outcrops';
    rocks.castShadow = false;
    rocks.receiveShadow = false;
    const transform = new THREE.Object3D();
    let placed = 0;
    for (let i = 0; i < target; i++) {
      const segment = i % ISLAND_OUTLINE.length;
      const [ax, az] = ISLAND_OUTLINE[segment];
      const [bx, bz] = ISLAND_OUTLINE[(segment + 1) % ISLAND_OUTLINE.length];
      const t = (Math.floor(i / ISLAND_OUTLINE.length) + 0.6)
        / (Math.ceil(target / ISLAND_OUTLINE.length) + 0.25);
      const x = (ax + (bx - ax) * t) * 0.996;
      const z = (az + (bz - az) * t) * 0.996;
      if (z > 153 && Math.abs(x) < 27) continue; // clear the entire pier approach
      const scale = 0.68 + ((i * 7) % 11) * 0.067;
      transform.position.set(x, -0.52 + scale * 0.35, z);
      transform.rotation.set(0, (i * 1.618) % (Math.PI * 2), 0);
      transform.scale.set(scale * 1.25, scale * 0.78, scale);
      transform.updateMatrix();
      rocks.setMatrixAt(placed++, transform.matrix);
    }
    rocks.count = placed;
    rocks.instanceMatrix.needsUpdate = true;
    rocks.computeBoundingSphere();
    this.root.add(rocks);
    this.detailScope.trackObject(rocks);
  }

  private buildWoodland(registerCollision: boolean): void {
    const count = this.quality === 'low' ? 68 : this.quality === 'medium' ? 112 : 176;
    const trunkGeo = this.detailScope.track(new THREE.CylinderGeometry(0.34, 0.44, 5.4, 7));
    const crownGeo = this.detailScope.track(new THREE.IcosahedronGeometry(3.2, 1));
    const trunkMat = this.detailScope.track(new THREE.MeshStandardMaterial({ color: 0x252d28, roughness: 1 }));
    const crownMaterials = [
      this.detailScope.track(new THREE.MeshStandardMaterial({ color: 0x15302d, roughness: 0.98 })),
      this.detailScope.track(new THREE.MeshStandardMaterial({ color: 0x1d3934, roughness: 0.98 })),
      this.detailScope.track(new THREE.MeshStandardMaterial({ color: 0x23423a, roughness: 0.98 })),
    ];
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunks.name = 'perimeter-woodland-trunks';
    trunks.userData.spatialFeatureId = 'grove-perimeter-trunks';
    trunks.castShadow = true;
    // A second asymmetric canopy mass creates a layered forest silhouette
    // rather than a field of identical green polyhedra. One extra draw only.
    const lobeMaterial = this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0x294b40, roughness: 0.98,
    }));
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
      const palette = placed % crownMaterials.length;
      dummy.position.y += 3.7 * scale;
      dummy.scale.set(0.90 * scale, 1.07 * scale, 0.91 * scale);
      dummy.updateMatrix();
      crowns[palette].setMatrixAt(byPalette[palette]++, dummy.matrix);
      const angle = placed * 2.399963229728653;
      dummy.position.set(x + Math.cos(angle) * 1.85 * scale, -0.5 + 5.1 * scale,
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
      if (Math.hypot(x + 104, z + 82) < 33) continue;
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
    const shrubsPerTree = this.quality === 'low' ? 4 : this.quality === 'medium' ? 8 : 12;
    const shrubGeo = this.detailScope.track(new THREE.IcosahedronGeometry(1, 0));
    const shrubMat = this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0x2b5447, roughness: 1,
    }));
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
        if (Math.hypot(x + 104, z + 82) < 33) continue;
        const width = 0.9 + ((i + j) % 5) * 0.18;
        const height = 0.55 + ((i + j * 2) % 3) * 0.14;
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
    const infillPerTree = this.quality === 'low' ? 2 : this.quality === 'medium' ? 3 : 4;
    const infillGeometry = this.detailScope.track(new THREE.IcosahedronGeometry(2.7, 0));
    const infillMaterial = this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0,
    }));
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
        if (Math.hypot(x + 104, z + 82) < 33) continue;
        const width = 0.94 + ((i + j) % 5) * 0.11;
        const height = 0.72 + ((i + j * 2) % 4) * 0.12;
        const elevation = 4.7 + ((i * 3 + j) % 5) * 0.78;
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

    // S5c: actual renderer screenshots showed the doubled shoreline lanes
    // as a regular perimeter hedge, with the *interior* forest still empty.
    // Occupy the real island's protected forest areas instead: a deterministic
    // jittered grid is site-masked against water, routes and visitor landmarks.
    // All new crowns remain render-only. No physical trunks or colliders move.
    // Doubled from the last LIVE S5c release (438/725/1040 accepted crowns).
    // Exact site-mask calibration: 901/1469/2111 low/medium/high.
    // Maintain the original land/path/landmark exclusion envelope.
    const step = this.quality === 'low' ? 7.315 : this.quality === 'medium' ? 5.670 : 4.746;
    const minX = Math.min(...ISLAND_OUTLINE.map(([x]) => x));
    const maxX = Math.max(...ISLAND_OUTLINE.map(([x]) => x));
    const minZ = Math.min(...ISLAND_OUTLINE.map(([, z]) => z));
    const maxZ = Math.max(...ISLAND_OUTLINE.map(([, z]) => z));
    const columns = Math.ceil((maxX - minX) / step);
    const rows = Math.ceil((maxZ - minZ) / step);
    // Low tier uses 20 triangles/crown rather than 80, reducing the forest
    // geometry burden without changing canopy counts, clearing or material.
    const beltGeometry = this.detailScope.track(new THREE.IcosahedronGeometry(4.1, this.quality === 'high' ? 1 : 0));
    const beltMaterial = this.detailScope.track(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.98, metalness: 0,
    }));
    const belt = new THREE.InstancedMesh(beltGeometry, beltMaterial, columns * rows);
    belt.name = 'woodland-forest-belt'; // keep inspector/CI scene identity
    belt.userData.visualRole = 'island-masked-woodland-distribution';
    belt.castShadow = false;
    belt.receiveShadow = false;
    const beltColours = [0x326652, 0x427963, 0x295844, 0x356f5b, 0x396d56];
    const beltTint = new THREE.Color();
    const forestPathClear = (x: number, z: number): boolean => !PATH_CENTERLINES.some((path) =>
      path.slice(0, -1).some(([ax, az], index) => {
        const [bx, bz] = path[index + 1];
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1,
          ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) < 10.5;
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
        && !(z > 155 && Math.abs(x) < 26);
    };
    const hash01 = (n: number): number => {
      const v = Math.sin(n * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };
    let beltCount = 0;
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows; row++) {
        const seed = 19_431 + col * 3719 + row * 1097;
        const x = minX + (col + 0.5) * step + (hash01(seed) - 0.5) * step * 0.66;
        const z = minZ + (row + 0.5) * step + (hash01(seed + 11) - 0.5) * step * 0.66;
        if (!clearFootprint(x, z)) continue;
        const sx = 0.78 + hash01(seed + 31) * 0.78;
        const sy = 0.85 + hash01(seed + 47) * 1.10;
        const sz = 0.79 + hash01(seed + 53) * 0.70;
        const height = 4.1 * sy;
        dummy.position.set(x, -0.5 + height * 0.78, z);
        dummy.rotation.set(0, hash01(seed + 71) * Math.PI * 2, 0);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        belt.setMatrixAt(beltCount, dummy.matrix);
        belt.setColorAt(beltCount, beltTint.setHex(beltColours[(col + row) % beltColours.length]));
        beltCount++;
      }
    }
    belt.count = beltCount;
    belt.instanceMatrix.needsUpdate = true;
    if (belt.instanceColor) belt.instanceColor.needsUpdate = true;
    belt.computeBoundingSphere();
    this.root.add(this.detailScope.track(belt));
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
      if (Math.hypot(x + 104, z + 82) < 40) continue;
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

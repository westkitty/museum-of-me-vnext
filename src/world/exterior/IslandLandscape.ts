import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import { CollisionWorld } from '../CollisionWorld';
import type { QualityTier } from '../../render/QualityTiers';
import {
  PATH_CENTERLINES, PIER_CENTERLINE, SPIRE_GARDEN_CENTER,
  SPIRE_GARDEN_RADIUS, isSiteLand,
} from './IslandSiteLayout';

/** Paths, woodland, western spire court and the axial south pier. */
export class IslandLandscape {
  readonly root = new THREE.Group();

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
    private readonly quality: QualityTier,
  ) {
    this.root.name = 'island-landscape';
  }

  build(): THREE.Group {
    this.buildPaths();
    this.buildSpireGarden();
    this.buildPier();
    this.buildWoodland();
    return this.root;
  }

  private buildPaths(): void {
    const pathMat = this.scope.track(new THREE.MeshStandardMaterial({ color: 0xb6a27a, roughness: 0.92, metalness: 0.02 }));
    const lightMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0xffbf78, toneMapped: false }));
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
        const lamp = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.18, 8, 6)), lightMat);
        lamp.name = `path-ground-light-${pathIndex + 1}-${i}`;
        lamp.position.set(p.x + (i % 2 ? 2.7 : -2.7), -0.24, p.z);
        this.root.add(lamp);
      }
    });
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
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.3, 0.35, 58)), trim);
      edge.name = `pier-edge-${side}`;
      edge.position.set(side * 5.35, -0.18, 188);
      this.root.add(edge);
    }
    this.collision.addFloor(-6, 6, 164, 218, -0.5);
  }

  private buildWoodland(): void {
    const count = this.quality === 'low' ? 48 : this.quality === 'medium' ? 72 : 96;
    const trunkGeo = this.scope.track(new THREE.CylinderGeometry(0.34, 0.44, 5.4, 7));
    const crownGeo = this.scope.track(new THREE.IcosahedronGeometry(3.2, 1));
    const trunkMat = this.scope.track(new THREE.MeshStandardMaterial({ color: 0x252d28, roughness: 1 }));
    const crownMaterials = [
      this.scope.track(new THREE.MeshStandardMaterial({ color: 0x15302d, roughness: 0.98 })),
      this.scope.track(new THREE.MeshStandardMaterial({ color: 0x1d3934, roughness: 0.98 })),
      this.scope.track(new THREE.MeshStandardMaterial({ color: 0x23423a, roughness: 0.98 })),
    ];
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunks.name = 'perimeter-woodland-trunks';
    trunks.castShadow = true;
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
    let state = 0x21d47011;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    for (let tries = 0; tries < count * 16 && placed < count; tries++) {
      const x = -172 + random() * 344;
      const z = -160 + random() * 320;
      if (!isSiteLand(x, z)) continue;
      if (Math.hypot(x, z - 128) < 54) continue;
      if (x > 44 && x < 142 && z > -62 && z < 63) continue;
      if (Math.hypot(x + 104, z + 82) < 33) continue;
      if (Math.abs(x) < 50 && Math.abs(z) < 112) continue;
      if (PATH_CENTERLINES.some((path) => path.slice(0, -1).some((point, index) => {
        const next = path[index + 1];
        const dx = next[0] - point[0];
        const dz = next[1] - point[1];
        const t = Math.max(0, Math.min(1, ((x - point[0]) * dx + (z - point[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - (point[0] + dx * t), z - (point[1] + dz * t)) < 8;
      }))) continue;
      const scale = 0.76 + random() * 0.75;
      dummy.position.set(x, -0.5 + 2.7 * scale, z);
      dummy.rotation.y = random() * Math.PI * 2;
      dummy.scale.set(0.9 * scale, 0.82 * scale, 0.9 * scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      const palette = placed % crownMaterials.length;
      dummy.position.y += 3.7 * scale;
      dummy.scale.set(1.0 * scale, 0.82 * scale, 0.92 * scale);
      dummy.updateMatrix();
      crowns[palette].setMatrixAt(byPalette[palette]++, dummy.matrix);
      this.collision.addBox([x, 2.7 * scale, z], [0.44 * scale, 2.7 * scale, 0.44 * scale]);
      placed++;
    }
    trunks.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    this.root.add(this.scope.track(trunks));
    crowns.forEach((mesh, index) => {
      mesh.count = byPalette[index];
      mesh.instanceMatrix.needsUpdate = true;
      this.scope.track(mesh);
    });
  }
}

import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { QualityTier } from '../../render/QualityTiers';
import { ISLAND_OUTLINE, LAGOON_OUTLINE, PATH_CENTERLINES, isLagoon, isSiteLand } from './IslandSiteLayout';

type Creature = { x: number; z: number; phase: number; radius: number; speed: number; height: number };
export const WILDLIFE_COUNTS = {
  low: { butterflies: 12, birds: 6, fish: 8 },
  medium: { butterflies: 30, birds: 12, fish: 18 },
  high: { butterflies: 48, birds: 18, fish: 32 },
} as const;

function seed01(n: number): number {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function nearPath(x: number, z: number, buffer: number): boolean {
  return PATH_CENTERLINES.some((line) => line.slice(0, -1).some(([ax, az], i) => {
    const [bx, bz] = line[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) < buffer;
  }));
}

/** Three bounded instanced wildlife populations owned by the existing exterior loop. */
export class ExteriorWildlife {
  readonly root = new THREE.Group();
  private readonly temp = new THREE.Object3D();
  private readonly butterflies: THREE.InstancedMesh;
  private readonly birds: THREE.InstancedMesh;
  private readonly fish: THREE.InstancedMesh;
  private readonly butterflySites: Creature[] = [];
  private readonly birdSites: Creature[] = [];
  private readonly fishSites: Creature[] = [];
  private time = 0;
  private lastDraw = 0;

  constructor(private readonly scope: ResourceScope, tier: QualityTier) {
    this.root.name = 'island-wildlife';
    const sizes = WILDLIFE_COUNTS[tier];

    for (let attempt = 0; attempt < 8000 && this.butterflySites.length < sizes.butterflies; attempt++) {
      const x = -166 + seed01(attempt * 23 + 13) * 332;
      const z = -152 + seed01(attempt * 31 + 47) * 310;
      const r = 0.65 + seed01(attempt * 11 + 83) * 0.8;
      if (!isSiteLand(x, z) || !isSiteLand(x + 2, z) || !isSiteLand(x - 2, z)
        || !isSiteLand(x, z + 2) || !isSiteLand(x, z - 2)) continue;
      if (Math.abs(x) < 50 && Math.abs(z) < 115) continue;
      if (x > 44 && x < 142 && z > -62 && z < 63) continue;
      if (Math.hypot(x + 104, z + 82) < 34 || Math.hypot(x, z - 128) < 52) continue;
      if (nearPath(x, z, 6.5)) continue;
      this.butterflySites.push({ x, z, phase: seed01(attempt + 147) * Math.PI * 2, radius: r,
        speed: 0.31 + seed01(attempt * 17) * 0.38, height: 1.9 + seed01(attempt + 37) * 2.8 });
    }

    const roosts: readonly (readonly [number, number])[] = [
      [-133, 38], [145, 83], [-115, -125], [131, -100], [-64, 125], [68, -133],
    ];
    for (let i = 0; i < sizes.birds; i++) {
      const [x, z] = roosts[i % roosts.length];
      this.birdSites.push({ x, z, phase: i * 2.39996323, radius: 8 + seed01(i + 17) * 9,
        speed: 0.10 + seed01(i + 43) * 0.14, height: 20 + (i % 5) * 3.4 });
    }

    const minX = Math.min(...LAGOON_OUTLINE.map(([x]) => x));
    const maxX = Math.max(...LAGOON_OUTLINE.map(([x]) => x));
    const minZ = Math.min(...LAGOON_OUTLINE.map(([, z]) => z));
    const maxZ = Math.max(...LAGOON_OUTLINE.map(([, z]) => z));
    for (let i = 0; i < 9000 && this.fishSites.length < sizes.fish; i++) {
      const x = minX + 4 + seed01(i * 19 + 157) * (maxX - minX - 8);
      const z = minZ + 4 + seed01(i * 23 + 91) * (maxZ - minZ - 8);
      const radius = 1.0 + seed01(i * 5 + 67) * 1.45;
      const margin = radius + 0.8;
      if (!isLagoon(x, z) || !isLagoon(x + margin, z) || !isLagoon(x - margin, z)
        || !isLagoon(x, z + margin) || !isLagoon(x, z - margin)) continue;
      this.fishSites.push({ x, z, phase: seed01(i * 37) * Math.PI * 2, radius,
        speed: 0.14 + seed01(i * 11 + 31) * 0.25, height: -1.075 });
    }

    // Three tiny untextured silhouette geometries, each one GPU draw; no files,
    // shaders, colliders, timers, separate animation systems or network requests.
    this.butterflies = this.makeBatch('island-butterflies',
      [0, 0.05, 0, -1.18, 0.44, 0.66, -0.65, 0.24, -0.66,
        0, 0.05, 0, 1.18, 0.44, 0.66, 0.65, 0.24, -0.66,
        0, 0.08, -0.62, -0.14, 0.1, 0.68, 0.14, 0.1, 0.68],
      this.butterflySites, [0xc7a27a, 0x9fc5cb, 0xc3b1cf, 0xc6cb9f]);
    this.birds = this.makeBatch('coastal-bird-flocks',
      [0, 0, -0.3, -2.0, 0.50, 0.10, -0.4, 0.18, 0.56,
        0, 0, -0.3, 2.0, 0.50, 0.10, 0.4, 0.18, 0.56,
        0, 0.02, -0.9, -0.17, 0.04, 0.78, 0.17, 0.04, 0.78],
      this.birdSites, [0xadc1c0, 0x8fa7b2, 0xc6c9bc]);
    this.fish = this.makeBatch('lagoon-fish-school',
      [0, 0, 1.15, -0.43, 0, -0.15, 0, 0, -0.8,
        0, 0, 1.15, 0, 0, -0.8, 0.43, 0, -0.15,
        0, 0, -0.8, -0.55, 0, -1.34, 0.55, 0, -1.34],
      this.fishSites, [0x9bd2d3, 0xd7b980, 0xb1c6c6, 0x88b3ba]);
    this.writeTransforms(0);
  }

  private makeBatch(name: string, vertices: number[], sites: Creature[], colors: number[]): THREE.InstancedMesh {
    const geometry = this.scope.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const material = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide, depthWrite: false,
      toneMapped: true,
    }));
    const mesh = new THREE.InstancedMesh(geometry, material, sites.length);
    mesh.name = name;
    mesh.userData.visualRole = 'non-colliding-procedural-wildlife';
    mesh.frustumCulled = false; // small bounded populations migrate across one large group
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.Color();
    for (let i = 0; i < sites.length; i++) mesh.setColorAt(i, color.setHex(colors[i % colors.length]));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.root.add(this.scope.track(mesh));
    return mesh;
  }

  private writeTransforms(t: number): void {
    for (let i = 0; i < this.butterflySites.length; i++) {
      const s = this.butterflySites[i];
      const angle = t * s.speed + s.phase;
      this.temp.position.set(s.x + Math.cos(angle) * s.radius,
        s.height + Math.sin(t * 3.2 + s.phase) * 0.45, s.z + Math.sin(angle) * s.radius);
      this.temp.rotation.set(Math.sin(t * 7 + s.phase) * 0.21, angle, Math.sin(t * 9 + s.phase) * 0.35);
      const flutter = 0.75 + 0.25 * Math.abs(Math.cos(t * 9 + s.phase));
      this.temp.scale.set(flutter * 0.75, 0.75, 0.75);
      this.temp.updateMatrix();
      this.butterflies.setMatrixAt(i, this.temp.matrix);
    }
    for (let i = 0; i < this.birdSites.length; i++) {
      const s = this.birdSites[i];
      const angle = t * s.speed + s.phase;
      this.temp.position.set(s.x + Math.cos(angle) * s.radius,
        s.height + Math.sin(t * 0.6 + s.phase) * 1.2, s.z + Math.sin(angle) * s.radius);
      this.temp.rotation.set(0, angle + Math.PI / 2, Math.sin(t * 2.3 + s.phase) * 0.14);
      this.temp.scale.set(1, 1, 1);
      this.temp.updateMatrix();
      this.birds.setMatrixAt(i, this.temp.matrix);
    }
    for (let i = 0; i < this.fishSites.length; i++) {
      const s = this.fishSites[i];
      const angle = t * s.speed + s.phase;
      this.temp.position.set(s.x + Math.cos(angle) * s.radius,
        s.height + Math.sin(t * 0.55 + s.phase) * 0.025, s.z + Math.sin(angle) * s.radius);
      this.temp.rotation.set(0, angle + Math.PI / 2 + Math.PI / 2, 0);
      this.temp.scale.set(0.63 + (i % 3) * 0.14, 1, 0.63 + (i % 3) * 0.14);
      this.temp.updateMatrix();
      this.fish.setMatrixAt(i, this.temp.matrix);
    }
    for (const mesh of [this.butterflies, this.birds, this.fish]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Throttled visual updates on the already-owned exterior variable tick. */
  update(dt: number, eye: readonly [number, number, number], reducedMotion: boolean): void {
    if (reducedMotion || !Number.isFinite(dt) || dt <= 0) return;
    if (Math.hypot(eye[0], eye[2]) > 300) return;
    this.time += Math.min(dt, 0.05);
    if (this.time - this.lastDraw < 1 / 24) return;
    this.lastDraw = this.time;
    this.writeTransforms(this.time);
  }
}

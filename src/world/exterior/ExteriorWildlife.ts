import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { QualityTier } from '../../render/QualityTiers';
import {
  LAGOON_OUTLINE, PATH_CENTERLINES, inAncientTreeClearing, isSiteLand, lagoonWaterClearance,
} from './IslandSiteLayout';

/**
 * One creature's authored home. `radius` bounds every horizontal excursion
 * from (x, z); the remaining fields give each creature its own movement
 * (lobe/lobeFreq: wander figure for butterflies, ellipse ratio/tilt for birds;
 * cyclePeriod/cycleOffset: perch cycle for butterflies, flap/glide for birds).
 */
type Creature = {
  x: number; z: number; phase: number; radius: number; speed: number; height: number;
  lobe: number; lobeFreq: number; cyclePeriod: number; cycleOffset: number;
};
export const WILDLIFE_COUNTS = {
  low: { butterflies: 12, birds: 6, fish: 8 },
  medium: { butterflies: 30, birds: 12, fish: 18 },
  high: { butterflies: 48, birds: 18, fish: 32 },
} as const;
/** Height of a butterfly settled on the ground (land support is at -0.5). */
export const BUTTERFLY_PERCH_Y = -0.46;
/** A visitor this close (m) to a butterfly makes it lift away. */
export const BUTTERFLY_STARTLE_RADIUS = 5;
/** Fish within this horizontal distance (m) of a visitor at the water scatter. */
export const FISH_FLEE_RADIUS = 10;
const HEADING_DT = 0.08;

function seed01(n: number): number {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
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
  private readonly scratchA = new THREE.Vector3();
  private readonly scratchB = new THREE.Vector3();
  private readonly butterflies: THREE.InstancedMesh;
  private readonly birds: THREE.InstancedMesh;
  private readonly fish: THREE.InstancedMesh;
  private readonly butterflySites: Creature[] = [];
  private readonly birdSites: Creature[] = [];
  private readonly fishSites: Creature[] = [];
  /** Smoothed per-butterfly startle offset (x, y, z). */
  private readonly butterflyStartle: Float32Array;
  /** Extra orbit phase each fish has gained by scattering from a visitor. */
  private readonly fishFlee: Float32Array;
  private resting = false;
  private time = 0;
  private lastDraw = 0;

  constructor(private readonly scope: ResourceScope, tier: QualityTier) {
    this.root.name = 'island-wildlife';
    // Reserve bounded high-tier capacity so later settings changes can grow as well as shrink.
    const sizes = WILDLIFE_COUNTS.high;

    for (let attempt = 0; attempt < 8000 && this.butterflySites.length < sizes.butterflies; attempt++) {
      const x = -166 + seed01(attempt * 23 + 13) * 332;
      const z = -152 + seed01(attempt * 31 + 47) * 310;
      const r = 0.65 + seed01(attempt * 11 + 83) * 0.8;
      if (!isSiteLand(x, z) || !isSiteLand(x + 2, z) || !isSiteLand(x - 2, z)
        || !isSiteLand(x, z + 2) || !isSiteLand(x, z - 2)) continue;
      if (Math.abs(x) < 50 && Math.abs(z) < 115) continue;
      if (x > 44 && x < 142 && z > -62 && z < 63) continue;
      if (Math.hypot(x + 104, z + 82) < 34 || Math.hypot(x, z - 128) < 52) continue;
      if (nearPath(x, z, 6.5) || inAncientTreeClearing(x, z)) continue;
      this.butterflySites.push({ x, z, phase: seed01(attempt + 147) * Math.PI * 2, radius: r,
        speed: 0.31 + seed01(attempt * 17) * 0.38, height: 1.9 + seed01(attempt + 37) * 2.8,
        lobe: 0.2 + seed01(attempt * 7 + 5) * 0.2, lobeFreq: 1.6 + seed01(attempt * 13 + 9),
        cyclePeriod: 14 + seed01(attempt * 29 + 3) * 14, cycleOffset: seed01(attempt * 41 + 1) * 28 });
    }

    const roosts: readonly (readonly [number, number])[] = [
      [-133, 38], [145, 83], [-115, -125], [131, -100], [-64, 125], [68, -133],
    ];
    for (let i = 0; i < sizes.birds; i++) {
      const [x, z] = roosts[i % roosts.length];
      this.birdSites.push({ x, z, phase: i * 2.39996323, radius: 8 + seed01(i + 17) * 9,
        speed: 0.10 + seed01(i + 43) * 0.14, height: 20 + (i % 5) * 3.4,
        lobe: 0.55 + seed01(i * 3 + 7) * 0.35, lobeFreq: seed01(i * 5 + 11) * Math.PI,
        cyclePeriod: 7 + seed01(i * 7 + 2) * 6, cycleOffset: seed01(i * 19 + 4) });
    }

    const minX = Math.min(...LAGOON_OUTLINE.map(([x]) => x));
    const maxX = Math.max(...LAGOON_OUTLINE.map(([x]) => x));
    const minZ = Math.min(...LAGOON_OUTLINE.map(([, z]) => z));
    const maxZ = Math.max(...LAGOON_OUTLINE.map(([, z]) => z));
    for (let i = 0; i < 9000 && this.fishSites.length < sizes.fish; i++) {
      const x = minX + 4 + seed01(i * 19 + 157) * (maxX - minX - 8);
      const z = minZ + 4 + seed01(i * 23 + 91) * (maxZ - minZ - 8);
      const radius = 1.0 + seed01(i * 5 + 67) * 1.45;
      // Protect the entire instanced fish silhouette, not only its center.
      // Maximum geometry extent is 1.34, maximum instance scale is 0.91.
      // The inset waterline clearance covers every orbit angle and bank slope;
      // the breathing orbit only ever shrinks below `radius`.
      const margin = radius + 1.34 * 0.91 + 0.05;
      if (lagoonWaterClearance(x, z) <= margin) continue;
      this.fishSites.push({ x, z, phase: seed01(i * 37) * Math.PI * 2, radius,
        speed: 0.14 + seed01(i * 11 + 31) * 0.25, height: -1.075,
        lobe: 0, lobeFreq: 1, cyclePeriod: 1, cycleOffset: 0 });
    }
    this.butterflyStartle = new Float32Array(this.butterflySites.length * 3);
    this.fishFlee = new Float32Array(this.fishSites.length);

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
    this.setQuality(tier);
  }

  /** Change visible populations without rebuilding the scene or allocating new GPU resources. */
  setQuality(tier: QualityTier): void {
    const sizes = WILDLIFE_COUNTS[tier];
    this.butterflies.count = sizes.butterflies;
    this.birds.count = sizes.birds;
    this.fish.count = sizes.fish;
    if (this.resting) this.applyRest();
    else this.writeTransforms(this.time);
  }

  /** True while the reduced-motion rest pose is shown. */
  get isResting(): boolean { return this.resting; }

  /** Authored home of a creature (read-only copy) — used by tests and tools. */
  site(kind: 'butterfly' | 'bird' | 'fish', index: number): Readonly<Creature> {
    const list = kind === 'butterfly' ? this.butterflySites : kind === 'bird' ? this.birdSites : this.fishSites;
    return { ...list[index] };
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

  /**
   * Butterfly flight: a two-lobed wander that never leaves the site's radius,
   * a slowly varying pace, and a periodic glide down to perch on the ground.
   * Writes the position and returns the perch weight (0 flying, 1 settled).
   */
  private butterflyAt(s: Creature, t: number, out: THREE.Vector3): number {
    const angle = s.phase + t * s.speed + 0.9 * Math.sin(t * 0.23 + s.phase);
    const b = angle * s.lobeFreq + s.phase;
    const ox = Math.cos(angle) * (1 - s.lobe) + Math.cos(b) * s.lobe;
    const oz = Math.sin(angle) * (1 - s.lobe) + Math.sin(b) * s.lobe;
    const cycle = (((t + s.cycleOffset) % s.cyclePeriod) + s.cyclePeriod) % s.cyclePeriod / s.cyclePeriod;
    const perch = smoothstep(0.70, 0.78, cycle) * (1 - smoothstep(0.94, 1, cycle));
    const airY = s.height + Math.sin(t * 3.2 + s.phase) * 0.45;
    out.set(
      lerp(s.x + ox * s.radius, s.x + Math.cos(s.phase) * s.radius * 0.6, perch),
      lerp(airY, BUTTERFLY_PERCH_Y, perch),
      lerp(s.z + oz * s.radius, s.z + Math.sin(s.phase) * s.radius * 0.6, perch),
    );
    return perch;
  }

  /** Birds: tilted elliptical circuits with altitude drift; returns 1 while flapping, 0 gliding. */
  private birdAt(s: Creature, t: number, out: THREE.Vector3): number {
    const angle = s.phase + t * s.speed + 0.25 * Math.sin(t * 0.11 + s.phase);
    const lx = Math.cos(angle) * s.radius;
    const lz = Math.sin(angle) * s.radius * s.lobe;
    const c = Math.cos(s.lobeFreq), sn = Math.sin(s.lobeFreq);
    out.set(s.x + lx * c - lz * sn,
      s.height + Math.sin(t * 0.6 + s.phase) * 1.2 + Math.sin(t * 0.07 + s.phase * 1.7) * 2.4,
      s.z + lx * sn + lz * c);
    const cycle = ((t / s.cyclePeriod + s.cycleOffset) % 1 + 1) % 1;
    return cycle < 0.38 ? 1 : 0;
  }

  /** Fish: burst-and-coast pace that never reverses, and an orbit that only breathes inward. */
  private fishAt(s: Creature, i: number, t: number, out: THREE.Vector3): void {
    const angle = s.phase + s.speed * (t + (0.8 / 0.45) * Math.sin(0.45 * t + s.phase)) + this.fishFlee[i];
    const r = s.radius * (0.86 + 0.14 * Math.sin(t * 0.21 + s.phase));
    out.set(s.x + Math.cos(angle) * r, s.height + Math.sin(t * 0.55 + s.phase) * 0.025, s.z + Math.sin(angle) * r);
  }

  private writeTransforms(t: number, dt = 0, eye?: readonly [number, number, number]): void {
    const p = this.scratchA;
    const q = this.scratchB;
    const blend = Math.min(1, dt * 3);
    const off = this.butterflyStartle;
    for (let i = 0; i < this.butterflies.count; i++) {
      const s = this.butterflySites[i];
      const perch = this.butterflyAt(s, t, p);
      this.butterflyAt(s, t + HEADING_DT, q);
      // A visitor walking into a butterfly's space makes it lift away, smoothly
      // and by a few metres at most; it drifts back once they move on.
      let tx = 0, ty = 0, tz = 0;
      if (eye) {
        const dx = p.x - eye[0], dy = p.y - eye[1], dz = p.z - eye[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < BUTTERFLY_STARTLE_RADIUS) {
          const push = (BUTTERFLY_STARTLE_RADIUS - d) * 0.6;
          const h = Math.hypot(dx, dz) || 1;
          tx = (dx / h) * push; tz = (dz / h) * push; ty = push * 0.5;
        }
      }
      const o = i * 3;
      off[o] += (tx - off[o]) * blend;
      off[o + 1] += (ty - off[o + 1]) * blend;
      off[o + 2] += (tz - off[o + 2]) * blend;
      const lift = Math.min(1, Math.hypot(off[o], off[o + 1], off[o + 2]));
      const flying = Math.max(1 - perch, lift);
      this.temp.position.set(p.x + off[o], p.y + off[o + 1], p.z + off[o + 2]);
      // Body axis is local +Z: face the direction of travel.
      const yaw = Math.atan2(q.x - p.x, q.z - p.z);
      this.temp.rotation.set(Math.sin(t * 7 + s.phase) * 0.21 * flying, yaw, Math.sin(t * 9 + s.phase) * 0.35 * flying);
      const flutter = 0.75 + 0.25 * Math.abs(Math.cos(t * 9 + s.phase));
      const rest = 0.35 + 0.3 * Math.abs(Math.sin(t * 1.3 + s.phase));
      this.temp.scale.set(lerp(rest, flutter, flying) * 0.75, 0.75, 0.75);
      this.temp.updateMatrix();
      this.butterflies.setMatrixAt(i, this.temp.matrix);
    }
    for (let i = 0; i < this.birds.count; i++) {
      const s = this.birdSites[i];
      const flapping = this.birdAt(s, t, p);
      this.birdAt(s, t + HEADING_DT, q);
      this.temp.position.copy(p);
      // Nose is local -Z; a steady bank into the (always same-handed) turn.
      const yaw = Math.atan2(-(q.x - p.x), -(q.z - p.z));
      this.temp.rotation.set(0, yaw, 0.18 + Math.sin(t * 2.3 + s.phase) * 0.08);
      this.temp.scale.set(1, flapping ? 1 + 0.75 * Math.sin(t * 9 + s.phase) : 0.82, 1);
      this.temp.updateMatrix();
      this.birds.setMatrixAt(i, this.temp.matrix);
    }
    for (let i = 0; i < this.fish.count; i++) {
      const s = this.fishSites[i];
      if (eye && dt > 0 && eye[1] < 4) {
        // Fish scatter (speed up along their own orbit) from a visitor at the water's edge.
        const d = Math.hypot(s.x - eye[0], s.z - eye[2]);
        if (d < FISH_FLEE_RADIUS) this.fishFlee[i] += dt * 1.6 * (1 - d / FISH_FLEE_RADIUS);
      }
      this.fishAt(s, i, t, p);
      this.fishAt(s, i, t + HEADING_DT, q);
      this.temp.position.copy(p);
      // Nose is local +Z: face the actual direction of travel.
      this.temp.rotation.set(0, Math.atan2(q.x - p.x, q.z - p.z), 0);
      this.temp.scale.set(0.63 + (i % 3) * 0.14, 1, 0.63 + (i % 3) * 0.14);
      this.temp.updateMatrix();
      this.fish.setMatrixAt(i, this.temp.matrix);
    }
    for (const mesh of [this.butterflies, this.birds, this.fish]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Reduced motion: nothing hangs frozen in mid-air. Butterflies are shown
   * settled on the ground with closed wings, birds are not drawn, and fish
   * simply hold still under the water.
   */
  private applyRest(): void {
    for (let i = 0; i < this.butterflies.count; i++) {
      const s = this.butterflySites[i];
      this.temp.position.set(s.x + Math.cos(s.phase) * s.radius * 0.6, BUTTERFLY_PERCH_Y,
        s.z + Math.sin(s.phase) * s.radius * 0.6);
      this.temp.rotation.set(0, s.phase, 0);
      this.temp.scale.set(0.3, 0.75, 0.75);
      this.temp.updateMatrix();
      this.butterflies.setMatrixAt(i, this.temp.matrix);
    }
    this.butterflyStartle.fill(0);
    this.butterflies.instanceMatrix.needsUpdate = true;
    this.birds.visible = false;
    this.resting = true;
  }

  /** Throttled visual updates on the already-owned exterior variable tick. */
  update(dt: number, eye: readonly [number, number, number], reducedMotion: boolean): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (reducedMotion) {
      if (!this.resting) this.applyRest();
      return;
    }
    if (Math.hypot(eye[0], eye[2]) > 300) return;
    if (this.resting) {
      this.resting = false;
      this.birds.visible = true;
    }
    this.time += Math.min(dt, 0.05);
    if (this.time - this.lastDraw < 1 / 24) return;
    const elapsed = this.time - this.lastDraw;
    this.lastDraw = this.time;
    this.writeTransforms(this.time, elapsed, eye);
  }
}

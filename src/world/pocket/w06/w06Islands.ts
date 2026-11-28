import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { orientedWall, paintVertices, seededRandom, tierCount } from '../kit/worldKit';
import { type Island, onIsland, type Updraft } from './w06Layout';

const UP = new THREE.Vector3(0, 1, 0);
const RIM_SEGMENTS = 36;

function angleDiff(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

export interface IslandMaterials {
  readonly ground: THREE.Material;
  readonly rock: THREE.Material;
  readonly rail: THREE.Material;
}

/**
 * One floating island: an exact round floor, a railed rim (open only on its
 * authored arcs), a solid core so nothing passes through the rock, and the
 * visible grass cap and hanging rock underside.
 */
export function buildIsland(ctx: PocketWorldContext, island: Island, mats: IslandMaterials, seed: number): { flowers: THREE.InstancedMesh; flowerBase: THREE.Matrix4[] } {
  const { scope, collision, root } = ctx;
  const { cx, cz, r, y } = island;
  collision.addMaskedFloor(cx - r, cx + r, cz - r, cz + r, y, (x, z) => onIsland(island, x, z));
  const depth = Math.max(5, r * 1.5);
  const core = r * 0.62;
  collision.add({ kind: 'wall', minX: cx - core, maxX: cx + core, minY: y - depth, maxY: y - 0.6, minZ: cz - core, maxZ: cz + core });

  // Rim rails (oriented segments), skipped on open arcs.
  const rails: { x: number; z: number; half: number; yaw: number }[] = [];
  for (let i = 0; i < RIM_SEGMENTS; i++) {
    const a = ((i + 0.5) / RIM_SEGMENTS) * Math.PI * 2;
    if (island.open.some(([b, half]) => angleDiff(a, b) < half)) continue;
    const rr = r - 0.15;
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    const half = (Math.PI * rr) / RIM_SEGMENTS;
    collision.add(orientedWall(x, z, 0.15, half, -a, y - 0.6, y + 1.1));
    rails.push({ x, z, half, yaw: -a });
  }
  const railMesh = new THREE.InstancedMesh(scope.track(new THREE.CylinderGeometry(0.045, 0.045, 1, 6)), mats.rail, Math.max(1, rails.length * 2));
  const postMesh = new THREE.InstancedMesh(scope.track(new THREE.CylinderGeometry(0.07, 0.09, 1.05, 6)), mats.rail, Math.max(1, rails.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const lay = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  rails.forEach(({ x, z, half, yaw }, i) => {
    q.copy(lay).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
    railMesh.setMatrixAt(i * 2, m.compose(new THREE.Vector3(x, y + 1.0, z), q, new THREE.Vector3(1, half * 2, 1)));
    railMesh.setMatrixAt(i * 2 + 1, m.compose(new THREE.Vector3(x, y + 0.55, z), q, new THREE.Vector3(1, half * 2, 1)));
    postMesh.setMatrixAt(i, m.makeTranslation(x, y + 0.52, z));
  });
  railMesh.count = rails.length * 2;
  postMesh.count = rails.length;
  railMesh.raycast = () => {};
  postMesh.raycast = () => {};
  root.add(railMesh, postMesh);

  // Grass cap and hanging rock.
  const rand = seededRandom(seed);
  const cap = scope.track(new THREE.CylinderGeometry(r + 0.1, r - 0.3, 0.7, 56, 1));
  cap.translate(0, -0.35, 0);
  paintVertices(cap, (vx, vy, vz, out) => {
    const edge = Math.hypot(vx, vz) / r;
    if (vy > -0.05) out.setHSL(0.27 + Math.sin(vx * 0.7 + vz * 0.5) * 0.02, 0.5, 0.42 - edge * 0.06);
    else out.setHSL(0.09, 0.35, 0.3);
  });
  const capMesh = new THREE.Mesh(cap, mats.ground);
  capMesh.position.set(cx, y, cz);
  root.add(capMesh);
  const rockGeo = scope.track(new THREE.ConeGeometry(r - 0.3, depth, 14, 5));
  rockGeo.rotateX(Math.PI);
  rockGeo.translate(0, -depth / 2 - 0.65, 0);
  const pos = rockGeo.getAttribute('position');
  for (let k = 0; k < pos.count; k++) {
    const py = pos.getY(k);
    if (py > -0.7) continue;
    const jitter = 1 + (rand() - 0.5) * 0.28;
    pos.setX(k, pos.getX(k) * jitter);
    pos.setZ(k, pos.getZ(k) * jitter);
  }
  rockGeo.computeVertexNormals();
  paintVertices(rockGeo, (_x, py, _z, out) => out.setHSL(0.07 + Math.sin(py * 1.7) * 0.015, 0.22, 0.34 + Math.sin(py * 2.3) * 0.05));
  const rockMesh = new THREE.Mesh(rockGeo, mats.rock);
  rockMesh.position.set(cx, y, cz);
  root.add(rockMesh);

  // Flowers in the grass: small flat blossoms on short stems (heads swell a little in the finale).
  const count = Math.round(tierCount(ctx, r * r * 1.6, 12));
  const headGeo = scope.track(new THREE.IcosahedronGeometry(0.09, 0));
  headGeo.scale(1, 0.45, 1);
  const flowers = new THREE.InstancedMesh(headGeo, scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x332211, emissiveIntensity: 0.2 })), count);
  const stemGeo = scope.track(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 4));
  stemGeo.translate(0, 0.12, 0);
  const stems = new THREE.InstancedMesh(stemGeo, scope.track(new THREE.MeshStandardMaterial({ color: 0x4f8a3c, roughness: 0.8 })), count);
  const flowerBase: THREE.Matrix4[] = [];
  const col = new THREE.Color();
  for (let k = 0; k < count; k++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * (r - 1.2);
    const fx = cx + Math.cos(a) * d, fz = cz + Math.sin(a) * d;
    const mtx = new THREE.Matrix4().makeTranslation(fx, y + 0.25, fz);
    flowerBase.push(mtx);
    flowers.setMatrixAt(k, mtx);
    stems.setMatrixAt(k, m.makeTranslation(fx, y, fz));
    flowers.setColorAt(k, col.setHSL([0.95, 0.12, 0.6, 0.8, 0.15][k % 5], 0.75, 0.68));
  }
  flowers.raycast = () => {};
  stems.raycast = () => {};
  root.add(flowers, stems);
  return { flowers, flowerBase };
}

/** Spiralling petals and a faint column of air for one updraft. */
export function buildUpdraftVisual(ctx: PocketWorldContext, u: Updraft, petalGeo: THREE.BufferGeometry, petalMat: THREE.Material, airMat: THREE.Material) {
  const { scope, root } = ctx;
  const base = Math.max(u.base, u.top - 30);
  const height = u.top + 3 - base;
  // Additive air: vertex brightness fades to nothing at both ends, so the column never reads as a solid tube.
  const airGeo = scope.track(new THREE.CylinderGeometry(u.r * 0.92, u.r, height, 28, 8, true));
  paintVertices(airGeo, (_x, py, _z, out) => { const t = py / height + 0.5; out.setScalar(Math.sin(Math.PI * t) ** 1.5); });
  const air = new THREE.Mesh(airGeo, airMat);
  air.position.set(u.cx, base + height / 2, u.cz);
  air.raycast = () => {};
  root.add(air);
  const n = Math.max(24, Math.round(tierCount(ctx, height * 6, 20)));
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, n);
  petals.raycast = () => {};
  petals.frustumCulled = false;
  root.add(petals);
  const seeds = Array.from({ length: n }, (_, i) => ({ phase: (i / n) * Math.PI * 2 * 5, lift: i / n, rr: u.r * (0.35 + ((i * 37) % 11) / 18) }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  return {
    update(time: number, reducedMotion: boolean): void {
      const t = reducedMotion ? 0 : time;
      seeds.forEach((sd, i) => {
        const f = (sd.lift + t * 0.09) % 1;
        const a = sd.phase + t * 1.1 + f * 4;
        v.set(u.cx + Math.cos(a) * sd.rr, base + f * height, u.cz + Math.sin(a) * sd.rr);
        e.set(t * 2 + i, a, t + i * 0.3);
        petals.setMatrixAt(i, m.compose(v, q.setFromEuler(e), s));
      });
      petals.instanceMatrix.needsUpdate = true;
    },
  };
}

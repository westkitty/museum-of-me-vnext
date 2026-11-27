import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { paintVertices, seededRandom, tierCount, type Rect } from '../kit/worldKit';
import {
  ALL_RAMPS, ALL_SHELVES, coast, FOSSIL_LOOP, GORGE_EAST, GORGE_WEST, insideCoast, MAIN_ROUTE,
  rampHeightAt, type W02RampDef, type W02ShelfDef,
} from './w02Layout';

/**
 * Prehistoric vegetation: tree ferns with arching fronds, ground fern clumps,
 * horsetail stands, monumental roots and route lanterns. Everything repeated
 * is instanced; only tree-fern trunks and root feet collide.
 */

export interface W02Flora {
  readonly frondGeometry: THREE.BufferGeometry;
  readonly frondMaterial: THREE.Material;
  readonly rootMaterial: THREE.MeshStandardMaterial;
  update(time: number, reducedMotion: boolean): void;
}

/** One arching fern frond along +X: a spine with alternating leaflets. */
export function buildFrondGeometry(segments = 14): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const base = new THREE.Color(0x2f5a2a);
  const tip = new THREE.Color(0x8cc96a);
  const c = new THREE.Color();
  const spine = (s: number) => new THREE.Vector3(s, Math.sin(s * Math.PI * 0.85) * 0.32 - s * s * 0.42, 0);
  const push = (v: THREE.Vector3, t: number) => {
    positions.push(v.x, v.y, v.z);
    c.copy(base).lerp(tip, t);
    colors.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < segments; i++) {
    const s0 = i / segments;
    const s1 = (i + 1) / segments;
    const a = spine(s0);
    const b = spine(s1);
    const width = 0.2 * Math.sin(Math.PI * Math.min(1, s0 * 1.15 + 0.08));
    for (const side of [-1, 1]) {
      const leaf = new THREE.Vector3((s0 + s1) / 2 + 0.04, a.y - 0.03, side * width);
      push(a, s0); push(b, s1); push(leaf, s0 + 0.1);
      // the underside so the frond reads from below without a double-sided material cost
      push(a, s0); push(leaf, s0 + 0.1); push(b, s1);
    }
    // a thin rib so the spine reads at distance
    const rib = new THREE.Vector3((s0 + s1) / 2, (a.y + b.y) / 2 + 0.012, 0);
    push(a, s0 * 0.5); push(rib, s0 * 0.5); push(b, s1 * 0.5);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function distToPath(path: readonly (readonly [number, number])[], x: number, z: number): number {
  let d = Infinity;
  for (let i = 1; i < path.length; i++) d = Math.min(d, distToSegment(x, z, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]));
  return d;
}

function inPadded(r: Rect, x: number, z: number, pad: number): boolean {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;
}

function distToCoast(x: number, z: number): number {
  let d = Infinity;
  for (let i = 0; i < coast.length; i++) {
    const a = coast[i], b = coast[(i + 1) % coast.length];
    d = Math.min(d, distToSegment(x, z, a[0], a[1], b[0], b[1]));
  }
  return d;
}

/** True where scenery may stand on the ground without crowding the route. */
export function isClearGround(x: number, z: number, routeClearance: number): boolean {
  if (!insideCoast(x, z) || distToCoast(x, z) < 2.5) return false;
  if (x > GORGE_WEST - 1.5 && x < GORGE_EAST + 1.5) return false;
  if (distToPath(MAIN_ROUTE, x, z) < routeClearance || distToPath(FOSSIL_LOOP, x, z) < routeClearance) return false;
  for (const r of [...ALL_RAMPS, ...ALL_SHELVES] as readonly Rect[]) if (inPadded(r, x, z, 1.6)) return false;
  if (Math.hypot(x + 28, z + 16) < 6) return false; // fossil hollow stays open
  return true;
}

export function buildW02Flora(ctx: PocketWorldContext): W02Flora {
  const { scope, root, collision } = ctx;
  const random = seededRandom(0xf3e2);
  const frondGeometry = scope.track(buildFrondGeometry());
  const frondMaterial = scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }));
  const rootMaterial = scope.track(new THREE.MeshStandardMaterial({ color: 0x6a4d33, roughness: 0.9, flatShading: true }));
  const barkGeo = scope.track(new THREE.CylinderGeometry(0.32, 0.52, 1, 8, 6));
  paintVertices(barkGeo, (x, y, z, c) => c.setHex(0x4a3524).offsetHSL(0, 0, 0.05 * Math.sin(y * 19 + Math.atan2(z, x) * 3)));
  const barkMat = scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));

  // ---- Tree ferns (instanced trunks + fronds). Authored grove sites first, then scatter.
  const authored: [number, number, number][] = [
    [-46, 2, 7], [-44, 14, 8.5], [-36, -2, 6], [-38, 16, 7.5], [-33, -6, 9], [-26, 20, 8], [-20, -4, 7],
    [-24, -24, 10], [-36, -24, 8], [-16, 22, 9], [-8, -18, 7], [-8, 26, 8],
    [20, 20, 9], [26, 14, 7], [30, -6, 8.5], [24, -30, 9], [10, 26, 7.5], [34, 28, 10], [46, 26, 7], [28, 36, 8],
  ];
  const ferns: [number, number, number][] = authored.filter(([x, z]) => isClearGround(x, z, 3.2));
  const target = tierCount(ctx, 46, 18);
  for (let tries = 0; ferns.length < target && tries < 900; tries++) {
    const x = -50 + random() * 100;
    const z = -48 + random() * 100;
    if (!isClearGround(x, z, 4) || ferns.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < 5.5)) continue;
    ferns.push([x, z, 5 + random() * 5]);
  }
  const frondsPer = 11;
  const trunks = new THREE.InstancedMesh(barkGeo, barkMat, ferns.length);
  const fronds = new THREE.InstancedMesh(frondGeometry, frondMaterial, ferns.length * frondsPer);
  trunks.castShadow = fronds.castShadow = ctx.quality.shadows;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  ferns.forEach(([x, z, h], i) => {
    const lean = (random() - 0.5) * 0.12;
    e.set(lean, 0, -lean);
    q.setFromEuler(e);
    p.set(x, h / 2, z);
    s.set(1, h, 1);
    trunks.setMatrixAt(i, m.compose(p, q, s));
    collision.addBox([x, 2.2, z], [0.5, 2.2, 0.5]);
    for (let k = 0; k < frondsPer; k++) {
      const yaw = (k / frondsPer) * Math.PI * 2 + random() * 0.4;
      const droop = -0.25 + random() * 0.5;
      e.set(0, yaw, droop, 'YZX');
      q.setFromEuler(e);
      const len = 3.6 + random() * 1.6;
      p.set(x + Math.sin(lean) * h * 0.5, h - 0.1, z);
      s.set(len, len, len);
      fronds.setMatrixAt(i * frondsPer + k, m.compose(p, q, s));
    }
  });
  root.add(trunks, fronds);

  // ---- Ground ferns: low clumps of the same frond, dense along the route edges.
  const clumpTarget = tierCount(ctx, 150, 50);
  const clumps: [number, number, number][] = [];
  for (let tries = 0; clumps.length < clumpTarget && tries < 3000; tries++) {
    const x = -50 + random() * 100;
    const z = -48 + random() * 100;
    if (!isClearGround(x, z, 1.8)) continue;
    clumps.push([x, z, 0.7 + random() * 0.9]);
  }
  const perClump = 6;
  const groundFronds = new THREE.InstancedMesh(frondGeometry, frondMaterial, clumps.length * perClump);
  clumps.forEach(([x, z, size], i) => {
    for (let k = 0; k < perClump; k++) {
      e.set(0, (k / perClump) * Math.PI * 2 + random(), 0.55 + random() * 0.35, 'YZX');
      q.setFromEuler(e);
      p.set(x, 0.02, z);
      s.set(size * 1.6, size * 1.6, size * 1.6);
      groundFronds.setMatrixAt(i * perClump + k, m.compose(p, q, s));
    }
  });
  root.add(groundFronds);

  // ---- Horsetail stands along the gorge rims and wet coast.
  const reedGeo = scope.track(new THREE.CylinderGeometry(0.045, 0.07, 1, 5, 4));
  paintVertices(reedGeo, (_x, y, _z, c) => c.setHex(Math.abs(Math.sin(y * 18)) > 0.92 ? 0x2b3a22 : 0x6f9a4e));
  const reedMat = scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  const reedTarget = tierCount(ctx, 320, 90);
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, reedTarget);
  let reedCount = 0;
  for (let tries = 0; reedCount < reedTarget && tries < 4000; tries++) {
    const nearGorge = random() < 0.6;
    const x = nearGorge ? (random() < 0.5 ? GORGE_WEST - 1.6 - random() * 4 : GORGE_EAST + 1.6 + random() * 4) : -50 + random() * 100;
    const z = -48 + random() * 100;
    if (!insideCoast(x, z) || distToCoast(x, z) < 1.2) continue;
    if (distToPath(MAIN_ROUTE, x, z) < 1.6 || distToPath(FOSSIL_LOOP, x, z) < 1.6) continue;
    if ((ALL_RAMPS as readonly Rect[]).concat(ALL_SHELVES).some((r) => inPadded(r, x, z, 0.6))) continue;
    const h = 1.2 + random() * 1.8;
    e.set((random() - 0.5) * 0.2, 0, (random() - 0.5) * 0.2);
    q.setFromEuler(e);
    reeds.setMatrixAt(reedCount++, m.compose(p.set(x, h / 2, z), q, s.set(1, h, 1)));
  }
  reeds.count = reedCount;
  root.add(reeds);

  // ---- Monumental roots: arches over the arrival trail and the root climb,
  // and buttress roots wrapping every elevated terrace.
  const arch = (a: THREE.Vector3, b: THREE.Vector3, height: number, radius: number) => {
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.max(a.y, b.y) + height;
    const curve = new THREE.CatmullRomCurve3([
      a.clone().add(new THREE.Vector3(0, -1.2, 0)), a, a.clone().lerp(mid, 0.5).setY(mid.y * 0.85), mid,
      b.clone().lerp(mid, 0.5).setY(mid.y * 0.85), b, b.clone().add(new THREE.Vector3(0, -1.2, 0)),
    ]);
    const tube = new THREE.Mesh(scope.track(new THREE.TubeGeometry(curve, 40, radius, 7, false)), rootMaterial);
    tube.castShadow = ctx.quality.shadows;
    root.add(tube);
    for (const foot of [a, b]) collision.addBox([foot.x, 1.2, foot.z], [radius + 0.15, 1.2, radius + 0.15]);
  };
  // Arrival arches frame the first view east toward the climb.
  arch(new THREE.Vector3(-36.5, 0, 0.8), new THREE.Vector3(-36, 0, 14.5), 5.5, 0.55);
  arch(new THREE.Vector3(-34, 0, -1.4), new THREE.Vector3(-31.5, 0, 14.2), 7, 0.7);
  // Fossil-loop gateway.
  arch(new THREE.Vector3(-37.5, 0, -13.5), new THREE.Vector3(-30.5, 0, -5.5), 5, 0.5);
  // Great roots over the east route, seen from the bridge.
  arch(new THREE.Vector3(20.5, 2, -6), new THREE.Vector3(20.5, 0, 3), 9, 0.9);
  arch(new THREE.Vector3(30, 0, -12), new THREE.Vector3(30, 0, -28), 13, 1.1);

  const buttress = (r: W02RampDef | W02ShelfDef) => {
    const top = 'y' in r ? r.y : Math.max(r.yAtMin, r.yAtMax);
    const corners: [number, number][] = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]];
    for (const [cx, cz] of corners) {
      const ty = 'y' in r ? r.y : rampHeightAt(r, cx, cz);
      if (ty < 1) continue;
      const out = new THREE.Vector3(cx - (r.minX + r.maxX) / 2, 0, cz - (r.minZ + r.maxZ) / 2).normalize();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx + out.x * 2.6, -0.6, cz + out.z * 2.6),
        new THREE.Vector3(cx + out.x * 1.4, ty * 0.35, cz + out.z * 1.4),
        new THREE.Vector3(cx + out.x * 0.35, ty * 0.8, cz + out.z * 0.35),
        new THREE.Vector3(cx, ty + 0.25, cz),
      ]);
      const tube = new THREE.Mesh(scope.track(new THREE.TubeGeometry(curve, 16, 0.35 + top * 0.04, 6, false)), rootMaterial);
      root.add(tube);
    }
  };
  for (const r of [...ALL_RAMPS.filter((ramp) => Math.max(ramp.yAtMin, ramp.yAtMax) > 2), ...ALL_SHELVES]) buttress(r);

  // ---- Rocks on the cliff rims and in the arrival meadow.
  const rockGeo = scope.track(new THREE.DodecahedronGeometry(1, 0));
  const rockMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x6d6555, roughness: 1, flatShading: true }));
  const rockTarget = tierCount(ctx, 90, 30);
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockTarget);
  let rockCount = 0;
  for (let tries = 0; rockCount < rockTarget && tries < 3000; tries++) {
    const x = -50 + random() * 100;
    const z = -48 + random() * 100;
    if (!insideCoast(x, z)) continue;
    const rim = distToCoast(x, z) < 3.2 || (x > GORGE_WEST - 3 && x < GORGE_WEST - 0.6) || (x > GORGE_EAST + 0.6 && x < GORGE_EAST + 3);
    if (!rim && random() > 0.15) continue;
    if (distToPath(MAIN_ROUTE, x, z) < 2.2 || distToPath(FOSSIL_LOOP, x, z) < 2.2) continue;
    if ((ALL_RAMPS as readonly Rect[]).concat(ALL_SHELVES).some((r) => inPadded(r, x, z, 0.8))) continue;
    const size = 0.4 + random() * 1.1;
    e.set(random() * 3, random() * 3, random() * 3);
    q.setFromEuler(e);
    rocks.setMatrixAt(rockCount++, m.compose(p.set(x, size * 0.3, z), q, s.set(size * 1.3, size, size * 1.1)));
  }
  rocks.count = rockCount;
  root.add(rocks);

  // ---- Route lanterns: luminous fungi at terrace corners. Diegetic guidance
  // that remains readable on every tier and with motion reduced.
  const lanternSpots: [number, number, number][] = [];
  const inset = 0.55;
  for (const r of [...ALL_RAMPS, ...ALL_SHELVES]) {
    for (const [cx, cz] of [[r.minX + inset, r.minZ + inset], [r.maxX - inset, r.minZ + inset], [r.maxX - inset, r.maxZ - inset], [r.minX + inset, r.maxZ - inset]] as const) {
      const y = 'y' in r ? r.y : rampHeightAt(r, cx, cz);
      lanternSpots.push([cx, y, cz]);
    }
  }
  const stemGeo = scope.track(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5));
  const capGeo = scope.track(new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2));
  const stemMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xb9c9a0, roughness: 0.8 }));
  const capMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x9cf0d0, emissive: 0x3ee0b0, emissiveIntensity: 1.4 }));
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, lanternSpots.length);
  const caps = new THREE.InstancedMesh(capGeo, capMat, lanternSpots.length);
  q.identity();
  lanternSpots.forEach(([x, y, z], i) => {
    stems.setMatrixAt(i, m.compose(p.set(x, y + 0.25, z), q, s.set(1, 1, 1)));
    caps.setMatrixAt(i, m.compose(p.set(x, y + 0.48, z), q, s.set(1, 1, 1)));
  });
  root.add(stems, caps);

  // ---- Drifting spores along the route.
  const sporeCount = tierCount(ctx, 220, 60);
  const sporePos = new Float32Array(sporeCount * 3);
  const sporeBase = new Float32Array(sporeCount * 3);
  const route = [...MAIN_ROUTE, ...FOSSIL_LOOP];
  for (let i = 0; i < sporeCount; i++) {
    const [x, z] = route[Math.floor(random() * route.length)];
    sporeBase.set([x + (random() - 0.5) * 12, 1 + random() * 6, z + (random() - 0.5) * 12], i * 3);
  }
  sporePos.set(sporeBase);
  const sporeGeo = scope.track(new THREE.BufferGeometry());
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(sporePos, 3));
  const spores = new THREE.Points(sporeGeo, scope.track(new THREE.PointsMaterial({
    color: 0xd9ffd0, size: 0.14, transparent: true, opacity: 0.8, depthWrite: false,
  })));
  spores.frustumCulled = false;
  root.add(spores);

  const update = (time: number, reducedMotion: boolean) => {
    if (reducedMotion) return;
    for (let i = 0; i < sporeCount; i++) {
      const k = i * 3;
      sporePos[k] = sporeBase[k] + Math.sin(time * 0.3 + i) * 0.8;
      sporePos[k + 1] = sporeBase[k + 1] + Math.sin(time * 0.21 + i * 1.3) * 0.6;
      sporePos[k + 2] = sporeBase[k + 2] + Math.cos(time * 0.27 + i * 0.7) * 0.8;
    }
    sporeGeo.getAttribute('position').needsUpdate = true;
  };

  return { frondGeometry, frondMaterial, rootMaterial, update };
}

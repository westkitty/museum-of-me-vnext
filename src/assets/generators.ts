import * as THREE from 'three';
import type { ResourceScope } from './ResourceScope';
import { registerProcedural } from './manifest';

/**
 * Deterministic pseudo-random source. Procedural assets must produce identical
 * geometry every run, so nothing here uses Math.random.
 */
export function rng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

export interface LatheProfile {
  /** [radius, height] pairs, bottom to top. */
  readonly points: readonly (readonly [number, number])[];
  readonly segments?: number;
}

/** A turned form — plinths, columns, bowls, vessels. */
export function lathe(scope: ResourceScope, profile: LatheProfile): THREE.BufferGeometry {
  const points = profile.points.map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h));
  return scope.track(new THREE.LatheGeometry(points, profile.segments ?? 24));
}

/** An extruded polygon — plinth tops, panels, floor inlays. */
export function polygonPrism(
  scope: ResourceScope,
  sides: number,
  radius: number,
  height: number,
  rotate = 0,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + rotate;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, height, 0);
  return scope.track(geo);
}

/**
 * A tube following a path. The museum's threads, cables, pipes, orbits and
 * network links are all built from this.
 */
export function tubeAlong(
  scope: ResourceScope,
  points: readonly THREE.Vector3[],
  radius: number,
  tubularSegments = 48,
  radialSegments = 6,
  closed = false,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([...points], closed);
  return scope.track(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed));
}

/** Instanced repetition — stars, shelves, crowds of small parts. */
export function instanced(
  scope: ResourceScope,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: readonly THREE.Matrix4[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  scope.track(geometry);
  scope.track(material);
  return mesh;
}

/** Points on a sphere, evenly distributed. Used for star fields and node graphs. */
export function fibonacciSphere(count: number, radius: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out.push(new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius));
  }
  return out;
}

/** A ring of transforms, for arranging stations around a centre. */
export function ringTransforms(count: number, radius: number, y = 0): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const m = new THREE.Matrix4();
    m.makeRotationY(-a);
    m.setPosition(Math.sin(a) * radius, y, Math.cos(a) * radius);
    out.push(m);
  }
  return out;
}

/**
 * Shared museum furniture assets. Registered here so the plinths, cases and
 * benches every exhibit reuses carry provenance like everything else.
 */
export const SHARED_ASSETS = {
  plinth: registerProcedural('kit.plinth', 'Exhibit plinth', 'shell'),
  case: registerProcedural('kit.case', 'Display case', 'shell'),
  bench: registerProcedural('kit.bench', 'Gallery bench', 'shell'),
  rail: registerProcedural('kit.rail', 'Guard rail', 'shell'),
} as const;

/** A standard plinth: the museum's most repeated object. */
export function buildPlinth(scope: ResourceScope, radius = 0.7, height = 0.95, material?: THREE.Material): THREE.Mesh {
  const mat = material ?? scope.track(new THREE.MeshStandardMaterial({ color: 0x3c352b, roughness: 0.82 }));
  const geo = lathe(scope, {
    points: [
      [radius * 1.12, 0],
      [radius * 1.12, 0.08],
      [radius, 0.16],
      [radius, height - 0.14],
      [radius * 1.1, height - 0.06],
      [radius * 1.1, height],
      [0, height],
    ],
    segments: 20,
  });
  return new THREE.Mesh(geo, mat);
}

/** A glass display case on a plinth. */
export function buildCase(scope: ResourceScope, width = 1.2, height = 1.1, depth = 1.2): THREE.Group {
  const group = new THREE.Group();
  const glass = scope.track(
    new THREE.MeshStandardMaterial({
      color: 0xcfe2f0, roughness: 0.05, metalness: 0,
      transparent: true, opacity: 0.16, side: THREE.DoubleSide,
    }),
  );
  const frame = scope.track(new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.45, metalness: 0.5 }));

  const box = new THREE.Mesh(scope.track(new THREE.BoxGeometry(width, height, depth)), glass);
  box.position.y = height / 2;
  group.add(box);

  const edge = scope.track(new THREE.BoxGeometry(0.045, height, 0.045));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(edge, frame);
      post.position.set((sx * width) / 2, height / 2, (sz * depth) / 2);
      group.add(post);
    }
  }
  return group;
}

/** A gallery bench. Visitors need somewhere to stop. */
export function buildBench(scope: ResourceScope, length = 1.8): THREE.Group {
  const group = new THREE.Group();
  const wood = scope.track(new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.7 }));
  const metal = scope.track(new THREE.MeshStandardMaterial({ color: 0x2d2925, roughness: 0.4, metalness: 0.6 }));

  const seat = new THREE.Mesh(scope.track(new THREE.BoxGeometry(length, 0.09, 0.44)), wood);
  seat.position.y = 0.44;
  group.add(seat);

  const legGeo = scope.track(new THREE.BoxGeometry(0.07, 0.44, 0.4));
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, metal);
    leg.position.set((s * length) / 2 - s * 0.16, 0.22, 0);
    group.add(leg);
  }
  return group;
}

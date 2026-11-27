import * as THREE from 'three';
import type { Wall } from '../../CollisionWorld';
import type { PocketWorldContext } from '../types';

/**
 * Small, world-local authoring helpers shared by the pocket-world previews.
 *
 * Every helper keeps the visible surface and its collider in one call so a
 * route can never show a floor it does not support, or support a floor it
 * does not show. Nothing here owns state or runs per frame.
 */

export type Axis = 'x' | 'z';

export interface Rect {
  readonly minX: number; readonly maxX: number;
  readonly minZ: number; readonly maxZ: number;
}

/** Deterministic PRNG (mulberry32) so authored scatter is identical every visit. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A box whose top face follows a ramp plane: `topAtMin` at the axis minimum,
 * `topAtMax` at the axis maximum, and whose bottom sits `depth` below the
 * lower of the two. Used for platforms (equal heights) and ramps alike.
 */
export function slabGeometry(r: Rect, axis: Axis, topAtMin: number, topAtMax: number, depth: number): THREE.BufferGeometry {
  const bottom = Math.min(topAtMin, topAtMax) - depth;
  const top = (x: number, z: number) => {
    const t = axis === 'x' ? (x - r.minX) / (r.maxX - r.minX) : (z - r.minZ) / (r.maxZ - r.minZ);
    return topAtMin + (topAtMax - topAtMin) * t;
  };
  const corners: [number, number][] = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]];
  const positions: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  };
  const T = corners.map(([x, z]) => new THREE.Vector3(x, top(x, z), z));
  const B = corners.map(([x, z]) => new THREE.Vector3(x, bottom, z));
  quad(T[0], T[3], T[2], T[1]);
  quad(B[0], B[1], B[2], B[3]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(B[i], T[i], T[j], B[j]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export interface PlatformSpec extends Rect {
  readonly y: number;
  /** Visual depth below the walkable top (default 0.6). */
  readonly depth?: number;
  /** Block ground-level walking into the solid mass (default true). */
  readonly solidBelow?: boolean;
}

/** Visible slab + supporting floor collider, optionally solid underneath. */
export function addPlatform(ctx: PocketWorldContext, material: THREE.Material, spec: PlatformSpec, parent: THREE.Object3D = ctx.root): THREE.Mesh {
  const depth = spec.depth ?? 0.6;
  const mesh = new THREE.Mesh(ctx.scope.track(slabGeometry(spec, 'x', spec.y, spec.y, depth)), material);
  mesh.receiveShadow = true;
  parent.add(mesh);
  ctx.collision.addFloor(spec.minX, spec.maxX, spec.minZ, spec.maxZ, spec.y);
  if (spec.solidBelow ?? true) {
    const bottom = spec.y - depth;
    // The wall stops 0.6 m below the walkable top: a visitor arriving up a ramp
    // has feet up to ~0.1-0.2 m below the top at the capsule edge and must not
    // snag, while anyone on lower ground (more than a step-up below) is blocked.
    if (spec.y - 0.6 > bottom) addWall(ctx, spec.minX, spec.maxX, bottom, spec.y - 0.6, spec.minZ, spec.maxZ);
  }
  return mesh;
}

export interface RampSpec extends Rect {
  readonly axis: Axis;
  readonly yAtMin: number;
  readonly yAtMax: number;
  readonly depth?: number;
  /** Add railings along both long sides (default true). */
  readonly rails?: boolean;
  readonly railHeight?: number;
}

/** Visible sloped slab + ramp collider, with optional side railings. */
export function addRamp(ctx: PocketWorldContext, material: THREE.Material, spec: RampSpec, parent: THREE.Object3D = ctx.root): THREE.Mesh {
  const depth = spec.depth ?? 0.6;
  const mesh = new THREE.Mesh(ctx.scope.track(slabGeometry(spec, spec.axis, spec.yAtMin, spec.yAtMax, depth)), material);
  mesh.receiveShadow = true;
  parent.add(mesh);
  ctx.collision.add({ kind: 'ramp', minX: spec.minX, maxX: spec.maxX, minZ: spec.minZ, maxZ: spec.maxZ, axis: spec.axis, yAtMin: spec.yAtMin, yAtMax: spec.yAtMax });
  if (spec.rails ?? true) {
    const lo = Math.min(spec.yAtMin, spec.yAtMax) - depth;
    const hi = Math.max(spec.yAtMin, spec.yAtMax) + (spec.railHeight ?? 1.1);
    const t = 0.3;
    if (spec.axis === 'x') {
      addWall(ctx, spec.minX, spec.maxX, lo, hi, spec.minZ - t, spec.minZ);
      addWall(ctx, spec.minX, spec.maxX, lo, hi, spec.maxZ, spec.maxZ + t);
    } else {
      addWall(ctx, spec.minX - t, spec.minX, lo, hi, spec.minZ, spec.maxZ);
      addWall(ctx, spec.maxX, spec.maxX + t, lo, hi, spec.minZ, spec.maxZ);
    }
  }
  return mesh;
}

export function addWall(ctx: PocketWorldContext, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void {
  ctx.collision.add({ kind: 'wall', minX, maxX, minY, maxY, minZ, maxZ });
}

/** An axis-aligned railing segment from (x0,z0) to (x1,z1) standing on height `y`. */
export function addRail(ctx: PocketWorldContext, x0: number, z0: number, x1: number, z1: number, y: number, height = 1.1, thickness = 0.3): void {
  const h = thickness / 2;
  addWall(ctx, Math.min(x0, x1) - h, Math.max(x0, x1) + h, y - 0.6, y + height, Math.min(z0, z1) - h, Math.max(z0, z1) + h);
}

export interface SkyColors {
  readonly zenith: THREE.ColorRepresentation;
  readonly horizon: THREE.ColorRepresentation;
  readonly nadir: THREE.ColorRepresentation;
  /** Exponent shaping how quickly the zenith colour gives way to horizon haze. */
  readonly falloff?: number;
}

/** A fog-free vertex-coloured dome; cheap, deterministic, and tier-independent. */
export function gradientSkyDome(ctx: PocketWorldContext, colors: SkyColors, radius = 420): THREE.Mesh {
  const geometry = ctx.scope.track(new THREE.SphereGeometry(radius, 32, 16));
  const zenith = new THREE.Color(colors.zenith);
  const horizon = new THREE.Color(colors.horizon);
  const nadir = new THREE.Color(colors.nadir);
  const pos = geometry.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const falloff = colors.falloff ?? 0.6;
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / radius;
    if (h >= 0) c.copy(horizon).lerp(zenith, Math.pow(h, falloff));
    else c.copy(horizon).lerp(nadir, Math.min(1, -h * 3));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const material = ctx.scope.track(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  const dome = new THREE.Mesh(geometry, material);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  ctx.root.add(dome);
  return dome;
}

export interface LightRig {
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
}

/** One hemisphere fill + one directional key. Shadows only where the tier allows. */
export function addLightRig(ctx: PocketWorldContext, opts: {
  sky: THREE.ColorRepresentation; ground: THREE.ColorRepresentation; hemiIntensity: number;
  sun: THREE.ColorRepresentation; sunIntensity: number; sunPosition: readonly [number, number, number];
}): LightRig {
  const hemi = new THREE.HemisphereLight(opts.sky, opts.ground, opts.hemiIntensity);
  const sun = new THREE.DirectionalLight(opts.sun, opts.sunIntensity);
  sun.position.set(...opts.sunPosition);
  sun.target.position.set(0, 0, 0);
  // No real-time shadow maps: the museum renderer updates shadow maps only on
  // demand (baked rooms), so a pocket light that casts would sample a never
  // rendered shadow texture and every receiving draw would fail.
  sun.castShadow = false;
  ctx.root.add(hemi, sun, sun.target);
  return { hemi, sun };
}

/** Count scaled by the quality tier's detail scale, never below `min`. */
export function tierCount(ctx: PocketWorldContext, high: number, min = 1): number {
  return Math.max(min, Math.round(high * Math.min(1, ctx.quality.detailScale)));
}

/** Axis-aligned rectangle containment helper for route triggers. */
export function inRect(r: Rect, x: number, z: number, pad = 0): boolean {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;
}

/** Smooth 0..1 ease used by authored transformations. */
export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Tint a geometry with per-vertex colours from a function of position. */
export function paintVertices(geometry: THREE.BufferGeometry, paint: (x: number, y: number, z: number, out: THREE.Color) => void): void {
  const pos = geometry.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    paint(pos.getX(i), pos.getY(i), pos.getZ(i), c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** Shared preview handle exposed on `window.__worldPreview[id]` in development previews. */
export interface PocketPreviewHandle {
  getSnapshot(): object;
}

/**
 * An exactly rotated wall segment (broad phase stays the min/max box). Local z
 * runs along world (sin yaw, cos yaw); a ring tangent at bearing `a` is yaw -a.
 */
export function orientedWall(cx: number, cz: number, halfX: number, halfZ: number, yaw: number, minY: number, maxY: number): Wall {
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const ex = c * halfX + s * halfZ, ez = s * halfX + c * halfZ;
  return {
    kind: 'wall', minX: cx - ex, maxX: cx + ex, minY, maxY, minZ: cz - ez, maxZ: cz + ez,
    oriented: { centerX: cx, centerZ: cz, halfX, halfZ, yaw },
  };
}

import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import type { Vec3 } from './layout';

/**
 * Shared construction primitives. Every helper builds the visible mesh and the
 * matching collider in one call, so geometry and collision cannot drift apart —
 * which is the failure mode that produces invisible walls and walk-through walls.
 */
export class GeometryKit {
  constructor(
    readonly scope: ResourceScope,
    readonly collision: CollisionWorld,
    readonly root: THREE.Object3D,
  ) {}

  private mesh(geo: THREE.BufferGeometry, mat?: THREE.Material, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(this.scope.track(geo), mat);
    m.castShadow = false;
    m.receiveShadow = true;
    (parent ?? this.root).add(m);
    return m;
  }

  /** Axis-aligned solid box: mesh + wall collider. */
  box(center: Vec3, half: Vec3, mat: THREE.Material, solid = true): THREE.Mesh {
    const m = this.mesh(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2), mat);
    m.position.set(center[0], center[1], center[2]);
    if (solid) this.collision.addBox(center, half);
    return m;
  }

  /** Decorative box with no collision — trim, signage frames, ornament. */
  prop(center: Vec3, half: Vec3, mat: THREE.Material, rotationY = 0): THREE.Mesh {
    const m = this.mesh(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2), mat);
    m.position.set(center[0], center[1], center[2]);
    m.rotation.y = rotationY;
    return m;
  }

  /** Horizontal slab: mesh + floor collider on its top face. */
  slab(minX: number, maxX: number, minZ: number, maxZ: number, topY: number, thickness: number, mat: THREE.Material): THREE.Mesh {
    const m = this.mesh(new THREE.BoxGeometry(maxX - minX, thickness, maxZ - minZ), mat);
    m.position.set((minX + maxX) / 2, topY - thickness / 2, (minZ + maxZ) / 2);
    this.collision.addFloor(minX, maxX, minZ, maxZ, topY);
    return m;
  }

  /** Ceiling slab: mesh plus a wall collider so the head query finds it. */
  ceiling(minX: number, maxX: number, minZ: number, maxZ: number, y: number, thickness: number, mat: THREE.Material): THREE.Mesh {
    const m = this.mesh(new THREE.BoxGeometry(maxX - minX, thickness, maxZ - minZ), mat);
    m.position.set((minX + maxX) / 2, y + thickness / 2, (minZ + maxZ) / 2);
    this.collision.addBox([(minX + maxX) / 2, y + thickness / 2, (minZ + maxZ) / 2], [(maxX - minX) / 2, thickness / 2, (maxZ - minZ) / 2]);
    return m;
  }

  /**
   * A wall running from `from` to `to`. The visual is a single rotated box; the
   * collision is a chain of axis-aligned boxes along the same line, which keeps
   * diagonal wings solid without a general convex-hull collider.
   */
  wall(from: Vec3, to: Vec3, baseY: number, height: number, thickness: number, mat: THREE.Material): THREE.Mesh {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) return this.prop(from, [0.01, 0.01, 0.01], mat);

    const m = this.mesh(new THREE.BoxGeometry(length, height, thickness));
    m.material = mat;
    m.position.set((from[0] + to[0]) / 2, baseY + height / 2, (from[2] + to[2]) / 2);
    m.rotation.y = Math.atan2(-dz, dx);

    this.wallCollision(from, to, baseY, height, thickness);
    return m;
  }

  /** Collision-only version of `wall`, for openings framed by separate visuals. */
  wallCollision(from: Vec3, to: Vec3, baseY: number, height: number, thickness: number): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) return;
    const axisAligned = Math.abs(dx) < 1e-6 || Math.abs(dz) < 1e-6;
    const segments = axisAligned ? 1 : Math.max(1, Math.ceil(length / 1.5));
    const halfT = thickness / 2;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const x0 = from[0] + dx * t0;
      const z0 = from[2] + dz * t0;
      const x1 = from[0] + dx * t1;
      const z1 = from[2] + dz * t1;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const hx = Math.abs(x1 - x0) / 2 + halfT;
      const hz = Math.abs(z1 - z0) / 2 + halfT;
      this.collision.addBox([cx, baseY + height / 2, cz], [hx, height / 2, hz]);
    }
  }

  /**
   * A wall with a rectangular opening centred on it: the two flanks plus the
   * lintel above. Used for every arch, doorway and bay opening in the museum.
   */
  wallWithOpening(
    from: Vec3,
    to: Vec3,
    baseY: number,
    height: number,
    thickness: number,
    openingWidth: number,
    openingHeight: number,
    mat: THREE.Material,
  ): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dz);
    if (openingWidth >= length) {
      if (openingHeight < height) {
        this.wall(from, to, baseY + openingHeight, height - openingHeight, thickness, mat);
      }
      return;
    }
    const ux = dx / length;
    const uz = dz / length;
    const flank = (length - openingWidth) / 2;

    const aEnd: Vec3 = [from[0] + ux * flank, 0, from[2] + uz * flank];
    const bStart: Vec3 = [to[0] - ux * flank, 0, to[2] - uz * flank];
    this.wall(from, aEnd, baseY, height, thickness, mat);
    this.wall(bStart, to, baseY, height, thickness, mat);

    if (openingHeight < height) {
      this.wall(aEnd, bStart, baseY + openingHeight, height - openingHeight, thickness, mat);
    }
  }

  /**
   * Floor along an arbitrary direction, emitted as overlapping axis-aligned
   * tiles so the support query works on diagonal wings and ramps.
   */
  orientedFloor(from: Vec3, to: Vec3, halfWidth: number, y: number, thickness: number, mat: THREE.Material): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dz);
    const m = this.mesh(new THREE.BoxGeometry(length, thickness, halfWidth * 2));
    m.material = mat;
    m.position.set((from[0] + to[0]) / 2, y - thickness / 2, (from[2] + to[2]) / 2);
    m.rotation.y = Math.atan2(-dz, dx);

    this.orientedFloorCollision(from, to, halfWidth, y);
  }

  orientedFloorCollision(from: Vec3, to: Vec3, halfWidth: number, y: number): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dz);
    const axisAligned = Math.abs(dx) < 1e-6 || Math.abs(dz) < 1e-6;
    if (axisAligned) {
      const px = Math.abs(dx) < 1e-6 ? halfWidth : 0;
      const pz = Math.abs(dz) < 1e-6 ? halfWidth : 0;
      this.collision.addFloor(
        Math.min(from[0], to[0]) - px, Math.max(from[0], to[0]) + px,
        Math.min(from[2], to[2]) - pz, Math.max(from[2], to[2]) + pz,
        y,
      );
      return;
    }
    const segments = Math.max(1, Math.ceil(length / 2));
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const x0 = from[0] + dx * t0;
      const z0 = from[2] + dz * t0;
      const x1 = from[0] + dx * t1;
      const z1 = from[2] + dz * t1;
      this.collision.addFloor(
        Math.min(x0, x1) - halfWidth, Math.max(x0, x1) + halfWidth,
        Math.min(z0, z1) - halfWidth, Math.max(z0, z1) + halfWidth,
        y,
      );
    }
  }

  /**
   * Visible stair with a ramp collider beneath it (plan §21). The steps are
   * decoration; the ramp is what the visitor actually walks on, so there is no
   * jump and no step-height tuning.
   */
  stair(
    from: Vec3,
    to: Vec3,
    fromY: number,
    toY: number,
    halfWidth: number,
    stepCount: number,
    mat: THREE.Material,
  ): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(-dz, dx);
    const rise = (toY - fromY) / stepCount;
    const run = length / stepCount;

    for (let i = 0; i < stepCount; i++) {
      const t = (i + 0.5) / stepCount;
      const y = fromY + rise * i + rise / 2;
      const step = this.mesh(new THREE.BoxGeometry(run * 1.02, Math.abs(rise) + 0.06, halfWidth * 2));
      step.material = mat;
      step.position.set(from[0] + dx * t, y, from[2] + dz * t);
      step.rotation.y = angle;
    }

    // Ramp collision along the dominant horizontal axis.
    const segments = Math.max(2, Math.ceil(length / 1.2));
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const x0 = from[0] + dx * t0;
      const z0 = from[2] + dz * t0;
      const x1 = from[0] + dx * t1;
      const z1 = from[2] + dz * t1;
      const useX = Math.abs(dx) >= Math.abs(dz);
      const y0 = fromY + (toY - fromY) * t0;
      const y1 = fromY + (toY - fromY) * t1;
      const minX = Math.min(x0, x1) - (useX ? 0 : halfWidth);
      const maxX = Math.max(x0, x1) + (useX ? 0 : halfWidth);
      const minZ = Math.min(z0, z1) - (useX ? halfWidth : 0);
      const maxZ = Math.max(z0, z1) + (useX ? halfWidth : 0);
      const ascendingAlongAxis = useX ? x1 >= x0 : z1 >= z0;
      this.collision.add({
        kind: 'ramp',
        minX, maxX, minZ, maxZ,
        axis: useX ? 'x' : 'z',
        yAtMin: ascendingAlongAxis ? y0 : y1,
        yAtMax: ascendingAlongAxis ? y1 : y0,
      });
    }
  }

  /** A smooth ramp with no visible steps — used for the Sanctuary descent. */
  ramp(from: Vec3, to: Vec3, fromY: number, toY: number, halfWidth: number, mat: THREE.Material): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dz);
    const slopeLength = Math.hypot(length, toY - fromY);
    const m = this.mesh(new THREE.BoxGeometry(slopeLength, 0.4, halfWidth * 2));
    m.material = mat;
    m.position.set((from[0] + to[0]) / 2, (fromY + toY) / 2 - 0.2, (from[2] + to[2]) / 2);
    m.rotation.order = 'YZX';
    m.rotation.y = Math.atan2(-dz, dx);
    m.rotation.z = Math.atan2(toY - fromY, length);

    const segments = Math.max(2, Math.ceil(length / 1.5));
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const x0 = from[0] + dx * t0;
      const z0 = from[2] + dz * t0;
      const x1 = from[0] + dx * t1;
      const z1 = from[2] + dz * t1;
      const useX = Math.abs(dx) >= Math.abs(dz);
      const y0 = fromY + (toY - fromY) * t0;
      const y1 = fromY + (toY - fromY) * t1;
      const pad = halfWidth;
      const ascending = useX ? x1 >= x0 : z1 >= z0;
      this.collision.add({
        kind: 'ramp',
        minX: Math.min(x0, x1) - pad, maxX: Math.max(x0, x1) + pad,
        minZ: Math.min(z0, z1) - pad, maxZ: Math.max(z0, z1) + pad,
        axis: useX ? 'x' : 'z',
        yAtMin: ascending ? y0 : y1,
        yAtMax: ascending ? y1 : y0,
      });
    }
  }
}

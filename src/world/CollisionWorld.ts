import type { Vec3 } from './layout';

/**
 * Simplified static collision. Plan §21: a capsule player against simplified
 * static geometry, with ramps under visible stairs. No physics engine.
 *
 * Three primitive kinds:
 *   - Wall:  axis-aligned box, blocks horizontally
 *   - Floor: horizontal rectangle at a height, supports from above
 *   - Ramp:  rectangle whose height varies linearly along one horizontal axis
 *
 * Everything is bucketed into a uniform XZ grid so a query touches only the
 * handful of primitives near the player rather than the whole museum.
 */

export interface Wall {
  readonly kind: 'wall';
  readonly minX: number; readonly maxX: number;
  readonly minY: number; readonly maxY: number;
  readonly minZ: number; readonly maxZ: number;
}

export interface Floor {
  readonly kind: 'floor';
  readonly minX: number; readonly maxX: number;
  readonly minZ: number; readonly maxZ: number;
  readonly y: number;
}

export interface Ramp {
  readonly kind: 'ramp';
  readonly minX: number; readonly maxX: number;
  readonly minZ: number; readonly maxZ: number;
  /** Which horizontal axis the height varies along. */
  readonly axis: 'x' | 'z';
  /** Height at the axis minimum and maximum. */
  readonly yAtMin: number;
  readonly yAtMax: number;
}

export type Collider = Wall | Floor | Ramp;

const CELL = 12;

export class CollisionWorld {
  private readonly colliders: Collider[] = [];
  private readonly grid = new Map<string, number[]>();

  static key(x: number, z: number): string {
    return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  }

  get size(): number {
    return this.colliders.length;
  }

  add(c: Collider): void {
    const index = this.colliders.length;
    this.colliders.push(c);
    for (let x = Math.floor(c.minX / CELL); x <= Math.floor(c.maxX / CELL); x++) {
      for (let z = Math.floor(c.minZ / CELL); z <= Math.floor(c.maxZ / CELL); z++) {
        const k = `${x},${z}`;
        let bucket = this.grid.get(k);
        if (!bucket) this.grid.set(k, (bucket = []));
        bucket.push(index);
      }
    }
  }

  addBox(center: Vec3, half: Vec3): void {
    this.add({
      kind: 'wall',
      minX: center[0] - half[0], maxX: center[0] + half[0],
      minY: center[1] - half[1], maxY: center[1] + half[1],
      minZ: center[2] - half[2], maxZ: center[2] + half[2],
    });
  }

  addFloor(minX: number, maxX: number, minZ: number, maxZ: number, y: number): void {
    this.add({ kind: 'floor', minX, maxX, minZ, maxZ, y });
  }

  clear(): void {
    this.colliders.length = 0;
    this.grid.clear();
  }

  /** Colliders whose cells overlap the square of `radius` around (x, z). */
  private near(x: number, z: number, radius: number): Collider[] {
    const out: Collider[] = [];
    const seen = new Set<number>();
    for (let cx = Math.floor((x - radius) / CELL); cx <= Math.floor((x + radius) / CELL); cx++) {
      for (let cz = Math.floor((z - radius) / CELL); cz <= Math.floor((z + radius) / CELL); cz++) {
        const bucket = this.grid.get(`${cx},${cz}`);
        if (!bucket) continue;
        for (const i of bucket) {
          if (seen.has(i)) continue;
          seen.add(i);
          out.push(this.colliders[i]);
        }
      }
    }
    return out;
  }

  /**
   * Highest supporting surface at (x, z) that is at or below `maxY`,
   * allowing a step-up of `stepUp` metres above the current feet height.
   * Returns null where the visitor would be standing over nothing.
   */
  supportHeight(x: number, z: number, feetY: number, stepUp = 0.55): number | null {
    let best: number | null = null;
    const ceiling = feetY + stepUp;
    for (const c of this.near(x, z, 0.6)) {
      if (c.kind === 'wall') continue;
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      const y = c.kind === 'floor' ? c.y : rampHeight(c, x, z);
      if (y > ceiling) continue;
      if (best === null || y > best) best = y;
    }
    return best;
  }

  /**
   * Push a vertical capsule out of any wall it overlaps. Resolves along the
   * shallowest axis, iterating so corners settle.
   */
  resolveHorizontal(
    pos: { x: number; y: number; z: number },
    radius: number,
    height: number,
    iterations = 4,
  ): boolean {
    let touched = false;
    const top = () => pos.y + height;
    for (let iter = 0; iter < iterations; iter++) {
      let moved = false;
      for (const c of this.near(pos.x, pos.z, radius + 1)) {
        if (c.kind !== 'wall') continue;
        if (top() <= c.minY || pos.y >= c.maxY) continue;

        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq > radius * radius) continue;

        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          // Centre is inside the box: escape along the shallowest face.
          const toMinX = pos.x - c.minX + radius;
          const toMaxX = c.maxX - pos.x + radius;
          const toMinZ = pos.z - c.minZ + radius;
          const toMaxZ = c.maxZ - pos.z + radius;
          const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
          if (m === toMinX) pos.x = c.minX - radius;
          else if (m === toMaxX) pos.x = c.maxX + radius;
          else if (m === toMinZ) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
        moved = true;
        touched = true;
      }
      if (!moved) break;
    }
    return touched;
  }

  /** Lowest ceiling above the visitor's head at (x, z), or Infinity. */
  ceilingHeight(x: number, z: number, headY: number): number {
    let best = Infinity;
    for (const c of this.near(x, z, 0.6)) {
      if (c.kind !== 'wall') continue;
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      if (c.minY >= headY && c.minY < best) best = c.minY;
    }
    return best;
  }
}

export function rampHeight(r: Ramp, x: number, z: number): number {
  const t =
    r.axis === 'x'
      ? (x - r.minX) / Math.max(1e-6, r.maxX - r.minX)
      : (z - r.minZ) / Math.max(1e-6, r.maxZ - r.minZ);
  const clamped = Math.max(0, Math.min(1, t));
  return r.yAtMin + (r.yAtMax - r.yAtMin) * clamped;
}

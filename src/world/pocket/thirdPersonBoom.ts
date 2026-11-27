import * as THREE from 'three';

/** Boom geometry of W10's third-person camera (unchanged from the original fixed rig). */
export const BOOM_BACK = 5;
export const BOOM_UP = 3.3;
/** The boom pivots above the character, clear of its body. */
export const BOOM_PIVOT_UP = 1.2;
/** Keep the lens this far in front of whatever it would otherwise sit inside. */
export const BOOM_CLEARANCE = 0.35;
/** Never pull the camera closer than this to the pivot. */
export const BOOM_MIN = 1.1;
/** When the obstruction clears, the camera eases back out at this speed (m/s). */
export const BOOM_RETURN_SPEED = 6;

/**
 * Third-person camera boom that stays in front of walls and terrain. A ray
 * from just above the character toward the ideal camera position finds the
 * nearest opaque, visible surface of the world; the camera stops in front of
 * it at once and eases back out once the view clears, so cliffs never fill the
 * screen. No allocation per frame.
 */
export class ThirdPersonBoom {
  private readonly ray = new THREE.Raycaster();
  private readonly hits: THREE.Intersection[] = [];
  private readonly pivot = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private length = Math.hypot(BOOM_BACK, BOOM_UP - BOOM_PIVOT_UP);

  /** The boom length used for the last placement (diagnostic). */
  get currentLength(): number { return this.length; }

  reset(): void { this.length = Math.hypot(BOOM_BACK, BOOM_UP - BOOM_PIVOT_UP); }

  /**
   * Place `camera` behind `target` facing `yaw`, pulled in front of anything
   * in `world`. `dt` (seconds) paces the ease back out.
   */
  place(camera: THREE.Camera, target: THREE.Vector3, yaw: number, world: THREE.Object3D | null, dt: number): void {
    this.pivot.set(target.x, target.y + BOOM_PIVOT_UP, target.z);
    this.dir.set(Math.sin(yaw) * BOOM_BACK, BOOM_UP - BOOM_PIVOT_UP, Math.cos(yaw) * BOOM_BACK);
    const ideal = this.dir.length();
    this.dir.divideScalar(ideal);
    let clear = ideal;
    if (world) {
      this.ray.set(this.pivot, this.dir);
      this.ray.near = 0;
      this.ray.far = ideal + BOOM_CLEARANCE;
      this.hits.length = 0;
      this.ray.intersectObject(world, true, this.hits);
      for (const hit of this.hits) {
        if (!blocksView(hit.object)) continue;
        clear = Math.max(BOOM_MIN, Math.min(ideal, hit.distance - BOOM_CLEARANCE));
        break;
      }
      this.hits.length = 0;
    }
    const easeOut = Number.isFinite(dt) && dt > 0 ? dt * BOOM_RETURN_SPEED : ideal;
    this.length = clear < this.length ? clear : Math.min(clear, this.length + easeOut);
    camera.position.copy(this.pivot).addScaledVector(this.dir, this.length);
  }
}

/** Visible, opaque surfaces block the view; wind ribbons, glows and hidden props do not. */
function blocksView(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
  if (!material) return false;
  const first = Array.isArray(material) ? material[0] : material;
  return Boolean(first) && !first.transparent && first.visible;
}

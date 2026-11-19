import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import { ENTRANCE_DOOR, type Vec3 } from './layout';
import { guideDestination, isGuideTarget, MUSEUM_ENTRANCE_TARGET, planVisitorRoute, type GuideWorld } from './visitorRoute';

export { MUSEUM_ENTRANCE_TARGET } from './visitorRoute';

/** One walking destination persists across the exterior-to-interior handoff. */
export class Wayfinding {
  readonly group = new THREE.Group();
  private readonly markers: THREE.Mesh[] = [];
  private target: string | null = null;
  private world: GuideWorld | null = null;
  private route: Vec3[] = [];
  private origin: Vec3 | null = null;
  private phase = 0;

  private static readonly MARKER_COUNT = 7;

  constructor(scope: ResourceScope) {
    this.group.name = 'wayfinding';
    this.group.visible = false;

    const geometry = scope.track(new THREE.PlaneGeometry(0.5, 0.9));
    for (let i = 0; i < Wayfinding.MARKER_COUNT; i++) {
      const material = scope.track(new THREE.MeshBasicMaterial({
        color: 0xe8c65a, transparent: true, opacity: 0.5, depthWrite: false,
      }));
      const marker = new THREE.Mesh(geometry, material);
      marker.rotation.x = -Math.PI / 2;
      this.group.add(marker);
      this.markers.push(marker);
    }
  }

  get currentTarget(): string | null {
    return this.target;
  }

  setTarget(id: string | null): void {
    const next = id && isGuideTarget(id) ? id : null;
    if (next === this.target) return;
    this.target = next;
    this.route = [];
    this.origin = null;
    this.group.visible = false;
  }

  update(dt: number, from: Vec3, reducedMotion: boolean, world?: GuideWorld, collision?: CollisionWorld): void {
    this.updateXYZ(dt, from[0], from[1], from[2], reducedMotion, world, collision);
  }

  updateXYZ(
    dt: number, x: number, y: number, z: number, reducedMotion: boolean,
    world: GuideWorld = z > ENTRANCE_DOOR[2] ? 'exterior' : 'interior',
    collision?: CollisionWorld,
  ): void {
    if (!this.target) return;
    const destination = guideDestination(world, this.target)!;
    const isFinal = world === 'interior' || this.target === MUSEUM_ENTRANCE_TARGET;
    const arrivalRadius = this.target === MUSEUM_ENTRANCE_TARGET ? 1.6 : 2.6;
    if (isFinal && Math.abs(y - destination[1]) < 1.25
      && Math.hypot(x - destination[0], z - destination[2]) < arrivalRadius) {
      this.setTarget(null);
      return;
    }

    // Replan when crossing the world seam or departing the last sample.
    // Static frames only reposition existing markers, with no graph allocation.
    const origin = this.origin;
    if (world !== this.world || !origin || Math.hypot(x - origin[0], y - origin[1], z - origin[2]) >= 1.1) {
      this.origin = [x, y, z];
      this.route = planVisitorRoute(world, this.origin, this.target, collision);
      this.world = world;
    }
    this.group.visible = this.route.length >= 2;
    if (!this.group.visible) return;

    if (!reducedMotion) this.phase = (this.phase + dt * 0.55) % 1;
    for (let i = 0; i < this.markers.length; i++) {
      const phase = (i / this.markers.length + this.phase) % 1;
      let along = 1.1 + phase * 7.5;
      const marker = this.markers[i];
      marker.visible = false;

      for (let j = 1; j < this.route.length; j++) {
        const a = this.route[j - 1], b = this.route[j];
        const dx = b[0] - a[0], dz = b[2] - a[2];
        const step = Math.hypot(dx, dz);
        if (step < 0.01) continue;
        if (along > step) {
          along -= step;
          continue;
        }
        const t = along / step;
        marker.position.set(a[0] + dx * t, a[1] + (b[1] - a[1]) * t + 0.06, a[2] + dz * t);
        marker.rotation.z = -Math.atan2(dx, dz);
        marker.visible = true;
        (marker.material as THREE.MeshBasicMaterial).opacity = 0.17 + Math.sin(phase * Math.PI) * 0.39;
        break;
      }
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.markers.length = 0;
    this.route = [];
  }
}

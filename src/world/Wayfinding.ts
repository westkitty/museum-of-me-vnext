import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { PLACEMENT_BY_EXHIBIT, WING_BY_ID, faceDirection, place, ROTUNDA_APOTHEM, type Vec3 } from './layout';
import { EXHIBITS_BY_ID } from '../content/collection.generated';

/**
 * Restrained spatial wayfinding (plan §8, "Guided visitor").
 *
 * When a visitor picks an exhibit from the map, a low line of light appears on
 * the floor ahead of them pointing the way — and nothing else. There is no
 * arrow in the sky, no minimap, and no teleport. It is a cue, not a rail, and
 * it disappears when they arrive.
 */
export class Wayfinding {
  readonly group = new THREE.Group();
  private readonly markers: THREE.Mesh[] = [];
  private target: string | null = null;
  private targetDoorway: Vec3 | null = null;
  private targetThreshold: Vec3 | null = null;
  private targetDirection: Vec3 | null = null;
  private phase = 0;

  private static readonly MARKER_COUNT = 7;

  constructor(scope: ResourceScope) {
    this.group.name = 'wayfinding';
    this.group.visible = false;

    const geometry = scope.track(new THREE.PlaneGeometry(0.5, 0.9));
    const material = scope.track(
      new THREE.MeshBasicMaterial({
        color: 0xe8c65a,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    for (let i = 0; i < Wayfinding.MARKER_COUNT; i++) {
      const marker = new THREE.Mesh(geometry, material.clone());
      scope.track(marker.material as THREE.Material);
      marker.rotation.x = -Math.PI / 2;
      this.group.add(marker);
      this.markers.push(marker);
    }
  }

  get currentTarget(): string | null {
    return this.target;
  }

  setTarget(exhibitId: string | null): void {
    if (!exhibitId) {
      this.target = null;
      this.targetDoorway = null;
      this.targetThreshold = null;
      this.targetDirection = null;
      this.group.visible = false;
      return;
    }

    const placement = PLACEMENT_BY_EXHIBIT.get(exhibitId);
    const record = EXHIBITS_BY_ID.get(exhibitId);
    const wing = record ? WING_BY_ID.get(record.wing) : undefined;
    if (!placement || !wing) {
      this.target = null;
      this.targetDoorway = null;
      this.targetThreshold = null;
      this.targetDirection = null;
      this.group.visible = false;
      return;
    }

    const direction = faceDirection(wing.face);
    this.target = exhibitId;
    this.targetDoorway = placement.doorway;
    this.targetDirection = direction;
    this.targetThreshold = place(direction, ROTUNDA_APOTHEM + 4, 0, wing.floorY);
    this.group.visible = true;
  }

  /** Compatibility wrapper for callers/tests that already own a tuple. */
  update(dt: number, from: Vec3, reducedMotion: boolean): void {
    this.updateXYZ(dt, from[0], from[1], from[2], reducedMotion);
  }

  /** Called once per frame from the single loop without allocating a Vec3 tuple. */
  updateXYZ(dt: number, x: number, y: number, z: number, reducedMotion: boolean): void {
    if (!this.target || !this.targetDoorway || !this.targetThreshold || !this.targetDirection) return;

    const along = x * this.targetDirection[0] + z * this.targetDirection[2];
    const to = along < ROTUNDA_APOTHEM + 2 ? this.targetThreshold : this.targetDoorway;
    const dx = to[0] - x;
    const dz = to[2] - z;
    const distanceSq = dx * dx + dz * dz;

    // Arrived: the cue takes itself away rather than nagging. Check squared
    // distance first so the common arrival decision avoids a square root.
    if (distanceSq < 3.5 * 3.5) {
      this.setTarget(null);
      return;
    }

    const distance = Math.sqrt(distanceSq);
    const invDistance = 1 / distance;
    const ux = dx * invDistance;
    const uz = dz * invDistance;
    const angle = Math.atan2(ux, uz);
    if (!reducedMotion) this.phase = (this.phase + dt * 0.55) % 1;

    const span = Math.min(distance - 1.2, 7.5);
    for (let i = 0; i < this.markers.length; i++) {
      const t = ((i / this.markers.length + this.phase) % 1) * span + 1.2;
      const marker = this.markers[i];
      marker.position.set(x + ux * t, y + 0.06, z + uz * t);
      marker.rotation.z = -angle;
      // Fade in at the near end and out at the far end so it reads as a flow.
      const fade = Math.sin((t / span) * Math.PI);
      (marker.material as THREE.MeshBasicMaterial).opacity = 0.12 + fade * 0.4;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.markers.length = 0;
    this.targetDoorway = null;
    this.targetThreshold = null;
    this.targetDirection = null;
  }
}

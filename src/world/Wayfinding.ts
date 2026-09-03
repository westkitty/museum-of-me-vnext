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
    this.target = exhibitId;
    this.group.visible = exhibitId !== null;
  }

  /**
   * The route: toward the exhibit's wing threshold if the visitor is not in
   * that wing yet, then straight down the hall to the bay doorway.
   */
  private waypointFor(from: Vec3): Vec3 | null {
    if (!this.target) return null;
    const placement = PLACEMENT_BY_EXHIBIT.get(this.target);
    const record = EXHIBITS_BY_ID.get(this.target);
    if (!placement || !record) return null;

    const wing = WING_BY_ID.get(record.wing)!;
    const dir = faceDirection(wing.face);
    const along = from[0] * dir[0] + from[2] * dir[2];

    // Not yet past the rotunda wall on this wing's axis: aim at the threshold.
    if (along < ROTUNDA_APOTHEM + 2) return place(dir, ROTUNDA_APOTHEM + 4, 0, wing.floorY);
    return placement.doorway;
  }

  /** Called once per frame from the single loop. */
  update(dt: number, from: Vec3, reducedMotion: boolean): void {
    if (!this.target) return;
    const to = this.waypointFor(from);
    if (!to) {
      this.group.visible = false;
      return;
    }

    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const distance = Math.hypot(dx, dz);

    // Arrived: the cue takes itself away rather than nagging.
    if (distance < 3.5) {
      this.setTarget(null);
      return;
    }

    const ux = dx / distance;
    const uz = dz / distance;
    const angle = Math.atan2(ux, uz);
    if (!reducedMotion) this.phase = (this.phase + dt * 0.55) % 1;

    const span = Math.min(distance - 1.2, 7.5);
    for (let i = 0; i < this.markers.length; i++) {
      const t = ((i / this.markers.length + this.phase) % 1) * span + 1.2;
      const marker = this.markers[i];
      marker.position.set(from[0] + ux * t, from[1] + 0.06, from[2] + uz * t);
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
  }
}

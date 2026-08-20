import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import {
  BALCONY_INNER_APOTHEM, GROUND_Y, LEVEL_1_Y, ROTUNDA_APOTHEM,
  WINGS, faceDirection, place, type Vec3, type WingSpec,
} from './layout';
import { PaletteSet } from './palette';

/**
 * Palette-derived floor wayfinding for the bright neutral hub.
 *
 * The Rotunda remains visually white at its centre. Colour enters only as thin
 * route threads toward each threshold, so visitors can read the six museum
 * areas at a glance without turning the hub itself into another themed room.
 */
export class RotundaWayfinding {
  readonly group = new THREE.Group();
  private readonly palettes: PaletteSet;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'rotunda-wayfinding';
    this.palettes = new PaletteSet(scope);
  }

  build(): THREE.Group {
    for (const wing of WINGS) this.buildRoute(wing);
    return this.group;
  }

  private buildRoute(wing: WingSpec): void {
    const d = faceDirection(wing.face);
    const palette = this.palettes.get(wing.id);
    const angle = Math.atan2(d[0], d[2]);
    const upper = wing.level === 1;
    const y = (upper ? LEVEL_1_Y : GROUND_Y) + 0.055;
    const fromRadius = upper ? BALCONY_INNER_APOTHEM + 1.0 : 5.2;
    const toRadius = upper ? ROTUNDA_APOTHEM + 1.2 : ROTUNDA_APOTHEM + 1.35;
    const midRadius = (fromRadius + toRadius) / 2;
    const length = toRadius - fromRadius;
    const mid = place(d, midRadius, 0, y);

    const thread = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(0.28, 0.035, length)),
      palette.trim,
    );
    thread.name = `rotunda-route-thread:${wing.id}`;
    thread.position.set(mid[0], mid[1], mid[2]);
    thread.rotation.y = angle;
    thread.receiveShadow = true;
    this.group.add(thread);

    // The end medallion acts as a small punctuation mark just before the wing
    // threshold; it never occupies enough height to become a collision object.
    const end = place(d, toRadius - 0.45, 0, y + 0.015);
    const medallion = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(0.72, 0.72, 0.045, 24)),
      palette.accent,
    );
    medallion.name = `rotunda-zone-medallion:${wing.id}`;
    medallion.position.set(end[0], end[1], end[2]);
    medallion.receiveShadow = true;
    this.group.add(medallion);

    // A paired tick near the outer end makes the direction readable even when
    // the thread itself is seen at a shallow angle.
    for (const side of [-1, 1]) {
      const tickAt: Vec3 = place(d, toRadius - 1.25, side * 0.56, y + 0.03);
      const tick = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(0.16, 0.045, 0.72)),
        side < 0 ? palette.trim : palette.accent,
      );
      tick.name = `rotunda-route-tick:${wing.id}`;
      tick.position.set(tickAt[0], tickAt[1], tickAt[2]);
      tick.rotation.y = angle;
      this.group.add(tick);
    }
  }
}

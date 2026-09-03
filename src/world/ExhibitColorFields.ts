import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { PLACEMENTS, WING_BY_ID, type ExhibitPlacement } from './layout';
import { resolveExhibitTheme } from './ExhibitTheme';

/**
 * Small persistent colour fields inside all 35 exhibit bays.
 *
 * Threshold accents already tell visitors which exhibit they are entering. This
 * layer carries that language behind the hero object itself: a low floor field
 * and a real bay-back wall surface derived from the exhibit's existing project
 * metadata. It never alters an exhibit's hero object or collision footprint.
 */
export class ExhibitColorFields {
  readonly group = new THREE.Group();

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'exhibit-color-fields';
  }

  build(): THREE.Group {
    for (const placement of PLACEMENTS) this.buildField(placement);
    return this.group;
  }

  private buildField(placement: ExhibitPlacement): void {
    const wing = WING_BY_ID.get(placement.wing)!;
    const theme = resolveExhibitTheme(placement.exhibitId, placement.wing);
    const primary = this.material(theme.floor, 0.66, 0.08, 0.74);
    const wall = this.material(theme.wall, 0.78, 0.02, 0.9);
    const trim = this.material(theme.trim, 0.5, 0.16, 0.88);

    const field = new THREE.Group();
    field.name = `exhibit-color-field:${placement.exhibitId}`;
    field.userData.theme = theme.id;
    field.userData.themeSource = theme.source;
    this.group.add(field);

    const floor = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(2.35, 2.35, 0.035, 28)),
      primary,
    );
    floor.name = `exhibit-floor-field:${placement.exhibitId}`;
    floor.position.set(placement.anchor[0], wing.floorY + 0.035, placement.anchor[2]);
    floor.receiveShadow = true;
    field.add(floor);

    // The hall direction is perpendicular to the wing-facing hero orientation.
    // It locates this colour surface against the actual closed back wall, not
    // as a floating rectangle behind an installation.
    const towardHallX = placement.doorway[0] - placement.anchor[0];
    const towardHallZ = placement.doorway[2] - placement.anchor[2];
    const towardHallLength = Math.hypot(towardHallX, towardHallZ);
    const hallNormalX = towardHallX / towardHallLength;
    const hallNormalZ = towardHallZ / towardHallLength;
    const backDistance = wing.bayDepth / 2 - 0.12;
    const bx = placement.anchor[0] - hallNormalX * backDistance;
    const bz = placement.anchor[2] - hallNormalZ * backDistance;
    const width = wing.bayHalfAlong * 2 - 0.28;
    const height = wing.bayHeight - 0.5;
    const angle = Math.atan2(hallNormalX, hallNormalZ);

    const backdrop = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(width, height, 0.09)),
      wall,
    );
    backdrop.name = `exhibit-theme-wall:${placement.exhibitId}`;
    backdrop.position.set(bx, wing.floorY + height / 2 + 0.18, bz);
    backdrop.rotation.y = angle;
    backdrop.receiveShadow = true;
    field.add(backdrop);

    // The architectural frame makes the field read as a wall finish while the
    // hero object remains visually and lifecycle-independent.
    const rail = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(width + 0.28, 0.12, 0.13)),
      trim,
    );
    rail.name = `exhibit-theme-wall-header:${placement.exhibitId}`;
    rail.position.set(bx, wing.floorY + height + 0.22, bz);
    rail.rotation.y = angle;
    field.add(rail);

    for (const side of [-1, 1] as const) {
      const upright = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(0.13, height + 0.15, 0.13)),
        trim,
      );
      upright.name = `exhibit-theme-wall-upright:${placement.exhibitId}`;
      upright.position.set(
        bx + Math.cos(angle) * (width / 2 + 0.02) * side,
        wing.floorY + height / 2 + 0.18,
        bz - Math.sin(angle) * (width / 2 + 0.02) * side,
      );
      upright.rotation.y = angle;
      field.add(upright);
    }
  }

  private material(color: number, roughness: number, metalness: number, opacity: number): THREE.MeshStandardMaterial {
    return this.scope.track(new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      transparent: true,
      opacity,
      depthWrite: true,
    }));
  }
}

import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { PLACEMENTS, WING_BY_ID, type ExhibitPlacement } from './layout';
import { resolveExhibitTheme } from './ExhibitTheme';
import { architecturalStoneFinish } from './SurfaceFinish';

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
  private readonly reliefs: { matrix: THREE.Matrix4; color: THREE.Color }[] = [];

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'exhibit-color-fields';
  }

  build(): THREE.Group {
    for (const placement of PLACEMENTS) this.buildField(placement);
    this.buildReliefAccents();
    return this.group;
  }

  private buildField(placement: ExhibitPlacement): void {
    const wing = WING_BY_ID.get(placement.wing)!;
    const theme = resolveExhibitTheme(placement.exhibitId, placement.wing);
    const primary = this.material(theme.floor, 0.66, 0.08, 0.74, true);
    const wall = this.material(theme.wall, 0.78, 0.02, 0.9, true);
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

    // Art-directed, inset brass/colour witness marks are instanced across all
    // 35 bays in one material/draw. They frame the story without replacing or
    // attaching to any streamed hero exhibit.
    const pose = new THREE.Object3D();
    const color = new THREE.Color(theme.trim);
    for (const side of [-1, 1] as const) {
      const lateral = side * width * 0.37;
      for (const [localX, localY, scaleX, scaleY] of [
        [lateral, height * 0.71, 0.042, 1.18],
        [lateral - side * 0.38, height * 0.71 + 0.6, 0.76, 0.042],
      ]) {
        pose.position.set(
          bx + Math.cos(angle) * localX + hallNormalX * 0.12,
          wing.floorY + localY + 0.18,
          bz - Math.sin(angle) * localX + hallNormalZ * 0.12,
        );
        pose.rotation.set(0, angle, 0);
        pose.scale.set(scaleX, scaleY, 0.045);
        pose.updateMatrix();
        this.reliefs.push({ matrix: pose.matrix.clone(), color });
      }
    }

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

  private buildReliefAccents(): void {
    // One batched draw, no per-frame animation, no emissive scene lights.
    const geom = this.scope.track(new THREE.BoxGeometry(1, 1, 1));
    const metal = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.48,
      depthWrite: false, toneMapped: false,
    }));
    const relief = this.scope.track(new THREE.InstancedMesh(geom, metal, this.reliefs.length));
    relief.name = 'gallery-relief-accents';
    relief.renderOrder = 2;
    for (let i = 0; i < this.reliefs.length; i++) {
      relief.setMatrixAt(i, this.reliefs[i].matrix);
      relief.setColorAt(i, this.reliefs[i].color);
    }
    relief.instanceMatrix.needsUpdate = true;
    relief.computeBoundingSphere();
    this.group.add(relief);
  }

  private material(color: number, roughness: number, metalness: number, opacity: number, mineral = false): THREE.MeshStandardMaterial {
    const finish = mineral ? architecturalStoneFinish(this.scope) : null;
    return this.scope.track(new THREE.MeshStandardMaterial({
      color, roughness, metalness, transparent: true, opacity, depthWrite: true,
      ...(finish ? { map: finish, roughnessMap: finish } : {}),
    }));
  }
}
